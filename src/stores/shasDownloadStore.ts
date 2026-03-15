/**
 * Zustand store for background Shas download with persistence.
 * Survives page navigations and auto-resumes incomplete downloads.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { MASECHTOT } from '@/lib/masechtotData';

export interface MasechetDownloadState {
  masechet: string;
  hebrewName: string;
  maxDaf: number;
  currentDaf: number;
  totalPages: number;
  loadedPages: number;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  errors: string[];
}

interface ShasDownloadStore {
  // State
  isRunning: boolean;
  isPaused: boolean;
  concurrency: number;
  masechtot: MasechetDownloadState[];
  activeDownloads: string[];
  lastUpdated: number;

  // Actions
  startFullDownload: () => void;
  startSingleMasechet: (masechet: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setConcurrency: (n: number) => void;
  _refreshFromServer: () => Promise<void>;
  _processQueue: () => void;
  _downloadMasechet: (masechet: string) => Promise<void>;
}

// Internal abort controller
let _abortController: AbortController | null = null;

export const useShasDownloadStore = create<ShasDownloadStore>()(
  persist(
    (set, get) => ({
      isRunning: false,
      isPaused: false,
      concurrency: 3,
      masechtot: [],
      activeDownloads: [],
      lastUpdated: 0,

      setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(6, n)) }),

      _refreshFromServer: async () => {
        try {
          const { data, error } = await supabase.functions.invoke('bulk-load-shas', {
            body: { mode: 'status' },
          });
          if (error) return;

          const statusMap = data.status || {};
          const progressList = data.progress || [];

          const masechtot: MasechetDownloadState[] = MASECHTOT.map((m) => {
            const dbStatus = statusMap[m.sefariaName] || { total: 0, withText: 0 };
            const progress = progressList.find((p: any) => p.masechet === m.sefariaName);
            const totalPages = (m.maxDaf - 1) * 2;

            return {
              masechet: m.sefariaName,
              hebrewName: m.hebrewName,
              maxDaf: m.maxDaf,
              currentDaf: progress?.current_daf || 2,
              totalPages,
              loadedPages: dbStatus.withText || 0,
              status: progress?.status === 'completed' || dbStatus.withText >= totalPages
                ? 'completed'
                : progress?.status || 'pending',
              errors: progress?.errors || [],
            };
          });

          set({ masechtot, lastUpdated: Date.now() });
        } catch (e) {
          console.error('Failed to refresh shas download status:', e);
        }
      },

      startFullDownload: () => {
        _abortController = new AbortController();
        
        // Mark all non-completed as pending
        const masechtot = get().masechtot.map((m) =>
          m.status === 'completed' ? m : { ...m, status: 'pending' as const }
        );
        
        set({ isRunning: true, isPaused: false, masechtot });

        // Initialize on server
        supabase.functions.invoke('bulk-load-shas', { body: { mode: 'init' } })
          .then(() => get()._processQueue());
      },

      startSingleMasechet: (masechet) => {
        if (!_abortController) _abortController = new AbortController();
        
        const masechtot = get().masechtot.map((m) =>
          m.masechet === masechet ? { ...m, status: 'pending' as const, currentDaf: 2 } : m
        );
        
        set({ isRunning: true, isPaused: false, masechtot });
        get()._downloadMasechet(masechet);
      },

      pause: () => {
        set({ isPaused: true });
      },

      resume: () => {
        set({ isPaused: false });
        get()._processQueue();
      },

      stop: () => {
        _abortController?.abort();
        _abortController = null;
        
        const masechtot = get().masechtot.map((m) =>
          m.status === 'downloading' ? { ...m, status: 'paused' as const } : m
        );
        
        set({ isRunning: false, isPaused: false, masechtot, activeDownloads: [] });
      },

      _processQueue: () => {
        const state = get();
        if (!state.isRunning || state.isPaused) return;
        if (_abortController?.signal.aborted) return;

        const { concurrency, activeDownloads, masechtot } = state;
        const activeCount = activeDownloads.length;
        const slotsAvailable = concurrency - activeCount;

        if (slotsAvailable <= 0) return;

        // Find next pending masechtot
        const pending = masechtot.filter(
          (m) => (m.status === 'pending' || m.status === 'paused') && !activeDownloads.includes(m.masechet)
        );

        const toStart = pending.slice(0, slotsAvailable);
        
        if (toStart.length === 0 && activeCount === 0) {
          // All done
          set({ isRunning: false });
          return;
        }

        for (const m of toStart) {
          get()._downloadMasechet(m.masechet);
        }
      },

      _downloadMasechet: async (masechet) => {
        const state = get();
        const masechetState = state.masechtot.find((m) => m.masechet === masechet);
        if (!masechetState) return;

        // Mark as active
        const newActive = [...state.activeDownloads, masechet];
        
        set({
          activeDownloads: newActive,
          masechtot: state.masechtot.map((m) =>
            m.masechet === masechet ? { ...m, status: 'downloading' } : m
          ),
        });

        let currentDaf = masechetState.currentDaf || 2;
        const maxDaf = masechetState.maxDaf;

        try {
          while (currentDaf <= maxDaf) {
            if (_abortController?.signal.aborted) break;
            
            // Wait while paused
            while (get().isPaused && !_abortController?.signal.aborted) {
              await new Promise((r) => setTimeout(r, 500));
            }
            if (_abortController?.signal.aborted) break;

            const { data, error } = await supabase.functions.invoke('bulk-load-shas', {
              body: { masechet, startDaf: currentDaf },
            });

            if (error) {
              console.error(`Download error for ${masechet}:`, error);
              // Mark error but continue trying
              set({
                masechtot: get().masechtot.map((m) =>
                  m.masechet === masechet
                    ? { ...m, errors: [...m.errors, error.message].slice(-20) }
                    : m
                ),
              });
              // Retry after delay
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }

            // Update local state
            set({
              masechtot: get().masechtot.map((m) =>
                m.masechet === masechet
                  ? { ...m, currentDaf: data.nextDaf || maxDaf }
                  : m
              ),
            });

            if (!data.hasMore) break;
            currentDaf = data.nextDaf;
          }

          // Mark completed
          if (!_abortController?.signal.aborted) {
            set({
              masechtot: get().masechtot.map((m) =>
                m.masechet === masechet ? { ...m, status: 'completed' } : m
              ),
            });
          }
        } catch (e) {
          console.error(`Fatal error downloading ${masechet}:`, e);
          set({
            masechtot: get().masechtot.map((m) =>
              m.masechet === masechet ? { ...m, status: 'error' } : m
            ),
          });
        } finally {
          // Remove from active
          const active = get().activeDownloads.filter((m) => m !== masechet);
          set({ activeDownloads: active });

          // Process next in queue
          get()._processQueue();
        }
      },
    }),
    {
      name: 'shas-download-store',
      partialize: (state) => ({
        masechtot: state.masechtot,
        concurrency: state.concurrency,
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
