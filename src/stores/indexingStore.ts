import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────
export type IndexingStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface IndexingStats {
  totalPsakim: number;
  processed: number;
  skipped: number;         // already indexed
  refsFound: number;
  errors: number;
  startedAt: number | null;
  elapsed: number;         // ms
  avgPerItem: number;      // ms
}

export interface IndexingError {
  psakId: string;
  title: string;
  message: string;
  timestamp: number;
}

interface IndexingState {
  status: IndexingStatus;
  stats: IndexingStats;
  errors: IndexingError[];
  concurrency: number;
  batchSize: number;
  skipIndexed: boolean;
  useAI: boolean;
  // Internal
  _abortController: AbortController | null;
  _pauseResolver: (() => void) | null;
  _pausePromise: Promise<void> | null;
}

interface IndexingActions {
  setConcurrency: (n: number) => void;
  setBatchSize: (n: number) => void;
  setSkipIndexed: (v: boolean) => void;
  setUseAI: (v: boolean) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  // Internal - called by the engine
  _setStatus: (s: IndexingStatus) => void;
  _updateStats: (patch: Partial<IndexingStats>) => void;
  _addError: (err: IndexingError) => void;
  _setAbortController: (ac: AbortController | null) => void;
}

const initialStats: IndexingStats = {
  totalPsakim: 0,
  processed: 0,
  skipped: 0,
  refsFound: 0,
  errors: 0,
  startedAt: null,
  elapsed: 0,
  avgPerItem: 0,
};

export const useIndexingStore = create<IndexingState & IndexingActions>((set, get) => ({
  status: 'idle',
  stats: { ...initialStats },
  errors: [],
  concurrency: 5,
  batchSize: 50,
  skipIndexed: true,
  useAI: false,
  _abortController: null,
  _pauseResolver: null,
  _pausePromise: null,

  setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(20, n)) }),
  setBatchSize: (n) => set({ batchSize: Math.max(10, Math.min(500, n)) }),
  setSkipIndexed: (v) => set({ skipIndexed: v }),
  setUseAI: (v) => set({ useAI: v }),

  start: () => {
    const ac = new AbortController();
    set({
      status: 'running',
      stats: { ...initialStats, startedAt: Date.now() },
      errors: [],
      _abortController: ac,
      _pauseResolver: null,
      _pausePromise: null,
    });
  },

  pause: () => {
    let resolver: (() => void) | null = null;
    const promise = new Promise<void>(resolve => { resolver = resolve; });
    set({
      status: 'paused',
      _pausePromise: promise,
      _pauseResolver: resolver,
    });
  },

  resume: () => {
    const { _pauseResolver } = get();
    if (_pauseResolver) _pauseResolver();
    set({
      status: 'running',
      _pausePromise: null,
      _pauseResolver: null,
    });
  },

  cancel: () => {
    const { _abortController, _pauseResolver } = get();
    if (_abortController) _abortController.abort();
    if (_pauseResolver) _pauseResolver(); // unblock if paused
    set({
      status: 'idle',
      _abortController: null,
      _pausePromise: null,
      _pauseResolver: null,
    });
  },

  reset: () => set({
    status: 'idle',
    stats: { ...initialStats },
    errors: [],
    _abortController: null,
    _pausePromise: null,
    _pauseResolver: null,
  }),

  _setStatus: (s) => set({ status: s }),
  _updateStats: (patch) => set(state => ({
    stats: { ...state.stats, ...patch },
  })),
  _addError: (err) => set(state => ({
    errors: [...state.errors.slice(-99), err], // keep last 100
    stats: { ...state.stats, errors: state.stats.errors + 1 },
  })),
  _setAbortController: (ac) => set({ _abortController: ac }),
}));
