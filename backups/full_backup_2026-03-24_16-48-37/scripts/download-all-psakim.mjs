/**
 * סקריפט להורדת כול פסקי הדין מ-psakim.org ועיצובם
 * ─────────────────────────────────────────────────────
 * סורק IDs מ-1 עד 14500, מורד פסקים תקפים, ומעצב כל אחד.
 * - resume: שומר manifest.json — אפשר לעצור ולהמשיך
 * - rate-limit: השהייה של 1.5 שניות בין בקשות
 * - שומר רק גרסה מעוצבת (styled) + אינדקס HTML
 * - optimized: notFound stored as ranges, saves every 200 IDs, chunked processing
 *
 * שימוש:
 *   node scripts/download-all-psakim.mjs              # סריקה מלאה 1-14500
 *   node scripts/download-all-psakim.mjs --from 500   # המשך מ-ID 500
 *   node scripts/download-all-psakim.mjs --to 200     # סרוק רק עד 200
 *   node scripts/download-all-psakim.mjs --test       # בדיקה: 5 IDs ראשונים שנמצאים
 *   node scripts/download-all-psakim.mjs --chunk 500  # עבד בקבוצות של 500 ועצור
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'all-psakim');
const manifestPath = join(outputDir, 'manifest.json');

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
let fromId = 1;
let toId = 14500;
let testMode = false;
let chunkSize = 0; // 0 = no chunking (run all)

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from' && args[i + 1]) fromId = parseInt(args[i + 1], 10);
  if (args[i] === '--to' && args[i + 1]) toId = parseInt(args[i + 1], 10);
  if (args[i] === '--test') testMode = true;
  if (args[i] === '--chunk' && args[i + 1]) chunkSize = parseInt(args[i + 1], 10);
}

// ── Setup ───────────────────────────────────────────────────
mkdirSync(outputDir, { recursive: true });

// ── notFound compression: store as ranges instead of huge array ──
function compressNotFound(arr) {
  if (!arr.length) return [];
  const sorted = [...new Set(arr)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else { ranges.push(start === end ? start : [start, end]); start = end = sorted[i]; }
  }
  ranges.push(start === end ? start : [start, end]);
  return ranges;
}

function expandNotFound(ranges) {
  const set = new Set();
  for (const r of ranges) {
    if (Array.isArray(r)) { for (let i = r[0]; i <= r[1]; i++) set.add(i); }
    else set.add(r);
  }
  return set;
}

// Load existing manifest (for resume)
let manifest = { downloaded: {}, notFoundRanges: [], lastScanned: 0 };
let notFoundSet = new Set();
if (existsSync(manifestPath)) {
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.downloaded = raw.downloaded || {};
    manifest.lastScanned = raw.lastScanned || 0;
    // Migrate old format (flat array) to ranges
    if (raw.notFound && Array.isArray(raw.notFound) && raw.notFound.length && !Array.isArray(raw.notFound[0])) {
      notFoundSet = new Set(raw.notFound);
      manifest.notFoundRanges = compressNotFound(raw.notFound);
    } else {
      manifest.notFoundRanges = raw.notFoundRanges || raw.notFound || [];
      notFoundSet = expandNotFound(manifest.notFoundRanges);
    }
    console.log(`📋 נטען manifest קיים: ${Object.keys(manifest.downloaded).length} פסקים, ${notFoundSet.size} לא נמצאו, סרוק עד ID ${manifest.lastScanned}`);
  } catch { /* start fresh */ }
}

