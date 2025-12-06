import { MASECHTOT, Masechet } from './masechtotData';

// Types for analysis results
export interface DetectedSource {
  type: 'gemara' | 'shulchan_aruch' | 'rambam' | 'tur' | 'mishna' | 'tosefta' | 'midrash' | 'other';
  text: string;
  masechet?: string;
  daf?: string;
  amud?: string;
  section?: string;
  halacha?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DetectedTopic {
  topic: string;
  category: string;
  occurrences: number;
}

export interface AnalysisResult {
  id: string;
  title: string;
  sources: DetectedSource[];
  topics: DetectedTopic[];
  masechtot: string[];
  books: string[];
  wordCount: number;
  hasFullText: boolean;
}

// Hebrew number patterns
const HEBREW_NUMBERS: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19,
  'כ': 20, 'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29,
  'ל': 30, 'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39,
  'מ': 40, 'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49,
  'נ': 50, 'נא': 51, 'נב': 52, 'נג': 53, 'נד': 54, 'נה': 55, 'נו': 56, 'נז': 57, 'נח': 58, 'נט': 59,
  'ס': 60, 'סא': 61, 'סב': 62, 'סג': 63, 'סד': 64, 'סה': 65, 'סו': 66, 'סז': 67, 'סח': 68, 'סט': 69,
  'ע': 70, 'עא': 71, 'עב': 72, 'עג': 73, 'עד': 74, 'עה': 75, 'עו': 76, 'עז': 77, 'עח': 78, 'עט': 79,
  'פ': 80, 'פא': 81, 'פב': 82, 'פג': 83, 'פד': 84, 'פה': 85, 'פו': 86, 'פז': 87, 'פח': 88, 'פט': 89,
  'צ': 90, 'צא': 91, 'צב': 92, 'צג': 93, 'צד': 94, 'צה': 95, 'צו': 96, 'צז': 97, 'צח': 98, 'צט': 99,
  'ק': 100, 'קא': 101, 'קב': 102, 'קג': 103, 'קד': 104, 'קה': 105, 'קו': 106, 'קז': 107, 'קח': 108, 'קט': 109,
  'קי': 110, 'קיא': 111, 'קיב': 112, 'קיג': 113, 'קיד': 114, 'קטו': 115, 'קטז': 116, 'קיז': 117, 'קיח': 118, 'קיט': 119,
  'קכ': 120, 'קכא': 121, 'קכב': 122, 'קל': 130, 'קמ': 140, 'קנ': 150, 'קס': 160, 'קע': 170, 'קפ': 180
};

// Build regex patterns for masechtot
const masechetPatterns = MASECHTOT.map(m => ({
  masechet: m,
  pattern: new RegExp(
    `(${m.hebrewName}|מסכת\\s*${m.hebrewName}|${m.englishName})\\s*(דף\\s*)?([א-ת]{1,3}|\\d{1,3})\\s*(ע[\\"\']?[אב]|עמוד\\s*[אב])?`,
    'gi'
  ),
  simplePattern: new RegExp(`(${m.hebrewName}|מסכת\\s*${m.hebrewName})`, 'gi')
}));

// Shulchan Aruch patterns
const SHULCHAN_ARUCH_SECTIONS = [
  { name: 'אורח חיים', aliases: ['או"ח', 'אורח החיים', 'או״ח'] },
  { name: 'יורה דעה', aliases: ['יו"ד', 'יורה דיעה', 'יו״ד'] },
  { name: 'אבן העזר', aliases: ['אהע"ז', 'אה"ע', 'אבהע"ז', 'אהע״ז', 'אה״ע'] },
  { name: 'חושן משפט', aliases: ['חו"מ', 'חושן המשפט', 'חו״מ'] }
];

