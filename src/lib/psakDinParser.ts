/**
 * Parser for structured psak din text files from psakim.org
 * Extracts metadata and sections from semi-structured plain text
 */

export interface ParsedPsakDin {
  title: string;
  court: string;
  date: string;
  year: number;
  caseNumber: string;
  sourceUrl: string;
  sourceId: string;
  judges: string[];
  summary: string;
  topics: string;
  sections: PsakSection[];
  rawText: string;
}

export interface PsakSection {
  type: 'plaintiff-claims' | 'defendant-claims' | 'ruling' | 'decision' | 'summary' | 'facts' | 'discussion' | 'reasoning' | 'conclusion' | 'chapters' | 'law-sources' | 'general';
  title: string;
  content: string;
}

/**
 * Parse a psak din TXT file into structured data
 */
export function parsePsakDinText(text: string): ParsedPsakDin {
  const lines = text.split('\n').map(l => l.trim());
  
  // Extract header metadata (first lines before separator)
  const headerEnd = lines.findIndex(l => l.startsWith('---'));
  const headerLines = headerEnd > 0 ? lines.slice(0, headerEnd) : [];
  const bodyLines = headerEnd > 0 ? lines.slice(headerEnd + 1) : lines;
  const bodyText = bodyLines.join('\n');

  // Parse header key-value pairs
  const headerMap: Record<string, string> = {};
  for (const line of headerLines) {
    const match = line.match(/^(Title|Court|Date|URL|ID):\s*(.+)/i);
    if (match) {
      headerMap[match[1].toLowerCase()] = match[2].trim();
    }
  }

  // Extract title
  const title = headerMap['title'] || extractByPattern(bodyText, /^(.+?)(?:\s*-\s*אתר פסקי דין רבניים)?$/m) || 'פסק דין';
  
  // Extract court - clean HTML artifacts like </span>
  let court = headerMap['court'] || extractByPattern(bodyText, /שם בית דין:\s*\n?\s*(.+)/);
  court = court.replace(/<[^>]*>/g, '').trim();

  // Extract date
  const date = headerMap['date']?.replace(/^תאריך:\s*/, '') || 
    extractByPattern(bodyText, /תאריך:\s*(.+)/);

  // Extract year from date
  const yearMatch = date.match(/(\d{4})/);
  const hebrewYearMatch = date.match(/תש[א-ת]"?[א-ת]/);
  const year = yearMatch ? parseInt(yearMatch[1]) : (hebrewYearMatch ? 2022 : new Date().getFullYear());

  // Extract case number
  const caseNumber = extractByPattern(bodyText, /תיק מספר:\s*(.+)/) ||
    extractByPattern(bodyText, /מס\.\s*סידורי:\s*(.+)/);

  // Extract source URL and ID
  const sourceUrl = headerMap['url'] || '';
  const sourceId = headerMap['id'] || extractByPattern(sourceUrl, /(\d+)$/) || '';

  // Extract judges
  const judges = extractJudges(bodyText);

  // Extract sections first (needed for summary fallback)
  const sections = extractSections(bodyText);

  // Extract summary — multiple strategies
  let summary = '';
  // Strategy 1: explicit "תקציר:" to next known section header
  const sm1 = bodyText.match(/תקציר[:\s]*\n?\s*(.+?)(?=\n\s*(?:נושאים|פסק\b|טענות|החלטה|הכרעת|עובדות|דיון|הנמקה|סיכום|תאריך))/s);
  if (sm1) summary = sm1[1].trim();
  // Strategy 2: "תקציר:" to double newline
  if (!summary) {
    const sm2 = bodyText.match(/תקציר[:\s]*\n?\s*(.+?)(?=\n\s*\n)/s);
    if (sm2) summary = sm2[1].trim();
  }
  // Strategy 3: "תקציר:" to end of text
  if (!summary) {
    const sm3 = bodyText.match(/תקציר[:\s]*\n?\s*(.+)/s);
    if (sm3) {
      summary = sm3[1].trim();
      if (summary.length > 2000) summary = summary.slice(0, 2000);
    }
  }
  // Strategy 4: use summary section content from parsed sections
  if (!summary) {
    const sSec = sections.find(s => s.type === 'summary');
    if (sSec) summary = sSec.content;
  }
  // Strategy 5: use pre-section background text as summary
  if (!summary) {
    const bgSec = sections.find(s => s.type === 'general' && (s.title === 'רקע' || s.title === 'תוכן פסק הדין'));
    if (bgSec) {
      summary = bgSec.content.length > 2000 ? bgSec.content.slice(0, 2000) + '...' : bgSec.content;
    }
  }

  // Extract topics — flexible terminator
  let topics = extractByPattern(bodyText, /נושאים הנידונים בפסק[:\s]*\n?\s*(.+?)(?=\n\s*(?:תאריך|פסק\b|תקציר|טענות|החלטה|דיון|עובדות))/s);
  if (!topics) {
    topics = extractByPattern(bodyText, /נושאים הנידונים בפסק[:\s]*\n?\s*(.+?)(?=\n\s*\n)/s);
  }
  if (!topics) {
    topics = extractByPattern(bodyText, /נושאים הנידונים בפסק[:\s]*\n?\s*(.+)/s);
    if (topics.length > 1000) topics = topics.slice(0, 1000);
  }

  return {
    title,
    court,
    date,
    year,
    caseNumber,
    sourceUrl,
    sourceId,
    judges,
    summary,
    topics,
    sections,
    rawText: text,
  };
}

function extractByPattern(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
}

function extractJudges(text: string): string[] {
  const judgesBlock = text.match(/דיינים:\s*\n([\s\S]*?)(?=\n\s*(?:תקציר|נושאים|תאריך|פסק דין))/);
  if (!judgesBlock) return [];
  
  return judgesBlock[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l.startsWith('הרב'));
}

function extractSections(text: string): PsakSection[] {
  // Define known section headers with flexible matching
  const sectionPatterns: Array<{ type: PsakSection['type']; patterns: RegExp[] }> = [
    { type: 'summary', patterns: [/^תקציר[:\s]/m] },
    { type: 'facts', patterns: [/^עובדות(?:\s*(?:המקרה|התיק|הרקע))?[:\s]/m, /^רקע(?:\s*עובדתי)?[:\s]/m] },
    { type: 'plaintiff-claims', patterns: [/^טענות התובע[ים]?[:\s]/m, /^טענות צד א[:\s]/m] },
    { type: 'defendant-claims', patterns: [/^טענות הנתבע[ים]?[:\s]/m, /^טענות צד ב[:\s]/m] },
    { type: 'ruling', patterns: [/^פסק הדין[:\s]/m, /^פסק[:\s]/m] },
    { type: 'decision', patterns: [/^החלטה[:\s]/m, /^הכרעת הדין[:\s]/m] },
  ];

  // Find all section start positions
  const found: Array<{ type: PsakSection['type']; title: string; start: number }> = [];
  for (const { type, patterns } of sectionPatterns) {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m.index !== undefined) {
        const titleEnd = text.indexOf('\n', m.index);
        const title = text.slice(m.index, titleEnd > m.index ? titleEnd : m.index + m[0].length).replace(/[:]/g, '').trim();
        found.push({ type, title, start: m.index });
        break;
      }
    }
  }

  // Sort by position in text
  found.sort((a, b) => a.start - b.start);

  const sections: PsakSection[] = [];

  if (found.length > 0) {
    // Extract content between consecutive section headers
    for (let i = 0; i < found.length; i++) {
      const headerLineEnd = text.indexOf('\n', found[i].start);
      const contentStart = headerLineEnd > found[i].start ? headerLineEnd + 1 : found[i].start + found[i].title.length;
      const contentEnd = i + 1 < found.length ? found[i + 1].start : text.length;
      const content = text.slice(contentStart, contentEnd).trim();
      if (content) {
        sections.push({ type: found[i].type, title: found[i].title, content });
      }
    }

    // Capture any text BEFORE the first section as a general intro
    const preContent = text.slice(0, found[0].start).trim();
    // Strip metadata lines we've already parsed
    const preLines = preContent.split('\n').filter(l => {
      const t = l.trim();
      return t && !/^(שם בית דין|דיינים|תקציר|נושאים הנידונים|תאריך|תיק מספר|מס\. סידורי|בס"ד)/.test(t)
        && !/^הרב /.test(t) && t.length > 0;
    });
    if (preLines.length > 0) {
      sections.unshift({ type: 'general', title: 'רקע', content: preLines.join('\n') });
    }
  } else {
    // No known sections found — treat ALL body text as one general section
    // Strip only the header/metadata lines that are already rendered separately
    const bodyLines = text.split('\n');
    const contentLines: string[] = [];
    let pastMetadata = false;
    for (const line of bodyLines) {
      const t = line.trim();
      if (!pastMetadata) {
        // Skip known metadata lines
        if (/^(שם בית דין|דיינים|תקציר|נושאים הנידונים|תאריך|תיק מספר|מס\. סידורי|Title|Court|Date|URL|ID)[:]/i.test(t)) continue;
        if (/^הרב /.test(t)) continue;
        if (t === '' || t === 'בס"ד' || /^-{3,}$/.test(t)) continue;
        // Once we hit a non-metadata line with ANY real content, start capturing
        if (t.length > 0) pastMetadata = true;
      }
      if (pastMetadata) {
        contentLines.push(line);
      }
    }
    const generalContent = contentLines.join('\n').trim();
    if (generalContent) {
      sections.push({ type: 'general', title: 'תוכן פסק הדין', content: generalContent });
    }
  }

  return sections;
}

/**
 * Detect if the text is a recognizable psak din format
 */
export function isPsakDinFormat(text: string): boolean {
  const indicators = [
    /פסק דין/,
    /בית דין/,
    /שם בית דין/,
    /טענות התובע/,
    /טענות הנתבע/,
    /דיינים/,
    /תיק מספר/,
    /psakim\.org/i,
  ];
  
  const matchCount = indicators.filter(p => p.test(text)).length;
  return matchCount >= 2;
}
