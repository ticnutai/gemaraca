/**
 * סקריפט להורדת 10 פסקי דין מ-psakim.org
 * ─────────────────────────────────────────
 * שם הקובץ = כותרת פסק הדין (sanitized לשם קובץ תקין)
 *
 * שימוש:
 *   node scripts/download-10-psakim.mjs                  # 10 פסקים ראשונים מ-ID 1
 *   node scripts/download-10-psakim.mjs --from 500       # 10 פסקים מ-ID 500
 *   node scripts/download-10-psakim.mjs --count 20       # שנה כמות (ברירת מחדל: 10)
 *   node scripts/download-10-psakim.mjs --out my-psakim  # תיקיית פלט מותאמת
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── App base URL — update to your deployed domain ───────────
const APP_BASE_URL = 'https://gemaraca.lovable.app';

// ── Masechet Hebrew→Sefaria name mapping ────────────────────
const MASECHET_MAP = {
  'ברכות':'Berakhot','שבת':'Shabbat','עירובין':'Eruvin','פסחים':'Pesachim',
  'שקלים':'Shekalim','יומא':'Yoma','סוכה':'Sukkah','ביצה':'Beitzah',
  'ראש השנה':'Rosh_Hashanah','תענית':'Taanit','מגילה':'Megillah',
  'מועד קטן':'Moed_Katan','חגיגה':'Chagigah','יבמות':'Yevamot',
  'כתובות':'Ketubot','נדרים':'Nedarim','נזיר':'Nazir','סוטה':'Sotah',
  'גיטין':'Gittin','קידושין':'Kiddushin','בבא קמא':'Bava_Kamma',
  'בבא מציעא':'Bava_Metzia','בבא בתרא':'Bava_Batra','סנהדרין':'Sanhedrin',
  'מכות':'Makkot','שבועות':'Shevuot','עבודה זרה':'Avodah_Zarah',
  'הוריות':'Horayot','זבחים':'Zevachim','מנחות':'Menachot','חולין':'Chullin',
  'בכורות':'Bekhorot','ערכין':'Arakhin','תמורה':'Temurah','כריתות':'Keritot',
  'מעילה':'Meilah','תמיד':'Tamid','נידה':'Niddah',
};

// ── Hebrew gematria → number ────────────────────────────────
function gematriaToNumber(heb) {
  const v = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,
    'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,'ר':200,'ש':300,'ת':400};
  let sum = 0;
  for (const ch of heb.replace(/[^א-ת]/g, '')) sum += v[ch] || 0;
  return sum;
}

// ── Build internal app URL for a source tag ─────────────────
function buildSourceUrl(sourcePath) {
  const parts = sourcePath.split(' ← ').map(s => s.trim());
  if (parts[0] !== 'בבלי' || parts.length < 4) return null;
  const sefariaName = MASECHET_MAP[parts[1]];
  if (!sefariaName) return null;
  const dafNum = gematriaToNumber(parts[2].replace(/^דף\s*/, ''));
  if (!dafNum) return null;
  const amud = (parts[3] || '').replace(/^עמוד\s*/, '').trim() === 'ב' ? 'b' : 'a';
  return `${APP_BASE_URL}/sugya/${sefariaName.toLowerCase()}_${dafNum}${amud}`;
}

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
let fromId = 1;
let maxId = 14500;
let count = 10;
let outFolder = 'sample-psakim';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromId = parseInt(args[i + 1], 10);
  if (args[i] === '--count' && args[i + 1]) count = parseInt(args[i + 1], 10);
  if (args[i] === '--out' && args[i + 1]) outFolder = args[i + 1];
}

const outputDir = join(__dirname, '..', outFolder);
mkdirSync(outputDir, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Sanitize title for filename ─────────────────────────────
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')    // תווים אסורים ב-Windows
    .replace(/\s+/g, ' ')            // רווחים כפולים
    .trim()
    .substring(0, 150);              // הגבלת אורך שם קובץ
}

// ── Content extraction ──────────────────────────────────────

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function stripInlineStyles(html) {
  return html
    .replace(/\s*data-mce-style="[^"]*"/gi, '')
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/<b[^>]*>\s*<\/b>/gi, '')
    .replace(/\s*id="docs-internal-guid-[^"]*"/gi, '');
}

// Remove all <span> tags iteratively (handles nesting)
function removeSpans(html) {
  let prev = '';
  let cur = html;
  for (let i = 0; i < 10 && cur !== prev; i++) {
    prev = cur;
    cur = cur.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  }
  cur = cur.replace(/<span[^>]*>\s*<\/span>/gi, '');
  return cur;
}

