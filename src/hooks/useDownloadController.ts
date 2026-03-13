import { useRef, useCallback, useEffect } from 'react';
import { useDownloadStore, DownloadItem } from '@/stores/downloadStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type JSZip from 'jszip';

const DEFAULT_CONCURRENCY = 3;
const RETRY_DELAYS = [1000, 3000, 5000];
const ITEM_TIMEOUT = 30000;

export function useDownloadController() {
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const activeRef = useRef(false);

  const {
    sessions,
    startSession,
    updateItemStatus,
    markItemDone,
    setSessionStatus,
    clearSession,
    getProgress,
  } = useDownloadStore();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sleep = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
    });

  const waitWhilePaused = async (signal: AbortSignal) => {
    while (pausedRef.current) {
      if (signal.aborted) throw new Error('aborted');
      await sleep(300, signal);
    }
  };

  const fetchPsakContent = async (id: string, signal: AbortSignal): Promise<{ title: string; content: string }> => {
    const { data, error } = await supabase
      .from('psakei_din')
      .select('title, full_text, summary, court, year, case_number')
      .eq('id', id)
      .single();

    if (error || !data) throw new Error(error?.message || 'Not found');

    const content = data.full_text || data.summary || '';
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.title)}</title>
<style>
  body { font-family: 'David', 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 20px; direction: rtl; line-height: 1.8; }
  h1 { color: #1a365d; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px; }
  .meta { background: #f7fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px; color: #4a5568; }
  .meta span { margin-left: 20px; }
  .content { white-space: pre-wrap; }
</style>
</head>
<body>
<h1>${escapeHtml(data.title)}</h1>
<div class="meta">
  <span>בית דין: ${escapeHtml(data.court)}</span>
  <span>שנה: ${data.year}</span>
  ${data.case_number ? `<span>תיק: ${escapeHtml(data.case_number)}</span>` : ''}
</div>
<div class="content">${escapeHtml(content)}</div>
</body>
</html>`;

    return { title: data.title, content: html };
  };

  const downloadWithRetry = async (
    id: string,
    signal: AbortSignal
  ): Promise<{ title: string; content: string }> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (signal.aborted) throw new Error('aborted');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ITEM_TIMEOUT);
        
        // Combine with parent signal
        signal.addEventListener('abort', () => controller.abort(), { once: true });
        
        try {
          return await fetchPsakContent(id, controller.signal);
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        lastError = err as Error;
        if ((err as Error).message === 'aborted') throw err;
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt], signal);
        }
      }
    }
    throw lastError || new Error('Download failed');
  };

  const startDownload = useCallback(async (
    items: Array<{ id: string; title: string; court: string; year: number }>,
    format: 'html' | 'zip' = 'zip',
    sessionName?: string
  ) => {
    if (items.length === 0) return;
    if (activeRef.current) {
      toast({ title: 'הורדה כבר פעילה', variant: 'destructive' });
      return;
    }

    activeRef.current = true;
    pausedRef.current = false;
    const sessionId = crypto.randomUUID();
    const name = sessionName || `הורדת ${items.length} פסקי דין`;

    const abortController = new AbortController();
    abortRef.current = abortController;
    const signal = abortController.signal;

    // Check which items were already completed (resume support)
    const existingSession = Object.values(sessions).find(
      s => s.status === 'paused' || s.status === 'error'
    );
    const alreadyDone = new Set(existingSession?.completedIds || []);

    const downloadItems: DownloadItem[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      court: item.court,
      year: item.year,
      status: alreadyDone.has(item.id) ? 'done' : 'pending',
    }));

    // Clean old session if resuming
    if (existingSession) {
      clearSession(existingSession.id);
    }

    startSession({
      id: sessionId,
      name,
      startedAt: Date.now(),
      items: downloadItems,
      status: 'downloading',
      format,
      concurrency: DEFAULT_CONCURRENCY,
    });

    const pendingItems = downloadItems.filter((i) => i.status === 'pending');
    const downloadedContents: Map<string, { title: string; content: string }> = new Map();

    // Concurrent download with semaphore
    let activeCount = 0;
    let itemIndex = 0;
    const errors: string[] = [];

    const processNext = async (): Promise<void> => {
      while (itemIndex < pendingItems.length) {
        if (signal.aborted) return;
        await waitWhilePaused(signal);

        const currentIndex = itemIndex++;
        const item = pendingItems[currentIndex];

        activeCount++;
        updateItemStatus(sessionId, item.id, 'downloading');

        try {
          const result = await downloadWithRetry(item.id, signal);
          downloadedContents.set(item.id, result);
          markItemDone(sessionId, item.id);
        } catch (err) {
          if ((err as Error).message === 'aborted') return;
          updateItemStatus(sessionId, item.id, 'error', (err as Error).message);
          errors.push(`${item.title}: ${(err as Error).message}`);
        } finally {
          activeCount--;
        }

        // Throttle to avoid overload
        if (currentIndex % 50 === 0 && currentIndex > 0) {
          await sleep(500, signal);
        }
      }
    };

    try {
      // Launch concurrent workers
      const workers = Array.from(
        { length: Math.min(DEFAULT_CONCURRENCY, pendingItems.length) },
        () => processNext()
      );
      await Promise.all(workers);

      if (signal.aborted) {
        activeRef.current = false;
        return;
      }

      // Package as ZIP
      if (format === 'zip') {
        setSessionStatus(sessionId, 'packaging');
        
        const { default: JSZipLib } = await import('jszip');
        const zip = new JSZipLib();
        downloadedContents.forEach((data, _id) => {
          const safeName = data.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
          zip.file(`${safeName}.html`, data.content);
        });

        // Also add previously completed items if resuming
        // (they won't be in downloadedContents since we just fetched pending ones)

        const blob = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (meta) => {
            // Progress callback for ZIP generation
          }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `psakei-din-${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }

      setSessionStatus(sessionId, 'completed');
      toast({
        title: 'ההורדה הושלמה!',
        description: `הורדו ${downloadedContents.size} פסקי דין${errors.length > 0 ? ` (${errors.length} שגיאות)` : ''}`,
      });
    } catch (err) {
      if ((err as Error).message !== 'aborted') {
        setSessionStatus(sessionId, 'error');
        toast({ title: 'שגיאה בהורדה', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      activeRef.current = false;
      abortRef.current = null;
    }
  }, [sessions, startSession, updateItemStatus, markItemDone, setSessionStatus, clearSession]);

  const pause = useCallback((sessionId: string) => {
    pausedRef.current = true;
    setSessionStatus(sessionId, 'paused');
    toast({ title: 'ההורדה הושהתה' });
  }, [setSessionStatus]);

  const resume = useCallback((sessionId: string) => {
    pausedRef.current = false;
    setSessionStatus(sessionId, 'downloading');
    toast({ title: 'ממשיך בהורדה...' });
  }, [setSessionStatus]);

  const cancel = useCallback((sessionId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeRef.current = false;
    pausedRef.current = false;
    clearSession(sessionId);
    toast({ title: 'ההורדה בוטלה', variant: 'destructive' });
  }, [clearSession]);

  return {
    sessions,
    startDownload,
    pause,
    resume,
    cancel,
    clearSession,
    getProgress,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
