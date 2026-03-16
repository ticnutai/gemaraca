import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MASECHTOT_LIST } from "../_shared/masechtotData.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── TUNING ───
const BATCH_SIZE = 20;          // dafim per call (was 15)
const PARALLEL_FETCHES = 5;     // concurrent Sefaria requests (was 1 = sequential!)
const DELAY_BETWEEN_GROUPS = 150; // ms between parallel groups (was 300 per page)
const FETCH_TIMEOUT_MS = 12000;

// Shekalim Yerushalmi mapping
const SHEKALIM_DAF_MAP: Record<string, string> = {};
const _buildShekalimMap = () => {
  const chapters = [
    { ch: 1, fromDaf: 2, fromAmud: 'a', toDaf: 5, toAmud: 'a' },
    { ch: 2, fromDaf: 5, fromAmud: 'a', toDaf: 7, toAmud: 'a' },
    { ch: 3, fromDaf: 7, fromAmud: 'a', toDaf: 9, toAmud: 'b' },
    { ch: 4, fromDaf: 9, fromAmud: 'b', toDaf: 12, toAmud: 'a' },
    { ch: 5, fromDaf: 12, fromAmud: 'a', toDaf: 14, toAmud: 'b' },
    { ch: 6, fromDaf: 14, fromAmud: 'b', toDaf: 17, toAmud: 'a' },
    { ch: 7, fromDaf: 17, fromAmud: 'a', toDaf: 19, toAmud: 'b' },
    { ch: 8, fromDaf: 19, fromAmud: 'b', toDaf: 22, toAmud: 'a' },
  ];
  const halakhaCounts: Record<number, number> = {};
  for (let daf = 2; daf <= 22; daf++) {
    for (const amud of ['a', 'b']) {
      const key = `${daf}${amud}`;
      const chapter = chapters.find(c => {
        const fromVal = c.fromDaf * 2 + (c.fromAmud === 'b' ? 1 : 0);
        const toVal = c.toDaf * 2 + (c.toAmud === 'b' ? 1 : 0);
        const curVal = daf * 2 + (amud === 'b' ? 1 : 0);
        return curVal >= fromVal && curVal <= toVal;
      });
      if (chapter) {
        if (!halakhaCounts[chapter.ch]) halakhaCounts[chapter.ch] = 1;
        SHEKALIM_DAF_MAP[key] = `Jerusalem_Talmud_Shekalim.${chapter.ch}.${halakhaCounts[chapter.ch]}`;
        halakhaCounts[chapter.ch]++;
      }
    }
  }
};
_buildShekalimMap();

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

