/**
 * סקריפט לעיצוב מחדש של פסקי דין שהורדו מ-psakim.org
 * מפיק גרסה נקייה ומעוצבת - בלי כפילויות, עם פסקאות ועיצוב מקצועי
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'downloaded-psakim');

function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
}

function stripInlineStyles(html) {
  // Remove all style attributes but preserve bold/italic semantics
  return html
    // Remove data-mce-style attributes entirely
    .replace(/\s*data-mce-style="[^"]*"/gi, '')
    // Remove all style attributes
    .replace(/\s*style="[^"]*"/gi, '')
    // Convert spans with bold content: detect <b> or <strong> inside span
    // Remove empty <b> tags
    .replace(/<b[^>]*>\s*<\/b>/gi, '')
    // Remove google docs internal IDs
    .replace(/\s*id="docs-internal-guid-[^"]*"/gi, '');
}

function extractContent(html) {
  // Remove scripts
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove style blocks
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const rawTitle = titleMatch ? decodeEntities(titleMatch[1].replace(/ - אתר פסקי דין רבניים/, '').trim()) : '';

  // Extract metadata
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

  // Find the actual psak content (the text written by the dayanim)
  // Usually starts after the metadata sections, inside <p> tags with the actual text
  // Look for the first <p> tag that contains actual psak content
  
  // Strategy: find the mainContent > container area, then find the first <p> after metadata
  let bodyHtml = '';
  
  // Find content start: after file-title + metadata sections
  // The actual psak text is in <p> tags inside the container
  const psakTextStart = html.search(/<p[^>]*>[\s\S]*?תיק מספר/i);
  let contentStart = psakTextStart > -1 ? psakTextStart : 0;
  
  if (contentStart === 0) {
    // Fallback: find the first <p> after "section-title" divs
    const lastSection = html.lastIndexOf('section-title');
    if (lastSection > -1) {
      const nextP = html.indexOf('<p', lastSection);
      if (nextP > -1) contentStart = nextP;
    }
  }
  
  // Find content end
  let contentEnd = html.indexOf('dedication.jpg');
  if (contentEnd === -1) contentEnd = html.indexOf('לחץ כאן');
  if (contentEnd === -1) contentEnd = html.indexOf('id="footer"');
  if (contentEnd === -1) contentEnd = html.indexOf('</body>');
  
  if (contentStart > 0 && contentEnd > contentStart) {
    bodyHtml = html.substring(contentStart, contentEnd);
  }
  
  // Clean the body aggressively
  bodyHtml = bodyHtml
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a[^>]*>\s*<\/a>/gi, '')
    .replace(/<a[^>]*href="\/"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<a[^>]*href="\/Psakim[^"]*"[^>]*>[^<]*<\/a>/gi, '')
    // file-tag links preserved — Sefaria linker will handle source references
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]*id="basad"[^>]*>[^<]*<\/div>/gi, '');
  
  // Strip inline styles
  bodyHtml = stripInlineStyles(bodyHtml);
  
  // Clean up spans: replace <span>text</span> with just text (since we removed styles)
  // But keep spans that are wrapped in bold/underline
  bodyHtml = bodyHtml.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  // Now remove any remaining empty spans
  bodyHtml = bodyHtml.replace(/<span[^>]*>\s*<\/span>/gi, '');
  
  // Clean up empty elements
  bodyHtml = bodyHtml
    .replace(/<div[^>]*>\s*<\/div>/g, '')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/<b[^>]*>\s*<\/b>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Remove the original site footer that may leak in
  const footerIdx = bodyHtml.indexOf('<div id="footer"');
  if (footerIdx > -1) {
    bodyHtml = bodyHtml.substring(0, footerIdx);
  }
  
  // Remove "תגיות" section and any tag navigation (jstree, subject trees)
  const tagsIdx = bodyHtml.search(/<h[2-5][^>]*>\s*תגיות\s*<\/h[2-5]>/i);
  if (tagsIdx > -1) {
    bodyHtml = bodyHtml.substring(0, tagsIdx);
  }
  // Also catch standalone "תגיות" text
  const tagsIdx2 = bodyHtml.indexOf('>תגיות<');
  if (tagsIdx2 > -1) {
    const cutPoint = bodyHtml.lastIndexOf('<', tagsIdx2);
    if (cutPoint > -1) bodyHtml = bodyHtml.substring(0, cutPoint);
  }
  
  // Remove trailing <ul>/<li> navigation remnants
  bodyHtml = bodyHtml.replace(/(<\/?ul[^>]*>\s*|<\/?li[^>]*>\s*)+$/g, '');
  
  // Remove trailing empty/broken divs  
  bodyHtml = bodyHtml.replace(/(<\/div>\s*){3,}$/g, '');
  bodyHtml = bodyHtml.replace(/\s*<\/div>\s*$/g, '');
  
  // Fix judges in h3 - add line breaks between concatenated names
  bodyHtml = bodyHtml.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (match, content) => {
    // If content has "הרב" appearing multiple times without separator
    if ((content.match(/הרב/g) || []).length > 1) {
      content = content.replace(/הרב/g, '<br>הרב').replace(/^<br>/, '');
    }
    return `<h3>${content}</h3>`;
  });
  
  // Detect section headings and wrap them properly
  const hebrewSections = [
    'פסק דין', 'עובדות מוסכמות', 'טענות התובעים', 'טענות התובע',
    'טענת הנתבע', 'טענות הנתבע', 'טענות הנתבעים', 'בעניין שבין',
    'דיון', 'הכרעת הדין', 'החלטה', 'פסק הדין', 'נימוקים', 'סיכום',
    'רקע', 'מקורות', 'נספח', 'מסקנה', 'לאור האמור', 'תביעה שכנגד',
    'טענות הצדדים', 'הנתבע טוען', 'התובע טוען', 'דיון והכרעה', 'מבוא'
  ];
  
  // Convert bold-only paragraphs to h2 if they match section headers
  for (const sec of hebrewSections) {
    const re = new RegExp(`<p[^>]*>\\s*<b>\\s*${sec}\\s*<\\/b>\\s*<\\/p>`, 'gi');
    bodyHtml = bodyHtml.replace(re, `<h2>${sec}</h2>`);
  }
  // Also match plain paragraphs that are exactly a section header (no bold)
  for (const sec of hebrewSections) {
    const re = new RegExp(`<p[^>]*>\\s*${sec}\\s*<\\/p>`, 'gi');
    bodyHtml = bodyHtml.replace(re, `<h2>${sec}</h2>`);
  }
  
  return { rawTitle, metaInfo, bodyHtml };
}

function buildBeautifiedHtml(data, id) {
  const { rawTitle, metaInfo, bodyHtml } = data;
  
  let cleanBody = bodyHtml;
  
  // Remove metadata sections that duplicate the header bar  
  // Remove from "שם בית דין" section up to (but not including) the first real <p> with psak content
  const metaStart = cleanBody.indexOf('שם בית דין');
  if (metaStart > -1) {
    // Find where metadata block ends - usually at the <p> with "תיק מספר" or first real content <p>
    const sectionEndIdx = cleanBody.indexOf('<p', metaStart);
    if (sectionEndIdx > -1 && sectionEndIdx - metaStart < 3000) {
      // Remove the metadata block, find the enclosing div
      const divStart = cleanBody.lastIndexOf('<div', metaStart);
      if (divStart > -1 && metaStart - divStart < 200) {
        cleanBody = cleanBody.substring(0, divStart) + cleanBody.substring(sectionEndIdx);
      }
    }
  }
  
  // Remove empty containers
  cleanBody = cleanBody
    .replace(/<div[^>]*>\s*<\/div>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n');

  const title = rawTitle || 'פסק דין';
  const court = metaInfo.court || '';
  const judges = metaInfo.judges || '';
  const caseNum = metaInfo.caseNum || '';
  const date = decodeEntities(metaInfo.date || '');
  const fileNum = metaInfo.fileNum || id;

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=David+Libre:wght@400;700&family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    @import url('https://fonts.googleapis.com/earlyaccess/opensanshebrew.css');

    :root {
      --primary: #1a237e;
      --primary-light: #3949ab;
      --accent: #c5a55a;
      --bg: #fafafa;
      --card: #ffffff;
      --text: #212121;
      --text-secondary: #555;
      --border: #e0e0e0;
      --section-bg: #f5f7ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html { font-size: 16px; }

    body {
      font-family: 'David Libre', 'Frank Ruhl Libre', 'Open Sans Hebrew', serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.9;
      direction: rtl;
      padding: 0;
    }

    /* Header banner */
    .psak-header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
      padding: 40px 20px 30px;
      text-align: center;
      position: relative;
    }
    .psak-header::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 4px;
      background: var(--accent);
      border-radius: 2px;
    }
    .psak-header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 8px;
      font-family: 'Frank Ruhl Libre', serif;
    }
    .psak-header .subtitle {
      font-size: 0.95rem;
      opacity: 0.85;
    }

    /* Metadata bar */
    .meta-bar {
      max-width: 850px;
      margin: 40px auto 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      padding: 0 20px;
    }
    .meta-item {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .meta-item .label {
      font-weight: 700;
      color: var(--primary);
    }

    /* Main content */
    .psak-body {
      max-width: 850px;
      margin: 30px auto;
      padding: 0 20px;
    }

    .psak-card {
      background: var(--card);
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      padding: 40px 45px;
      margin-bottom: 30px;
    }

    /* Typography */
    h1 { font-size: 1.8rem; color: var(--primary); margin: 30px 0 15px; font-family: 'Frank Ruhl Libre', serif; }
    h2 { font-size: 1.4rem; color: var(--primary); margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--accent); font-family: 'Frank Ruhl Libre', serif; }
    h3 { font-size: 1.15rem; color: var(--primary-light); margin: 20px 0 10px; }
    h5 { font-size: 1rem; color: var(--primary); margin: 15px 0 8px; }
    h6 { font-size: 0.9rem; color: var(--text-secondary); }

    p, div.section, .toggle-title {
      margin-bottom: 14px;
      text-align: justify;
    }

    span { font-family: inherit !important; color: inherit !important; }

    /* Section blocks */
    .section { padding: 8px 0; }
    .section-title { 
      font-weight: 700; 
      font-size: 1.1rem;
      color: var(--primary);
      margin-bottom: 6px;
    }
    .toggle-title { font-weight: 600; color: var(--primary-light); cursor: default; }
    .toggle-title:before { content: '' !important; }

    /* Info sections */
    .file-title {
      background: var(--primary) !important;
      color: white !important;
      padding: 8px 20px !important;
      border-radius: 6px !important;
      font-size: 1.2rem !important;
      display: inline-block !important;
      position: static !important;
      right: auto !important;
      margin-bottom: 15px;
    }

    #file-num {
      font-size: 0.9rem !important;
      color: var(--text-secondary);
      float: none !important;
    }

    .pagename {
      font-size: 1.6rem !important;
      color: var(--primary) !important;
      text-align: center;
      margin: 15px 0 !important;
    }

    /* Tags & links */
    a.file-tag {
      background: var(--primary-light) !important;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .ogen { background-color: rgba(197, 165, 90, 0.2) !important; border-radius: 2px; }
    .ogen::after { content: '' !important; }
    .highlight { background-color: rgba(255, 235, 59, 0.4) !important; }

    /* Hide external refs */
    .selOgen:before { display: none !important; }

    /* Signature area */
    hr { border: none; border-top: 1px solid var(--border); margin: 25px 0; }

    /* Footer */
    .psak-footer {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 0.75rem;
      border-top: 1px solid var(--border);
      margin-top: 20px;
    }
    .psak-footer a { color: var(--primary-light); }

    /* Print */
    @media print {
      body { background: white; }
      .psak-header { background: var(--primary); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .psak-card { box-shadow: none; border: 1px solid #ddd; }
    }

    /* Mobile */
    @media (max-width: 600px) {
      .psak-card { padding: 20px 18px; }
      .psak-header h1 { font-size: 1.5rem; }
      h2 { font-size: 1.2rem; }
    }
  </style>
</head>
<body>

  <header class="psak-header">
    <h1>${title}</h1>
    <div class="subtitle">
      ${court ? court + ' · ' : ''}מס׳ סידורי ${fileNum}
    </div>
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
    מקור: <a href="https://www.psakim.org/Psakim/File/${id}" target="_blank">psakim.org - פסק ${id}</a>
  </footer>

</body>
</html>`;
}

// Process both files
const files = readdirSync(dir).filter(f => f.match(/^psak-din-\d+\.html$/) && !f.includes('clean') && !f.includes('styled'));

for (const file of files) {
  const id = file.match(/(\d+)/)[1];
  console.log(`\n🎨 מעצב פסק דין ${id}...`);
  
  const html = readFileSync(join(dir, file), 'utf8');
  const data = extractContent(html);
  const styled = buildBeautifiedHtml(data, id);
  
  const outFile = `psak-din-${id}-styled.html`;
  writeFileSync(join(dir, outFile), styled, 'utf8');
  console.log(`   ✅ ${outFile} (${(styled.length/1024).toFixed(1)}KB)`);
  console.log(`   📌 ${data.rawTitle}`);
  console.log(`   🏛️ ${data.metaInfo.court || 'לא זוהה'}`);
  console.log(`   📅 ${data.metaInfo.date || 'לא זוהה'}`);
}

console.log('\n✅ הסתיים!');
