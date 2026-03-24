/**
 * שדרוג פסקי דין - הוספת סיידבר תוכן עניינים בצד ימין + עיצוב משופר
 * - סיידבר קבוע בצד ימין עם כותרות הפסק
 * - לחיצה על כותרת מביאה ישירות לאותו מקום
 * - כפילויות מוסרות (כותרת זהה מופיעה פעם אחת בלבד)
 * - מחליף גרסה ישנה אם קיימת
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ========= CSS for RIGHT-side sidebar + improved styling =========
const SIDEBAR_CSS = `
    /* === סיידבר תוכן עניינים — צד ימין === */
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
    @media(min-width:1200px){
      .toc-sidebar{transform:translateX(0);box-shadow:none}
      .toc-toggle{display:none}
      .toc-overlay{display:none}
      .psak-body{margin-left:auto;margin-right:300px}
      .psak-header,.meta-bar{padding-right:290px}
      .psak-footer{padding-right:290px}
    }
    @media(max-width:600px){.toc-sidebar{width:260px}}
    /* === שיפורי עיצוב === */
    html{scroll-behavior:smooth}
    h2{scroll-margin-top:20px}
    h3{scroll-margin-top:20px}
    .ogen{background-color:rgba(197,165,90,.15)!important;border-radius:3px;padding:1px 4px}
`;

// ========= JavaScript for TOC generation =========
const SIDEBAR_JS = `
<script>
(function(){
  // Build TOC from headings
  var card = document.querySelector('.psak-card');
  if(!card) return;
  var headings = card.querySelectorAll('h1, h2, h3, .Heading230, .Bodytext50');
  if(headings.length < 2) return;

  // Assign IDs and collect TOC items
  var items = [];
  var seen = new Set();
  var idx = 0;
  headings.forEach(function(h){
    var text = h.textContent.replace(/\\s+/g,' ').trim();
    if(!text || text.length < 2 || text === 'פסק דין') return;
    // Skip exact duplicates (same heading text appearing twice)
    if(seen.has(text)) return;
    seen.add(text);
    var id = 'toc-' + (idx++);
    h.id = id;
    var level = h.tagName === 'H3' ? 'h3' : 'h2';
    if(h.tagName === 'H1' && h.closest('.psak-header')) return;
    items.push({id:id, text:text, level:level});
  });
  if(items.length < 2) return;

  // Create sidebar HTML
  var sidebar = document.createElement('nav');
  sidebar.className = 'toc-sidebar';
  sidebar.innerHTML = '<h3>תוכן עניינים</h3><ul>' +
    items.map(function(it){
      return '<li class="toc-'+it.level+'"><a href="#'+it.id+'">'+it.text+'</a></li>';
    }).join('') + '</ul>';
  document.body.appendChild(sidebar);

  // Create toggle button
  var btn = document.createElement('button');
  btn.className = 'toc-toggle';
  btn.innerHTML = '☰';
  btn.setAttribute('aria-label','תוכן עניינים');
  document.body.appendChild(btn);

  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'toc-overlay';
  document.body.appendChild(overlay);

  function toggle(){
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
  btn.addEventListener('click', toggle);
  overlay.addEventListener('click', toggle);

  // Close on link click (mobile)
  sidebar.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      if(window.innerWidth < 1200) toggle();
    });
  });

  // Highlight active section on scroll
  var tocLinks = sidebar.querySelectorAll('a');
  var headingEls = items.map(function(it){ return document.getElementById(it.id); });
  window.addEventListener('scroll', function(){
    var scrollPos = window.scrollY + 100;
    var active = 0;
    headingEls.forEach(function(el, i){
      if(el && el.offsetTop <= scrollPos) active = i;
    });
    tocLinks.forEach(function(a,i){
      a.classList.toggle('active', i === active);
    });
  }, {passive:true});
})();
</script>
`;

// ========= Strip old TOC sidebar (left or right) =========
function stripOldToc(html) {
  // Remove old sidebar CSS block (between marker comments or by pattern)
  html = html.replace(/\s*\/\* === סיידבר תוכן עניינים[^]*?\.ogen\{[^}]+\}\s*/g, '');
  // Remove old TOC JS script block
  html = html.replace(/\s*<script>\s*\(function\(\)\{\s*\/\/ Build TOC from headings[\s\S]*?<\/script>\s*/g, '');
  // Remove leftover toc-related CSS that may not be in comment block
  html = html.replace(/\s*\.toc-toggle\{[^}]+\}[\s\S]*?\.toc-overlay\.open\{[^}]+\}\s*/g, '');
  return html;
}

// ========= Process files =========
let processed = 0;
let skipped = 0;
let errors = 0;

function processFile(filePath) {
  try {
    let html = readFileSync(filePath, 'utf-8');

    // If old sidebar exists, strip it first
    if (html.includes('toc-sidebar')) {
      html = stripOldToc(html);
    }

    // Skip if no </style> (not a styled psak file)
    const styleCloseIdx = html.indexOf('</style>');
    if (styleCloseIdx === -1) {
      skipped++;
      return;
    }

    // 1. Add sidebar CSS — inject before </style> of main style block
    html = html.slice(0, styleCloseIdx) + SIDEBAR_CSS + '\n  </style>' + html.slice(styleCloseIdx + 8);

    // 2. Add sidebar JS — inject before </body>
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx > -1) {
      html = html.slice(0, bodyCloseIdx) + SIDEBAR_JS + '\n</body>' + html.slice(bodyCloseIdx + 7);
    } else {
      html += SIDEBAR_JS;
    }

    writeFileSync(filePath, html, 'utf-8');
    processed++;
  } catch (err) {
    console.error(`שגיאה: ${filePath}: ${err.message}`);
    errors++;
  }
}

// Process all directories
for (const subDir of ['all-psakim', 'downloaded-psakim', 'sample-psakim']) {
  const dir = join(__dirname, '..', subDir);
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
  } catch { continue; }

  console.log(`מעבד ${files.length} קבצים ב-${subDir}...`);
  for (const file of files) {
    processFile(join(dir, file));
  }
}

console.log(`\n✅ הסתיים!`);
console.log(`   שודרגו: ${processed} קבצים`);
console.log(`   דולגו: ${skipped}`);
if (errors > 0) console.log(`   שגיאות: ${errors}`);
console.log(`\nכל פסק דין כולל עכשיו סיידבר תוכן עניינים בצד ימין 📋`);