// Fetch a single page from Sefaria with timeout
async function fetchSefariaPage(sefariaRef: string, isYerushalmi: boolean, dafAmudKey: string): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(
      `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=0&context=0`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!resp.ok) {
      // Fallback for Yerushalmi
      if (isYerushalmi) {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), FETCH_TIMEOUT_MS);
        try {
          const fallbackResp = await fetch(
            `https://www.sefaria.org/api/texts/Shekalim.${dafAmudKey}?commentary=0&context=0`,
            { signal: fallbackController.signal }
          );
          clearTimeout(fallbackTimeout);
          if (fallbackResp.ok) return await fallbackResp.json();
        } catch { /* ignore */ }
        finally { clearTimeout(fallbackTimeout); }
      }
      return null;
    }
    return await resp.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

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
      while (true) {
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

      const { data: progress } = await supabaseClient
        .from('shas_download_progress')
        .select('*');

      return new Response(
        JSON.stringify({ success: true, status: statusMap, progress: progress || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SYNC MODE: count actual pages and update shas_download_progress ───
    if (mode === 'sync') {
      // Count actual pages with text per masechet
      const actualCounts: Record<string, number> = {};
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        const { data: rows } = await supabaseClient
          .from('gemara_pages')
          .select('masechet, text_he')
          .range(offset, offset + PAGE - 1);
        if (!rows || rows.length === 0) break;
        for (const row of rows) {
          if (row.text_he) {
            actualCounts[row.masechet] = (actualCounts[row.masechet] || 0) + 1;
          }
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
      }

      // Update shas_download_progress for each masechet
      let synced = 0;
      for (const m of MASECHTOT_LIST) {
        const totalPages = (m.maxDaf - 1) * 2;
        const actual = actualCounts[m.sefariaName] || 0;
        const isComplete = actual >= totalPages;

        await supabaseClient
          .from('shas_download_progress')
          .upsert({
            masechet: m.sefariaName,
            hebrew_name: m.hebrewName,
            max_daf: m.maxDaf,
            total_pages: totalPages,
            loaded_pages: actual,
            status: isComplete ? 'completed' : (actual > 0 ? 'paused' : 'pending'),
            current_daf: isComplete ? m.maxDaf : 2,
            errors: [],
            ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
          }, { onConflict: 'masechet' });
        synced++;
      }

      return new Response(
        JSON.stringify({ success: true, message: `Synced ${synced} masechtot`, counts: actualCounts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── INIT MODE ───
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
    const isYerushalmi = sefariaName === 'Shekalim';

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

    // Build list of all pages to fetch in this batch
    interface PageInfo {
      daf: number;
      amud: 'a' | 'b';
      sugyaId: string;
      sefariaRef: string;
      dafAmudKey: string;
      dafYomi: string;
    }

    const pages: PageInfo[] = [];
    for (let daf = fromDaf; daf <= toDaf; daf++) {
      for (const amud of ['a', 'b'] as const) {
        const dafAmudKey = `${daf}${amud}`;
        const sugyaId = `${sefariaName.toLowerCase()}_${dafAmudKey}`;
        const sefariaRef = isYerushalmi && SHEKALIM_DAF_MAP[dafAmudKey]
          ? SHEKALIM_DAF_MAP[dafAmudKey]
          : `${sefariaName}.${dafAmudKey}`;
        const amudLabel = amud === 'a' ? 'ע״א' : 'ע״ב';
        const dafYomi = `${hebrewName} ${toHebrewNumeral(daf)} ${amudLabel}`;
        pages.push({ daf, amud, sugyaId, sefariaRef, dafAmudKey, dafYomi });
      }
    }

    // ── BATCH CHECK: which pages already have text ──
    const sugyaIds = pages.map(p => p.sugyaId);
    const existingMap: Map<string, { id: string; hasText: boolean }> = new Map();
    
    // Fetch in chunks of 50 to stay within query limits
    for (let i = 0; i < sugyaIds.length; i += 50) {
      const chunk = sugyaIds.slice(i, i + 50);
      const { data: existing } = await supabaseClient
        .from('gemara_pages')
        .select('id, sugya_id, text_he')
        .in('sugya_id', chunk);
      if (existing) {
        for (const row of existing) {
          existingMap.set(row.sugya_id, { id: row.id, hasText: !!row.text_he });
        }
      }
    }

    // Filter out pages that already have text
    const pagesToFetch = pages.filter(p => {
      const ex = existingMap.get(p.sugyaId);
      return !ex?.hasText;
    });

    const skipped = pages.length - pagesToFetch.length;
    let loaded = 0;
    let pagesWithText = skipped; // count existing text pages
    const errors: string[] = [];

    // ── PARALLEL FETCH in groups of PARALLEL_FETCHES ──
    for (let i = 0; i < pagesToFetch.length; i += PARALLEL_FETCHES) {
      const group = pagesToFetch.slice(i, i + PARALLEL_FETCHES);

      const results = await Promise.allSettled(
        group.map(async (page) => {
          const data = await fetchSefariaPage(page.sefariaRef, isYerushalmi, page.dafAmudKey);
          if (!data || !data.he || data.he.length === 0) {
            return { page, data: null };
          }
          return { page, data };
        })
      );

      // Process results - batch upsert
      const inserts: any[] = [];
      const updates: Array<{ id: string; data: any }> = [];

      for (const result of results) {
        if (result.status === 'rejected') {
          errors.push(`fetch error: ${result.reason}`);
          continue;
        }
        const { page, data } = result.value;
        if (!data) {
          errors.push(`${page.sefariaRef}: אין טקסט`);
          continue;
        }

        pagesWithText++;
        loaded++;

        const existing = existingMap.get(page.sugyaId);
        const rowData = {
          text_he: data.he,
          text_en: data.text || null,
          he_ref: data.heRef || null,
          book: data.book || null,
          categories: data.categories || null,
          section_ref: data.sectionRef || null,
        };

        if (existing) {
          updates.push({ id: existing.id, data: rowData });
        } else {
          inserts.push({
            daf_number: page.daf,
            sugya_id: page.sugyaId,
            title: page.dafYomi,
            daf_yomi: page.dafYomi,
            sefaria_ref: page.sefariaRef,
            masechet: sefariaName,
            ...rowData,
          });
        }
      }

      // Batch insert new rows
      if (inserts.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('gemara_pages')
          .insert(inserts);
        if (insertError) {
          errors.push(`batch insert error: ${insertError.message}`);
        }
      }

      // Batch update existing rows
      for (const upd of updates) {
        await supabaseClient
          .from('gemara_pages')
          .update(upd.data)
          .eq('id', upd.id);
      }

      // Small delay between groups to avoid Sefaria rate limiting
      if (i + PARALLEL_FETCHES < pagesToFetch.length) {
        await sleep(DELAY_BETWEEN_GROUPS);
      }
    }

    // ── Single progress update at end of batch ──
    const { data: currentProgress } = await supabaseClient
      .from('shas_download_progress')
      .select('loaded_pages, errors')
      .eq('masechet', sefariaName)
      .maybeSingle();

    const prevLoaded = currentProgress?.loaded_pages || 0;
    const prevErrors = (currentProgress?.errors as string[]) || [];

    const hasMore = toDaf < maxDaf;
    const nextDaf = hasMore ? toDaf + 1 : null;
    const newPagesAttempted = pagesToFetch.length;
    const allFailed = newPagesAttempted > 0 && loaded === 0;
    const totalLoaded = prevLoaded + loaded + skipped;

    await supabaseClient
      .from('shas_download_progress')
      .update({
        current_daf: hasMore ? toDaf + 1 : maxDaf,
        loaded_pages: totalLoaded,
        errors: [...prevErrors, ...errors].slice(-50),
        status: hasMore ? 'downloading' : 'completed',
        ...(hasMore ? {} : { completed_at: new Date().toISOString() }),
      })
      .eq('masechet', sefariaName);

    return new Response(
      JSON.stringify({
        success: true,
        masechet: sefariaName,
        hebrewName,
        fromDaf, toDaf, maxDaf,
        hasMore, nextDaf,
        allFailed,
        totalLoaded,
        batchStats: { fetched: loaded, skipped, errors: errors.length, totalPages: pages.length },
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
