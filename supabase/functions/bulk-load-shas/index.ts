import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MASECHTOT_MAP, MASECHTOT_LIST } from "../_shared/masechtotData.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 15; // dafim per call (each daf = 2 amudim = 2 API calls)
const DELAY_MS = 350; // delay between Sefaria API calls

const toHebrewNumeral = (num: number): string => {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;
  let result = hundreds[h] + tens[t] + ones[o];
  if (result.length > 1) return result.slice(0, -1) + '״' + result.slice(-1);
  return result + '׳';
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { masechet, startDaf, mode } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mode: "status" — return download status for all masechtot
    if (mode === 'status') {
      const { data: counts } = await supabaseClient
        .from('gemara_pages')
        .select('masechet, text_he');

      const statusMap: Record<string, { total: number; withText: number }> = {};
      for (const row of (counts || [])) {
        if (!statusMap[row.masechet]) statusMap[row.masechet] = { total: 0, withText: 0 };
        statusMap[row.masechet].total++;
        if (row.text_he) statusMap[row.masechet].withText++;
      }

      return new Response(
        JSON.stringify({ success: true, status: statusMap }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find masechet info
    const masechetInfo = MASECHTOT_LIST.find(
      (m: any) => m.sefariaName === masechet || m.hebrewName === masechet
    );
    if (!masechetInfo) {
      return new Response(
        JSON.stringify({ error: `מסכת לא נמצאה: ${masechet}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sefariaName = masechetInfo.sefariaName;
    const hebrewName = masechetInfo.hebrewName;
    const maxDaf = masechetInfo.maxDaf;
    const fromDaf = startDaf || 2; // Talmud starts from daf 2
    const toDaf = Math.min(fromDaf + BATCH_SIZE - 1, maxDaf);

    console.log(`Bulk loading ${hebrewName}: dafim ${fromDaf}-${toDaf} of ${maxDaf}`);

    let loaded = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (let daf = fromDaf; daf <= toDaf; daf++) {
      for (const amud of ['a', 'b'] as const) {
        const sugyaId = `${sefariaName.toLowerCase()}_${daf}${amud}`;
        const sefariaRef = `${sefariaName}.${daf}${amud}`;
        const amudLabel = amud === 'a' ? 'ע״א' : 'ע״ב';
        const dafYomi = `${hebrewName} ${toHebrewNumeral(daf)} ${amudLabel}`;
        const title = dafYomi;

        // Check if already has text
        const { data: existing } = await supabaseClient
          .from('gemara_pages')
          .select('id, text_he')
          .eq('sugya_id', sugyaId)
          .maybeSingle();

        if (existing?.text_he) {
          skipped++;
          continue;
        }

        // Fetch from Sefaria
        try {
          await sleep(DELAY_MS);
          const resp = await fetch(
            `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=0&context=1`
          );

          if (!resp.ok) {
            errors.push(`${sefariaRef}: HTTP ${resp.status}`);
            continue;
          }

          const data = await resp.json();
          if (!data.he || data.he.length === 0) {
            errors.push(`${sefariaRef}: אין טקסט`);
            continue;
          }

          const row = {
            daf_number: daf,
            sugya_id: sugyaId,
            title,
            daf_yomi: dafYomi,
            sefaria_ref: sefariaRef,
            masechet: sefariaName,
            text_he: data.he,
            text_en: data.text || null,
            he_ref: data.heRef || null,
            book: data.book || null,
            categories: data.categories || null,
            section_ref: data.sectionRef || null,
          };

          if (existing) {
            // Update existing row with text
            await supabaseClient
              .from('gemara_pages')
              .update({
                text_he: data.he,
                text_en: data.text || null,
                he_ref: data.heRef || null,
                book: data.book || null,
                categories: data.categories || null,
                section_ref: data.sectionRef || null,
              })
              .eq('id', existing.id);
          } else {
            // Insert new row
            await supabaseClient
              .from('gemara_pages')
              .insert(row);
          }

          loaded++;
        } catch (e) {
          errors.push(`${sefariaRef}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    const hasMore = toDaf < maxDaf;
    const nextDaf = hasMore ? toDaf + 1 : null;

    console.log(`Done batch: loaded=${loaded}, skipped=${skipped}, errors=${errors.length}, hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        masechet: sefariaName,
        hebrewName,
        loaded,
        skipped,
        errors,
        fromDaf,
        toDaf,
        maxDaf,
        hasMore,
        nextDaf,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('bulk-load-shas error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
