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

export const TRACTATES = [
  'ברכות','שבת','עירובין','פסחים','ראש השנה','יומא','סוכה','ביצה',
  'תענית','מגילה','חגיגה','יבמות','כתובות','נדרים','נזיר','גיטין',
  'קידושין','בבא קמא','בבא מציעא','בבא בתרא','סנהדרין','מכות','שבועות',
  'עבודה זרה','הוריות','זבחים','מנחות','חולין','בכורות','ערכין',
  'תמורה','כריתות','מעילה','נידה',
];

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightRawInContext(context: string, raw: string): string {
  const escaped = escapeHtml(context);
  const rawEscaped = escapeHtml(raw);
  const pattern = new RegExp(`(${rawEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
  return escaped.replace(pattern, '<mark class="bg-primary/20 text-primary font-bold rounded px-0.5">$1</mark>');
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
