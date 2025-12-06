import { useRef, useCallback, useEffect } from 'react';
import { useUploadStore } from '@/stores/uploadStore';
import { 
  uploadBatchWithRetry, 
  sleep, 
  isOnline, 
  waitForOnline,
  UploadAbortError 
} from '@/lib/uploadUtils';
import { toast } from '@/hooks/use-toast';

const BATCH_SIZE = 5;

interface UseUploadControllerOptions {
  onComplete?: (sessionId: string) => void;
  onError?: (sessionId: string, error: Error) => void;
}

export function useUploadController(options: UseUploadControllerOptions = {}) {
  // Multiple abort controllers for concurrent uploads
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pausedRef = useRef<Set<string>>(new Set());
  
  const {
    sessions,
    startSession,
    updateProgress,
    addResult,
    addError,
    setStatus,
    pauseSession,
    resumeSession,
    startAnalysis,
    updateAnalysisProgress,
    markAnalyzed,
    completeSession,
    clearSession,
    clearAllSessions,
    getActiveSessions,
    getTotalProgress,
  } = useUploadStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
    };
  }, []);

  const pause = useCallback((sessionId: string) => {
    pausedRef.current.add(sessionId);
    pauseSession(sessionId);
    toast({ title: "ההעלאה הושהתה", description: "לחץ המשך כדי להמשיך" });
  }, [pauseSession]);

  const resume = useCallback((sessionId: string) => {
    pausedRef.current.delete(sessionId);
    resumeSession(sessionId);
    toast({ title: "ממשיך בהעלאה..." });
  }, [resumeSession]);

  const cancel = useCallback((sessionId: string) => {
    const controller = abortControllersRef.current.get(sessionId);
    controller?.abort();
    abortControllersRef.current.delete(sessionId);
    pausedRef.current.delete(sessionId);
    setStatus(sessionId, 'error');
    toast({ 
      title: "ההעלאה בוטלה", 
      description: "הקבצים שהועלו נשמרו",
      variant: "destructive" 
    });
  }, [setStatus]);

  const cancelAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    pausedRef.current.clear();
    Object.keys(sessions).forEach((id) => setStatus(id, 'error'));
    toast({ 
      title: "כל ההעלאות בוטלו", 
      variant: "destructive" 
    });
  }, [sessions, setStatus]);

  const waitWhilePaused = useCallback(async (sessionId: string, signal?: AbortSignal) => {
    while (pausedRef.current.has(sessionId)) {
      if (signal?.aborted) {
        throw new UploadAbortError();
      }
      await sleep(300, signal);
    }
  }, []);

  const checkNetworkAndWait = useCallback(async (signal?: AbortSignal) => {
    if (!isOnline()) {
      toast({ 
        title: "אין חיבור לאינטרנט", 
        description: "ממתין לחיבור מחדש...",
        variant: "destructive" 
      });
      await waitForOnline(signal);
      toast({ title: "החיבור חזר", description: "ממשיך בהעלאה..." });
    }
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    metadata: { court?: string; year?: number; tags?: string[] },
    withAI: boolean = false,
    sessionName?: string
  ) => {
    if (files.length === 0) return;

    // Generate unique session ID
    const sessionId = crypto.randomUUID();
    const name = sessionName || `העלאה ${new Date().toLocaleTimeString('he-IL')}`;

    // Create new abort controller for this session
    const abortController = new AbortController();
    abortControllersRef.current.set(sessionId, abortController);
    const signal = abortController.signal;

    // Start session
    startSession(sessionId, name, metadata);

    // Create batches
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }

    updateProgress(sessionId, {
      total: files.length,
      completed: 0,
      current: '',
      successful: 0,
      failed: 0,
      skipped: 0,
    });

    const allResults: any[] = [];
    const allErrors: string[] = [];
    const uploadedFileNames: string[] = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        // Wait if paused
        await waitWhilePaused(sessionId, signal);
        
        // Check network
        await checkNetworkAndWait(signal);

        const batch = batches[i];
        const batchFileNames = batch.map(f => f.name).join(', ');
        
        updateProgress(sessionId, {
          current: batchFileNames.length > 50 
            ? batchFileNames.substring(0, 50) + '...' 
            : batchFileNames,
        });

        // Upload with retry and timeout
        const { results: batchResults, errors: batchErrors } = await uploadBatchWithRetry(
          batch,
          metadata,
          signal,
          (attempt, fileName) => {
            toast({ 
              title: `ניסיון חוזר (${attempt}/3)`, 
              description: fileName.substring(0, 30) + '...'
            });
          }
        );

        // Process results
        batchResults.forEach(result => {
          allResults.push(result);
          addResult(sessionId, {
            id: result.id,
            title: result.title || result.fileName,
            fileName: result.fileName,
            success: true,
          });
        });

        // Process errors
        batchErrors.forEach(error => {
          allErrors.push(error);
          addError(sessionId, error);
        });

        // Track uploaded files
        uploadedFileNames.push(...batch.map(f => f.name));

        updateProgress(sessionId, {
          completed: Math.min((i + 1) * BATCH_SIZE, files.length),
          successful: allResults.length,
          failed: allErrors.length,
        });

        // Small delay between batches
        if (i < batches.length - 1) {
          await sleep(200, signal);
        }
      }

      toast({
        title: `${name}: הועלו ${allResults.length} פסקים`,
        description: allErrors.length > 0 
          ? `${allErrors.length} שגיאות` 
          : withAI ? "מתחיל ניתוח AI..." : undefined,
      });

      // Run AI analysis if requested
      if (withAI && allResults.length > 0) {
        await runAIAnalysis(sessionId, allResults, signal);
      } else {
        completeSession(sessionId);
      }

      options.onComplete?.(sessionId);
      return { sessionId, uploadedFileNames, results: allResults, errors: allErrors };

    } catch (error) {
      if (error instanceof UploadAbortError) {
        console.log(`Upload ${sessionId} aborted`);
        return { sessionId, uploadedFileNames, results: allResults, errors: allErrors };
      }

      console.error('Upload error:', error);
      setStatus(sessionId, 'error');
      options.onError?.(sessionId, error as Error);

      toast({
        title: "שגיאה בהעלאה",
        description: "ההעלאות שהצליחו נשמרו. תוכל להמשיך מאוחר יותר.",
        variant: "destructive",
      });

      return { sessionId, uploadedFileNames, results: allResults, errors: allErrors };
    } finally {
      abortControllersRef.current.delete(sessionId);
    }
  }, [
    startSession, updateProgress, addResult, addError, setStatus, 
    completeSession, waitWhilePaused, checkNetworkAndWait, options
  ]);

  const runAIAnalysis = useCallback(async (
    sessionId: string,
    psakimToAnalyze: any[],
    signal?: AbortSignal
  ) => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    startAnalysis(sessionId, psakimToAnalyze.map(p => p.id));

    for (let i = 0; i < psakimToAnalyze.length; i++) {
      // Wait if paused
      await waitWhilePaused(sessionId, signal);
      
      // Check if aborted
      if (signal?.aborted) {
        throw new UploadAbortError();
      }

      const result = psakimToAnalyze[i];
      updateAnalysisProgress(sessionId, {
        current: i + 1,
        total: psakimToAnalyze.length,
        currentTitle: result.title || result.fileName,
      });

      try {
        await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: result.id }
        });
        markAnalyzed(sessionId, result.id);
        console.log(`Analyzed psak ${result.id}`);
      } catch (err) {
        console.error(`Error analyzing psak ${result.id}:`, err);
      }

      if (i < psakimToAnalyze.length - 1) {
        await sleep(500, signal);
      }
    }

    completeSession(sessionId);
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${psakimToAnalyze.length} פסקי דין`,
    });
  }, [startAnalysis, updateAnalysisProgress, markAnalyzed, completeSession, waitWhilePaused]);

  const analyzeExisting = useCallback(async (sessionId: string, psakimIds: string[]) => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: psakim } = await supabase
      .from('psakei_din')
      .select('*')
      .in('id', psakimIds);

    if (psakim && psakim.length > 0) {
      const abortController = new AbortController();
      abortControllersRef.current.set(sessionId, abortController);
      await runAIAnalysis(sessionId, psakim, abortController.signal);
    }
  }, [runAIAnalysis]);

  return {
    sessions,
    getActiveSessions,
    getTotalProgress,
    uploadFiles,
    analyzeExisting,
    pause,
    resume,
    cancel,
    cancelAll,
    clearSession,
    clearAllSessions,
  };
}
