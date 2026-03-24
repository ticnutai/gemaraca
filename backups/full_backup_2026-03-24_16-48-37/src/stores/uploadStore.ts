import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UploadResult {
  id: string;
  title: string;
  fileName: string;
  success: boolean;
  analyzed?: boolean;
  error?: string;
}

export interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  successful: number;
  failed: number;
  skipped: number;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  currentTitle?: string;
}

export interface UploadSession {
  id: string;
  name: string; // ZIP/folder name
  startedAt: number;
  metadata: {
    court?: string;
    year?: number;
    tags?: string[];
  };
  results: UploadResult[];
  errors: string[];
  pendingAnalysis: string[];
  uploadProgress: UploadProgress | null;
  analysisProgress: AnalysisProgress | null;
  status: 'idle' | 'uploading' | 'paused' | 'analyzing' | 'completed' | 'error';
}

interface UploadStore {
  // Multiple concurrent sessions
  sessions: Record<string, UploadSession>;
  
  // Actions for multi-session
  startSession: (id: string, name: string, metadata: UploadSession['metadata']) => void;
  updateProgress: (sessionId: string, progress: Partial<UploadProgress>) => void;
  addResult: (sessionId: string, result: UploadResult) => void;
  addError: (sessionId: string, error: string) => void;
  setStatus: (sessionId: string, status: UploadSession['status']) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  startAnalysis: (sessionId: string, pendingIds: string[]) => void;
  updateAnalysisProgress: (sessionId: string, progress: AnalysisProgress) => void;
  markAnalyzed: (sessionId: string, id: string) => void;
  completeSession: (sessionId: string) => void;
  clearSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  cleanupStaleSessions: () => void;
  
  // Hash storage for content-based duplicate detection
  fileHashes: Record<string, string>;
  addFileHash: (hash: string, title: string) => void;
  hasFileHash: (hash: string) => boolean;
  getFileByHash: (hash: string) => string | undefined;
  
  // Get active sessions
  getActiveSessions: () => UploadSession[];
  getTotalProgress: () => {
    total: number;
    completed: number;
    successful: number;
    failed: number;
    activeSessions: number;
  };
}

export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      fileHashes: {},
      
      startSession: (id, name, metadata) => {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [id]: {
              id,
              name,
              startedAt: Date.now(),
              metadata,
              results: [],
              errors: [],
              pendingAnalysis: [],
              uploadProgress: null,
              analysisProgress: null,
              status: 'uploading',
            },
          },
        }));
      },
      
      updateProgress: (sessionId, progress) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                uploadProgress: session.uploadProgress
                  ? { ...session.uploadProgress, ...progress }
                  : {
                      total: 0,
                      completed: 0,
                      current: '',
                      successful: 0,
                      failed: 0,
                      skipped: 0,
                      ...progress,
                    },
              },
            },
          };
        });
      },
      
      addResult: (sessionId, result) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                results: [...session.results, result],
              },
            },
          };
        });
      },
      
      addError: (sessionId, error) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                errors: [...session.errors, error],
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
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                status,
              },
            },
          };
        });
      },
      
      pauseSession: (sessionId) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                status: 'paused',
              },
            },
          };
        });
      },
      
      resumeSession: (sessionId) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          const newStatus = session.pendingAnalysis.length > 0 ? 'analyzing' : 'uploading';
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                status: newStatus,
              },
            },
          };
        });
      },
      
      startAnalysis: (sessionId, pendingIds) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                pendingAnalysis: pendingIds,
                analysisProgress: { current: 0, total: pendingIds.length },
                status: 'analyzing',
              },
            },
          };
        });
      },
      
      updateAnalysisProgress: (sessionId, progress) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                analysisProgress: progress,
              },
            },
          };
        });
      },
      
      markAnalyzed: (sessionId, id) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                results: session.results.map((r) =>
                  r.id === id ? { ...r, analyzed: true } : r
                ),
                pendingAnalysis: session.pendingAnalysis.filter((pid) => pid !== id),
              },
            },
          };
        });
      },
      
      completeSession: (sessionId) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                status: 'completed',
              },
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
      
      clearAllSessions: () => {
        set({ sessions: {} });
      },
      
      // Clean up stale sessions (older than 24 hours or stuck)
      cleanupStaleSessions: () => {
        set((state) => {
          const now = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          const cleanedSessions: Record<string, UploadSession> = {};
          
          Object.entries(state.sessions).forEach(([id, session]) => {
            // Keep completed sessions for a bit
            if (session.status === 'completed') {
              cleanedSessions[id] = session;
              return;
            }
            
            // Remove sessions older than 24 hours
            if (now - session.startedAt > maxAge) {
              return; // Skip (remove)
            }
            
            // Keep recent sessions
            cleanedSessions[id] = session;
          });
          
          return { sessions: cleanedSessions };
        });
      },
      
      // Hash methods for content-based duplicate detection
      addFileHash: (hash, title) => {
        set((state) => ({
          fileHashes: {
            ...state.fileHashes,
            [hash]: title,
          },
        }));
      },
      
      hasFileHash: (hash) => {
        return hash in get().fileHashes;
      },
      
      getFileByHash: (hash) => {
        return get().fileHashes[hash];
      },
      
      getActiveSessions: () => {
        const { sessions } = get();
        return Object.values(sessions).filter(
          (s) => ['uploading', 'paused', 'analyzing'].includes(s.status)
        );
      },
      
      getTotalProgress: () => {
        const { sessions } = get();
        const active = Object.values(sessions).filter(
          (s) => ['uploading', 'paused', 'analyzing'].includes(s.status)
        );
        
        let total = 0;
        let completed = 0;
        let successful = 0;
        let failed = 0;
        
        active.forEach((s) => {
          if (s.uploadProgress) {
            total += s.uploadProgress.total;
            completed += s.uploadProgress.completed;
            successful += s.uploadProgress.successful;
            failed += s.uploadProgress.failed;
          }
        });
        
        return { total, completed, successful, failed, activeSessions: active.length };
      },
    }),
    {
      name: 'upload-store-v2',
      partialize: (state) => ({
        sessions: state.sessions,
        fileHashes: state.fileHashes,
      }),
    }
  )
);

// Legacy compatibility - get single session (first active or first completed)
export function useLegacySession() {
  const sessions = useUploadStore((state) => state.sessions);
  const sessionsArr = Object.values(sessions);
  
  // Return first active session, or first completed, or null
  return (
    sessionsArr.find((s) => ['uploading', 'paused', 'analyzing'].includes(s.status)) ||
    sessionsArr.find((s) => s.status === 'completed') ||
    null
  );
}