// Extract tags (נושאים + מקורות) from the full original HTML
function extractTags(html) {
  const tagsStart = html.indexOf('תגיות');
  if (tagsStart === -1) return { subjects: [], sources: [] };

  const tagsSection = html.substring(tagsStart, html.indexOf('</body>', tagsStart) || html.length);

  const subjects = [];
  const sources = [];

  // ── נושאים (subjects) — uses firstLevels divs ──
  const subjectsStart = tagsSection.indexOf('subjectsTree');
  const sourcesStart = tagsSection.indexOf('sourcesTree');
  
  if (subjectsStart > -1) {
    const subjectsEnd = sourcesStart > -1 ? sourcesStart : tagsSection.length;
    const subjectsHtml = tagsSection.substring(subjectsStart, subjectsEnd);
    const firstLevels = subjectsHtml.split('firstLevels');
    for (let i = 1; i < firstLevels.length; i++) {
      const fl = firstLevels[i];
      const flLinks = fl.match(/<a[^>]*>[^<]+<\/a>/gi) || [];
      const path = flLinks.map(l => (l.match(/>([^<]+)</) || [])[1]?.trim())
        .filter(t => t && t !== 'לחץ כאן' && t !== 'לחץ');
      if (path.length > 0) subjects.push(path.join(' ← '));
    }
  }

  // ── מקורות (sources) — uses nested ul/li jstree structure ──
  if (sourcesStart > -1) {
    const sourcesHtml = tagsSection.substring(sourcesStart);
    // Split by top-level jstree-open items (root sources)
    const rootItems = sourcesHtml.split(/jstree-open/g);
    for (let i = 1; i < rootItems.length; i++) {
      const item = rootItems[i];
      const links = item.match(/<a[^>]*>[^<]+<\/a>/gi) || [];
      const path = links.map(l => (l.match(/>([^<]+)</) || [])[1]?.trim())
        .filter(t => t && t !== 'לחץ כאן' && t !== 'לחץ');
      if (path.length > 0) sources.push(path.join(' ← '));
    }
  }

  return { subjects, sources };
}

