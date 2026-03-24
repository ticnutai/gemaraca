import { useRef, useCallback } from 'react';
import { useDeleteStore, DeleteSession } from '@/stores/deleteStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const CONCURRENCY = 8;
const BATCH_SIZE = 50;
const RELATED_TABLES = [
  'sugya_psak_links',
  'pattern_sugya_links',
  'talmud_references',
  'smart_index_results',
  'faq_items',
  'psak_sections',
] as const;

// Module-level state for background persistence
let globalAbortController: AbortController | null = null;
let globalPaused = false;
let globalActive = false;

export function useDeleteController() {
  const speedRef = useRef({ startTime: 0, completedCount: 0 });

  const {
    startSession,
    updateProgress,
    addError,
    setStatus,
    clearSession,
    getProgress,
  } = useDeleteStore();

  const sleep = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
    });

  const waitWhilePaused = async (signal: AbortSignal) => {
    while (globalPaused) {
      if (signal.aborted) throw new Error('aborted');
      await sleep(200, signal);
    }
  };

  // Delete storage file by extracting path from source_url
  const deleteStorageFile = async (sourceUrl: string | null) => {
    if (!sourceUrl) return;
    try {
      const bucketBase = '/storage/v1/object/public/psakei-din-files/';
      const idx = sourceUrl.indexOf(bucketBase);
      if (idx === -1) return;
      const path = decodeURIComponent(sourceUrl.substring(idx + bucketBase.length));
      await supabase.storage.from('psakei-din-files').remove([path]);
    } catch {
      // Non-critical, file may not exist
    }
  };

  // Batch delete related records for multiple IDs at once
  const deleteRelatedBatch = async (ids: string[]) => {
    await Promise.all(
      RELATED_TABLES.map((table) =>
        supabase.from(table).delete().in('psak_din_id', ids)
      )
    );
  };

  const startBulkDelete = useCallback(async (
    ids: string[],
    sessionName?: string
  ) => {
    if (ids.length === 0) return;
    if (globalActive) {
      toast({ title: 'מחיקה כבר פעילה', variant: 'destructive' });
      return;
    }

    globalActive = true;
    globalPaused = false;
    speedRef.current = { startTime: Date.now(), completedCount: 0 };

    const sessionId = crypto.randomUUID();
    const name = sessionName || `מחיקת ${ids.length} פסקי דין`;

    const abortController = new AbortController();
    globalAbortController = abortController;
    const signal = abortController.signal;

    startSession({
      id: sessionId,
      name,
      startedAt: Date.now(),
      totalCount: ids.length,
      completedCount: 0,
      failedCount: 0,
      status: 'deleting',
      failedIds: [],
      errors: [],
    });

    let completedCount = 0;
    let failedCount = 0;
    let batchIndex = 0;

    // Split into batches for parallel processing
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    const processBatch = async (): Promise<void> => {
      while (batchIndex < batches.length) {
        if (signal.aborted) return;
        await waitWhilePaused(signal);

        const currentIdx = batchIndex++;
        const batch = batches[currentIdx];

        try {
          // 1) Fetch source_urls for storage cleanup
          const { data: psakim } = await supabase
            .from('psakei_din')
            .select('id, source_url')
            .in('id', batch);

          // 2) Delete all related records in parallel
          await deleteRelatedBatch(batch);

          // 3) Delete main records
          const { error } = await supabase
            .from('psakei_din')
            .delete()
            .in('id', batch);

          if (error) throw error;

          // 4) Delete storage files (best-effort, parallel)
          if (psakim && psakim.length > 0) {
            const storagePromises = psakim
              .filter((p) => p.source_url)
              .map((p) => deleteStorageFile(p.source_url));
            await Promise.allSettled(storagePromises);
          }

          completedCount += batch.length;
          speedRef.current.completedCount += batch.length;
        } catch (err) {
          if ((err as Error).message === 'aborted') return;
          failedCount += batch.length;
          for (const id of batch) {
            addError(sessionId, id, (err as Error).message);
          }
        }

        updateProgress(sessionId, completedCount, failedCount);
      }
    };

    try {
      // Launch concurrent workers
      const workerCount = Math.min(CONCURRENCY, batches.length);
      const workers = Array.from({ length: workerCount }, () => processBatch());
      await Promise.all(workers);

      if (signal.aborted) {
        globalActive = false;
        return;
      }

      setStatus(sessionId, 'completed');
      toast({
        title: '✅ המחיקה הושלמה!',
        description: `נמחקו ${completedCount.toLocaleString()} פסקי דין${failedCount > 0 ? ` (${failedCount} שגיאות)` : ''}`,
      });
    } catch (err) {
      if ((err as Error).message !== 'aborted') {
        setStatus(sessionId, 'error');
        toast({
          title: '❌ שגיאה במחיקה',
          description: (err as Error).message,
          variant: 'destructive',
        });
      }
    } finally {
      globalActive = false;
      globalAbortController = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSession, updateProgress, addError, setStatus]);

  const pause = useCallback((sessionId: string) => {
    globalPaused = true;
    setStatus(sessionId, 'paused');
    toast({ title: 'המחיקה הושהתה' });
  }, [setStatus]);

  const resume = useCallback((sessionId: string) => {
    globalPaused = false;
    setStatus(sessionId, 'deleting');
    toast({ title: 'ממשיך במחיקה...' });
  }, [setStatus]);

  const cancel = useCallback((sessionId: string) => {
    globalAbortController?.abort();
    globalAbortController = null;
    globalActive = false;
    globalPaused = false;
    clearSession(sessionId);
    toast({ title: 'המחיקה בוטלה', variant: 'destructive' });
  }, [clearSession]);

  const getSpeed = useCallback(() => {
    const { startTime, completedCount } = speedRef.current;
    if (!startTime || completedCount === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    return elapsed > 0 ? Math.round((completedCount / elapsed) * 10) / 10 : 0;
  }, []);

  return {
    startBulkDelete,
    pause,
    resume,
    cancel,
    clearSession,
    getProgress,
    getSpeed,
  };
}
