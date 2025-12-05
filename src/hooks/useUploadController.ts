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
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useUploadController(options: UseUploadControllerOptions = {}) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  
  const {
    session,
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
  } = useUploadStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    pauseSession();
    toast({ title: "ההעלאה הושהתה", description: "לחץ המשך כדי להמשיך" });
  }, [pauseSession]);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    resumeSession();
    toast({ title: "ממשיך בהעלאה..." });
  }, [resumeSession]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    isPausedRef.current = false;
    setStatus('error');
    toast({ 
      title: "ההעלאה בוטלה", 
      description: "הקבצים שהועלו נשמרו",
      variant: "destructive" 
    });
  }, [setStatus]);

  const waitWhilePaused = useCallback(async (signal?: AbortSignal) => {
    while (isPausedRef.current) {
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
    withAI: boolean = false
  ) => {
    if (files.length === 0) return;

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    isPausedRef.current = false;

    // Start session
    startSession(metadata);

    // Create batches
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }

    updateProgress({
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
        await waitWhilePaused(signal);
        
        // Check network
        await checkNetworkAndWait(signal);

        const batch = batches[i];
        const batchFileNames = batch.map(f => f.name).join(', ');
        
        updateProgress({
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
          addResult({
            id: result.id,
            title: result.title || result.fileName,
            fileName: result.fileName,
            success: true,
          });
        });

        // Process errors
        batchErrors.forEach(error => {
          allErrors.push(error);
          addError(error);
        });

        // Track uploaded files
        uploadedFileNames.push(...batch.map(f => f.name));

        updateProgress({
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
        title: `הועלו ${allResults.length} פסקי דין בהצלחה`,
        description: allErrors.length > 0 
          ? `${allErrors.length} שגיאות` 
          : withAI ? "מתחיל ניתוח AI..." : undefined,
      });

      // Run AI analysis if requested
      if (withAI && allResults.length > 0) {
        await runAIAnalysis(allResults, signal);
      } else {
        completeSession();
      }

      options.onComplete?.();
      return { uploadedFileNames, results: allResults, errors: allErrors };

    } catch (error) {
      if (error instanceof UploadAbortError) {
        console.log('Upload aborted');
        return { uploadedFileNames, results: allResults, errors: allErrors };
      }

      console.error('Upload error:', error);
      setStatus('error');
      options.onError?.(error as Error);

      toast({
        title: "שגיאה בהעלאה",
        description: "ההעלאות שהצליחו נשמרו. תוכל להמשיך מאוחר יותר.",
        variant: "destructive",
      });

      return { uploadedFileNames, results: allResults, errors: allErrors };
    }
  }, [
    startSession, updateProgress, addResult, addError, setStatus, 
    completeSession, waitWhilePaused, checkNetworkAndWait, options
  ]);

  const runAIAnalysis = useCallback(async (
    psakimToAnalyze: any[],
    signal?: AbortSignal
  ) => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    startAnalysis(psakimToAnalyze.map(p => p.id));

    for (let i = 0; i < psakimToAnalyze.length; i++) {
      // Wait if paused
      await waitWhilePaused(signal);
      
      // Check if aborted
      if (signal?.aborted) {
        throw new UploadAbortError();
      }

      const result = psakimToAnalyze[i];
      updateAnalysisProgress({
        current: i + 1,
        total: psakimToAnalyze.length,
        currentTitle: result.title || result.fileName,
      });

      try {
        await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: result.id }
        });
        markAnalyzed(result.id);
        console.log(`Analyzed psak ${result.id}`);
      } catch (err) {
        console.error(`Error analyzing psak ${result.id}:`, err);
      }

      if (i < psakimToAnalyze.length - 1) {
        await sleep(500, signal);
      }
    }

    completeSession();
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${psakimToAnalyze.length} פסקי דין וקושרו למקורות`,
    });
  }, [startAnalysis, updateAnalysisProgress, markAnalyzed, completeSession, waitWhilePaused]);

  const analyzeExisting = useCallback(async (psakimIds: string[]) => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: psakim } = await supabase
      .from('psakei_din')
      .select('*')
      .in('id', psakimIds);

    if (psakim && psakim.length > 0) {
      abortControllerRef.current = new AbortController();
      await runAIAnalysis(psakim, abortControllerRef.current.signal);
    }
  }, [runAIAnalysis]);

  return {
    session,
    isUploading: session?.status === 'uploading',
    isPaused: session?.status === 'paused',
    isAnalyzing: session?.status === 'analyzing',
    isActive: ['uploading', 'paused', 'analyzing'].includes(session?.status || ''),
    uploadFiles,
    analyzeExisting,
    pause,
    resume,
    cancel,
    clearSession,
  };
}
