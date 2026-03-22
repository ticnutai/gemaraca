/**
 * OCR Service — communicates with the Python FastAPI OCR server.
 * In dev: proxied via Vite (/api/ocr → localhost:8399)
 * In prod: direct URL from env or same-origin
 */

const OCR_BASE = "/api/ocr";

export interface OcrCorrection {
  type: string;   // "gershayim" | "sofit" | "quote" | "geresh" | "learned" | "similar_char"
  from: string;
  to: string;
  detail?: string;
}

export interface OcrTextLine {
  text: string;
  original_text?: string | null;
  corrections?: OcrCorrection[] | null;
  confidence: number;
  bbox: number[];
  polygon: number[][];
}

export interface OcrPage {
  page: number;
  text_lines: OcrTextLine[];
  full_text: string;
  line_count: number;
}

export interface OcrResult {
  filename: string;
  pages: OcrPage[];
  processing_time_seconds: number;
  total_lines: number;
  engine?: string;
}

export interface OcrServerStatus {
  models_loaded: boolean;
  loading: boolean;
  gpu: {
    available: boolean;
    name: string | null;
    memory: {
      total_mb: number;
      allocated_mb: number;
      reserved_mb: number;
    } | null;
  };
}

export interface OcrHealthResponse {
  status: string;
  models_loaded: boolean;
  gpu_available: boolean;
  gpu_name: string | null;
  tesseract_available?: boolean;
  engines?: string[];
}

export async function checkOcrHealth(): Promise<OcrHealthResponse> {
  const res = await fetch(`${OCR_BASE}/health`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function shutdownOcrServer(): Promise<void> {
  const res = await fetch(`${OCR_BASE}/shutdown`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
}

export async function startOcrServer(): Promise<{ status: string; pid?: number }> {
  const res = await fetch("/api/ocr-launcher/start", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Launcher error: ${res.status}`);
  return res.json();
}

export async function getOcrStatus(): Promise<OcrServerStatus> {
  const res = await fetch(`${OCR_BASE}/status`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function runOcrOnFile(file: File): Promise<OcrResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${OCR_BASE}/ocr`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json();
}

export type OcrEngine = "auto" | "surya" | "tesseract";

export async function runOcrBase64(
  dataUrl: string,
  filename: string,
  engine: OcrEngine = "auto",
): Promise<OcrResult> {
  const res = await fetch(`${OCR_BASE}/ocr/base64`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: dataUrl,
      filename,
      languages: ["he", "en"],
      engine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Corrections API ──

export interface CorrectionStats {
  word_corrections: Record<string, string>;
  custom_dictionary: string[];
  stats: {
    total_applied: number;
    gershayim_fixes: number;
    sofit_fixes: number;
    quote_fixes: number;
    similar_char_fixes: number;
    user_corrections_applied: number;
    user_taught_count: number;
  };
}

export interface AddCorrectionResponse {
  status: string;
  from?: string;
  to?: string;
  learned?: { from: string; to: string }[];
  total_learned: number;
}

export async function addOcrCorrection(
  wrong: string,
  correct: string
): Promise<AddCorrectionResponse> {
  const res = await fetch(`${OCR_BASE}/corrections/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wrong, correct }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json();
}

export async function getOcrCorrections(): Promise<CorrectionStats> {
  const res = await fetch(`${OCR_BASE}/corrections`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function removeOcrCorrection(word: string): Promise<void> {
  const res = await fetch(`${OCR_BASE}/corrections/${encodeURIComponent(word)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
}

// ── Dictionary API ──

export async function addDictionaryWord(word: string): Promise<{ status: string; word?: string; total?: number }> {
  const res = await fetch(`${OCR_BASE}/dictionary/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json();
}

export async function removeDictionaryWord(word: string): Promise<void> {
  const res = await fetch(`${OCR_BASE}/dictionary/${encodeURIComponent(word)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
}