function extractContent(html) {
  // Extract tags BEFORE stripping scripts/styles
  const tags = extractTags(html);

  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const rawTitle = titleMatch ? decodeEntities(titleMatch[1].replace(/ - אתר פסקי דין רבניים/, '').trim()) : '';

  const metaInfo = {};
  const courtMatch = html.match(/שם בית דין[:\s]*<\/span>([^<]+)/i) || html.match(/שם בית דין[:\s]*<\/div>\s*<div>([^<]+)/i);
  if (courtMatch) metaInfo.court = decodeEntities(courtMatch[1].trim());

  const judgesMatch = html.match(/דיינים[:\s]*<\/span>([\s\S]*?)(?=תקציר|<\/div)/i)
    || html.match(/דיינים[:\s]*<\/div>\s*<div>([\s\S]*?)<\/div>/i);
  if (judgesMatch) {
    metaInfo.judges = decodeEntities(judgesMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').trim());
  }

  const caseMatch = html.match(/תיק מספר[:\s]*(\d+)/i);
  if (caseMatch) metaInfo.caseNum = caseMatch[1].trim();

  const dateMatch = html.match(/תאריך[:\s]*<\/span>([^<]+)/i)
    || html.match(/תאריך[:\s]*<\/div>\s*<div[^>]*>([^<]+)/i)
    || html.match(/תאריך:\s*([^\n<]+)/i);
  if (dateMatch) metaInfo.date = decodeEntities(dateMatch[1].replace(/<[^>]+>/g, '').trim());

  let bodyHtml = '';
  const psakTextStart = html.search(/<p[^>]*>[\s\S]*?תיק מספר/i);
  let contentStart = psakTextStart > -1 ? psakTextStart : 0;
  if (contentStart === 0) {
    const lastSection = html.lastIndexOf('section-title');
    if (lastSection > -1) {
      const nextP = html.indexOf('<p', lastSection);
      if (nextP > -1) contentStart = nextP;
    }
  }

  let contentEnd = html.indexOf('dedication.jpg');
  if (contentEnd === -1) contentEnd = html.indexOf('לחץ כאן');
  if (contentEnd === -1) contentEnd = html.indexOf('id="footer"');
  if (contentEnd === -1) contentEnd = html.indexOf('</body>');

  if (contentStart > 0 && contentEnd > contentStart) {
    bodyHtml = html.substring(contentStart, contentEnd);
  }

  bodyHtml = bodyHtml
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a[^>]*>\s*<\/a>/gi, '')
    .replace(/<a[^>]*href="\/"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<a[^>]*href="\/Psakim[^"]*"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]*id="basad"[^>]*>[^<]*<\/div>/gi, '');

  bodyHtml = stripInlineStyles(bodyHtml);
  // Iteratively remove all spans (handles nested spans cleanly)
  bodyHtml = removeSpans(bodyHtml);

  bodyHtml = bodyHtml
    .replace(/<div[^>]*>\s*<\/div>/g, '')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/<b[^>]*>\s*<\/b>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

  const footerIdx = bodyHtml.indexOf('<div id="footer"');
  if (footerIdx > -1) bodyHtml = bodyHtml.substring(0, footerIdx);

  const tagsIdx = bodyHtml.search(/<h[2-5][^>]*>\s*תגיות\s*<\/h[2-5]>/i);
  if (tagsIdx > -1) bodyHtml = bodyHtml.substring(0, tagsIdx);
  const tagsIdx2 = bodyHtml.indexOf('>תגיות<');
  if (tagsIdx2 > -1) {
    const cutPoint = bodyHtml.lastIndexOf('<', tagsIdx2);
    if (cutPoint > -1) bodyHtml = bodyHtml.substring(0, cutPoint);
  }

  bodyHtml = bodyHtml.replace(/(<\/?ul[^>]*>\s*|<\/?li[^>]*>\s*)+$/g, '');
  bodyHtml = bodyHtml.replace(/(<\/div>\s*){3,}$/g, '');
  bodyHtml = bodyHtml.replace(/\s*<\/div>\s*$/g, '');

  bodyHtml = bodyHtml.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (match, content) => {
    if ((content.match(/הרב/g) || []).length > 1) {
      content = content.replace(/הרב/g, '<br>הרב').replace(/^<br>/, '');
    }
    return `<h3>${content}</h3>`;
  });

  const hebrewSections = [
    'פסק דין', 'עובדות מוסכמות', 'טענות התובעים', 'טענות התובע',
    'טענת הנתבע', 'טענות הנתבע', 'טענות הנתבעים', 'בעניין שבין',
    'דיון', 'הכרעת הדין', 'החלטה', 'פסק הדין', 'נימוקים', 'סיכום',
    'רקע', 'מקורות', 'נספח', 'מסקנה', 'לאור האמור', 'תביעה שכנגד',
    'טענות הצדדים', 'הנתבע טוען', 'התובע טוען', 'דיון והכרעה', 'מבוא'
  ];

  for (const sec of hebrewSections) {
    bodyHtml = bodyHtml.replace(new RegExp(`<p[^>]*>\\s*<b>\\s*${sec}\\s*<\\/b>\\s*<\\/p>`, 'gi'), `<h2>${sec}</h2>`);
    bodyHtml = bodyHtml.replace(new RegExp(`<p[^>]*>\\s*${sec}\\s*<\\/p>`, 'gi'), `<h2>${sec}</h2>`);
  }

  return { rawTitle, metaInfo, bodyHtml, tags };
}

// ── Build styled HTML ───────────────────────────────────────

