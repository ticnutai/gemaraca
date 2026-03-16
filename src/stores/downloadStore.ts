import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DownloadItem {
  id: string;
  title: string;
  court: string;
  year: number;
  status: 'pending' | 'downloading' | 'done' | 'error';
  error?: string;
  blobUrl?: string;
}

export interface DownloadSession {
  id: string;
  name: string;
  startedAt: number;
  items: DownloadItem[];
  status: 'idle' | 'downloading' | 'paused' | 'packaging' | 'completed' | 'error';
  format: 'html' | 'pdf' | 'docx' | 'zip';
  concurrency: number;
  completedIds: string[];
}

interface DownloadStore {
  sessions: Record<string, DownloadSession>;
  
  startSession: (session: Omit<DownloadSession, 'completedIds'>) => void;
  updateItemStatus: (sessionId: string, itemId: string, status: DownloadItem['status'], error?: string) => void;
  markItemDone: (sessionId: string, itemId: string) => void;
  setSessionStatus: (sessionId: string, status: DownloadSession['status']) => void;
  clearSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  
  getActiveSession: () => DownloadSession | null;
  getResumableSession: () => DownloadSession | null;
  getProgress: (sessionId: string) => { total: number; completed: number; failed: number; percent: number };
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      sessions: {},

      startSession: (session) => {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [session.id]: { ...session, completedIds: [] },
          },
        }));
      },

      updateItemStatus: (sessionId, itemId, status, error) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                items: session.items.map((item) =>
                  item.id === itemId ? { ...item, status, error } : item
                ),
              },
            },
          };
        });
      },

      markItemDone: (sessionId, itemId) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                items: session.items.map((item) =>
                  item.id === itemId ? { ...item, status: 'done' as const } : item
                ),
                completedIds: session.completedIds.includes(itemId) ? session.completedIds : [...session.completedIds, itemId],
              },
            },
          };
        });
      },

      setSessionStatus: (sessionId, status) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, status },
            },
          };
        });
      },

      clearSession: (sessionId) => {
        set((state) => {
          const { [sessionId]: _, ...rest } = state.sessions;
          return { sessions: rest };
        });
      },

      clearAllSessions: () => set({ sessions: {} }),

      getActiveSession: () => {
        const { sessions } = get();
        return (
          Object.values(sessions).find((s) =>
            ['downloading', 'paused', 'packaging'].includes(s.status)
          ) || null
        );
      },

      getResumableSession: () => {
        const { sessions } = get();
        return (
          Object.values(sessions).find((s) =>
            ['paused', 'error'].includes(s.status) && s.completedIds.length > 0
          ) || null
        );
      },

      getProgress: (sessionId) => {
        const session = get().sessions[sessionId];
        if (!session) return { total: 0, completed: 0, failed: 0, percent: 0 };
        const total = session.items.length;
        const completed = session.items.filter((i) => i.status === 'done').length;
        const failed = session.items.filter((i) => i.status === 'error').length;
        return {
          total,
          completed,
          failed,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      },
    }),
    {
      name: 'download-store-v2',
      partialize: (state) => ({
        sessions: Object.fromEntries(
          Object.entries(state.sessions)
            .filter(([, s]) => s.status !== 'completed')
            .map(([id, s]) => [
            id,
            {
              ...s,
              items: s.items.map((i) => ({ ...i, blobUrl: undefined })),
            },
          ])
        ),
      }),
    }
  )
);
