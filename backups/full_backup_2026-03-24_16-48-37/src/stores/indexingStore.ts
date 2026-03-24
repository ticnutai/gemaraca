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

export interface SavedProgress {
  offset: number;
  stats: IndexingStats;
  savedAt: number;
  concurrency: number;
  batchSize: number;
  skipIndexed: boolean;
  useAI: boolean;
}

const SAVE_KEY = 'indexing-saved-progress';

function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProgress;
  } catch { return null; }
}

function persistProgress(progress: SavedProgress | null) {
  if (progress) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } else {
    localStorage.removeItem(SAVE_KEY);
  }
}

interface IndexingState {
  status: IndexingStatus;
  stats: IndexingStats;
  errors: IndexingError[];
  concurrency: number;
  batchSize: number;
  skipIndexed: boolean;
  useAI: boolean;
  savedProgress: SavedProgress | null;
  _currentOffset: number;
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
  saveProgress: () => void;
  clearSavedProgress: () => void;
  startFromSaved: () => void;
  // Internal - called by the engine
  _setStatus: (s: IndexingStatus) => void;
  _updateStats: (patch: Partial<IndexingStats>) => void;
  _addError: (err: IndexingError) => void;
  _setAbortController: (ac: AbortController | null) => void;
  _setCurrentOffset: (offset: number) => void;
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
  savedProgress: loadSavedProgress(),
  _currentOffset: 0,
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
      _currentOffset: 0,
      _abortController: ac,
      _pauseResolver: null,
      _pausePromise: null,
    });
  },

  startFromSaved: () => {
    const saved = get().savedProgress;
    if (!saved) return;
    const ac = new AbortController();
    set({
      status: 'running',
      stats: { ...saved.stats, startedAt: Date.now() },
      errors: [],
      concurrency: saved.concurrency,
      batchSize: saved.batchSize,
      skipIndexed: saved.skipIndexed,
      useAI: saved.useAI,
      _currentOffset: saved.offset,
      _abortController: ac,
      _pauseResolver: null,
      _pausePromise: null,
    });
  },

  saveProgress: () => {
    const { stats, _currentOffset, concurrency, batchSize, skipIndexed, useAI } = get();
    const progress: SavedProgress = {
      offset: _currentOffset,
      stats,
      savedAt: Date.now(),
      concurrency,
      batchSize,
      skipIndexed,
      useAI,
    };
    persistProgress(progress);
    set({ savedProgress: progress });
  },

  clearSavedProgress: () => {
    persistProgress(null);
    set({ savedProgress: null });
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
    // Auto-save progress before cancelling
    get().saveProgress();
    if (_abortController) _abortController.abort();
    if (_pauseResolver) _pauseResolver(); // unblock if paused
    set({
      status: 'idle',
      _abortController: null,
      _pausePromise: null,
      _pauseResolver: null,
    });
  },

  reset: () => {
    persistProgress(null);
    set({
      status: 'idle',
      stats: { ...initialStats },
      errors: [],
      savedProgress: null,
      _currentOffset: 0,
      _abortController: null,
      _pausePromise: null,
      _pauseResolver: null,
    });
  },

  _setStatus: (s) => set({ status: s }),
  _updateStats: (patch) => set(state => ({
    stats: { ...state.stats, ...patch },
  })),
  _addError: (err) => set(state => ({
    errors: [...state.errors.slice(-99), err], // keep last 100
    stats: { ...state.stats, errors: state.stats.errors + 1 },
  })),
  _setAbortController: (ac) => set({ _abortController: ac }),
  _setCurrentOffset: (offset) => set({ _currentOffset: offset }),
}));