// Rambam patterns
const RAMBAM_BOOKS = [
  'הלכות שבת', 'הלכות עירובין', 'הלכות יום טוב', 'הלכות חמץ ומצה', 'הלכות שופר',
  'הלכות סוכה', 'הלכות לולב', 'הלכות מגילה', 'הלכות חנוכה', 'הלכות תעניות',
  'הלכות קידוש החודש', 'הלכות תפילה', 'הלכות ברכות', 'הלכות מילה', 'הלכות ציצית',
  'הלכות תפילין', 'הלכות מזוזה', 'הלכות ספר תורה', 'הלכות עבודה זרה', 'הלכות דעות',
  'הלכות תלמוד תורה', 'הלכות יסודי התורה', 'הלכות אישות', 'הלכות גירושין', 'הלכות ייבום',
  'הלכות נערה בתולה', 'הלכות סוטה', 'הלכות נזירות', 'הלכות ערכין', 'הלכות שחיטה',
  'הלכות מאכלות אסורות', 'הלכות שבועות', 'הלכות נדרים', 'הלכות נזקי ממון', 'הלכות גנבה',
  'הלכות גזלה', 'הלכות נזקי גוף', 'הלכות רוצח', 'הלכות מכירה', 'הלכות זכייה', 'הלכות שכנים',
  'הלכות שלוחין', 'הלכות עבדים', 'הלכות שכירות', 'הלכות שאלה', 'הלכות מלוה', 'הלכות טוען',
  'הלכות נחלות', 'הלכות סנהדרין', 'הלכות עדות', 'הלכות ממרים', 'הלכות אבל', 'הלכות מלכים'
];

// Topic categories with keywords
const TOPIC_CATEGORIES: Record<string, string[]> = {
  'ממון ומסחר': [
    'מכר', 'קנין', 'קניין', 'כסף', 'ממון', 'מקח', 'שכירות', 'שכר', 'שטר', 'חוב', 'הלוואה',
    'ערבות', 'משכון', 'עסקה', 'מחיר', 'פיצוי', 'פיצויים', 'נזק', 'נזקי ממון', 'גזל', 'גנבה',
    'השבה', 'פיקדון', 'שותפות', 'ירושה', 'נחלה', 'צוואה', 'מתנה', 'הפקר'
  ],
  'נזיקין': [
    'נזק', 'נזיקין', 'היזק', 'שור', 'בור', 'אש', 'מבעה', 'תשלומי נזק', 'נזקי גוף',
    'חבלה', 'רציחה', 'רוצח', 'שוגג', 'מזיד', 'גרמא', 'גרמי', 'דינא דגרמי'
  ],
  'דיני ראיות': [
    'עד', 'עדים', 'עדות', 'הודאה', 'הודאת בעל דין', 'מיגו', 'חזקה', 'מוחזק', 'ספק',
    'ראיה', 'הוכחה', 'שבועה', 'נאמנות', 'כשרות עדים', 'פסולי עדות'
  ],
  'בתי דין': [
    'דין', 'דיין', 'דיינים', 'בית דין', 'בי"ד', 'סנהדרין', 'פסק', 'פסיקה', 'ערעור',
    'הוצאה לפועל', 'שליח בית דין', 'נידוי', 'חרם', 'כפייה', 'מורד', 'מורדת'
  ],
  'אישות ומשפחה': [
    'נישואין', 'אישות', 'קידושין', 'גירושין', 'גט', 'כתובה', 'תוספת כתובה', 'מזונות',
    'יבום', 'חליצה', 'אלמנה', 'גרושה', 'עגונה', 'ממזר', 'ייחוס', 'צניעות', 'נדה'
  ],
  'שבת ומועדים': [
    'שבת', 'מלאכה', 'מוקצה', 'עירוב', 'יום טוב', 'חג', 'פסח', 'חמץ', 'מצה', 'סוכות',
    'לולב', 'שופר', 'ראש השנה', 'יום כיפור', 'פורים', 'חנוכה', 'תענית', 'צום'
  ],
  'איסור והיתר': [
    'כשרות', 'טריפה', 'נבלה', 'שחיטה', 'בשר', 'חלב', 'דם', 'גיד הנשה', 'חלק',
    'תערובת', 'ביטול', 'נותן טעם', 'בליעה', 'הכשר כלים', 'טבילת כלים'
  ],
  'תפילה וברכות': [
    'תפילה', 'ברכה', 'ברכות', 'קריאת שמע', 'שמונה עשרה', 'עמידה', 'קדיש', 'קדושה',
    'ברכת המזון', 'זימון', 'הלל', 'סליחות', 'תחנון'
  ],
  'הלכות כלליות': [
    'מנהג', 'גזירה', 'תקנה', 'חומרא', 'קולא', 'לכתחילה', 'בדיעבד', 'מצווה', 'עבירה',
    'איסור', 'היתר', 'מותר', 'אסור', 'פטור', 'חייב', 'דאורייתא', 'דרבנן'
  ]
};