function saveManifest() {
  manifest.notFoundRanges = compressNotFound([...notFoundSet]);
  const slim = {
    downloaded: manifest.downloaded,
    notFoundRanges: manifest.notFoundRanges,
    lastScanned: manifest.lastScanned
  };
  writeFileSync(manifestPath, JSON.stringify(slim), 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Sanitize title for filename ─────────────────────────────
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')   // תווים אסורים ב-Windows
    .replace(/\s+/g, ' ')            // רווחים כפולים
    .trim()
    .substring(0, 150);              // הגבלת אורך שם קובץ
}

// Track used filenames to avoid duplicates
const usedFilenames = new Set();
function initUsedFilenames() {
  for (const [, info] of Object.entries(manifest.downloaded)) {
    if (info.filename) usedFilenames.add(info.filename);
  }
}

function getUniqueFilename(title, id) {
  const safeTitle = sanitizeFileName(title || `פסק דין ${id}`);
  let filename = `${safeTitle}.html`;
  if (usedFilenames.has(filename)) {
    filename = `${safeTitle} (${id}).html`;
  }
  usedFilenames.add(filename);
  return filename;
}

// ── Content extraction (from style-psakim.mjs) ─────────────

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

// ── Generate index page ─────────────────────────────────────

function buildIndexHtml(manifest) {
  const entries = Object.entries(manifest.downloaded)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const rows = entries.map(([id, info]) => {
    const safe = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const href = encodeURIComponent(info.filename || `psak-${id}.html`);
    return `<tr>
      <td>${id}</td>
      <td><a href="${href}">${safe(info.title)}</a></td>
      <td>${safe(info.court)}</td>
      <td>${safe(info.date)}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>אינדקס פסקי דין</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    :root{--primary:#1a237e;--accent:#c5a55a}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Frank Ruhl Libre',serif;background:#fafafa;color:#212121;direction:rtl;padding:20px}
    h1{text-align:center;color:var(--primary);margin:30px 0;font-size:2rem}
    .stats{text-align:center;color:#555;margin-bottom:30px;font-size:1.1rem}
    table{width:100%;max-width:1000px;margin:0 auto;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    th{background:var(--primary);color:#fff;padding:12px 16px;text-align:right;font-weight:600}
    td{padding:10px 16px;border-bottom:1px solid #eee}
    tr:hover td{background:#f5f7ff}
    a{color:var(--primary);text-decoration:none}
    a:hover{text-decoration:underline}
    input{display:block;margin:0 auto 20px;width:100%;max-width:500px;padding:12px 18px;border:2px solid #e0e0e0;border-radius:8px;font-size:1rem;font-family:inherit;direction:rtl}
    input:focus{outline:none;border-color:var(--primary)}
  </style>
</head>
<body>
  <h1>אינדקס פסקי דין</h1>
  <div class="stats">${entries.length} פסקי דין</div>
  <input type="text" id="search" placeholder="חיפוש לפי כותרת, בית דין..." oninput="filterTable()">
  <table>
    <thead><tr><th>מס׳</th><th>כותרת</th><th>בית דין</th><th>תאריך</th></tr></thead>
    <tbody id="tbody">${rows}</tbody>
  </table>
  <script>
    function filterTable(){
      const q=(document.getElementById('search').value||'').trim().toLowerCase();
      const rows=document.querySelectorAll('#tbody tr');
      rows.forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'});
    }
  </script>
</body>
</html>`;
}

// ── Main loop ───────────────────────────────────────────────

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

  // Check for "not found" page
  if (html.includes('לא נמצא הפריט המבוקש')) return null;

  // Extract, style, save
  const data = extractContent(html);
  const styled = buildStyledHtml(data, id);

  const title = data.rawTitle || `פסק דין ${id}`;
  const filename = getUniqueFilename(title, id);
  writeFileSync(join(outputDir, filename), styled, 'utf8');

  return {
    title: data.rawTitle,
    filename,
    court: data.metaInfo.court || '',
    judges: data.metaInfo.judges || '',
    date: data.metaInfo.date || '',
    caseNum: data.metaInfo.caseNum || '',
    sizeKB: +(styled.length / 1024).toFixed(1)
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  הורדת כול פסקי הדין מ-psakim.org');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  טווח סריקה: ${fromId} - ${toId}`);
  console.log(`  תיקייה: all-psakim/`);
  console.log(`  שם קובץ = כותרת פסק הדין`);
  console.log(`  פסקים כבר הורדו: ${Object.keys(manifest.downloaded).length}`);
  console.log('═══════════════════════════════════════════════════\n');

  initUsedFilenames();

  let found = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;
  let testCount = 0;

  const startTime = Date.now();

  for (let id = fromId; id <= toId; id++) {
    // Skip already downloaded
    if (manifest.downloaded[id]) {
      skipped++;
      continue;
    }
    // Skip known not-found
    if (notFoundSet.has(id)) {
      continue;
    }

    const result = await downloadAndStyle(id);

    if (result) {
      found++;
      manifest.downloaded[id] = result;
      const total = Object.keys(manifest.downloaded).length;
      console.log(`✅ [${total}] ID ${id}: ${result.title} (${result.sizeKB}KB)`);

      if (testMode) {
        testCount++;
        if (testCount >= 5) {
          console.log('\n🧪 מצב בדיקה — עוצר אחרי 5 פסקים');
          break;
        }
      }
    } else {
      notFound++;
      notFoundSet.add(id);
    }

    manifest.lastScanned = id;

    // Save manifest every 200 IDs (less frequent = less disk I/O)
    if (id % 200 === 0) {
      saveManifest();
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const totalDownloaded = Object.keys(manifest.downloaded).length;
      console.log(`   📊 [סרוק ${id}/${toId}] נמצאו ${totalDownloaded} | חסרים ${notFound} | דלגנו ${skipped} | ${elapsed} דק'`);
      // Hint GC to free memory
      if (global.gc) global.gc();
    }

    // Rate limit
    await sleep(1500);

    // Stop after chunk
    if (chunkSize > 0 && (found + notFound) >= chunkSize) {
      console.log(`\n⏸️ עצירת chunk — עובדו ${chunkSize} IDs. הפעל שוב להמשך.`);
      break;
    }
  }

  // Final save
  saveManifest();

  // Build index
  console.log('\n📝 בונה אינדקס HTML...');
  const indexHtml = buildIndexHtml(manifest);
  writeFileSync(join(outputDir, 'index.html'), indexHtml, 'utf8');

  const totalDownloaded = Object.keys(manifest.downloaded).length;
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ הסתיים!`);
  console.log(`  📥 הורדו בסה"כ: ${totalDownloaded} פסקי דין`);
  console.log(`  ⏭️ דלגנו (כבר קיימים): ${skipped}`);
  console.log(`  ❌ לא נמצאו: ${notFound}`);
  console.log(`  ⏱️ זמן: ${elapsed} דקות`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('שגיאה קריטית:', err);
  saveManifest();
  process.exit(1);
});
