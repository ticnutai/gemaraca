import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  function_name: string;
  status: string;
  status_code: number | null;
  duration_ms: number;
  request_body: Record<string, unknown>;
  response_summary: string | null;
  error_message: string | null;
}

// Sanitize request body - remove large fields like full_text
function sanitizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `[${value.length} chars]`;
    } else if (value instanceof File) {
      sanitized[key] = `[File: ${value.name}, ${value.size} bytes]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function writeLog(entry: LogEntry) {
  try {
    // Use service role via edge function or direct insert
    await supabase.from('function_logs').insert({
      function_name: entry.function_name,
      status: entry.status,
      status_code: entry.status_code,
      duration_ms: entry.duration_ms,
      request_body: sanitizeBody(entry.request_body) as unknown as import("@/integrations/supabase/types").Json,
      response_summary: entry.response_summary,
      error_message: entry.error_message,
    });
  } catch (e) {
    console.warn('[FunctionLogger] Failed to write log:', e);
  }
}

/**
 * Wraps supabase.functions.invoke with automatic logging
 */
export async function invokeWithLogging<T = unknown>(
  functionName: string,
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<{ data: T | null; error: Error | null }> {
  const startTime = performance.now();
  
  try {
    const result = await supabase.functions.invoke(functionName, {
      body: options?.body,
      headers: options?.headers,
    });
    
    const duration = Math.round(performance.now() - startTime);
    const hasError = !!result.error;
    
    // Fire and forget - don't await
    writeLog({
      function_name: functionName,
      status: hasError ? 'error' : 'success',
      status_code: hasError ? 500 : 200,
      duration_ms: duration,
      request_body: (options?.body as Record<string, unknown>) || {},
      response_summary: hasError
        ? null
        : typeof result.data === 'object'
          ? JSON.stringify(result.data).slice(0, 200)
          : String(result.data).slice(0, 200),
      error_message: hasError ? (result.error?.message || 'Unknown error') : null,
    });
    
    return result as { data: T | null; error: Error | null };
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    
    writeLog({
      function_name: functionName,
      status: 'error',
      status_code: null,
      duration_ms: duration,
      request_body: (options?.body as Record<string, unknown>) || {},
      response_summary: null,
      error_message: errMsg,
    });
    
    throw error;
  }
}

// Event-based monitoring for components
type LogEventHandler = (log: LogEntry) => void;
const listeners: LogEventHandler[] = [];

export function onFunctionLog(handler: LogEventHandler) {
  listeners.push(handler);
  return () => {
    const idx = listeners.indexOf(handler);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
