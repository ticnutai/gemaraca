import fs from 'fs';
import path from 'path';

const dir = 'all-psakim';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

// Skip English ones, look at Hebrew ones
const hebrewFiles = files.filter(f => /[\u0590-\u05FF]/.test(f));
for (let i = 0; i < Math.min(5, hebrewFiles.length); i++) {
  files[i] = hebrewFiles[i];
}
for (let i = 0; i < Math.min(5, files.length); i++) {
  const html = fs.readFileSync(path.join(dir, files[i]), 'utf8');
  const metaStart = html.indexOf('class="meta-bar"');
  const metaEnd = html.indexOf('class="psak-body"');
  if (metaStart > 0 && metaEnd > metaStart) {
    console.log('=== ' + files[i].substring(0, 50) + ' ===');
    console.log(html.substring(metaStart, metaEnd));
    console.log('---');
  }
}
