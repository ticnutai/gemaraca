/**
 * Analysis Engine - extracts structured sections (facts, claims, ruling, etc.)
 * from psakei din. Runs independently from the indexing engine.
 */
import { supabase } from '@/integrations/supabase/client';
import { useAnalysisStore } from '@/stores/analysisStore';
import type { PsakSection } from '@/lib/psakDinParser';

// ─── Section patterns (matches both plain text and stripped HTML) ──
const sectionPatterns: Array<{ type: PsakSection['type']; patterns: RegExp[] }> = [
  { type: 'summary', patterns: [
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?תקציר[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?תמצית\s*(?:פסק\s*הדין|העובדות|המקרה|העובדות\s*המוסכמות)?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?תמצית[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?מבוא[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?הקדמה[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?פתח\s*דבר[:\s.\-–]/m,
  ] },
  { type: 'facts', patterns: [
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?(?:ה)?עובדות\s*(?:ה)?מוסכמות(?:\s*בקצרה)?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?עובדות(?:\s*(?:המקרה|התיק|הרקע|וטענות|ורקע|הצריכות(?:\s*לענייננו)?|בקצרה))?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?תיאור\s*(?:המקרה|העובדות|עובדתי|התביעה)(?:\s*(?:ו)?(?:ה)?עובדות\s*(?:ה)?מוסכמות)?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?תמצית\s*(?:ה)?עובדות(?:\s*(?:ה)?מוסכמות)?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?רקע(?:\s*(?:עובדתי|מוסכם|כללי))?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?רקע\s*וטענות(?:\s*הצדדים)?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?המקרה\s*העובדתי[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?נושא\s*(?:המקרה|התביעה|הדיון)[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?נושאי\s*הדיון[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?מצב\s*עובדתי[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?פרטי\s*המקרה[:\s.\-–]/m,
    /(?:^|\n)\s*(?:[א-ת][.):\s]\s*)?התשתית\s*העובדתית[:\s.\-–]/m,
    /(?:^|\n)\s*(?:\d+[.):\s]\s*)?(?:ה)?עובדות(?:\s*(?:המוסכמות|הצריכות\s*לענייננו))?[:\s.\-–]/m,
    /(?:^|\n)\s*(?:\d+[.):\s]\s*)?רקע(?:\s*(?:עובדתי|כללי))?[:\s.\-–]/m,
  ] },
  { type: 'plaintiff-claims', patterns: [
    /(?:^|\n)\s*טענות\s*התובע[ים]?(?:\s*ותביעות[ים]?(?:הם)?)?[:\s.\-–]/m,
    /(?:^|\n)\s*תביעת\s*התובע[ים]?\s*וטענות[יו]?[:\s.\-–]/m,
    /(?:^|\n)\s*טענות\s*צד\s*א[:\s.\-–]/m,
    /(?:^|\n)\s*טענות\s*המבקש[ים]?[:\s.\-–]/m,
    /(?:^|\n)\s*תביעות\s*וטענות\s*הצדדים[:\s.\-–]/m,
    /(?:^|\n)\s*טענות\s*התובע[ים]?\s*ותביעות[ים]?(?:הם)?[:\s.\-–]/m,
  ] },
  { type: 'defendant-claims', patterns: [
    /(?:^|\n)\s*טענות\s*הנתבע[ים]?(?:\s*ותביעות[ים]?(?:הם)?)?[:\s.\-–]/m,
    /(?:^|\n)\s*טענות\s*צד\s*ב[:\s.\-–]/m,
    /(?:^|\n)\s*טענות\s*המשיב[ים]?[:\s.\-–]/m,
  ] },
  { type: 'discussion', patterns: [
    /(?:^|\n)\s*דיון(?:\s*(?:הלכתי|משפטי))?[:\s.\-–]/m,
    /(?:^|\n)\s*ניתוח\s*(?:הלכתי|משפטי)[:\s.\-–]/m,
    /(?:^|\n)\s*(?:ה)?שאלות\s*לדיון[:\s.\-–]/m,
    /(?:^|\n)\s*נושאים\s*לדיון[:\s.\-–]/m,
  ] },
  { type: 'reasoning', patterns: [
    /(?:^|\n)\s*נימוקי?\s*(?:הדין|הפסק|פסק\s*הדין|בית\s*הדין)(?:\s*בהרחבה)?[:\s.\-–]/m,
    /(?:^|\n)\s*הנמקה[:\s.\-–]/m,
    /(?:^|\n)\s*נימוקים[:\s.\-–]/m,
  ] },
  { type: 'ruling', patterns: [
    /(?:^|\n)\s*פסק\s*(?:הדין|דין|ביניים)[:\s.\-–]/m,
    /(?:^|\n)\s*פסיקה[:\s.\-–]/m,
  ] },
  { type: 'decision', patterns: [
    /(?:^|\n)\s*החלט(?:ה|ות|ת\s*(?:ה)?ביניים)[:\s.\-–]/m,
    /(?:^|\n)\s*הכרעת\s*(?:הדין|השו"ע|הרמ"א)[:\s.\-–]/m,
    /(?:^|\n)\s*הכרעה[:\s.\-–]/m,
  ] },
  { type: 'conclusion', patterns: [
    /(?:^|\n)\s*סוף\s*דבר[:\s.\-–]/m,
    /(?:^|\n)\s*לסיכום[:\s,]/m,
    /(?:^|\n)\s*סיכום(?:\s*ביניים)?[:\s.\-–]/m,
  ] },
];

// ─── Strip HTML to plain text ─────────────────────────────────
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section)>/gi, '\n')
    .replace(/<(?:p|div|h[1-6]|li|tr|blockquote|section)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Extract sections from text ──────────────────────────────
interface ExtractedSection {
  type: PsakSection['type'];
  title: string;
  content: string;
  order: number;
}

function extractSectionsFromText(rawText: string): ExtractedSection[] {
  // Detect HTML and convert
  const text = rawText.includes('<') ? htmlToPlainText(rawText) : rawText;

  // Find all section start positions
  const found: Array<{ type: PsakSection['type']; title: string; start: number; matchEnd: number }> = [];

  for (const { type, patterns } of sectionPatterns) {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m.index !== undefined) {
        const lineStart = text.lastIndexOf('\n', m.index) + 1;
        const lineEnd = text.indexOf('\n', m.index + m[0].length);
        const title = text.slice(lineStart, lineEnd > lineStart ? lineEnd : m.index + m[0].length)
          .replace(/[:\s.\-–]+$/, '').trim();
        const contentStart = lineEnd > lineStart ? lineEnd + 1 : m.index + m[0].length;
        found.push({ type, title, start: m.index, matchEnd: contentStart });
        break; // one match per type
      }
    }
  }

  // Sort by position
  found.sort((a, b) => a.start - b.start);

  const sections: ExtractedSection[] = [];
  for (let i = 0; i < found.length; i++) {
    const contentEnd = i + 1 < found.length ? found[i + 1].start : text.length;
    const content = text.slice(found[i].matchEnd, contentEnd).trim();
    if (content.length > 10) {
      sections.push({
        type: found[i].type,
        title: found[i].title,
        content,
        order: i,
      });
    }
  }

  return sections;
}

// ─── Build case summary from sections ─────────────────────────
function buildCaseSummary(sections: ExtractedSection[], existingSummary: string): string {
  // Priority: explicit summary > facts > general intro
  const summarySection = sections.find(s => s.type === 'summary');
  if (summarySection && summarySection.content.length > 20) {
    return summarySection.content.length > 2000
      ? summarySection.content.slice(0, 2000) + '...'
      : summarySection.content;
  }

  const factsSection = sections.find(s => s.type === 'facts');
  if (factsSection && factsSection.content.length > 20) {
    return factsSection.content.length > 2000
      ? factsSection.content.slice(0, 2000) + '...'
      : factsSection.content;
  }

  // Use existing summary if it's meaningful
  if (existingSummary && !existingSummary.startsWith('פסק דין שהועלה מהקובץ')) {
    return existingSummary;
  }

  return '';
}

// ─── Process single psak ─────────────────────────────────────
interface PsakToAnalyze {
  id: string;
  title: string;
  full_text: string;
  summary: string;
}

// ─── Analyze single psak (AI mode only — needs HTTP call) ────
async function analyzeSinglePsakAI(
  psak: PsakToAnalyze,
): Promise<{ sections: ExtractedSection[]; caseSummary: string }> {
  const text = psak.full_text || psak.summary || '';

  const { data, error: fnError } = await supabase.functions.invoke('analyze-sections', {
    body: { text, documentId: psak.id },
  });

  if (fnError) {
    throw new Error(fnError.message ?? 'שגיאה בקריאה ל-AI');
  }

  const sections: ExtractedSection[] = (data?.sections || []).map(
    (s: { type: string; title: string; content: string; order: number }) => ({
      type: s.type as PsakSection['type'],
      title: s.title,
      content: s.content,
      order: s.order,
    }),
  );
  return { sections, caseSummary: data?.case_summary || '' };
}

// ─── Analyze single psak locally (regex — instant) ───────────
function analyzeSinglePsakRegex(
  psak: PsakToAnalyze,
): { sections: ExtractedSection[]; caseSummary: string } {
  const text = psak.full_text || psak.summary || '';
  const sections = extractSectionsFromText(text);
  const caseSummary = buildCaseSummary(sections, psak.summary);
  return { sections, caseSummary };
}

// ─── Batch-write results to DB ───────────────────────────────
async function flushResultsToDB(
  results: Array<{
    psakId: string;
    sections: ExtractedSection[];
    caseSummary: string;
  }>,
): Promise<void> {
  if (results.length === 0) return;

  // 1. Batch delete existing sections for all psak ids
  const ids = results.map(r => r.psakId);
  await supabase.from('psak_sections').delete().in('psak_din_id', ids);

  // 2. Batch insert all new sections in one call
  const allRows: Array<{
    psak_din_id: string;
    section_type: string;
    section_title: string;
    section_content: string;
    section_order: number;
  }> = [];
  for (const r of results) {
    for (const s of r.sections) {
      allRows.push({
        psak_din_id: r.psakId,
        section_type: s.type,
        section_title: s.title,
        section_content: s.content,
        section_order: s.order,
      });
    }
  }
  if (allRows.length > 0) {
    const { error } = await supabase.from('psak_sections').insert(allRows);
    if (error) throw error;
  }

  // 3. Batch update case_summary — group updates
  const summaryUpdates = results.filter(r => r.caseSummary);
  // Supabase REST doesn't support batch UPDATE by different IDs,
  // so fire them in parallel (much faster than serial)
  if (summaryUpdates.length > 0) {
    await Promise.all(
      summaryUpdates.map(r =>
        supabase.from('psakei_din').update({ case_summary: r.caseSummary }).eq('id', r.psakId),
      ),
    );
  }
}

// ─── Concurrency Pool (for AI mode) ─────────────────────────
async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  signal: AbortSignal,
  checkPause: () => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      if (signal.aborted) return;
      await checkPause();
      if (signal.aborted) return;

      const i = index++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

// ─── Main engine entry point ─────────────────────────────────
export async function runAnalysisEngine(): Promise<void> {
  const store = useAnalysisStore.getState();
  const { batchSize, concurrency, skipAnalyzed, useAI, _abortController, _currentOffset } = store;

  if (!_abortController) return;
  const signal = _abortController.signal;

  const checkPause = async () => {
    const s = useAnalysisStore.getState();
    if (s._pausePromise) await s._pausePromise;
  };

  try {
    // 1. Get total count
    const { count: totalCount } = await supabase
      .from('psakei_din')
      .select('*', { count: 'exact', head: true });

    const total = totalCount ?? 0;
    store._updateStats({ totalPsakim: total });

    if (total === 0) {
      store._setStatus('completed');
      return;
    }

    // 2. Get already-analyzed psak_din_ids
    const analyzedIds = new Set<string>();
    if (skipAnalyzed) {
      const PAGE = 1000;
      let off = 0;
      let fetchMore = true;
      while (fetchMore) {
        const { data } = await supabase
          .from('psak_sections')
          .select('psak_din_id')
          .range(off, off + PAGE - 1);
        if (data && data.length > 0) {
          for (const r of data) analyzedIds.add(r.psak_din_id);
          if (data.length < PAGE) fetchMore = false;
          off += PAGE;
        } else {
          fetchMore = false;
        }
      }
    }

    // 3. Process in batches
    let offset = _currentOffset;
    const startTime = Date.now();
    const baseProcessed = useAnalysisStore.getState().stats.processed;

    while (offset < total) {
      if (signal.aborted) return;
      await checkPause();
      if (signal.aborted) return;

      const { data: psakim, error } = await supabase
        .from('psakei_din')
        .select('id, title, full_text, summary')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!psakim || psakim.length === 0) break;

      // Filter: skip analyzed + skip empty
      const toProcess: PsakToAnalyze[] = [];
      let skippedInBatch = 0;

      for (const p of psakim) {
        if (skipAnalyzed && analyzedIds.has(p.id)) {
          skippedInBatch++;
          continue;
        }
        const text = p.full_text || p.summary || '';
        if (text.length < 30) {
          skippedInBatch++;
          continue;
        }
        toProcess.push(p);
      }

      store._updateStats({
        skipped: useAnalysisStore.getState().stats.skipped + skippedInBatch,
      });

      // Process batch
      if (toProcess.length > 0) {
        if (useAI) {
          // AI mode: use concurrency pool (each item needs HTTP call to Edge Function)
          await runPool(
            toProcess,
            concurrency,
            async (p) => {
              try {
                const { sections, caseSummary } = await analyzeSinglePsakAI(p);
                // Write single result immediately in AI mode
                if (sections.length > 0) {
                  await flushResultsToDB([{ psakId: p.id, sections, caseSummary }]);
                }
                const currentStats = useAnalysisStore.getState().stats;
                const processed = currentStats.processed + 1;
                const elapsed = Date.now() - startTime + (baseProcessed > 0 ? currentStats.elapsed : 0);
                store._updateStats({
                  processed,
                  sectionsFound: currentStats.sectionsFound + sections.length,
                  elapsed,
                  avgPerItem: elapsed / processed,
                });
              } catch (e: unknown) {
                if (signal.aborted) return;
                const message = e instanceof Error ? e.message : String(e);
                store._addError({
                  psakId: p.id,
                  title: p.title || '',
                  message,
                  timestamp: Date.now(),
                });
                const currentStats = useAnalysisStore.getState().stats;
                store._updateStats({
                  processed: currentStats.processed + 1,
                  elapsed: Date.now() - startTime,
                });
              }
            },
            signal,
            checkPause,
          );
        } else {
          // Regex mode: process ALL items locally (instant), then batch-write to DB
          const batchResults: Array<{
            psakId: string;
            sections: ExtractedSection[];
            caseSummary: string;
          }> = [];

          for (const p of toProcess) {
            if (signal.aborted) return;
            try {
              const { sections, caseSummary } = analyzeSinglePsakRegex(p);
              if (sections.length > 0) {
                batchResults.push({ psakId: p.id, sections, caseSummary });
              }
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : String(e);
              store._addError({ psakId: p.id, title: p.title || '', message, timestamp: Date.now() });
            }
          }

          // Single batch write for the entire batch — 2–3 HTTP calls instead of 3×N
          if (batchResults.length > 0) {
            await flushResultsToDB(batchResults);
          }

          // Update stats for the whole batch at once
          const totalSections = batchResults.reduce((sum, r) => sum + r.sections.length, 0);
          const currentStats = useAnalysisStore.getState().stats;
          const processed = currentStats.processed + toProcess.length;
          const elapsed = Date.now() - startTime + (baseProcessed > 0 ? currentStats.elapsed : 0);
          store._updateStats({
            processed,
            sectionsFound: currentStats.sectionsFound + totalSections,
            elapsed,
            avgPerItem: elapsed / processed,
          });
        }
      }

      offset += psakim.length;
      store._setCurrentOffset(offset);

      if (!signal.aborted && offset < total) {
        await new Promise(r => setTimeout(r, useAI ? 100 : 50));
      }
    }

    if (!signal.aborted) {
      store._updateStats({ elapsed: Date.now() - startTime });
      store._setStatus('completed');
      store.clearSavedProgress();
    }
  } catch (e: unknown) {
    if (signal.aborted) return;
    const message = e instanceof Error ? e.message : String(e);
    store._addError({ psakId: '', title: 'שגיאה כללית', message, timestamp: Date.now() });
    store._setStatus('error');
  }
}
