import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────

export type DownloadScope = 'masechet' | 'seder' | 'shas';

export type JobStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export interface GemaraDownloadJob {
  id: string;                    // unique key e.g. "masechet:Berakhot" or "seder:מועד"
  scope: DownloadScope;
  label: string;                 // display label e.g. "מסכת ברכות" or "סדר מועד"
  /** sefariaName list of masechtot in this job */
  masechtot: string[];
  status: JobStatus;
  /** daf keys already persisted in DB — survives restart */
  completedDafs: string[];       // e.g. ["Berakhot:2", "Berakhot:3"]
  /** total daf count for this job */
  totalDafs: number;
  /** daf keys that failed in the current run */
  failedDafs: string[];
  createdAt: number;
  /** current masechet being downloaded (for UI) */
  currentMasechet?: string;
  /** current daf being downloaded (for UI) */
  currentDaf?: number;
  error?: string;
}

interface GemaraDownloadStore {
  jobs: Record<string, GemaraDownloadJob>;
  /** ordered queue of job IDs — first is active */
  queue: string[];
  /** concurrency for parallel daf requests within a job */
  concurrency: number;

  // ─── Actions ────────────────────────────────────────
  enqueueJob: (job: Omit<GemaraDownloadJob, 'status' | 'completedDafs' | 'failedDafs' | 'createdAt'>) => void;
  removeJob: (jobId: string) => void;
  pauseJob: (jobId: string) => void;
  resumeJob: (jobId: string) => void;
  cancelAllJobs: () => void;

  /** Called by engine — move job to downloading */
  startJob: (jobId: string) => void;
  /** Mark a single daf as completed */
  markDafCompleted: (jobId: string, dafKey: string) => void;
  /** Mark a single daf as failed */
  markDafFailed: (jobId: string, dafKey: string) => void;
  /** Update current progress indicator */
  setCurrentProgress: (jobId: string, masechet: string, daf: number) => void;
  /** Mark entire job completed */
  completeJob: (jobId: string) => void;
  /** Mark job as errored */
  errorJob: (jobId: string, error: string) => void;

  // ─── Selectors ──────────────────────────────────────
  getActiveJob: () => GemaraDownloadJob | null;
  getJobProgress: (jobId: string) => { completed: number; total: number; percent: number; failed: number };
  getOverallProgress: () => { completed: number; total: number; percent: number; activeLabel: string | null };
  hasActiveDownloads: () => boolean;
}

export const useGemaraDownloadStore = create<GemaraDownloadStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      queue: [],
      concurrency: 5,

      enqueueJob: (job) => {
        const existing = get().jobs[job.id];
        // If job already exists and is completed or downloading, skip
        if (existing && (existing.status === 'downloading' || existing.status === 'completed')) return;

        set((state) => {
          // If resuming paused/error job, keep completedDafs
          const prevCompleted = existing?.completedDafs || [];
          return {
            jobs: {
              ...state.jobs,
              [job.id]: {
                ...job,
                status: 'queued',
                completedDafs: prevCompleted,
                failedDafs: [],
                createdAt: existing?.createdAt || Date.now(),
              },
            },
            queue: state.queue.includes(job.id)
              ? state.queue
              : [...state.queue, job.id],
          };
        });
      },

      removeJob: (jobId) => {
        set((state) => {
          const { [jobId]: _, ...rest } = state.jobs;
          return {
            jobs: rest,
            queue: state.queue.filter((id) => id !== jobId),
          };
        });
      },

      pauseJob: (jobId) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === 'completed') return state;
          return {
            jobs: { ...state.jobs, [jobId]: { ...job, status: 'paused' } },
          };
        });
      },

      resumeJob: (jobId) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job || job.status === 'completed' || job.status === 'downloading') return state;
          const newJob = { ...job, status: 'queued' as const, error: undefined };
          const newQueue = state.queue.includes(jobId)
            ? state.queue
            : [...state.queue, jobId];
          return {
            jobs: { ...state.jobs, [jobId]: newJob },
            queue: newQueue,
          };
        });
      },

      cancelAllJobs: () => {
        set((state) => {
          const updated: Record<string, GemaraDownloadJob> = {};
          for (const [id, job] of Object.entries(state.jobs)) {
            if (job.status === 'completed') {
              updated[id] = job;
            } else {
              updated[id] = { ...job, status: 'paused' };
            }
          }
          return { jobs: updated, queue: [] };
        });
      },

      startJob: (jobId) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: { ...state.jobs, [jobId]: { ...job, status: 'downloading', error: undefined, failedDafs: [] } },
          };
        });
      },

      markDafCompleted: (jobId, dafKey) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          if (job.completedDafs.includes(dafKey)) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                completedDafs: [...job.completedDafs, dafKey],
              },
            },
          };
        });
      },

      markDafFailed: (jobId, dafKey) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...job,
                failedDafs: job.failedDafs.includes(dafKey) ? job.failedDafs : [...job.failedDafs, dafKey],
              },
            },
          };
        });
      },

      setCurrentProgress: (jobId, masechet, daf) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...job, currentMasechet: masechet, currentDaf: daf },
            },
          };
        });
      },

      completeJob: (jobId) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...job, status: 'completed', currentMasechet: undefined, currentDaf: undefined },
            },
            queue: state.queue.filter((id) => id !== jobId),
          };
        });
      },

      errorJob: (jobId, error) => {
        set((state) => {
          const job = state.jobs[jobId];
          if (!job) return state;
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...job, status: 'error', error },
            },
            queue: state.queue.filter((id) => id !== jobId),
          };
        });
      },

      // ─── Selectors ──────────────────────────────────

      getActiveJob: () => {
        const { jobs, queue } = get();
        for (const id of queue) {
          if (jobs[id]?.status === 'downloading') return jobs[id];
        }
        return null;
      },

      getJobProgress: (jobId) => {
        const job = get().jobs[jobId];
        if (!job) return { completed: 0, total: 0, percent: 0, failed: 0 };
        const completed = job.completedDafs.length;
        const total = job.totalDafs;
        return {
          completed,
          total,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          failed: job.failedDafs.length,
        };
      },

      getOverallProgress: () => {
        const { jobs, queue } = get();
        const activeJobs = queue.map((id) => jobs[id]).filter(Boolean);
        if (activeJobs.length === 0) return { completed: 0, total: 0, percent: 0, activeLabel: null };
        let completed = 0, total = 0;
        for (const job of activeJobs) {
          completed += job.completedDafs.length;
          total += job.totalDafs;
        }
        const active = activeJobs.find((j) => j.status === 'downloading');
        return {
          completed,
          total,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          activeLabel: active?.label || null,
        };
      },

      hasActiveDownloads: () => {
        const { jobs, queue } = get();
        return queue.some((id) => {
          const s = jobs[id]?.status;
          return s === 'queued' || s === 'downloading';
        });
      },
    }),
    {
      name: 'gemara-download-store-v1',
      partialize: (state) => ({
        jobs: state.jobs,
        queue: state.queue.filter((id) => {
          const s = state.jobs[id]?.status;
          // Keep queued/paused/error jobs for resume; drop completed from queue
          return s && s !== 'completed';
        }),
        concurrency: state.concurrency,
      }),
    }
  )
);
