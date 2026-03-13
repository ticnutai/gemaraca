import { MASECHTOT } from '@/lib/masechtotData';

export type ValidationStatus = 'correct' | 'incorrect' | 'pending' | 'ignored';

export interface TalmudReference {
  id: string;
  psak_din_id: string;
  tractate: string;
  daf: string;
  amud: string | null;
  raw_reference: string;
  normalized: string;
  confidence: string;
  source: string;
  context_snippet: string | null;
  validation_status: ValidationStatus;
  created_at: string;
  user_id: string | null;
}

export type ViewMode = 'list' | 'accordion' | 'table' | 'cards' | 'tree';

export interface TalmudRefWithPsak extends TalmudReference {
  psakei_din: { title: string; court: string } | null;
}

export interface RefItemProps {
  data: TalmudRefWithPsak;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
}

export const TRACTATES = MASECHTOT.map(m => m.hebrewName);

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const HIGHLIGHT_COLORS = [
  { name: 'כחול', value: '#3b82f6', bg: 'rgba(59,130,246,0.18)' },
  { name: 'ירוק', value: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
  { name: 'סגול', value: '#a855f7', bg: 'rgba(168,85,247,0.18)' },
  { name: 'כתום', value: '#f97316', bg: 'rgba(249,115,22,0.18)' },
  { name: 'ורוד', value: '#ec4899', bg: 'rgba(236,72,153,0.18)' },
  { name: 'אדום', value: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
  { name: 'צהוב', value: '#eab308', bg: 'rgba(234,179,8,0.25)' },
];

export function highlightRawInContext(context: string, raw: string, color?: string, bgColor?: string): string {
  const escaped = escapeHtml(context);
  const rawEscaped = escapeHtml(raw);
  const pattern = new RegExp(`(${rawEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
  if (color && bgColor) {
    return escaped.replace(pattern, `<mark style="background:${bgColor};color:${color};font-weight:700;border-radius:3px;padding:0 2px">$1</mark>`);
  }
  return escaped.replace(pattern, '<mark class="bg-primary/20 text-primary font-bold rounded px-0.5">$1</mark>');
}

/** Extract the line containing `raw` and optionally ±N surrounding lines */
export function extractContextLines(snippet: string | null, raw: string, surroundCount = 0): { matchLine: string; surroundLines: string[] } | null {
  if (!snippet) return null;
  const lines = snippet.split(/\n|\. /).map(l => l.trim()).filter(Boolean);
  const idx = lines.findIndex(l => l.includes(raw));
  if (idx === -1) return null;
  const start = Math.max(0, idx - surroundCount);
  const end = Math.min(lines.length, idx + surroundCount + 1);
  return { matchLine: lines[idx], surroundLines: lines.slice(start, end) };
}

/** Convert a number (or numeric string) to Hebrew gematria letters */
export function toHebrewDaf(n: string | number): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (isNaN(num) || num <= 0) return String(n);

  const hundreds = ['', 'ק', 'ר'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const units = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';

  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const u = num % 10;

  let result = (hundreds[h] || '') + (tens[t] || '') + (units[u] || '');

  if (result.length === 1) {
    result += '׳';
  } else if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  }

  return result;
}

/** Convert amud value (a/b/1/2/א/ב) to Hebrew */
export function toHebrewAmud(amud: string | null): string {
  if (!amud) return '';
  if (amud === 'a' || amud === '1' || amud === 'א') return 'א׳';
  if (amud === 'b' || amud === '2' || amud === 'ב') return 'ב׳';
  return amud;
}
