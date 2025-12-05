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
  // Current session
  session: UploadSession | null;
  
  // Actions
  startSession: (metadata: UploadSession['metadata']) => void;
  updateProgress: (progress: Partial<UploadProgress>) => void;
  addResult: (result: UploadResult) => void;
  addError: (error: string) => void;
  setStatus: (status: UploadSession['status']) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  startAnalysis: (pendingIds: string[]) => void;
  updateAnalysisProgress: (progress: AnalysisProgress) => void;
  markAnalyzed: (id: string) => void;
  completeSession: () => void;
  clearSession: () => void;
  
  // Hash storage for content-based duplicate detection
  fileHashes: Record<string, string>;
  addFileHash: (hash: string, title: string) => void;
  hasFileHash: (hash: string) => boolean;
  getFileByHash: (hash: string) => string | undefined;
  
  // Summary
  getSummary: () => {
    totalUploaded: number;
    totalAnalyzed: number;
    totalErrors: number;
    totalSkipped: number;
    duration: number;
  } | null;
}

export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      session: null,
      fileHashes: {},
      
      startSession: (metadata) => {
        set({
          session: {
            id: crypto.randomUUID(),
            startedAt: Date.now(),
            metadata,
            results: [],
            errors: [],
            pendingAnalysis: [],
            uploadProgress: null,
            analysisProgress: null,
            status: 'uploading',
          },
        });
      },
      
      updateProgress: (progress) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
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
        });
      },
      
      addResult: (result) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            results: [...session.results, result],
          },
        });
      },
      
      addError: (error) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            errors: [...session.errors, error],
          },
        });
      },
      
      setStatus: (status) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            status,
          },
        });
      },
      
      pauseSession: () => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            status: 'paused',
          },
        });
      },
      
      resumeSession: () => {
        const { session } = get();
        if (!session) return;
        
        const newStatus = session.pendingAnalysis.length > 0 ? 'analyzing' : 'uploading';
        set({
          session: {
            ...session,
            status: newStatus,
          },
        });
      },
      
      startAnalysis: (pendingIds) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            pendingAnalysis: pendingIds,
            analysisProgress: { current: 0, total: pendingIds.length },
            status: 'analyzing',
          },
        });
      },
      
      updateAnalysisProgress: (progress) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            analysisProgress: progress,
          },
        });
      },
      
      markAnalyzed: (id) => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            results: session.results.map((r) =>
              r.id === id ? { ...r, analyzed: true } : r
            ),
            pendingAnalysis: session.pendingAnalysis.filter((pid) => pid !== id),
          },
        });
      },
      
      completeSession: () => {
        const { session } = get();
        if (!session) return;
        
        set({
          session: {
            ...session,
            status: 'completed',
          },
        });
      },
      
      clearSession: () => {
        set({ session: null });
      },
      
      // Hash methods for content-based duplicate detection
      addFileHash: (hash, title) => {
        const { fileHashes } = get();
        set({
          fileHashes: {
            ...fileHashes,
            [hash]: title,
          },
        });
      },
      
      hasFileHash: (hash) => {
        const { fileHashes } = get();
        return hash in fileHashes;
      },
      
      getFileByHash: (hash) => {
        const { fileHashes } = get();
        return fileHashes[hash];
      },
      
      getSummary: () => {
        const { session } = get();
        if (!session) return null;
        
        return {
          totalUploaded: session.results.filter((r) => r.success).length,
          totalAnalyzed: session.results.filter((r) => r.analyzed).length,
          totalErrors: session.errors.length,
          totalSkipped: session.uploadProgress?.skipped || 0,
          duration: Date.now() - session.startedAt,
        };
      },
    }),
    {
      name: 'upload-store',
      partialize: (state) => ({
        session: state.session,
        fileHashes: state.fileHashes,
      }),
    }
  )
);
