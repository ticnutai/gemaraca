import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeleteSession {
  id: string;
  name: string;
  startedAt: number;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status: 'deleting' | 'paused' | 'completed' | 'error' | 'cancelled';
  failedIds: string[];
  errors: string[];
}

interface DeleteStore {
  sessions: Record<string, DeleteSession>;

  startSession: (session: DeleteSession) => void;
  updateProgress: (sessionId: string, completed: number, failed: number) => void;
  addError: (sessionId: string, itemId: string, error: string) => void;
  setStatus: (sessionId: string, status: DeleteSession['status']) => void;
  clearSession: (sessionId: string) => void;
  clearAllSessions: () => void;

  getActiveSession: () => DeleteSession | null;
  getProgress: (sessionId: string) => { total: number; completed: number; failed: number; percent: number };
}

export const useDeleteStore = create<DeleteStore>()(
  persist(
    (set, get) => ({
      sessions: {},

      startSession: (session) => {
        set((state) => ({
          sessions: { ...state.sessions, [session.id]: session },
        }));
      },

      updateProgress: (sessionId, completed, failed) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, completedCount: completed, failedCount: failed },
            },
          };
        });
      },

      addError: (sessionId, itemId, error) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                failedIds: [...session.failedIds, itemId],
                errors: [...session.errors.slice(-49), `${itemId}: ${error}`],
              },
            },
          };
        });
      },

      setStatus: (sessionId, status) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: { ...state.sessions, [sessionId]: { ...session, status } },
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
        return Object.values(sessions).find((s) => ['deleting', 'paused'].includes(s.status)) || null;
      },

      getProgress: (sessionId) => {
        const session = get().sessions[sessionId];
        if (!session) return { total: 0, completed: 0, failed: 0, percent: 0 };
        return {
          total: session.totalCount,
          completed: session.completedCount,
          failed: session.failedCount,
          percent: session.totalCount > 0 ? Math.round((session.completedCount / session.totalCount) * 100) : 0,
        };
      },
    }),
    {
      name: 'delete-store-v1',
      partialize: (state) => ({
        sessions: Object.fromEntries(
          Object.entries(state.sessions).filter(([, s]) => s.status !== 'completed')
        ),
      }),
    }
  )
);