// Other important books
const OTHER_BOOKS = [
  { name: 'טור', pattern: /טור\s*(או"ח|יו"ד|אהע"ז|חו"מ|אורח חיים|יורה דעה|אבן העזר|חושן משפט)?/gi },
  { name: 'משנה ברורה', pattern: /משנה\s*ברורה|מ"ב|מ״ב/gi },
  { name: 'ביאור הלכה', pattern: /ביאור\s*הלכה|בה"ל|בה״ל/gi },
  { name: 'ערוך השולחן', pattern: /ערוך\s*השולחן/gi },
  { name: 'בית יוסף', pattern: /בית\s*יוסף|ב"י|ב״י/gi },
  { name: 'רמ"א', pattern: /רמ"א|רמ״א|הגהות\s*הרמ"א/gi },
  { name: 'ש"ך', pattern: /ש"ך|ש״ך|שפתי\s*כהן/gi },
  { name: 'ט"ז', pattern: /ט"ז|ט״ז|טורי\s*זהב/gi },
  { name: 'פתחי תשובה', pattern: /פתחי\s*תשובה|פ"ת|פ״ת/gi },
  { name: 'חתם סופר', pattern: /חתם\s*סופר|חת"ס|חת״ס/gi },
  { name: 'אגרות משה', pattern: /אגרות\s*משה|אג"מ|אג״מ/gi },
  { name: 'משנה הלכות', pattern: /משנה\s*הלכות/gi },
  { name: 'ציץ אליעזר', pattern: /ציץ\s*אליעזר/gi },
  { name: 'יביע אומר', pattern: /יביע\s*אומר/gi },
  { name: 'יחוה דעת', pattern: /יחוה\s*דעת/gi },
  { name: 'שמירת שבת כהלכתה', pattern: /שמירת\s*שבת\s*כהלכתה|שש"כ|שש״כ/gi },
  { name: 'פסקי תשובות', pattern: /פסקי\s*תשובות/gi }
];

/**
 * Analyze a psak din text without AI
 */
export function analyzeText(text: string): { sources: DetectedSource[], topics: DetectedTopic[], books: string[] } {
  if (!text || text.trim().length === 0) {
    return { sources: [], topics: [], books: [] };
  }

  const sources: DetectedSource[] = [];
  const detectedBooks = new Set<string>();
  const topicCounts: Record<string, { category: string, count: number }> = {};

  // 1. Detect Gemara sources
  for (const { masechet, pattern } of masechetPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const dafPart = match[3];
      const amudPart = match[4];

      let daf: string | undefined;
      let amud: string | undefined;

      // Parse daf number
      if (dafPart) {
        if (/^\d+$/.test(dafPart)) {
          daf = dafPart;
        } else if (HEBREW_NUMBERS[dafPart]) {
          daf = String(HEBREW_NUMBERS[dafPart]);
        } else {
          daf = dafPart;
        }
      }

      // Parse amud
      if (amudPart) {
        if (amudPart.includes('א')) {
          amud = 'א';
        } else if (amudPart.includes('ב')) {
          amud = 'ב';
        }
      }

      sources.push({
        type: 'gemara',
        text: fullMatch,
        masechet: masechet.hebrewName,
        daf,
        amud,
        confidence: daf ? 'high' : 'medium'
      });
    }
  }

  // 2. Detect Shulchan Aruch references
  for (const section of SHULCHAN_ARUCH_SECTIONS) {
    const allNames = [section.name, ...section.aliases];
    for (const name of allNames) {
      const pattern = new RegExp(`(שולחן\\s*ערוך\\s*)?${escapeRegex(name)}\\s*(סימן\\s*)?([א-ת]{1,3}|\\d{1,3})?(\\s*סעיף\\s*([א-ת]{1,3}|\\d{1,3}))?`, 'gi');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        sources.push({
          type: 'shulchan_aruch',
          text: match[0],
          section: section.name,
          halacha: match[3] || undefined,
          confidence: match[3] ? 'high' : 'medium'
        });
        detectedBooks.add('שולחן ערוך');
      }
    }
  }

  // 3. Detect Rambam references
  for (const book of RAMBAM_BOOKS) {
    const pattern = new RegExp(`(רמב"ם|רמב״ם|משנה\\s*תורה)?\\s*${escapeRegex(book)}\\s*(פרק\\s*)?([א-ת]{1,3}|\\d{1,3})?(\\s*הלכה\\s*([א-ת]{1,3}|\\d{1,3}))?`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sources.push({
        type: 'rambam',
        text: match[0],
        section: book,
        halacha: match[3] || undefined,
        confidence: match[3] ? 'high' : 'medium'
      });
      detectedBooks.add('רמב"ם');
    }
  }

  // 4. Detect other books
  for (const book of OTHER_BOOKS) {
    if (book.pattern.test(text)) {
      detectedBooks.add(book.name);
    }
    book.pattern.lastIndex = 0; // Reset regex
  }

  // 5. Detect topics
  for (const [category, keywords] of Object.entries(TOPIC_CATEGORIES)) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        if (!topicCounts[keyword]) {
          topicCounts[keyword] = { category, count: 0 };
        }
        topicCounts[keyword].count += matches.length;
      }
    }
  }

  // Convert topic counts to array and sort by occurrences
  const topics: DetectedTopic[] = Object.entries(topicCounts)
    .map(([topic, { category, count }]) => ({ topic, category, occurrences: count }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 15); // Top 15 topics

  return {
    sources,
    topics,
    books: Array.from(detectedBooks)
  };
}

/**
 * Analyze a psak din document
 */
export function analyzePsakDin(psak: { 
  id: string; 
  title: string; 
  summary: string; 
  full_text?: string | null;
  tags?: string[] | null;
}): AnalysisResult {
  const textToAnalyze = [psak.title, psak.summary, psak.full_text || ''].join(' ');
  const { sources, topics, books } = analyzeText(textToAnalyze);

  // Extract unique masechtot
  const masechtot = [...new Set(
    sources
      .filter(s => s.type === 'gemara' && s.masechet)
      .map(s => s.masechet!)
  )];

  return {
    id: psak.id,
    title: psak.title,
    sources,
    topics,
    masechtot,
    books,
    wordCount: textToAnalyze.split(/\s+/).length,
    hasFullText: !!psak.full_text && psak.full_text.length > 100
  };
}

/**
 * Batch analyze multiple psakei din
 */
export function batchAnalyze(psakim: Array<{
  id: string;
  title: string;
  summary: string;
  full_text?: string | null;
  tags?: string[] | null;
}>): AnalysisResult[] {
  return psakim.map(analyzePsakDin);
}

/**
 * Generate index summary from analysis results
 */
export function generateIndexSummary(results: AnalysisResult[]): {
  totalAnalyzed: number;
  withSources: number;
  withTopics: number;
  topMasechtot: { name: string; count: number }[];
  topBooks: { name: string; count: number }[];
  topCategories: { name: string; count: number }[];
} {
  const masechetCounts: Record<string, number> = {};
  const bookCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  let withSources = 0;
  let withTopics = 0;

  for (const result of results) {
    if (result.sources.length > 0) withSources++;
    if (result.topics.length > 0) withTopics++;

    for (const m of result.masechtot) {
      masechetCounts[m] = (masechetCounts[m] || 0) + 1;
    }

    for (const b of result.books) {
      bookCounts[b] = (bookCounts[b] || 0) + 1;
    }

    for (const t of result.topics) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }
  }

  return {
    totalAnalyzed: results.length,
    withSources,
    withTopics,
    topMasechtot: Object.entries(masechetCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topBooks: Object.entries(bookCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topCategories: Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}

// Helper function to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
