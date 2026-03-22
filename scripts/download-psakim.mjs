/**
 * סקריפט להורדת פסקי דין מ-psakim.org עם העיצוב המלא
 * שימוש: node scripts/download-psakim.mjs [id1] [id2] ...
 * ברירת מחדל: 14399 14398
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'downloaded-psakim');

const ids = process.argv.slice(2);
if (ids.length === 0) ids.push('14399', '14398');

mkdirSync(outputDir, { recursive: true });

async function downloadPsak(id) {
  const url = `https://www.psakim.org/Psakim/File/${id}`;
  console.log(`\n📥 מוריד פסק דין ${id} מ: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`❌ שגיאה בהורדה: ${res.status} ${res.statusText}`);
    return null;
  }

  const html = await res.text();
  console.log(`   📄 גודל: ${(html.length / 1024).toFixed(1)}KB`);

  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/ - אתר פסקי דין רבניים/, '').trim() : `psak-${id}`;
  console.log(`   📌 כותרת: ${title}`);

  // Save the full page HTML as-is (with all original styling)
  const filename = `psak-din-${id}.html`;
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, html, 'utf-8');
  console.log(`   ✅ נשמר: downloaded-psakim/${filename}`);

  // Also create a clean standalone version with only the psak content
  const cleanHtml = createCleanVersion(html, id, title);
  const cleanFilename = `psak-din-${id}-clean.html`;
  const cleanPath = join(outputDir, cleanFilename);
  writeFileSync(cleanPath, cleanHtml, 'utf-8');
  console.log(`   ✅ גרסה נקייה: downloaded-psakim/${cleanFilename}`);

  return { id, title, filename, cleanFilename };
}

function createCleanVersion(html, id, title) {
  // Extract all inline styles from the original page
  const styleBlocks = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRegex.exec(html)) !== null) {
    styleBlocks.push(m[1]);
  }

  // Extract the main content area
  // Look for the #psakim-body or #mainContent div
  let contentHtml = '';

  // Try to find the main content between specific markers
  const bodyStart = html.indexOf('<div id="psakim-body"');
  if (bodyStart > -1) {
    // Find the matching closing - take everything from psakim-body
    const afterBody = html.substring(bodyStart);
    // Find the footer or end scripts  
    const footerIdx = afterBody.indexOf('<div id="footer"');
    const scriptEnd = afterBody.indexOf('</body>');
    const endIdx = footerIdx > -1 ? footerIdx : scriptEnd;
    if (endIdx > -1) {
      contentHtml = afterBody.substring(0, endIdx);
    } else {
      contentHtml = afterBody;
    }
  } else {
    // Fallback - try mainContent
    const mainStart = html.indexOf('<div id="mainContent"');
    if (mainStart > -1) {
      const afterMain = html.substring(mainStart);
      const endIdx = afterMain.indexOf('</body>');
      contentHtml = endIdx > -1 ? afterMain.substring(0, endIdx) : afterMain;
    } else {
      // Last resort - use everything between <body> and </body>
      const bStart = html.indexOf('<body');
      const bEnd = html.indexOf('</body>');
      if (bStart > -1 && bEnd > -1) {
        contentHtml = html.substring(html.indexOf('>', bStart) + 1, bEnd);
      }
    }
  }

  // Remove navigation, scripts, and unnecessary elements
  contentHtml = contentHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/id="nvbar"[\s\S]*?<\/div>/i, '');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${title} - פסק דין ${id}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/earlyaccess/opensanshebrew.css" rel="stylesheet">
  <style>
    ${styleBlocks.join('\n')}
    
    /* Override for standalone display */
    html, body {
      background: #fff;
      font-family: 'Open Sans Hebrew', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      direction: rtl;
      padding: 0;
      margin: 0;
    }
    #mainContent {
      background: #fff !important;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .pagename {
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      margin: 20px 0;
      color: #2A3062;
    }
    @media print {
      body { background: white; }
      .container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${contentHtml}
  </div>
  <footer style="text-align:center;padding:20px;color:#999;font-size:12px;">
    מקור: <a href="https://www.psakim.org/Psakim/File/${id}">psakim.org - פסק ${id}</a>
  </footer>
</body>
</html>`;
}

// Run
console.log('🔄 מתחיל להוריד פסקי דין מ-psakim.org...');
console.log(`   מספרי פסקים: ${ids.join(', ')}`);

const results = [];
for (const id of ids) {
  const result = await downloadPsak(id);
  if (result) results.push(result);
}

console.log('\n========================================');
console.log(`✅ הורדו ${results.length} פסקי דין:`);
results.forEach(r => {
  console.log(`   📄 ${r.title} (${r.id})`);
  console.log(`      מלא: downloaded-psakim/${r.filename}`);
  console.log(`      נקי: downloaded-psakim/${r.cleanFilename}`);
});
console.log('========================================');
