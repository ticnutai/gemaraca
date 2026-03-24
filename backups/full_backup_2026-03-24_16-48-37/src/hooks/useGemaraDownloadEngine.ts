import { useEffect, useRef, useCallback } from 'react';
import { useGemaraDownloadStore, GemaraDownloadJob } from '@/stores/gemaraDownloadStore';
import { MASECHTOT, getMasechtotBySeder, SEDARIM, Masechet } from '@/lib/masechtotData';
import { toHebrewNumeral } from '@/lib/hebrewNumbers';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 800;
const RETRY_DELAYS = [1500, 4000];

/** Build a daf key like "Berakhot:2a" */
const dafKey = (sefariaName: string, daf: number, amud: 'a' | 'b') => `${sefariaName}:${daf}${amud}`;

/** Generate all daf keys for a list of masechtot (both amud a and b) */
function allDafKeysForMasechtot(masechtot: string[]): string[] {
  const keys: string[] = [];
  for (const sName of masechtot) {
    const m = MASECHTOT.find((x) => x.sefariaName === sName);
    if (!m) continue;
    for (let daf = 2; daf <= m.maxDaf; daf++) {
      keys.push(dafKey(sName, daf, 'a'));
      keys.push(dafKey(sName, daf, 'b'));
    }
  }
  return keys;
}

async function loadSingleDaf(masechet: Masechet, dafNumber: number, amud: 'a' | 'b', signal?: AbortSignal): Promise<void> {
  const hebrewNumber = toHebrewNumeral(dafNumber);
  const sugya_id = `${masechet.sefariaName.toLowerCase()}_${dafNumber}${amud}`;
  const amudLabel = amud === 'a' ? 'ע״א' : 'ע״ב';
  const title = `${masechet.hebrewName} דף ${hebrewNumber} ${amudLabel}`;

  const { error } = await supabase.functions.invoke('load-daf', {
    body: {
      dafNumber,
      sugya_id,
      title,
      masechet: masechet.hebrewName,
      amud,
    },
  });

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) throw error;
}

async function loadDafWithRetry(masechet: Masechet, dafNumber: number, amud: 'a' | 'b', signal?: AbortSignal): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await loadSingleDaf(masechet, dafNumber, amud, signal);
      return;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      if (attempt >= RETRY_DELAYS.length) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }
}

// ─── Helpers to enqueue jobs ────────────────────────────

export function buildMasechetJob(masechet: Masechet): Omit<GemaraDownloadJob, 'status' | 'completedDafs' | 'failedDafs' | 'createdAt'> {
  return {
    id: `masechet:${masechet.sefariaName}`,
    scope: 'masechet',
    label: `מסכת ${masechet.hebrewName}`,
    masechtot: [masechet.sefariaName],
    totalDafs: (masechet.maxDaf - 1) * 2,
  };
}

export function buildSederJob(seder: string) {
  const masechtot = getMasechtotBySeder(seder);
  const totalDafs = masechtot.reduce((sum, m) => sum + (m.maxDaf - 1) * 2, 0);
  return {
    id: `seder:${seder}`,
    scope: 'seder' as const,
    label: `סדר ${seder}`,
    masechtot: masechtot.map((m) => m.sefariaName),
    totalDafs,
  };
}

export function buildShasJob() {
  const totalDafs = MASECHTOT.reduce((sum, m) => sum + (m.maxDaf - 1) * 2, 0);
  return {
    id: 'shas:all',
    scope: 'shas' as const,
    label: 'כל הש"ס',
    masechtot: MASECHTOT.map((m) => m.sefariaName),
    totalDafs,
  };
}

// ─── Engine Hook ────────────────────────────────────────

