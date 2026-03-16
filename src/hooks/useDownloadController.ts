import { useRef, useCallback, useEffect } from 'react';
import { useDownloadStore, DownloadItem } from '@/stores/downloadStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const DEFAULT_CONCURRENCY = 6;
const RETRY_DELAYS = [500, 1500, 3000];
const ITEM_TIMEOUT = 20000;

export type DownloadFormat = 'html' | 'pdf' | 'docx';

export function useDownloadController() {
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const activeRef = useRef(false);
  const speedRef = useRef({ startTime: 0, completedCount: 0 });

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

  const fetchPsakContent = async (id: string, format: DownloadFormat): Promise<{ title: string; content: string | Blob; ext: string }> => {
    const { data, error } = await supabase
      .from('psakei_din')
      .select('title, full_text, summary, court, year, case_number, source_url')
      .eq('id', id)
      .single();

    if (error || !data) throw new Error(error?.message || 'Not found');

    // PDF format: try to fetch original file from storage
    if (format === 'pdf' && data.source_url) {
      try {
        const res = await fetch(data.source_url);
        if (res.ok) {
          const blob = await res.blob();
          return { title: data.title, content: blob, ext: '.pdf' };
        }
      } catch {
        // fallback to HTML
      }
    }

    const textContent = data.full_text || data.summary || '';
    const htmlBody = buildHtmlContent(data, textContent);

    if (format === 'docx') {
      return { title: data.title, content: htmlBody, ext: '.doc' };
    }

    return { title: data.title, content: htmlBody, ext: '.html' };
  };

  const downloadWithRetry = async (
    id: string,
    format: DownloadFormat,
    signal: AbortSignal
  ): Promise<{ title: string; content: string | Blob; ext: string }> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (signal.aborted) throw new Error('aborted');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ITEM_TIMEOUT);
        signal.addEventListener('abort', () => controller.abort(), { once: true });

        try {
          return await fetchPsakContent(id, format);
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
    format: DownloadFormat = 'html',
    sessionName?: string
  ) => {
    if (items.length === 0) return;
    if (activeRef.current) {
      toast({ title: 'הורדה כבר פעילה', variant: 'destructive' });
      return;
    }

    activeRef.current = true;
    pausedRef.current = false;
    speedRef.current = { startTime: Date.now(), completedCount: 0 };
    const sessionId = crypto.randomUUID();
    const name = sessionName || `הורדת ${items.length} פסקי דין`;

    const abortController = new AbortController();
    abortRef.current = abortController;
    const signal = abortController.signal;

    // Check for resumable session
    const existingSession = Object.values(sessions).find(
      s => (s.status === 'paused' || s.status === 'error') && s.format === format
    );
    const alreadyDone = new Set(existingSession?.completedIds || []);

    const downloadItems: DownloadItem[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      court: item.court,
      year: item.year,
      status: alreadyDone.has(item.id) ? 'done' : 'pending',
    }));

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
    const downloadedContents: Map<string, { title: string; content: string | Blob; ext: string }> = new Map();

    let itemIndex = 0;
    const errors: string[] = [];

    const processNext = async (): Promise<void> => {
      while (itemIndex < pendingItems.length) {
        if (signal.aborted) return;
        await waitWhilePaused(signal);

        const currentIndex = itemIndex++;
        const item = pendingItems[currentIndex];

        updateItemStatus(sessionId, item.id, 'downloading');

        try {
          const result = await downloadWithRetry(item.id, format, signal);
          downloadedContents.set(item.id, result);
          markItemDone(sessionId, item.id);
          speedRef.current.completedCount++;
        } catch (err) {
          if ((err as Error).message === 'aborted') return;
          updateItemStatus(sessionId, item.id, 'error', (err as Error).message);
          errors.push(`${item.title}: ${(err as Error).message}`);
        }

        // Throttle every 100 items
        if (currentIndex % 100 === 0 && currentIndex > 0) {
          await sleep(300, signal);
        }
      }
    };

    try {
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
      setSessionStatus(sessionId, 'packaging');

      const { default: JSZipLib } = await import('jszip');
      const zip = new JSZipLib();
      downloadedContents.forEach((data) => {
        const safeName = data.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
        if (data.content instanceof Blob) {
          zip.file(`${safeName}${data.ext}`, data.content);
        } else {
          zip.file(`${safeName}${data.ext}`, data.content);
        }
      });

      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const formatLabel = format === 'pdf' ? 'pdf' : format === 'docx' ? 'doc' : 'html';
      a.download = `psakei-din-${formatLabel}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 60000);

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

  const getSpeed = useCallback(() => {
    const { startTime, completedCount } = speedRef.current;
    if (!startTime || completedCount === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    return elapsed > 0 ? Math.round((completedCount / elapsed) * 10) / 10 : 0;
  }, []);

  return {
    sessions,
    startDownload,
    pause,
    resume,
    cancel,
    clearSession,
    getProgress,
    getSpeed,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlContent(data: { title: string; court: string; year: number; case_number?: string | null }, textContent: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.title)}</title>
<style>
  @page { size: A4; margin: 2cm; }
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
<div class="content">${escapeHtml(textContent)}</div>
</body>
</html>`;
}
