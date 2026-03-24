/**
 * סקריפט להוספת Sefaria Auto-Linker לכל קבצי פסקי הדין
 * הסקריפט של ספריא מזהה אוטומטית מראי מקומות בטקסט
 * והופך אותם לקישורים ללחיצה → צפייה במקור ישירות מספריא
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const allPsakimDir = join(__dirname, '..', 'all-psakim');

// The Sefaria linker v3 script tag + configuration + styles
const SEFARIA_SNIPPET = `
  <!-- Sefaria Auto-Linker: הפיכת מראי מקומות לקישורים -->
  <script
    charset="utf-8"
    src="https://www.sefaria.org/linker.v3.js"
    data-mode="popup-click"
  ></script>
  <style>
    .sefaria-ref { color: var(--primary-light, #3949ab) !important; cursor: pointer; border-bottom: 1px dashed var(--accent, #c5a55a); transition: border-color 0.2s; }
    .sefaria-ref:hover { border-bottom-color: var(--primary, #1a237e); background-color: rgba(197,165,90,0.1); }
  </style>`;

let processed = 0;
let skipped = 0;
let errors = 0;

const files = readdirSync(allPsakimDir).filter(f => f.endsWith('.html') && f !== 'index.html');

console.log(`מעבד ${files.length} פסקי דין בתיקיית all-psakim...\n`);

for (const file of files) {
  const filePath = join(allPsakimDir, file);
  try {
    let html = readFileSync(filePath, 'utf-8');

    // Skip if already has Sefaria linker
    if (html.includes('sefaria.org/linker')) {
      skipped++;
      continue;
    }

    // Insert Sefaria snippet before </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${SEFARIA_SNIPPET}\n</head>`);
    } else if (html.includes('</body>')) {
      // Fallback: add before </body>
      html = html.replace('</body>', `${SEFARIA_SNIPPET}\n</body>`);
    } else {
      // Last resort: append 
      html += SEFARIA_SNIPPET;
    }

    writeFileSync(filePath, html, 'utf-8');
    processed++;
  } catch (err) {
    console.error(`שגיאה בקובץ ${file}: ${err.message}`);
    errors++;
  }
}

// Also process downloaded-psakim and sample-psakim
for (const subDir of ['downloaded-psakim', 'sample-psakim']) {
  const dir = join(__dirname, '..', subDir);
  let subFiles;
  try {
    subFiles = readdirSync(dir).filter(f => f.endsWith('.html'));
  } catch { continue; }

  for (const file of subFiles) {
    const filePath = join(dir, file);
    try {
      let html = readFileSync(filePath, 'utf-8');
      if (html.includes('sefaria.org/linker')) { skipped++; continue; }

      if (html.includes('</head>')) {
        html = html.replace('</head>', `${SEFARIA_SNIPPET}\n</head>`);
      } else if (html.includes('</body>')) {
        html = html.replace('</body>', `${SEFARIA_SNIPPET}\n</body>`);
      } else {
        html += SEFARIA_SNIPPET;
      }

      writeFileSync(filePath, html, 'utf-8');
      processed++;
    } catch (err) {
      console.error(`שגיאה בקובץ ${subDir}/${file}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`\n✅ הסתיים!`);
console.log(`   עובדו: ${processed} קבצים`);
console.log(`   דולגו (כבר קיים): ${skipped}`);
if (errors > 0) console.log(`   שגיאות: ${errors}`);
console.log(`\nמראי המקומות בפסקי הדין הפכו לקישורים לספריא 📚`);
