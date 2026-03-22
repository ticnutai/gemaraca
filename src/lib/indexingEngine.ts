/**
 * Indexing Engine - processes psakei din in parallel batches
 * with pause/resume/cancel support and progress tracking.
 */
import { supabase } from '@/integrations/supabase/client';
import { useIndexingStore } from '@/stores/indexingStore';

interface PsakToProcess {
  id: string;
  title: string;
  text: string;
}

// ─── Concurrency Pool ────────────────────────────────────────
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

// ─── Single psak extraction ─────────────────────────────────
async function extractSinglePsak(
  psak: PsakToProcess,
  useAI: boolean,
  userId: string | null,
  signal: AbortSignal,
): Promise<number> {
  const { data, error: fnError } = await supabase.functions.invoke('extract-references', {
    body: { text: psak.text, documentId: psak.id, useAI },
  });

  if (fnError) {
    throw new Error(fnError.message ?? `שגיאה בקריאה ל-Edge Function`);
  }

  const references = data?.references;
  if (!references?.length) return 0;

  // Delete existing refs for this psak
  await supabase
    .from('talmud_references')
    .delete()
    .eq('psak_din_id', psak.id);

  const rows = references.map((ref: Record<string, string>) => ({
    psak_din_id: psak.id,
    tractate: ref.tractate,
    daf: ref.daf,
    amud: ref.amud,
    raw_reference: ref.raw,
    normalized: ref.normalized,
    confidence: ref.confidence,
    source: ref.source,
    context_snippet: ref.context_snippet || null,
    user_id: userId,
  }));

  const { error } = await supabase.from('talmud_references').insert(rows);
  if (error) throw error;

  return references.length;
}

// ─── Main engine entry point ─────────────────────────────────
export async function runIndexingEngine(userId: string | null): Promise<void> {
  const store = useIndexingStore.getState();
  const { batchSize, concurrency, skipIndexed, useAI, _abortController, _currentOffset } = store;

  if (!_abortController) return;
  const signal = _abortController.signal;

  const checkPause = async () => {
    const s = useIndexingStore.getState();
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

    // 2. Get already-indexed psak_din_ids if skipIndexed (paginate to avoid 1000 limit)
    let indexedIds = new Set<string>();
    if (skipIndexed) {
      const PAGE = 1000;
      let off = 0;
      let fetchMore = true;
      while (fetchMore) {
        const { data: indexed } = await supabase
          .from('talmud_references')
          .select('psak_din_id')
          .range(off, off + PAGE - 1);
        if (indexed && indexed.length > 0) {
          for (const r of indexed) indexedIds.add(r.psak_din_id);
          if (indexed.length < PAGE) fetchMore = false;
          off += PAGE;
        } else {
          fetchMore = false;
        }
      }
    }

    // 3. Process in pages (support resume from saved offset)
    let offset = _currentOffset;
    const startTime = Date.now();
    const baseProcessed = useIndexingStore.getState().stats.processed;

    while (offset < total) {
      if (signal.aborted) return;
      await checkPause();
      if (signal.aborted) return;

      // Fetch a batch of psakim
      const { data: psakim, error } = await supabase
        .from('psakei_din')
        .select('id, title, full_text, summary')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!psakim || psakim.length === 0) break;

      // Filter: skip indexed + skip empty
      const toProcess: PsakToProcess[] = [];
      let skippedInBatch = 0;

      for (const p of psakim) {
        if (skipIndexed && indexedIds.has(p.id)) {
          skippedInBatch++;
          continue;
        }
        const text = p.full_text || p.summary || '';
        if (text.length < 10) {
          skippedInBatch++;
          continue;
        }
        toProcess.push({ id: p.id, title: p.title || '', text });
      }

      store._updateStats({
        skipped: useIndexingStore.getState().stats.skipped + skippedInBatch,
      });

      // Process batch with concurrency pool
      if (toProcess.length > 0) {
        await runPool(
          toProcess,
          concurrency,
          async (psak) => {
            try {
              const count = await extractSinglePsak(psak, useAI, userId, signal);
              const currentStats = useIndexingStore.getState().stats;
              const processed = currentStats.processed + 1;
              const elapsed = Date.now() - startTime + (baseProcessed > 0 ? currentStats.elapsed : 0);
              store._updateStats({
                processed,
                refsFound: currentStats.refsFound + count,
                elapsed,
                avgPerItem: elapsed / processed,
              });
            } catch (e: unknown) {
              if (signal.aborted) return;
              const message = e instanceof Error ? e.message : String(e);
              store._addError({
                psakId: psak.id,
                title: psak.title,
                message,
                timestamp: Date.now(),
              });
              // Still count as processed
              const currentStats = useIndexingStore.getState().stats;
              store._updateStats({
                processed: currentStats.processed + 1,
                elapsed: Date.now() - startTime,
              });
            }
          },
          signal,
          checkPause,
        );
      }

      offset += psakim.length;
      store._setCurrentOffset(offset);

      // Small delay between batches to avoid rate limiting
      if (!signal.aborted && offset < total) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (!signal.aborted) {
      const finalStats = useIndexingStore.getState().stats;
      store._updateStats({ elapsed: Date.now() - startTime });
      store._setStatus('completed');
      store.clearSavedProgress();
    }
  } catch (e: unknown) {
    if (signal.aborted) return;
    const message = e instanceof Error ? e.message : String(e);
    store._addError({
      psakId: '',
      title: 'שגיאה כללית',
      message,
      timestamp: Date.now(),
    });
    store._setStatus('error');
  }
}
