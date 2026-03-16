import { supabase } from "@/integrations/supabase/client";

/**
 * Installs a global interceptor on supabase.functions.invoke 
 * to automatically log all edge function calls to function_logs table.
 */
export function installFunctionLogger() {
  const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

  supabase.functions.invoke = async (functionName: string, options?: { body?: unknown; headers?: Record<string, string> }) => {
    const startTime = performance.now();
    let status = 'success';
    let statusCode: number | null = 200;
    let errorMessage: string | null = null;
    let responseSummary: string | null = null;

    try {
      const result = await originalInvoke(functionName, options);
      const duration = Math.round(performance.now() - startTime);

      if (result.error) {
        status = 'error';
        statusCode = 500;
        errorMessage = result.error.message || 'Unknown error';
      } else {
        responseSummary = typeof result.data === 'object'
          ? JSON.stringify(result.data).slice(0, 300)
          : String(result.data || '').slice(0, 300);
      }

      // Fire and forget log
      writeLog(functionName, status, statusCode, duration, options?.body, responseSummary, errorMessage);

      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      errorMessage = error instanceof Error ? error.message : 'Network error';
      
      writeLog(functionName, 'error', null, duration, options?.body, null, errorMessage);

      throw error;
    }
  };

  console.log('[FunctionLogger] Interceptor installed');
}

function writeLog(
  functionName: string,
  status: string,
  statusCode: number | null,
  durationMs: number,
  requestBody: unknown,
  responseSummary: string | null,
  errorMessage: string | null,
) {
  // Sanitize request body
  const sanitized = sanitizeBody(requestBody);

  // Don't await - fire and forget
  supabase.from('function_logs').insert({
    function_name: functionName,
    status,
    status_code: statusCode,
    duration_ms: durationMs,
    request_body: sanitized as any,
    response_summary: responseSummary,
    error_message: errorMessage,
  }).then(({ error }) => {
    if (error) {
      // Silent fail - don't log errors about logging to avoid loops
      console.debug('[FunctionLogger] Write failed:', error.message);
    }
  });
}

function sanitizeBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  if (body instanceof FormData) {
    const obj: Record<string, unknown> = {};
    (body as FormData).forEach((value, key) => {
      if (value instanceof File) {
        obj[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else if (typeof value === 'string' && value.length > 500) {
        obj[key] = `[${value.length} chars]`;
      } else {
        obj[key] = value;
      }
    });
    return obj;
  }
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > 500) {
      obj[key] = `[${value.length} chars]`;
    } else {
      obj[key] = value;
    }
  }
  return obj;
}
