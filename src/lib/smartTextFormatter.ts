/**
 * Smart text formatter for psak din content.
 * Detects section headers, references, lists, and quotes — applies styling without AI.
 */

/** Known section header patterns (standalone lines) */
const SECTION_HEADER_PATTERNS: RegExp[] = [
  // Exact known headers
  /^(?:ראשי\s*פרקים|תוכן\s*(?:ה)?עניינים)\s*:?\s*$/,
  /^(?:תקציר|סיכום)\s*:?\s*$/,
  /^(?:עובדות(?:\s*(?:המקרה|התיק|הרקע))?|המקרה\s*העובדתי|רקע(?:\s*עובדתי)?|תיאור\s*(?:המקרה|העובדות))\s*:?\s*$/,
  /^(?:טענות\s*(?:התובע[ים]?|הנתבע[ים]?|המבקש[ים]?|המשיב[ים]?|צד\s*[אב]))\s*:?\s*$/,
  /^(?:דיון(?:\s*(?:הלכתי|משפטי))?|ניתוח(?:\s*(?:הלכתי|משפטי))?)\s*:?\s*$/,
  /^(?:הנמקה|נימוקים|נימוקי\s*(?:הדין|הפסק|בית\s*הדין))\s*:?\s*$/,
  /^(?:פסק\s*(?:הדין)?|פסיקה|החלטה|הכרעת?\s*(?:הדין)?|מסקנה|מסקנות)\s*:?\s*$/,
  /^(?:סוף\s*דבר|לסיכום)\s*:?\s*$/,
  /^(?:מקורות(?:\s*(?:הלכתיים|משפטיים))?|מראי\s*מקומות)\s*:?\s*$/,
  /^(?:שאלה|תשובה|הלכה\s*למעשה)\s*:?\s*$/,
  /^(?:נושאים\s*הנידונים\s*בפסק)\s*:?\s*$/,
  // Generic pattern: short line (< 60 chars) ending with colon
  /^.{3,60}:\s*$/,
];

/** Sub-header patterns: lines that look like sub-section titles */
const SUB_HEADER_PATTERNS: RegExp[] = [
  // Hebrew lettered list headers: "א. על הניזק להרחיק"
  /^[א-ת][.׳']\s+.{3,80}$/,
  // Numeric list headers: "1. נושא ראשון"
  /^\d{1,3}[.)]\s+.{3,80}$/,
];

/** Reference patterns: lines citing sources */
const REFERENCE_PATTERNS: RegExp[] = [
  // Talmud references: בב"ק כג,ב
  /^(?:ב?ב"[קמגפ]|ב?שבת|ב?יבמות|ב?כתובות|ב?גיטין|ב?קידושין|ב?סנהדרין|ב?מכות|ב?שבועות|ב?ע"ז|ב?חולין|ב?בכורות|ב?ערכין|ב?נדרים|ב?נזיר)\s+[א-ת]{1,3}[,׳'][א-ב]?\s*;?\s*$/,
  // Short source citations: "ועי'" or "וכן" alone
  /^(?:ועי['\u2019]|ועיין|וכן|וע"ע|וע"ש|עי['\u2019]|עיין)\s*$/,
  // Rambam/Shulchan Aruch refs
  /^(?:ב?רמב"ם|ב?שו"ע|ב?רמ"א|ב?טור|ב?ש"ך|ב?ט"ז)\s+.{3,80}$/,
  // Responsa references
  /^(?:ב?שו"ת|ב?תשו['\u2019])\s+.{3,80}$/,
];

/** Check if a line looks like a quote */
function isQuoteLine(line: string): boolean {
  // Starts and ends with quotes
  if (/^["״"'].+["״"']\.?\s*$/.test(line)) return true;
  // Starts with quote mark
  if (/^["״"']/.test(line) && line.length > 10) return true;
  return false;
}

/** Check if line is a section header */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return SECTION_HEADER_PATTERNS.some(p => p.test(trimmed));
}

/** Check if line is a sub-header (list item header) */
function isSubHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return SUB_HEADER_PATTERNS.some(p => p.test(trimmed));
}

/** Check if line is a source reference */
function isReference(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return REFERENCE_PATTERNS.some(p => p.test(trimmed));
}

export type FormattedLine = {
  type: 'header' | 'subheader' | 'reference' | 'quote' | 'paragraph' | 'empty';
  text: string;
};

/**
 * Analyze and classify each line of text for smart formatting
 */
export function classifyLines(text: string): FormattedLine[] {
  // First normalize spacing: collapse 3+ blank lines to 2
  const normalized = text.replace(/\n{4,}/g, '\n\n\n');
  const lines = normalized.split('\n');
  const result: FormattedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Collapse consecutive empties
      if (result.length > 0 && result[result.length - 1].type === 'empty') continue;
      result.push({ type: 'empty', text: '' });
    } else if (isSectionHeader(trimmed)) {
      result.push({ type: 'header', text: trimmed.replace(/:$/, '').trim() });
    } else if (isSubHeader(trimmed)) {
      result.push({ type: 'subheader', text: trimmed });
    } else if (isReference(trimmed)) {
      result.push({ type: 'reference', text: trimmed });
    } else if (isQuoteLine(trimmed)) {
      result.push({ type: 'quote', text: trimmed });
    } else {
      result.push({ type: 'paragraph', text: trimmed });
    }
  }

  return result;
}

/**
 * Convert classified lines to formatted HTML body content (not full document).
 * Used inside the psakDinHtmlTemplate for the body section.
 */
export function classifiedLinesToHtml(lines: FormattedLine[]): string {
  const parts: string[] = [];

  for (const line of lines) {
    switch (line.type) {
      case 'header':
        parts.push(`<h3 class="detected-header">${esc(line.text)}</h3>`);
        break;
      case 'subheader':
        parts.push(`<div class="detected-subheader">${esc(line.text)}</div>`);
        break;
      case 'reference':
        parts.push(`<div class="detected-reference">${esc(line.text)}</div>`);
        break;
      case 'quote':
        parts.push(`<blockquote class="detected-quote">${esc(line.text)}</blockquote>`);
        break;
      case 'paragraph':
        parts.push(`<div class="paragraph">${esc(line.text)}</div>`);
        break;
      case 'empty':
        parts.push(`<div class="spacer"></div>`);
        break;
    }
  }

  return parts.join('\n        ');
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
