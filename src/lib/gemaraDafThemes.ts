import type { DafThemeId } from "@/hooks/useGemaraDafTheme";

export interface DafTheme {
  id: DafThemeId;
  label: string;
  description: string;
  /** Quick visual swatch — gradient or solid for the picker button */
  swatchBg: string;
  swatchText: string;
  /** Full CSS injected into the iframe document <style> */
  buildCss: (vars: { fontSize: number; lineHeight: number }) => string;
}

/**
 * 5 ready-made themes for rendering the gemara text iframe.
 * Each theme provides full CSS — body, paragraphs, headings, decorations.
 */
export const DAF_THEMES: Record<DafThemeId, DafTheme> = {
  vilna: {
    id: 'vilna',
    label: 'וילנא קלאסי',
    description: 'דיו שחור על נייר קרם, אות מרובעת מסורתית',
    swatchBg: 'linear-gradient(135deg, #f5ecd7 0%, #e8d9b5 100%)',
    swatchText: '#1a1410',
    buildCss: ({ fontSize, lineHeight }) => `
      @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=David+Libre:wght@400;500;700&display=swap');
      body {
        font-family: 'Frank Ruhl Libre', 'David Libre', 'David', serif;
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
        color: #1a1410;
        background: #f5ecd7;
        background-image: radial-gradient(ellipse at top, #faf3e0 0%, #f5ecd7 70%, #e8d9b5 100%);
        padding: 48px 56px;
        margin: 0;
        direction: rtl;
        text-align: justify;
        text-justify: inter-word;
      }
      p, div { margin-bottom: 6px; text-indent: 0; }
      p:first-letter {
        font-size: 1.6em;
        font-weight: 900;
        color: #5a1f0f;
        margin-left: 4px;
      }
      ::selection { background: rgba(212, 175, 55, 0.4); }
      body::before {
        content: '';
        display: block;
        height: 2px;
        background: linear-gradient(90deg, transparent, #8b6914, transparent);
        margin-bottom: 24px;
      }
      body::after {
        content: '';
        display: block;
        height: 2px;
        background: linear-gradient(90deg, transparent, #8b6914, transparent);
        margin-top: 24px;
      }
    `,
  },
  modern: {
    id: 'modern',
    label: 'אקדמי מודרני',
    description: 'גופן נקי, רווחים נדיבים, קל לקריאה ממושכת',
    swatchBg: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    swatchText: '#0f172a',
    buildCss: ({ fontSize, lineHeight }) => `
      @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&family=Assistant:wght@400;600&display=swap');
      body {
        font-family: 'Heebo', 'Assistant', sans-serif;
        font-size: ${fontSize}px;
        line-height: ${Math.max(lineHeight, 1.9)};
        color: #1e293b;
        background: #ffffff;
        padding: 56px 64px;
        margin: 0;
        direction: rtl;
        text-align: right;
        max-width: 780px;
        margin-inline: auto;
      }
      p, div {
        margin-bottom: 18px;
        padding-right: 16px;
        border-right: 3px solid transparent;
        transition: border-color 0.2s;
      }
      p:hover { border-right-color: #3b82f6; }
      ::selection { background: rgba(59, 130, 246, 0.25); }
    `,
  },
  minimal: {
    id: 'minimal',
    label: 'מינימליסטי',
    description: 'שחור-לבן, ללא קישוטים, מיקוד מלא בטקסט',
    swatchBg: '#ffffff',
    swatchText: '#000000',
    buildCss: ({ fontSize, lineHeight }) => `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;700&display=swap');
      body {
        font-family: 'Noto Serif Hebrew', 'Times New Roman', serif;
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
        color: #000000;
        background: #ffffff;
        padding: 64px 72px;
        margin: 0;
        direction: rtl;
        text-align: right;
        max-width: 720px;
        margin-inline: auto;
      }
      p, div { margin-bottom: 14px; }
      ::selection { background: #000; color: #fff; }
    `,
  },
  night: {
    id: 'night',
    label: 'לילה כהה',
    description: 'רקע כהה, טקסט בהיר, נוח לעיניים בלילה',
    swatchBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    swatchText: '#e2e8f0',
    buildCss: ({ fontSize, lineHeight }) => `
      @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&display=swap');
      body {
        font-family: 'Frank Ruhl Libre', 'David', serif;
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
        color: #e2e8f0;
        background: #0f172a;
        background-image: radial-gradient(ellipse at center, #1e293b 0%, #0f172a 80%);
        padding: 48px 56px;
        margin: 0;
        direction: rtl;
        text-align: justify;
      }
      p, div { margin-bottom: 12px; }
      p:first-letter { color: #fbbf24; font-weight: 700; font-size: 1.3em; }
      ::selection { background: rgba(251, 191, 36, 0.35); }
    `,
  },
  parchment: {
    id: 'parchment',
    label: 'פרגמנט עתיק',
    description: 'מראה של קלף עתיק עם דיו חום-אדמדם',
    swatchBg: 'linear-gradient(135deg, #e8d4a8 0%, #c9a878 100%)',
    swatchText: '#3d1f0f',
    buildCss: ({ fontSize, lineHeight }) => `
      @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&display=swap');
      body {
        font-family: 'Frank Ruhl Libre', serif;
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
        color: #3d1f0f;
        background: #e8d4a8;
        background-image:
          radial-gradient(circle at 20% 30%, rgba(139, 90, 43, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(139, 90, 43, 0.1) 0%, transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(232, 212, 168, 1) 0%, rgba(201, 168, 120, 1) 100%);
        padding: 56px 64px;
        margin: 0;
        direction: rtl;
        text-align: justify;
        position: relative;
      }
      body::before, body::after {
        content: '❦';
        display: block;
        text-align: center;
        color: #8b5a2b;
        font-size: 1.4em;
        margin: 8px 0 24px;
        opacity: 0.7;
      }
      body::after { margin: 24px 0 8px; }
      p, div { margin-bottom: 10px; }
      p:first-letter {
        font-size: 1.8em;
        font-weight: 900;
        color: #6b2410;
        font-family: 'Frank Ruhl Libre', serif;
      }
      ::selection { background: rgba(107, 36, 16, 0.3); }
    `,
  },
};

export const DAF_THEME_LIST = Object.values(DAF_THEMES);