function buildStyledHtml(data, id) {
  const { rawTitle, metaInfo, bodyHtml, tags } = data;
  let cleanBody = bodyHtml;

  const metaStart = cleanBody.indexOf('שם בית דין');
  if (metaStart > -1) {
    const sectionEndIdx = cleanBody.indexOf('<p', metaStart);
    if (sectionEndIdx > -1 && sectionEndIdx - metaStart < 3000) {
      const divStart = cleanBody.lastIndexOf('<div', metaStart);
      if (divStart > -1 && metaStart - divStart < 200) {
        cleanBody = cleanBody.substring(0, divStart) + cleanBody.substring(sectionEndIdx);
      }
    }
  }

  cleanBody = cleanBody
    .replace(/<div[^>]*>\s*<\/div>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

  const title = rawTitle || 'פסק דין';
  const court = metaInfo.court || '';
  const judges = metaInfo.judges || '';
  const caseNum = metaInfo.caseNum || '';
  const date = decodeEntities(metaInfo.date || '');

  // Build tags section HTML
  let tagsHtml = '';
  if (tags && (tags.subjects.length > 0 || tags.sources.length > 0)) {
    tagsHtml = '<section class="tags-section"><h2>תגיות ומקורות</h2><div class="tags-container">';
    if (tags.subjects.length > 0) {
      tagsHtml += '<div class="tags-group"><h3>נושאים</h3><div class="tags-list">';
      tags.subjects.forEach(s => { tagsHtml += `<span class="tag-pill tag-subject">${s}</span>`; });
      tagsHtml += '</div></div>';
    }
    if (tags.sources.length > 0) {
      tagsHtml += '<div class="tags-group"><h3>מקורות</h3><div class="tags-list">';
      tags.sources.forEach(s => {
        const url = buildSourceUrl(s);
        if (url) {
          tagsHtml += `<a class="tag-pill tag-source" href="${url}" target="_blank" rel="noopener">${s}</a>`;
        } else {
          tagsHtml += `<span class="tag-pill tag-source">${s}</span>`;
        }
      });
      tagsHtml += '</div></div>';
    }
    tagsHtml += '</div></section>';
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;700&family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    :root{--primary:#1a237e;--primary-light:#3949ab;--accent:#c5a55a;--bg:#fafafa;--card:#fff;--text:#212121;--text-secondary:#555;--border:#e0e0e0}
    *{box-sizing:border-box;margin:0;padding:0}
    html{font-size:16px}
    body{font-family:'David Libre','Frank Ruhl Libre',serif;background:var(--bg);color:var(--text);line-height:1.9;direction:rtl}
    .psak-header{background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;padding:40px 20px 30px;text-align:center;position:relative}
    .psak-header::after{content:'';position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);width:60px;height:4px;background:var(--accent);border-radius:2px}
    .psak-header h1{font-size:2rem;font-weight:700;margin-bottom:8px;font-family:'Frank Ruhl Libre',serif}
    .psak-header .subtitle{font-size:.95rem;opacity:.85}
    .meta-bar{max-width:850px;margin:40px auto 20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:0 20px}
    .meta-item{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 18px;font-size:.85rem;display:flex;align-items:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .meta-item .label{font-weight:700;color:var(--primary)}
    .psak-body{max-width:850px;margin:30px auto;padding:0 20px}
    .psak-card{background:var(--card);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07);padding:40px 45px;margin-bottom:30px}
    h1{font-size:1.8rem;color:var(--primary);margin:30px 0 15px;font-family:'Frank Ruhl Libre',serif}
    h2{font-size:1.4rem;color:var(--primary);margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--accent);font-family:'Frank Ruhl Libre',serif}
    h3{font-size:1.15rem;color:var(--primary-light);margin:20px 0 10px}
    p,div.section,.toggle-title{margin-bottom:14px;text-align:justify}
    span{font-family:inherit!important;color:inherit!important}
    .section-title{font-weight:700;font-size:1.1rem;color:var(--primary);margin-bottom:6px}
    .toggle-title{font-weight:600;color:var(--primary-light);cursor:default}
    .toggle-title:before{content:''!important}
    .file-title{background:var(--primary)!important;color:#fff!important;padding:8px 20px!important;border-radius:6px!important;font-size:1.2rem!important;display:inline-block!important;position:static!important;right:auto!important;margin-bottom:15px}
    #file-num{font-size:.9rem!important;color:var(--text-secondary);float:none!important}
    .pagename{font-size:1.6rem!important;color:var(--primary)!important;text-align:center;margin:15px 0!important}
    a.file-tag{background:var(--primary-light)!important;border-radius:4px;font-size:.8rem}
    .ogen{background-color:rgba(197,165,90,.2)!important;border-radius:2px;padding:1px 3px}
    .ogen::after{content:''!important}
    .highlight{background-color:rgba(255,235,59,.4)!important}
    .selOgen:before{display:none!important}
    hr{border:none;border-top:1px solid var(--border);margin:25px 0}
    blockquote{border-right:4px solid var(--accent);padding:12px 20px;margin:15px 0;background:rgba(197,165,90,.06);border-radius:0 8px 8px 0}
    .psak-footer{text-align:center;padding:20px;color:#999;font-size:.75rem;border-top:1px solid var(--border);margin-top:20px}
    .psak-footer a{color:var(--primary-light)}
    @media print{body{background:#fff}.psak-header{background:var(--primary);-webkit-print-color-adjust:exact;print-color-adjust:exact}.psak-card{box-shadow:none;border:1px solid #ddd}.toc-sidebar,.toc-toggle,.toc-overlay{display:none!important}}
    @media(max-width:600px){.psak-card{padding:20px 18px}.psak-header h1{font-size:1.5rem}h2{font-size:1.2rem}.toc-sidebar{width:260px}}
    .toc-toggle{position:fixed;top:12px;right:12px;z-index:1001;background:var(--primary);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:1.3rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:transform .2s}
    .toc-toggle:hover{transform:scale(1.1)}
    .toc-sidebar{position:fixed;top:0;right:0;width:280px;height:100vh;background:var(--card,#fff);border-left:3px solid var(--accent,#c5a55a);box-shadow:-4px 0 20px rgba(0,0,0,.1);z-index:1000;overflow-y:auto;transform:translateX(100%);transition:transform .3s ease;padding:60px 0 20px;direction:rtl}
    .toc-sidebar.open{transform:translateX(0)}
    .toc-sidebar h3{text-align:center;color:var(--primary,#1a237e);font-size:1.1rem;margin:0 0 12px;padding:0 15px 10px;border-bottom:2px solid var(--accent,#c5a55a);font-family:'Frank Ruhl Libre',serif}
    .toc-sidebar ul{list-style:none;padding:0;margin:0}
    .toc-sidebar li{border-bottom:1px solid rgba(0,0,0,.05)}
    .toc-sidebar li a{display:block;padding:10px 20px;color:var(--text,#212121);text-decoration:none;font-size:.88rem;line-height:1.5;transition:background .15s,border-left-color .15s;border-left:3px solid transparent}
    .toc-sidebar li a:hover,.toc-sidebar li a.active{background:rgba(26,35,126,.06);border-left-color:var(--accent,#c5a55a);color:var(--primary,#1a237e)}
    .toc-sidebar li.toc-h3 a{padding-right:35px;font-size:.82rem;color:var(--text-secondary,#555)}
    .toc-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:999;opacity:0;pointer-events:none;transition:opacity .3s}
    .toc-overlay.open{opacity:1;pointer-events:auto}
    html{scroll-behavior:smooth}
    h2,h3{scroll-margin-top:20px}
    .ogen{background-color:rgba(197,165,90,.15)!important;border-radius:3px;padding:1px 4px}
    @media(min-width:1200px){.toc-sidebar{transform:translateX(0);box-shadow:none}.toc-toggle{display:none}.toc-overlay{display:none}.psak-body{margin-left:auto;margin-right:300px}.psak-header,.meta-bar{padding-right:290px}.psak-footer{padding-right:290px}}
    .tags-section{max-width:850px;margin:0 auto 30px;padding:0 20px}
    .tags-section h2{font-size:1.3rem;color:var(--primary);margin-bottom:15px;padding-bottom:8px;border-bottom:2px solid var(--accent);font-family:'Frank Ruhl Libre',serif}
    .tags-container{background:var(--card);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07);padding:25px 30px}
    .tags-group{margin-bottom:18px}
    .tags-group:last-child{margin-bottom:0}
    .tags-group h3{font-size:1rem;color:var(--primary-light);margin-bottom:10px}
    .tags-list{display:flex;flex-wrap:wrap;gap:8px}
    .tag-pill{display:inline-block;padding:6px 14px;border-radius:20px;font-size:.82rem;line-height:1.4}
    .tag-subject{background:rgba(26,35,126,.08);color:var(--primary);border:1px solid rgba(26,35,126,.15)}
    .tag-source{background:rgba(197,165,90,.12);color:#5d4e1f;border:1px solid rgba(197,165,90,.3)}
    a.tag-pill{text-decoration:none;cursor:pointer;transition:background .2s,box-shadow .2s}
    a.tag-pill:hover{box-shadow:0 2px 8px rgba(0,0,0,.15);filter:brightness(.92)}
    a.tag-source:hover{background:rgba(197,165,90,.28)}
  </style>
  <script charset="utf-8" src="https://www.sefaria.org/linker.v3.js" data-mode="popup-click"></script>
  <style>.sefaria-ref{color:var(--primary-light,#3949ab)!important;cursor:pointer;border-bottom:1px dashed var(--accent,#c5a55a);transition:border-color .2s}.sefaria-ref:hover{border-bottom-color:var(--primary,#1a237e);background-color:rgba(197,165,90,.1)}</style>
</head>
<body>
  <header class="psak-header">
    <h1>${title}</h1>
    <div class="subtitle">${court ? court + ' · ' : ''}מס׳ סידורי ${id}</div>
  </header>
  <div class="meta-bar">
    ${caseNum ? `<div class="meta-item"><span class="label">תיק מס׳</span> ${caseNum}</div>` : ''}
    ${date ? `<div class="meta-item"><span class="label">תאריך</span> ${date}</div>` : ''}
    ${judges ? `<div class="meta-item"><span class="label">דיינים</span> ${judges}</div>` : ''}
    ${court ? `<div class="meta-item"><span class="label">בית דין</span> ${court}</div>` : ''}
  </div>
  <main class="psak-body">
    <article class="psak-card">
      ${cleanBody}
    </article>
  </main>
  ${tagsHtml}
  <footer class="psak-footer">
    מקור: <a href="https://www.psakim.org/Psakim/File/${id}" target="_blank">psakim.org — פסק ${id}</a>
  </footer>
<script>
(function(){
  var card=document.querySelector('.psak-card');if(!card)return;
  var headings=card.querySelectorAll('h1,h2,h3,.Heading230,.Bodytext50');if(headings.length<2)return;
  var items=[],seen=new Set(),idx=0;
  headings.forEach(function(h){var t=h.textContent.replace(/\\s+/g,' ').trim();if(!t||t.length<2||t==='פסק דין')return;if(seen.has(t))return;seen.add(t);var id='toc-'+(idx++);h.id=id;var lv=h.tagName==='H3'?'h3':'h2';if(h.tagName==='H1'&&h.closest('.psak-header'))return;items.push({id:id,text:t,level:lv})});
  if(items.length<2)return;
  var sb=document.createElement('nav');sb.className='toc-sidebar';sb.innerHTML='<h3>תוכן עניינים</h3><ul>'+items.map(function(it){return'<li class="toc-'+it.level+'"><a href="#'+it.id+'">'+it.text+'</a></li>'}).join('')+'</ul>';document.body.appendChild(sb);
  var btn=document.createElement('button');btn.className='toc-toggle';btn.innerHTML='☰';btn.setAttribute('aria-label','תוכן עניינים');document.body.appendChild(btn);
  var ov=document.createElement('div');ov.className='toc-overlay';document.body.appendChild(ov);
  function tog(){sb.classList.toggle('open');ov.classList.toggle('open')}btn.addEventListener('click',tog);ov.addEventListener('click',tog);
  sb.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var t=document.getElementById(a.getAttribute('href').slice(1));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});if(window.innerWidth<1200)tog()})});
  var links=sb.querySelectorAll('a'),els=items.map(function(it){return document.getElementById(it.id)});
  window.addEventListener('scroll',function(){var sp=window.scrollY+100,ac=0;els.forEach(function(el,i){if(el&&el.offsetTop<=sp)ac=i});links.forEach(function(a,i){a.classList.toggle('active',i===ac)})},{passive:true});
})();
</script>
</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────

async function downloadAndStyle(id) {
  const url = `https://www.psakim.org/Psakim/File/${id}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`   ⚠️ שגיאת רשת ID ${id}: ${err.message}`);
    return null;
  }

  if (!res.ok) return null;

  const html = await res.text();
  if (html.includes('לא נמצא הפריט המבוקש')) return null;

  const data = extractContent(html);
  const styled = buildStyledHtml(data, id);
  const title = data.rawTitle || `פסק דין ${id}`;

  // שם הקובץ = כותרת פסק הדין
  const safeTitle = sanitizeFileName(title);
  const filename = `${safeTitle}.html`;
  writeFileSync(join(outputDir, filename), styled, 'utf8');

  return { title, filename, sizeKB: +(styled.length / 1024).toFixed(1) };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(`  הורדת ${count} פסקי דין מ-psakim.org`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`  סריקה מ-ID ${fromId}`);
  console.log(`  תיקיית פלט: ${outFolder}/`);
  console.log('═══════════════════════════════════════════════════\n');

  let downloaded = 0;
  const results = [];
  const startTime = Date.now();

  for (let id = fromId; id <= maxId && downloaded < count; id++) {
    const result = await downloadAndStyle(id);

    if (result) {
      downloaded++;
      results.push({ id, ...result });
      console.log(`✅ [${downloaded}/${count}] ID ${id}: ${result.title} (${result.sizeKB}KB)`);
    }

    // Rate limit
    await sleep(1200);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ הורדו ${downloaded} פסקי דין`);
  console.log(`  📁 תיקייה: ${outFolder}/`);
  console.log(`  ⏱️ זמן: ${elapsed} שניות`);
  console.log('═══════════════════════════════════════════════════');
  console.log('\nקבצים:');
  results.forEach(r => console.log(`  📄 ${r.title}`));
}

main().catch(err => {
  console.error('שגיאה קריטית:', err);
  process.exit(1);
});
