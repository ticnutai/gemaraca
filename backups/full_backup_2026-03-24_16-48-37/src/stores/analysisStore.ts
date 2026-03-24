import { create } from 'zustand';

export type AnalysisStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface AnalysisStats {
  totalPsakim: number;
  processed: number;
  skipped: number;
  sectionsFound: number;
  errors: number;
  startedAt: number | null;
  elapsed: number;
  avgPerItem: number;
}

export interface AnalysisError {
  psakId: string;
  title: string;
  message: string;
  timestamp: number;
}

export interface AnalysisSavedProgress {
  offset: number;
  stats: AnalysisStats;
  savedAt: number;
  batchSize: number;
  concurrency: number;
  skipAnalyzed: boolean;
  useAI: boolean;
}

const ANALYSIS_SAVE_KEY = 'analysis-saved-progress';

function loadSavedProgress(): AnalysisSavedProgress | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisSavedProgress;
  } catch { return null; }
}

function persistProgress(progress: AnalysisSavedProgress | null) {
  if (progress) {
    localStorage.setItem(ANALYSIS_SAVE_KEY, JSON.stringify(progress));
  } else {
    localStorage.removeItem(ANALYSIS_SAVE_KEY);
  }
}

const initialStats: AnalysisStats = {
  totalPsakim: 0,
  processed: 0,
  skipped: 0,
  sectionsFound: 0,
  errors: 0,
  startedAt: null,
  elapsed: 0,
  avgPerItem: 0,
};

interface AnalysisState {
  status: AnalysisStatus;
  stats: AnalysisStats;
  errors: AnalysisError[];
  batchSize: number;
  concurrency: number;
  skipAnalyzed: boolean;
  useAI: boolean;
  savedProgress: AnalysisSavedProgress | null;
  _currentOffset: number;
  _abortController: AbortController | null;
  _pauseResolver: (() => void) | null;
  _pausePromise: Promise<void> | null;
}

interface AnalysisActions {
  setBatchSize: (n: number) => void;
  setConcurrency: (n: number) => void;
  setSkipAnalyzed: (v: boolean) => void;
  setUseAI: (v: boolean) => void;
  start: () => void;
  startFromSaved: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  saveProgress: () => void;
  clearSavedProgress: () => void;
  _setStatus: (s: AnalysisStatus) => void;
  _updateStats: (patch: Partial<AnalysisStats>) => void;
  _addError: (err: AnalysisError) => void;
  _setCurrentOffset: (offset: number) => void;
}

export const useAnalysisStore = create<AnalysisState & AnalysisActions>((set, get) => ({
  status: 'idle',
  stats: { ...initialStats },
  errors: [],
  batchSize: 50,
  concurrency: 3,
  skipAnalyzed: true,
  useAI: false,
  savedProgress: loadSavedProgress(),
  _currentOffset: 0,
  _abortController: null,
  _pauseResolver: null,
  _pausePromise: null,

  setBatchSize: (n) => set({ batchSize: Math.max(10, Math.min(500, n)) }),
  setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(15, n)) }),
  setSkipAnalyzed: (v) => set({ skipAnalyzed: v }),
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
      batchSize: saved.batchSize,
      concurrency: saved.concurrency,
      skipAnalyzed: saved.skipAnalyzed,
      useAI: saved.useAI,
      _currentOffset: saved.offset,
      _abortController: ac,
      _pauseResolver: null,
      _pausePromise: null,
    });
  },

  saveProgress: () => {
    const { stats, _currentOffset, batchSize, concurrency, skipAnalyzed, useAI } = get();
    const progress: AnalysisSavedProgress = {
      offset: _currentOffset,
      stats,
      savedAt: Date.now(),
      batchSize,
      concurrency,
      skipAnalyzed,
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
    set({ status: 'paused', _pausePromise: promise, _pauseResolver: resolver });
  },

  resume: () => {
    const { _pauseResolver } = get();
    if (_pauseResolver) _pauseResolver();
    set({ status: 'running', _pausePromise: null, _pauseResolver: null });
  },

  cancel: () => {
    const { _abortController, _pauseResolver } = get();
    get().saveProgress();
    if (_abortController) _abortController.abort();
    if (_pauseResolver) _pauseResolver();
    set({ status: 'idle', _abortController: null, _pausePromise: null, _pauseResolver: null });
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
  _updateStats: (patch) => set(state => ({ stats: { ...state.stats, ...patch } })),
  _addError: (err) => set(state => ({
    errors: [...state.errors.slice(-99), err],
    stats: { ...state.stats, errors: state.stats.errors + 1 },
  })),
  _setCurrentOffset: (offset) => set({ _currentOffset: offset }),
}));
