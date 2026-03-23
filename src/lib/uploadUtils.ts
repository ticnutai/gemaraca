import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";

export interface UploadBatchResult {
  results: Array<{ id: string; fileName: string; title?: string }>;
  errors: string[];
}

const UPLOAD_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff

export class UploadAbortError extends Error {
  constructor() {
    super('Upload aborted');
    this.name = 'UploadAbortError';
  }
}

export class UploadTimeoutError extends Error {
  constructor() {
    super('Upload timeout');
    this.name = 'UploadTimeoutError';
  }
}

/**
 * Upload a batch of files with retry logic and timeout handling
 */
export async function uploadBatchWithRetry(
  batch: File[],
  metadata: Record<string, any>,
  abortSignal?: AbortSignal,
  onRetry?: (attempt: number, fileName: string) => void
): Promise<UploadBatchResult> {
  
  // Check if aborted before starting
  if (abortSignal?.aborted) {
    throw new UploadAbortError();
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (abortSignal?.aborted) {
        throw new UploadAbortError();
      }

      const result = await uploadBatchWithTimeout(batch, metadata, abortSignal);
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort
      if (error instanceof UploadAbortError) {
        throw error;
      }
      
      // Don't retry on final attempt
      if (attempt >= MAX_RETRIES) {
        break;
      }
      
      // Check for retryable errors
      const isRetryable = 
        error instanceof UploadTimeoutError ||
        (error as any)?.message?.includes('fetch') ||
        (error as any)?.message?.includes('network') ||
        (error as any)?.message?.includes('ECONNRESET') ||
        (error as any)?.status === 503 ||
        (error as any)?.status === 502;
      
      if (!isRetryable) {
        break;
      }
      
      // Wait before retry
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      console.log(`Retrying upload in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      
      if (onRetry) {
        onRetry(attempt + 1, batch.map(f => f.name).join(', '));
      }
      
      await sleep(delay, abortSignal);
    }
  }
  
  // All retries failed
  return {
    results: [],
    errors: batch.map(f => `${f.name}: ${lastError?.message || 'שגיאה לא ידועה'}`)
  };
}

/**
 * Upload batch with timeout
 */
async function uploadBatchWithTimeout(
  batch: File[],
  metadata: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<UploadBatchResult> {
  
  // Extract text from DOCX files client-side in parallel (Edge Function can't parse DOCX)
  const fullTexts: Record<string, string> = {};
  const docxFiles = batch.filter(f => f.name.split('.').pop()?.toLowerCase() === 'docx');
  
  if (docxFiles.length > 0) {
    const extractResults = await Promise.allSettled(
      docxFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return { name: file.name, text: result.value };
      })
    );
    
    for (const result of extractResults) {
      if (result.status === 'fulfilled' && result.value.text?.length > 10) {
        fullTexts[result.value.name] = result.value.text.length > 100000
          ? result.value.text.substring(0, 100000) + '... [קוצר]'
          : result.value.text;
      }
    }
  }

  const formData = new FormData();
  batch.forEach(file => {
    formData.append("files", file);
  });
  const metadataWithText = Object.keys(fullTexts).length > 0
    ? { ...metadata, fullTexts }
    : metadata;
  formData.append("metadata", JSON.stringify(metadataWithText));

  // Create timeout promise
  const timeoutId = setTimeout(() => {}, UPLOAD_TIMEOUT);
  
  try {
    const result = await Promise.race([
      supabase.functions.invoke('upload-psak-din', {
        body: formData,
      }),
      createTimeoutPromise(UPLOAD_TIMEOUT),
      createAbortPromise(abortSignal),
    ]);

    if (result instanceof Error) {
      throw result;
    }

    const { data, error } = result as { data: { results?: Array<{ id: string; fileName: string; title?: string }>; errors?: string[] } | null; error: { message: string } | null };

    if (error) {
      return { results: [], errors: batch.map(f => `${f.name}: ${error.message}`) };
    }

    return {
      results: data?.results || [],
      errors: data?.errors || [],
    };
    
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a promise that rejects after timeout
 */
function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new UploadTimeoutError()), ms);
  });
}

/**
 * Create a promise that rejects when abort signal is triggered
 */
function createAbortPromise(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) {
      // Never resolves if no signal
      return;
    }
    
    if (signal.aborted) {
      reject(new UploadAbortError());
      return;
    }
    
    signal.addEventListener('abort', () => {
      reject(new UploadAbortError());
    }, { once: true });
  });
}

/**
 * Sleep with abort support
 */
export function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new UploadAbortError());
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    abortSignal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new UploadAbortError());
    }, { once: true });
  });
}

/**
 * Check if we have network connectivity
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network to come back online
 */
export function waitForOnline(abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve();
      return;
    }
    
    const handler = () => {
      window.removeEventListener('online', handler);
      resolve();
    };
    
    window.addEventListener('online', handler);
    
    abortSignal?.addEventListener('abort', () => {
      window.removeEventListener('online', handler);
      reject(new UploadAbortError());
    }, { once: true });
  });
}
