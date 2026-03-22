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

function extractContent(html) {
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
    .replace(/<a[^>]*class="file-tag"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]*id="basad"[^>]*>[^<]*<\/div>/gi, '');

  bodyHtml = stripInlineStyles(bodyHtml);
  bodyHtml = bodyHtml.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  bodyHtml = bodyHtml.replace(/<span[^>]*>\s*<\/span>/gi, '');

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

  return { rawTitle, metaInfo, bodyHtml };
}

// ── Build styled HTML ───────────────────────────────────────

function buildStyledHtml(data, id) {
  const { rawTitle, metaInfo, bodyHtml } = data;
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
    .ogen{background-color:rgba(197,165,90,.2)!important;border-radius:2px}
    .ogen::after{content:''!important}
    .highlight{background-color:rgba(255,235,59,.4)!important}
    .selOgen:before{display:none!important}
    hr{border:none;border-top:1px solid var(--border);margin:25px 0}
    blockquote{border-right:4px solid var(--accent);padding:12px 20px;margin:15px 0;background:rgba(197,165,90,.06);border-radius:0 8px 8px 0}
    .psak-footer{text-align:center;padding:20px;color:#999;font-size:.75rem;border-top:1px solid var(--border);margin-top:20px}
    .psak-footer a{color:var(--primary-light)}
    @media print{body{background:#fff}.psak-header{background:var(--primary);-webkit-print-color-adjust:exact;print-color-adjust:exact}.psak-card{box-shadow:none;border:1px solid #ddd}}
    @media(max-width:600px){.psak-card{padding:20px 18px}.psak-header h1{font-size:1.5rem}h2{font-size:1.2rem}}
  </style>
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
  <footer class="psak-footer">
    מקור: <a href="https://www.psakim.org/Psakim/File/${id}" target="_blank">psakim.org — פסק ${id}</a>
  </footer>
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
