import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MASECHTOT_LIST } from "../_shared/masechtotData.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 15;
const DELAY_MS = 300;

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
    const body = await req.json();
    const { masechet, startDaf, mode } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ─── STATUS MODE ───
    if (mode === 'status') {
      const statusMap: Record<string, { total: number; withText: number }> = {};
      const PAGE = 1000;
      let offset = 0;
      let fetchMore = true;
      while (fetchMore) {
        const { data: rows } = await supabaseClient
          .from('gemara_pages')
          .select('masechet, text_he')
          .range(offset, offset + PAGE - 1);
        if (!rows || rows.length === 0) break;
        for (const row of rows) {
          if (!statusMap[row.masechet]) statusMap[row.masechet] = { total: 0, withText: 0 };
          statusMap[row.masechet].total++;
          if (row.text_he) statusMap[row.masechet].withText++;
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
      }

      // Also fetch download progress
      const { data: progress } = await supabaseClient
        .from('shas_download_progress')
        .select('*');

      return new Response(
        JSON.stringify({ success: true, status: statusMap, progress: progress || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── INIT MODE — initialize all masechet rows for tracking ───
    if (mode === 'init') {
      for (const m of MASECHTOT_LIST) {
        const totalPages = (m.maxDaf - 1) * 2;
        await supabaseClient
          .from('shas_download_progress')
          .upsert({
            masechet: m.sefariaName,
            hebrew_name: m.hebrewName,
            max_daf: m.maxDaf,
            total_pages: totalPages,
            current_daf: 2,
            loaded_pages: 0,
            status: 'pending',
            errors: [],
          }, { onConflict: 'masechet' });
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Initialized all masechtot' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── DOWNLOAD BATCH ───
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
    const fromDaf = startDaf || 2;
    const toDaf = Math.min(fromDaf + BATCH_SIZE - 1, maxDaf);

    // Update progress to "downloading"
    await supabaseClient
      .from('shas_download_progress')
      .upsert({
        masechet: sefariaName,
        hebrew_name: hebrewName,
        max_daf: maxDaf,
        total_pages: (maxDaf - 1) * 2,
        current_daf: fromDaf,
        status: 'downloading',
        started_at: fromDaf === 2 ? new Date().toISOString() : undefined,
      }, { onConflict: 'masechet' });

    let loaded = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (let daf = fromDaf; daf <= toDaf; daf++) {
      for (const amud of ['a', 'b'] as const) {
        const sugyaId = `${sefariaName.toLowerCase()}_${daf}${amud}`;
        const sefariaRef = `${sefariaName}.${daf}${amud}`;
        const amudLabel = amud === 'a' ? 'ע״א' : 'ע״ב';
        const dafYomi = `${hebrewName} ${toHebrewNumeral(daf)} ${amudLabel}`;

        // Check if already has text
        const { data: existing } = await supabaseClient
          .from('gemara_pages')
          .select('id, text_he')
          .eq('sugya_id', sugyaId)
          .maybeSingle();

        if (existing?.text_he) { skipped++; continue; }

        try {
          await sleep(DELAY_MS);
          const resp = await fetch(
            `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=0&context=1`
          );
          if (!resp.ok) { errors.push(`${sefariaRef}: HTTP ${resp.status}`); continue; }

          const data = await resp.json();
          if (!data.he || data.he.length === 0) { errors.push(`${sefariaRef}: אין טקסט`); continue; }

          const row = {
            daf_number: daf,
            sugya_id: sugyaId,
            title: dafYomi,
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
            await supabaseClient.from('gemara_pages').update({
              text_he: data.he, text_en: data.text || null,
              he_ref: data.heRef || null, book: data.book || null,
              categories: data.categories || null, section_ref: data.sectionRef || null,
            }).eq('id', existing.id);
          } else {
            await supabaseClient.from('gemara_pages').insert(row);
          }
          loaded++;
        } catch (e) {
          errors.push(`${sefariaRef}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Update progress after each daf
      const { data: currentProgress } = await supabaseClient
        .from('shas_download_progress')
        .select('loaded_pages, errors')
        .eq('masechet', sefariaName)
        .maybeSingle();

      const prevLoaded = currentProgress?.loaded_pages || 0;
      const prevErrors = (currentProgress?.errors as string[]) || [];

      await supabaseClient
        .from('shas_download_progress')
        .update({
          current_daf: daf + 1,
          loaded_pages: prevLoaded + loaded,
          errors: [...prevErrors, ...errors].slice(-50), // keep last 50
        })
        .eq('masechet', sefariaName);
      
      // Reset for next daf iteration count
      loaded = 0;
      skipped = 0;
      errors = [];
    }

    const hasMore = toDaf < maxDaf;
    const nextDaf = hasMore ? toDaf + 1 : null;

    // Update final status for this batch
    if (!hasMore) {
      await supabaseClient
        .from('shas_download_progress')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_daf: maxDaf,
        })
        .eq('masechet', sefariaName);
    }

    return new Response(
      JSON.stringify({
        success: true,
        masechet: sefariaName,
        hebrewName,
        fromDaf, toDaf, maxDaf,
        hasMore, nextDaf,
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