export function useGemaraDownloadEngine() {
  const store = useGemaraDownloadStore();
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const processJob = useCallback(async (job: GemaraDownloadJob) => {
    const abort = new AbortController();
    abortRef.current = abort;
    const { startJob, markDafCompleted, markDafFailed, setCurrentProgress, completeJob, errorJob } = useGemaraDownloadStore.getState();

    startJob(job.id);

    try {
      for (const sefariaName of job.masechtot) {
        const masechet = MASECHTOT.find((m) => m.sefariaName === sefariaName);
        if (!masechet) continue;

        const allDafs = Array.from({ length: masechet.maxDaf - 1 }, (_, i) => i + 2);

        // Build list of all amud pages (a and b) for this masechet
        const allPages: { daf: number; amud: 'a' | 'b' }[] = [];
        for (const d of allDafs) {
          allPages.push({ daf: d, amud: 'a' });
          allPages.push({ daf: d, amud: 'b' });
        }

        // Filter out already-completed pages (resume support)
        const completedSet = new Set(useGemaraDownloadStore.getState().jobs[job.id]?.completedDafs || []);
        const pending = allPages.filter((p) => !completedSet.has(dafKey(sefariaName, p.daf, p.amud)));

        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          // Check if paused or aborted
          const currentStatus = useGemaraDownloadStore.getState().jobs[job.id]?.status;
          if (currentStatus === 'paused' || abort.signal.aborted) {
            return; // exit gracefully, progress saved
          }

          const batch = pending.slice(i, i + BATCH_SIZE);
          setCurrentProgress(job.id, masechet.hebrewName, batch[0].daf);

          const results = await Promise.allSettled(
            batch.map((p) => loadDafWithRetry(masechet, p.daf, p.amud, abort.signal))
          );

          for (let j = 0; j < results.length; j++) {
            const key = dafKey(sefariaName, batch[j].daf, batch[j].amud);
            if (results[j].status === 'fulfilled') {
              markDafCompleted(job.id, key);
            } else {
              markDafFailed(job.id, key);
            }
          }

          // Small delay between batches to avoid overwhelming the API
          if (i + BATCH_SIZE < pending.length) {
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
          }
        }
      }

      // Check final status
      const finalJob = useGemaraDownloadStore.getState().jobs[job.id];
      if (finalJob?.status === 'paused') return;

      completeJob(job.id);
      toast({ title: 'הורדה הושלמה', description: job.label });

      // Refresh loaded pages cache
      await queryClient.invalidateQueries({ queryKey: ['sedarim-loaded-pages'] });
      await queryClient.refetchQueries({ queryKey: ['sedarim-loaded-pages'] });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      errorJob(job.id, msg);
      toast({ title: 'שגיאה בהורדה', description: `${job.label}: ${msg}`, variant: 'destructive' });
    } finally {
      abortRef.current = null;
    }
  }, [queryClient, toast]);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      // Verify auth before starting
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'נדרשת התחברות', description: 'יש להתחבר למערכת לפני הורדת דפים', variant: 'destructive' });
        // Pause all queued jobs so they can be resumed after login
        const { jobs, queue } = useGemaraDownloadStore.getState();
        const { errorJob } = useGemaraDownloadStore.getState();
        for (const id of queue) {
          if (jobs[id]?.status === 'queued') errorJob(id, 'נדרשת התחברות');
        }
        runningRef.current = false;
        return;
      }

      while (true) {
        const { jobs, queue } = useGemaraDownloadStore.getState();
        // Find next queued job
        const nextId = queue.find((id) => jobs[id]?.status === 'queued');
        if (!nextId) break;

        await processJob(jobs[nextId]);
      }
    } finally {
      runningRef.current = false;
    }
  }, [processJob]);

  // Watch for new queued jobs and start processing
  useEffect(() => {
    const unsub = useGemaraDownloadStore.subscribe((state, prev) => {
      const hasQueued = state.queue.some((id) => state.jobs[id]?.status === 'queued');
      const hadQueued = prev.queue.some((id) => prev.jobs[id]?.status === 'queued');
      if (hasQueued && !hadQueued) {
        processQueue();
      }
    });

    // On mount, resume any queued jobs from a previous session
    const { queue, jobs } = useGemaraDownloadStore.getState();
    if (queue.some((id) => jobs[id]?.status === 'queued')) {
      processQueue();
    }

    return () => {
      unsub();
      // Don't abort on unmount — downloads should continue in background
    };
  }, [processQueue]);

  // Pause handler — abort current network calls
  useEffect(() => {
    const unsub = useGemaraDownloadStore.subscribe((state, prev) => {
      for (const id of Object.keys(state.jobs)) {
        if (state.jobs[id]?.status === 'paused' && prev.jobs[id]?.status === 'downloading') {
          abortRef.current?.abort();
        }
      }
    });
    return unsub;
  }, []);

  // Warn user before closing tab if downloads are active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useGemaraDownloadStore.getState().hasActiveDownloads()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // When tab becomes visible again, refetch cache so UI stays up-to-date
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['sedarim-loaded-pages'] });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [queryClient]);

  const enqueue = useCallback((jobDef: Omit<GemaraDownloadJob, 'status' | 'completedDafs' | 'failedDafs' | 'createdAt'>) => {
    useGemaraDownloadStore.getState().enqueueJob(jobDef);
    // Kick off processing if idle
    setTimeout(processQueue, 0);
  }, [processQueue]);

  return { enqueue };
}
