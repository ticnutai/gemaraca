import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE_KEY = 'explorer-panel-layout';
const DEFAULT_LAYOUT: PanelLayout = { x: -1, y: -1, w: 480, h: 520 };

function loadLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_LAYOUT };
}

interface ExplorerPanelState {
  isOpen: boolean;
  layout: PanelLayout;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setLayout: (layout: PanelLayout) => void;
  syncFromCloud: () => Promise<void>;
  syncToCloud: () => Promise<void>;
}

let cloudSaveTimer: ReturnType<typeof setTimeout> | undefined;

export const useExplorerPanelStore = create<ExplorerPanelState>((set, get) => ({
  isOpen: false,
  layout: loadLayout(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setLayout: (layout) => {
    set({ layout });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* */ }
    // Debounced cloud save
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => get().syncToCloud(), 2000);
  },

  syncFromCloud: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cloud = user?.user_metadata?.explorerPanel as PanelLayout | undefined;
      if (cloud && typeof cloud.x === 'number') {
        const merged = { ...DEFAULT_LAYOUT, ...cloud };
        set({ layout: merged });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* */ }
      }
    } catch { /* not logged in or error */ }
  },

  syncToCloud: async () => {
    try {
      const layout = get().layout;
      await supabase.auth.updateUser({ data: { explorerPanel: layout } });
    } catch { /* not logged in or error */ }
  },
}));
