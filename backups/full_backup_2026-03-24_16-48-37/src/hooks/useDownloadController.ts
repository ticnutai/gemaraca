import { useCallback } from 'react';
import { useDownloadStore, DownloadItem } from '@/stores/downloadStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { parsePsakDinText } from '@/lib/psakDinParser';

const DEFAULT_CONCURRENCY = 6;
const RETRY_DELAYS = [500, 1500, 3000];
const ITEM_TIMEOUT = 20000;

export type DownloadFormat = 'html' | 'pdf' | 'docx';

// ─── Module-level singletons (survive component unmount) ─────
let _abortController: AbortController | null = null;
let _paused = false;
let _active = false;
let _speed = { startTime: 0, completedCount: 0 };

export function useDownloadController() {
  const {
    sessions,
    startSession,
    updateItemStatus,
    markItemDone,
    setSessionStatus,
    clearSession,
    getProgress,
  } = useDownloadStore();

  const sleep = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
    });

  const waitWhilePaused = async (signal: AbortSignal) => {
    while (_paused) {
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

    // PDF format: try original file first, then generate real PDF
    if (format === 'pdf') {
      if (data.source_url) {
        try {
          const res = await fetch(data.source_url);
          if (res.ok) {
            const blob = await res.blob();
            return { title: data.title, content: blob, ext: '.pdf' };
          }
        } catch { /* fallback to generated PDF */ }
      }

      // Generate real PDF with jsPDF
      const pdfBlob = await generatePdf(data);
      return { title: data.title, content: pdfBlob, ext: '.pdf' };
    }

    const textContent = data.full_text || data.summary || '';
    const htmlBody = buildHtmlContent(data, textContent);

    if (format === 'docx') {
      const { generateDocx } = await import('@/lib/docxGenerator');
      const docxBlob = await generateDocx(data);
      return { title: data.title, content: docxBlob, ext: '.docx' };
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
    if (_active) {
      toast({ title: 'הורדה כבר פעילה', variant: 'destructive' });
      return;
    }

    _active = true;
    _paused = false;
    _speed = { startTime: Date.now(), completedCount: 0 };
    const sessionId = crypto.randomUUID();
    const name = sessionName || `הורדת ${items.length} פסקי דין`;

    const abortController = new AbortController();
    _abortController = abortController;
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
          _speed.completedCount++;
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
        _active = false;
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
        title: '✅ ההורדה הושלמה!',
        description: `הורדו ${downloadedContents.size} פסקי דין בפורמט ${format.toUpperCase()}${errors.length > 0 ? ` (${errors.length} שגיאות)` : ''}`,
      });
    } catch (err) {
      if ((err as Error).message !== 'aborted') {
        setSessionStatus(sessionId, 'error');
        toast({
          title: '❌ שגיאה בהורדה',
          description: `${(err as Error).message} — ניתן להמשיך מאותה נקודה`,
          variant: 'destructive',
          duration: 8000,
        });
      }
    } finally {
      _active = false;
      _abortController = null;
    }
  }, [sessions, startSession, updateItemStatus, markItemDone, setSessionStatus, clearSession]);

  const pause = useCallback((sessionId: string) => {
    _paused = true;
    setSessionStatus(sessionId, 'paused');
    toast({ title: 'ההורדה הושהתה' });
  }, [setSessionStatus]);

  const resume = useCallback((sessionId: string) => {
    _paused = false;
    setSessionStatus(sessionId, 'downloading');
    toast({ title: 'ממשיך בהורדה...' });
  }, [setSessionStatus]);

  const cancel = useCallback((sessionId: string) => {
    _abortController?.abort();
    _abortController = null;
    _active = false;
    _paused = false;
    clearSession(sessionId);
    toast({ title: 'ההורדה בוטלה', variant: 'destructive' });
  }, [clearSession]);

  const getSpeed = useCallback(() => {
    const { startTime, completedCount } = _speed;
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

async function generatePdf(data: { title: string; court: string; year: number; case_number?: string | null; full_text?: string | null; summary?: string | null }): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const textContent = data.full_text || data.summary || '';
  const parsed = parsePsakDinText(textContent);

  type TocEntry = { title: string; page: number };
  const tocEntries: TocEntry[] = [];

  const renderContainerToPages = async (html: string): Promise<number> => {
    const startPage = doc.getCurrentPageInfo().pageNumber;
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      width: 700px; padding: 40px; background: white;
      font-family: 'David', 'Times New Roman', serif;
      direction: rtl; line-height: 1.8; color: #1a1a1a;
    `;
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgWidth = maxWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const availableHeight = pageHeight - margin * 2;

      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        if (sourceY > 0) doc.addPage();

        const sliceHeight = Math.min(availableHeight, remainingHeight);
        const srcYPx = (sourceY / imgHeight) * canvas.height;
        const srcHPx = (sliceHeight / imgHeight) * canvas.height;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcHPx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');

        ctx.drawImage(canvas, 0, srcYPx, canvas.width, srcHPx, 0, 0, canvas.width, srcHPx);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        doc.addImage(sliceData, 'JPEG', margin, margin, imgWidth, sliceHeight);

        sourceY += sliceHeight;
        remainingHeight -= sliceHeight;
      }

      return startPage;
    } finally {
      document.body.removeChild(container);
    }
  };

  // Page 1: cover + placeholder TOC
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(data.title || 'פסק דין', pageWidth - margin, margin, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`בית דין: ${data.court || ''}`, pageWidth - margin, margin + 10, { align: 'right' });
  doc.text(`שנה: ${String(data.year || '')}`, pageWidth - margin, margin + 17, { align: 'right' });
  if (data.case_number) {
    doc.text(`תיק: ${data.case_number}`, pageWidth - margin, margin + 24, { align: 'right' });
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('תוכן עניינים', pageWidth - margin, margin + 36, { align: 'right' });

  // Start content on page 2
  doc.addPage();

  const summaryText = parsed.summary || data.summary || '';
  if (summaryText.trim()) {
    const startPage = await renderContainerToPages(`
      <h2 style="color:#1a365d;font-size:18px;margin:0 0 12px">תקציר</h2>
      <div style="white-space:pre-wrap;font-size:15px">${escapeHtml(summaryText)}</div>
    `);
    tocEntries.push({ title: 'תקציר', page: startPage });
    doc.addPage();
  }

  if (parsed.sections.length > 0) {
    for (const section of parsed.sections) {
      const startPage = await renderContainerToPages(`
        <h2 style="color:#1a365d;font-size:18px;margin:0 0 12px">${escapeHtml(section.title)}</h2>
        <div style="white-space:pre-wrap;font-size:15px">${escapeHtml(section.content)}</div>
      `);
      tocEntries.push({ title: section.title, page: startPage });
      doc.addPage();
    }
  } else {
    const startPage = await renderContainerToPages(`
      <h2 style="color:#1a365d;font-size:18px;margin:0 0 12px">גוף פסק הדין</h2>
      <div style="white-space:pre-wrap;font-size:15px">${escapeHtml(textContent)}</div>
    `);
    tocEntries.push({ title: 'גוף פסק הדין', page: startPage });
  }

  // Remove trailing blank page (if any)
  const last = doc.getNumberOfPages();
  if (last > 1) {
    const txt = doc.getPageInfo(last);
    if (txt.pageNumber === last) {
      try {
        // jsPDF has deletePage in modern versions
        doc.deletePage(last);
      } catch {
        // Ignore if not supported
      }
    }
  }

  // Fill TOC links on page 1
  doc.setPage(1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  let y = margin + 44;

  tocEntries.slice(0, 24).forEach((entry, idx) => {
    const label = `${idx + 1}. ${entry.title}`;
    const pageLabel = `עמוד ${entry.page}`;
    doc.text(label, pageWidth - margin, y, { align: 'right' });
    doc.text(pageLabel, margin, y, { align: 'left' });
    doc.link(margin, y - 4.5, pageWidth - margin * 2, 7, { pageNumber: entry.page });
    y += 8;
  });

  return doc.output('blob');
}
