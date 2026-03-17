/**
 * Multiple smart templates for psak din formatting.
 * Each template produces a full self-contained HTML document.
 */
import type { ParsedPsakDin } from './psakDinParser';
import { classifyLines, classifiedLinesToHtml } from './smartTextFormatter';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Template metadata ───
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  requiresAi: boolean;
  icon: string;
  hasIndex: boolean;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "classic",
    name: "קלאסי מקצועי",
    description: "עיצוב מסורתי עם אינדקס פנימי קליקבילי, כותרות, פרטי תיק וחתימה — ללא AI",
    requiresAi: false,
    icon: "📜",
    hasIndex: true,
  },
  {
    id: "modern",
    name: "מודרני נקי",
    description: "עיצוב מודרני מינימליסטי עם צבעים רכים — ללא AI",
    requiresAi: false,
    icon: "✨",
    hasIndex: false,
  },
  {
    id: "indexed",
    name: "עם אינדקס (תוכן עניינים)",
    description: "יוצר אינדקס אוטומטי מהסעיפים, עם ניווט פנימי — ללא AI",
    requiresAi: false,
    icon: "📑",
    hasIndex: true,
  },
  {
    id: "academic",
    name: "אקדמי מחקרי",
    description: "מבנה מחקרי עם הערות שוליים, מספור סעיפים ומקורות — ללא AI",
    requiresAi: false,
    icon: "🎓",
    hasIndex: true,
  },
  {
    id: "ai-enhanced",
    name: "שיפור AI מלא",
    description: "AI מעצב, מסכם ומשפר את הטקסט, מוסיף מבנה מקצועי",
    requiresAi: true,
    icon: "🤖",
    hasIndex: false,
  },
  {
    id: "ai-summary",
    name: "סיכום AI + עיצוב",
    description: "AI יוצר סיכום מקוצר עם נקודות מפתח + עיצוב מלא",
    requiresAi: true,
    icon: "⚡",
    hasIndex: false,
  },
];

// ─── Shared CSS blocks ───

const PRINT_CSS = `
  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; border: none; padding: 20px; }
    .toc-link { text-decoration: none; color: inherit; }
  }
`;

const TOC_CSS = `
  .toc {
    background: #faf8f0;
    border: 1px solid #e0d9c8;
    border-radius: 8px;
    padding: 20px 30px;
    margin: 20px 0 35px 0;
  }
  .toc-title {
    color: #0B1F5B;
    font-size: 1.5em;
    margin-bottom: 12px;
    font-weight: bold;
    text-align: center;
    border-bottom: 2px solid #D4AF37;
    padding-bottom: 8px;
  }
  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: toc-counter;
  }
  .toc-list li {
    counter-increment: toc-counter;
    padding: 4px 0;
    border-bottom: 1px dotted #ddd;
  }
  .toc-list li:last-child { border-bottom: none; }
  .toc-list li::before {
    content: counter(toc-counter) ". ";
    color: #D4AF37;
    font-weight: bold;
    margin-left: 6px;
  }
  .toc-link {
    color: #0B1F5B;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }
  .toc-link:hover {
    color: #D4AF37;
    text-decoration: underline;
  }
`;

const SEARCH_WIDGET_CSS = `
  .search-widget {
    position: sticky;
    top: 10px;
    z-index: 50;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 10px;
    margin: 12px 0 18px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }
  .search-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .search-input, .search-select {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    direction: rtl;
    background: #fff;
  }
  .search-input { flex: 1; min-width: 180px; }
  .search-select { min-width: 140px; }
  .search-btn {
    border: 1px solid #d1d5db;
    background: #f8fafc;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 13px;
  }
  .search-btn:hover { background: #eef2f7; }
  .search-count {
    font-size: 12px;
    color: #475569;
    min-width: 64px;
    text-align: center;
  }
  .search-check {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #334155;
  }
  .doc-toolbar-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .breadcrumbs {
    font-size: 12px;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 10px;
  }
  .toc-link.toc-active {
    color: #b45309;
    font-weight: 700;
    text-decoration: underline;
  }
  .doc-section-content.section-collapsed {
    display: none;
  }
  mark.psak-hit {
    background: #fde68a;
    color: #111827;
    border-radius: 2px;
    padding: 0 1px;
  }
  mark.psak-hit.active-hit {
    background: #f59e0b;
    color: #111827;
  }
  [id^="sec-"], #toc-top {
    scroll-margin-top: 98px;
  }
`;

const SEARCH_WIDGET_SCRIPT = `
<script>
(function () {
  var root = document.querySelector('.container') || document.body;
  if (!root) return;

  var input = document.getElementById('psak-search-input');
  var prevBtn = document.getElementById('psak-search-prev');
  var nextBtn = document.getElementById('psak-search-next');
  var clearBtn = document.getElementById('psak-search-clear');
  var countEl = document.getElementById('psak-search-count');
  var exactEl = document.getElementById('psak-search-exact');
  var normalizedEl = document.getElementById('psak-search-normalized');
  var sectionFilterEl = document.getElementById('psak-search-section');
  var tocExpandEl = document.getElementById('psak-expand-all');
  var tocCollapseEl = document.getElementById('psak-collapse-all');
  var secPrevEl = document.getElementById('psak-prev-sec');
  var secNextEl = document.getElementById('psak-next-sec');
  var backPosEl = document.getElementById('psak-back-pos');
  var copyQuoteEl = document.getElementById('psak-copy-quote');
  var notesEl = document.getElementById('psak-notes');
  var notesSaveEl = document.getElementById('psak-save-notes');
  var breadcrumbEl = document.getElementById('psak-breadcrumbs');

  if (!input || !prevBtn || !nextBtn || !clearBtn || !countEl || !exactEl || !normalizedEl || !sectionFilterEl) return;

  var lastScrollY = 0;
  var hits = [];
  var activeIndex = -1;
  var allSecAnchors = Array.prototype.slice.call(document.querySelectorAll('[id^="sec-"]'));

  function normalizeHebrew(str) {
    if (!str) return '';
    var base = str
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/ך/g, 'כ')
      .replace(/ם/g, 'מ')
      .replace(/ן/g, 'נ')
      .replace(/ף/g, 'פ')
      .replace(/ץ/g, 'צ');
    return base.toLocaleLowerCase('he-IL');
  }

  function isBoundary(ch) {
    return !ch || /[\s.,;:!?()\[\]{}"'\/\\|-]/.test(ch);
  }

  function sectionKeyFromNode(node) {
    var parent = node.parentElement;
    if (!parent) return '';
    var holder = parent.closest('[data-search-scope]');
    return holder ? (holder.getAttribute('data-search-scope') || '') : '';
  }

  function clearHighlights() {
    document.querySelectorAll('mark.psak-hit').forEach(function (mark) {
      var text = document.createTextNode(mark.textContent || '');
      mark.replaceWith(text);
      if (text.parentNode) text.parentNode.normalize();
    });
    hits = [];
    activeIndex = -1;
    countEl.textContent = '0/0';
  }

  function collectTextNodes(node) {
    var sectionFilter = sectionFilterEl.value || '';
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: function (textNode) {
        var parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.search-widget')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.toc')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, mark')) return NodeFilter.FILTER_REJECT;
        if (!(textNode.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
        if (sectionFilter && sectionKeyFromNode(textNode) !== sectionFilter) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function highlightTerm(term) {
    clearHighlights();
    if (!term || term.length < 2) return;

    var normalizedMode = !!normalizedEl.checked;
    var exactMode = !!exactEl.checked;
    var query = normalizedMode ? normalizeHebrew(term) : term.toLocaleLowerCase('he-IL');
    var nodes = collectTextNodes(root);

    nodes.forEach(function (node) {
      var original = node.nodeValue || '';
      var source = normalizedMode ? normalizeHebrew(original) : original.toLocaleLowerCase('he-IL');
      var indexes = [];
      var from = 0;

      while (from < source.length) {
        var idx = source.indexOf(query, from);
        if (idx === -1) break;
        if (exactMode) {
          var left = idx > 0 ? source.charAt(idx - 1) : '';
          var right = source.charAt(idx + query.length);
          if (!isBoundary(left) || !isBoundary(right)) {
            from = idx + query.length;
            continue;
          }
        }
        indexes.push(idx);
        from = idx + query.length;
      }

      for (var i = indexes.length - 1; i >= 0; i -= 1) {
        var start = indexes[i];
        var after = node.splitText(start + query.length);
        var middle = node.splitText(start);
        var mark = document.createElement('mark');
        mark.className = 'psak-hit';
        mark.textContent = middle.nodeValue || '';
        middle.parentNode.replaceChild(mark, middle);
        hits.push(mark);
        node = after;
      }
    });

    if (hits.length > 0) {
      activeIndex = 0;
      focusHit(activeIndex);
    } else {
      countEl.textContent = '0/0';
    }
  }

  function focusHit(index) {
    if (!hits.length) {
      countEl.textContent = '0/0';
      return;
    }
    hits.forEach(function (hit) { hit.classList.remove('active-hit'); });
    activeIndex = ((index % hits.length) + hits.length) % hits.length;
    var current = hits[activeIndex];
    current.classList.add('active-hit');
    current.scrollIntoView({ behavior: 'auto', block: 'center' });
    countEl.textContent = String(activeIndex + 1) + '/' + String(hits.length);
  }

  function updateActiveToc() {
    var active = null;
    for (var i = 0; i < allSecAnchors.length; i += 1) {
      var rect = allSecAnchors[i].getBoundingClientRect();
      if (rect.top <= 130) active = allSecAnchors[i];
      else break;
    }
    document.querySelectorAll('.toc-link').forEach(function (l) { l.classList.remove('toc-active'); });
    if (!active) return;
    var selector = '.toc-link[href="#' + active.id + '"]';
    var link = document.querySelector(selector);
    if (link) link.classList.add('toc-active');
    if (breadcrumbEl) breadcrumbEl.textContent = 'מיקום נוכחי: ' + (active.textContent || active.id);
  }

  function jumpToAnchor(anchorId) {
    var target = document.getElementById(anchorId);
    if (!target) return;
    lastScrollY = window.scrollY;
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (history && history.replaceState) history.replaceState(null, '', '#' + anchorId);
  }

  function currentSectionIndex() {
    var current = 0;
    for (var i = 0; i < allSecAnchors.length; i += 1) {
      var rect = allSecAnchors[i].getBoundingClientRect();
      if (rect.top <= 130) current = i;
      else break;
    }
    return current;
  }

  function getSelectedQuote() {
    var selection = window.getSelection();
    var text = (selection && selection.toString()) ? selection.toString().trim() : '';
    if (!text) return '';
    var node = selection.anchorNode;
    var holder = node && node.parentElement ? node.parentElement.closest('[data-search-scope]') : null;
    var ref = holder ? (holder.getAttribute('data-search-label') || holder.getAttribute('data-search-scope') || '') : '';
    return text + (ref ? '\n\n[הפניה: ' + ref + ']' : '');
  }

  document.querySelectorAll('.toc-link').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      var id = href.slice(1);
      if (!id) return;
      event.preventDefault();
      jumpToAnchor(id);
    });
  });

  input.addEventListener('input', function () { highlightTerm(input.value.trim()); });
  exactEl.addEventListener('change', function () { highlightTerm(input.value.trim()); });
  normalizedEl.addEventListener('change', function () { highlightTerm(input.value.trim()); });
  sectionFilterEl.addEventListener('change', function () { highlightTerm(input.value.trim()); });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) focusHit(activeIndex - 1);
      else focusHit(activeIndex + 1);
    }
  });

  prevBtn.addEventListener('click', function () { focusHit(activeIndex - 1); });
  nextBtn.addEventListener('click', function () { focusHit(activeIndex + 1); });
  clearBtn.addEventListener('click', function () {
    input.value = '';
    clearHighlights();
  });

  if (tocExpandEl) {
    tocExpandEl.addEventListener('click', function () {
      document.querySelectorAll('.doc-section-content').forEach(function (el) { el.classList.remove('section-collapsed'); });
    });
  }

  if (tocCollapseEl) {
    tocCollapseEl.addEventListener('click', function () {
      document.querySelectorAll('.doc-section-content').forEach(function (el) { el.classList.add('section-collapsed'); });
    });
  }

  if (secPrevEl) {
    secPrevEl.addEventListener('click', function () {
      if (!allSecAnchors.length) return;
      var idx = Math.max(0, currentSectionIndex() - 1);
      jumpToAnchor(allSecAnchors[idx].id);
    });
  }

  if (secNextEl) {
    secNextEl.addEventListener('click', function () {
      if (!allSecAnchors.length) return;
      var idx = Math.min(allSecAnchors.length - 1, currentSectionIndex() + 1);
      jumpToAnchor(allSecAnchors[idx].id);
    });
  }

  if (backPosEl) {
    backPosEl.addEventListener('click', function () {
      window.scrollTo({ top: lastScrollY || 0, behavior: 'auto' });
    });
  }

  if (copyQuoteEl && navigator.clipboard) {
    copyQuoteEl.addEventListener('click', function () {
      var quote = getSelectedQuote();
      if (!quote) return;
      navigator.clipboard.writeText(quote).catch(function () {});
    });
  }

  if (notesEl && notesSaveEl) {
    var key = 'psak-notes:' + (location.pathname || 'doc') + ':' + (document.title || 'psak');
    try { notesEl.value = localStorage.getItem(key) || ''; } catch (e) { }
    notesSaveEl.addEventListener('click', function () {
      try { localStorage.setItem(key, notesEl.value || ''); } catch (e) { }
    });
  }

  document.addEventListener('scroll', updateActiveToc, { passive: true });
  updateActiveToc();
})();
</script>
`;

function renderSearchWidget(data: ParsedPsakDin): string {
  const sectionOptions = [
    `<option value="">כל המסמך</option>`,
    `<option value="sec-details">פרטי תיק</option>`,
    data.summary ? `<option value="sec-summary">תקציר</option>` : "",
    ...data.sections.map((sec, i) => `<option value="sec-${i}">${esc(sec.title)}</option>`),
    data.judges.length > 0 ? `<option value="sec-signature">חתימה</option>` : "",
  ].join("");

  return `<div class="search-widget" aria-label="כלי חיפוש וניווט במסמך" data-testid="psak-doc-widget">
    <div class="search-row">
      <input id="psak-search-input" data-testid="psak-search-input" class="search-input" type="search" placeholder="חיפוש בתוך פסק הדין..." />
      <select id="psak-search-section" data-testid="psak-search-section" class="search-select">${sectionOptions}</select>
      <label class="search-check"><input id="psak-search-exact" type="checkbox" /> ביטוי מדויק</label>
      <label class="search-check"><input id="psak-search-normalized" type="checkbox" checked /> התאמה חכמה</label>
      <button id="psak-search-prev" data-testid="psak-search-prev" class="search-btn" type="button" title="תוצאה קודמת">הקודם</button>
      <button id="psak-search-next" data-testid="psak-search-next" class="search-btn" type="button" title="תוצאה הבאה">הבא</button>
      <button id="psak-search-clear" data-testid="psak-search-clear" class="search-btn" type="button" title="ניקוי חיפוש">נקה</button>
      <span id="psak-search-count" data-testid="psak-search-count" class="search-count">0/0</span>
    </div>
    <div class="doc-toolbar-row">
      <button id="psak-prev-sec" data-testid="psak-prev-sec" class="search-btn" type="button">סעיף קודם</button>
      <button id="psak-next-sec" data-testid="psak-next-sec" class="search-btn" type="button">סעיף הבא</button>
      <button id="psak-back-pos" data-testid="psak-back-pos" class="search-btn" type="button">חזור למיקום קודם</button>
      <button id="psak-expand-all" data-testid="psak-expand-all" class="search-btn" type="button">פתח הכל</button>
      <button id="psak-collapse-all" data-testid="psak-collapse-all" class="search-btn" type="button">כווץ הכל</button>
      <button id="psak-copy-quote" data-testid="psak-copy-quote" class="search-btn" type="button">העתק ציטוט מסומן</button>
      <span id="psak-breadcrumbs" data-testid="psak-breadcrumbs" class="breadcrumbs">מיקום נוכחי: תחילת מסמך</span>
    </div>
    <div class="doc-toolbar-row">
      <textarea id="psak-notes" data-testid="psak-notes" class="search-input" placeholder="הערות אישיות למסמך (נשמר מקומית בדפדפן)..." style="min-height:56px;"></textarea>
      <button id="psak-save-notes" data-testid="psak-save-notes" class="search-btn" type="button">שמור הערות</button>
    </div>
  </div>`;
}

// ─── Build table of contents from parsed data ───
function buildTableOfContents(data: ParsedPsakDin): { tocHtml: string; sectionAnchors: Map<number, string> } {
  const anchors = new Map<number, string>();
  const items: string[] = [];

  // Built-in sections
  const builtInSections: { label: string; anchor: string; show: boolean }[] = [
    { label: "פרטי התיק", anchor: "sec-details", show: true },
    { label: "תקציר", anchor: "sec-summary", show: !!data.summary },
  ];

  for (const bs of builtInSections) {
    if (bs.show) items.push(`<li><a href="#${bs.anchor}" class="toc-link">${esc(bs.label)}</a></li>`);
  }

  data.sections.forEach((sec, i) => {
    const anchor = `sec-${i}`;
    anchors.set(i, anchor);
    items.push(`<li><a href="#${anchor}" class="toc-link">${esc(sec.title)}</a></li>`);
  });

  if (data.judges.length > 0) {
    items.push(`<li><a href="#sec-signature" class="toc-link">חתימה</a></li>`);
  }

  const tocHtml = items.length > 0
    ? `<div class="toc">
        <div class="toc-title">📑 תוכן עניינים</div>
        <ol class="toc-list">${items.join("\n          ")}</ol>
      </div>`
    : "";
  return { tocHtml, sectionAnchors: anchors };
}

// ─── Smart content renderer ───
function renderSectionContent(content: string): string {
  const classified = classifyLines(content);
  return classifiedLinesToHtml(classified);
}

function renderBodyText(data: ParsedPsakDin): string {
  if (data.sections.length > 0) return "";
  const classified = classifyLines(data.rawText);
  return classifiedLinesToHtml(classified);
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Classic Professional (default)
// ═════════════════════════════════════════════════════
function generateClassicHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type:none;padding:0;margin:0;">${data.judges.map(j => `<li>${esc(j)}</li>`).join("")}</ul>`
    : "";

  const sectionsHtml = data.sections.map((section, i) => {
    const icon = getSectionIcon(section.type);
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="subsection-title"><span class="icon">${icon}</span> ${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
      <div class="doc-section-content">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = renderBodyText(data);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    body { font-family: 'David','Times New Roman',serif; line-height:1.8; color:#333; background:#f9f9f9; margin:0; padding:20px; direction:rtl; text-align:right; }
    .container { max-width:900px; margin:30px auto; background:#fff; border:1px solid #eee; box-shadow:0 0 15px rgba(0,0,0,.05); padding:40px 60px; border-radius:8px; }
    .header { text-align:center; margin-bottom:40px; border-bottom:3px solid #D4AF37; padding-bottom:20px; }
    .header h1 { color:#0B1F5B; font-size:2.8em; margin:0; padding-bottom:10px; font-weight:bold; }
    .header .logo { font-size:1.2em; color:#555; margin-top:5px; }
    .section-title { color:#0B1F5B; font-size:1.8em; margin-top:35px; margin-bottom:15px; border-bottom:2px solid #D4AF37; padding-bottom:8px; font-weight:bold; }
    .subsection-title { color:#0B1F5B; font-size:1.4em; margin-top:25px; margin-bottom:10px; font-weight:bold; scroll-margin-top:20px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:25px; }
    .details-table td { padding:10px 0; border-bottom:1px dashed #eee; vertical-align:top; }
    .details-table td:first-child { font-weight:bold; width:150px; color:#0B1F5B; }
    .paragraph { margin-bottom:15px; text-align:justify; }
    .icon { margin-left:8px; color:#D4AF37; }
    .divider { border:none; border-top:1px solid #eee; margin:30px 0; }
    .footer { text-align:center; margin-top:50px; padding-top:20px; border-top:1px solid #eee; color:#777; font-size:0.9em; }
    .signature { text-align:center; margin-top:40px; font-weight:bold; color:#0B1F5B; }
    .signature div { margin-top:10px; }
    .back-to-top { font-size:0.6em; color:#D4AF37; text-decoration:none; margin-right:8px; vertical-align:middle; opacity:0.6; }
    .back-to-top:hover { opacity:1; }
    .detected-header { color:#0B1F5B; font-size:1.3em; font-weight:bold; margin-top:28px; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #D4AF37; }
    .detected-subheader { color:#0B1F5B; font-size:1.1em; font-weight:bold; margin-top:16px; margin-bottom:8px; }
    .detected-reference { color:#555; font-size:0.95em; margin:4px 0; padding-right:20px; font-style:italic; }
    .detected-quote { margin:12px 30px; padding:10px 20px; border-right:4px solid #D4AF37; background:#faf8f0; font-style:italic; color:#333; }
    .spacer { height:12px; }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏛️ בית דין רבני ⚖️</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<div style="font-size:1.1em;color:#555;">תיק מס' ${esc(data.caseNumber)}</div>` : ""}
    </div>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="section-title"><span class="icon">📋</span> פרטי התיק</h2>
      <div class="doc-section-content">
        <table class="details-table">
          ${data.title ? `<tr><td><span class="icon">📌</span> כותרת:</td><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><td><span class="icon">🏛️</span> בית הדין:</td><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><td><span class="icon">📅</span> תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><td><span class="icon">🔖</span> מזהה:</td><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><td><span class="icon">🔗</span> קישור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>
    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="section-title"><span class="icon">📝</span> תקציר</h2><div class="doc-section-content"><div class="paragraph">${esc(data.summary)}</div></div></section>` : ""}
    <hr class="divider">
    <h2 class="section-title"><span class="icon">📖</span> גוף פסק הדין</h2>
    ${data.topics ? `<div class="paragraph"><strong>נושאים:</strong> ${esc(data.topics)}</div>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}
    ${judgesHtml ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה">
      <div>חתמו על פסק הדין:</div>
      ${judgesHtml}
    </div>` : ""}
    <div class="footer">מסמך זה עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Modern Clean
// ═════════════════════════════════════════════════════
function generateModernHtml(data: ParsedPsakDin): string {
  const judgesHtml = data.judges.length > 0
    ? data.judges.map(j => `<span class="judge-chip">${esc(j)}</span>`).join(" ")
    : "";

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="modern-section doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
        <h3 id="${anchor}" class="modern-section-title">${esc(section.title)}</h3>
        <div class="doc-section-content">${contentHtml}</div>
      </section>`;
  }).join("\n");

  const fallbackBody = renderBodyText(data);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height:1.7; color:#2d3748; background:linear-gradient(135deg,#f7fafc 0%,#edf2f7 100%); margin:0; padding:24px; direction:rtl; text-align:right; }
    .container { max-width:860px; margin:20px auto; background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.08); padding:48px; }
    .modern-header { text-align:center; margin-bottom:36px; }
    .modern-header .badge { display:inline-block; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:4px 16px; border-radius:20px; font-size:0.85em; letter-spacing:1px; margin-bottom:12px; }
    .modern-header h1 { color:#2d3748; font-size:2.2em; margin:8px 0; font-weight:700; }
    .modern-header .case-no { color:#718096; font-size:1em; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#f7fafc; border-radius:12px; padding:20px; margin-bottom:28px; }
    .meta-item { display:flex; flex-direction:column; }
    .meta-label { font-size:0.8em; color:#a0aec0; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
    .meta-value { font-size:0.95em; color:#2d3748; font-weight:500; }
    .modern-section { margin-top:28px; }
    .modern-section-title { color:#4a5568; font-size:1.3em; font-weight:600; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #e2e8f0; position:relative; }
    .modern-section-title::after { content:''; position:absolute; bottom:-2px; right:0; width:60px; height:2px; background:linear-gradient(90deg,#667eea,#764ba2); }
    .summary-card { background:linear-gradient(135deg,#ebf4ff 0%,#e9d8fd 100%); border-radius:12px; padding:20px; margin:20px 0; border-right:4px solid #667eea; }
    .summary-card p { margin:0; color:#4a5568; }
    .judge-chip { display:inline-block; background:#edf2f7; color:#4a5568; padding:4px 14px; border-radius:20px; font-size:0.9em; margin:3px; }
    .modern-footer { text-align:center; margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; color:#a0aec0; font-size:0.85em; }
    .paragraph { margin-bottom:14px; text-align:justify; }
    .detected-header { color:#4a5568; font-size:1.25em; font-weight:600; margin-top:24px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; }
    .detected-subheader { color:#4a5568; font-size:1.05em; font-weight:600; margin-top:14px; margin-bottom:6px; }
    .detected-reference { color:#718096; font-size:0.9em; margin:4px 0; padding-right:16px; font-style:italic; }
    .detected-quote { margin:12px 24px; padding:12px 18px; border-right:3px solid #667eea; background:#f7fafc; font-style:italic; border-radius:0 8px 8px 0; }
    .spacer { height:10px; }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="modern-header">
      <div class="badge">⚖️ פסק דין</div>
      <h1>${esc(data.title)}</h1>
      ${data.caseNumber ? `<div class="case-no">תיק ${esc(data.caseNumber)}</div>` : ""}
    </div>
    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <div id="sec-details" class="meta-grid doc-section-content">
        ${data.court ? `<div class="meta-item"><span class="meta-label">בית הדין</span><span class="meta-value">${esc(data.court)}</span></div>` : ""}
        ${data.date ? `<div class="meta-item"><span class="meta-label">תאריך</span><span class="meta-value">${esc(data.date)}</span></div>` : ""}
        ${data.year ? `<div class="meta-item"><span class="meta-label">שנה</span><span class="meta-value">${data.year}</span></div>` : ""}
        ${data.sourceId ? `<div class="meta-item"><span class="meta-label">מזהה</span><span class="meta-value">${esc(data.sourceId)}</span></div>` : ""}
      </div>
    </section>
    ${renderSearchWidget(data)}
    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><div id="sec-summary" class="summary-card doc-section-content"><p>${esc(data.summary)}</p></div></section>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}
    ${judgesHtml ? `<div id="sec-signature" data-search-scope="sec-signature" data-search-label="חתימה" style="margin-top:32px;text-align:center;"><div style="color:#718096;font-size:0.9em;margin-bottom:8px;">חתימת הדיינים</div>${judgesHtml}</div>` : ""}
    <div class="modern-footer">עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: With Index (Table of Contents)
// ═════════════════════════════════════════════════════
function generateIndexedHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type:none;padding:0;margin:0;">${data.judges.map(j => `<li>${esc(j)}</li>`).join("")}</ul>`
    : "";

  const sectionsHtml = data.sections.map((section, i) => {
    const icon = getSectionIcon(section.type);
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="subsection-title"><span class="icon">${icon}</span> ${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
      <div class="doc-section-content">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = renderBodyText(data);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    body { font-family:'David','Times New Roman',serif; line-height:1.8; color:#333; background:#f9f9f9; margin:0; padding:20px; direction:rtl; text-align:right; }
    .container { max-width:900px; margin:30px auto; background:#fff; border:1px solid #eee; box-shadow:0 0 15px rgba(0,0,0,.05); padding:40px 60px; border-radius:8px; }
    .header { text-align:center; margin-bottom:30px; border-bottom:3px solid #D4AF37; padding-bottom:20px; }
    .header h1 { color:#0B1F5B; font-size:2.6em; margin:0; font-weight:bold; }
    .header .logo { font-size:1.2em; color:#555; margin-top:5px; }
    .section-title { color:#0B1F5B; font-size:1.8em; margin-top:35px; margin-bottom:15px; border-bottom:2px solid #D4AF37; padding-bottom:8px; font-weight:bold; }
    .subsection-title { color:#0B1F5B; font-size:1.4em; margin-top:25px; margin-bottom:10px; font-weight:bold; scroll-margin-top:20px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    .details-table td { padding:8px 0; border-bottom:1px dashed #eee; vertical-align:top; }
    .details-table td:first-child { font-weight:bold; width:150px; color:#0B1F5B; }
    .paragraph { margin-bottom:15px; text-align:justify; }
    .icon { margin-left:8px; color:#D4AF37; }
    .divider { border:none; border-top:1px solid #eee; margin:25px 0; }
    .footer { text-align:center; margin-top:50px; padding-top:20px; border-top:1px solid #eee; color:#777; font-size:0.9em; }
    .signature { text-align:center; margin-top:40px; font-weight:bold; color:#0B1F5B; }
    .signature div { margin-top:10px; }
    .back-to-top { font-size:0.6em; color:#D4AF37; text-decoration:none; margin-right:8px; vertical-align:middle; opacity:0.6; }
    .back-to-top:hover { opacity:1; }
    .detected-header { color:#0B1F5B; font-size:1.3em; font-weight:bold; margin-top:28px; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #D4AF37; }
    .detected-subheader { color:#0B1F5B; font-size:1.1em; font-weight:bold; margin-top:16px; margin-bottom:8px; }
    .detected-reference { color:#555; font-size:0.95em; margin:4px 0; padding-right:20px; font-style:italic; }
    .detected-quote { margin:12px 30px; padding:10px 20px; border-right:4px solid #D4AF37; background:#faf8f0; font-style:italic; color:#333; }
    .spacer { height:12px; }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏛️ בית דין רבני ⚖️</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<div style="font-size:1.1em;color:#555;">תיק מס' ${esc(data.caseNumber)}</div>` : ""}
    </div>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="section-title"><span class="icon">📋</span> פרטי התיק</h2>
      <div class="doc-section-content">
        <table class="details-table">
          ${data.title ? `<tr><td><span class="icon">📌</span> כותרת:</td><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><td><span class="icon">🏛️</span> בית הדין:</td><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><td><span class="icon">📅</span> תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><td><span class="icon">🔖</span> מזהה:</td><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><td><span class="icon">🔗</span> קישור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>
    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="section-title"><span class="icon">📝</span> תקציר</h2><div class="doc-section-content"><div class="paragraph">${esc(data.summary)}</div></div></section>` : ""}
    <hr class="divider">
    <h2 class="section-title"><span class="icon">📖</span> גוף פסק הדין</h2>
    ${data.topics ? `<div class="paragraph"><strong>נושאים:</strong> ${esc(data.topics)}</div>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}
    ${judgesHtml ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה">
      <div>חתמו על פסק הדין:</div>
      ${judgesHtml}
    </div>` : ""}
    <div class="footer">מסמך זה עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Academic / Research
// ═════════════════════════════════════════════════════
function generateAcademicHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const judgesHtml = data.judges.length > 0
    ? data.judges.map((j, i) => `<div class="judge-line">${i + 1}. ${esc(j)}</div>`).join("")
    : "";

  let sectionCounter = 0;
  const sectionsHtml = data.sections.map((section, i) => {
    sectionCounter++;
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="academic-section doc-section" id="${anchor}" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
        <h3 class="academic-section-title">${sectionCounter}. ${esc(section.title)} <a href="#toc-top" class="back-to-top">↑</a></h3>
        <div class="doc-section-content">${contentHtml}</div>
      </section>`;
  }).join("\n");

  const fallbackBody = renderBodyText(data);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    body { font-family:'David','Times New Roman',serif; line-height:1.9; color:#1a202c; background:#fff; margin:0; padding:24px; direction:rtl; text-align:right; }
    .container { max-width:800px; margin:40px auto; padding:0 40px; }
    .academic-header { text-align:center; margin-bottom:40px; padding-bottom:24px; border-bottom:double 4px #1a202c; }
    .academic-header h1 { font-size:2em; margin:8px 0; letter-spacing:1px; color:#1a202c; }
    .academic-header .institution { font-size:1.1em; color:#4a5568; margin-bottom:4px; }
    .academic-header .case-info { font-size:0.95em; color:#718096; }
    .meta-block { background:#f7fafc; border:1px solid #e2e8f0; padding:16px 20px; margin:20px 0 30px; font-size:0.95em; }
    .meta-block .row { display:flex; gap:8px; padding:4px 0; border-bottom:1px dotted #e2e8f0; }
    .meta-block .row:last-child { border-bottom:none; }
    .meta-block .label { font-weight:bold; min-width:120px; color:#2d3436; }
    .academic-section { margin-top:28px; }
    .academic-section-title { font-size:1.3em; color:#1a202c; font-weight:bold; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; }
    .back-to-top { font-size:0.55em; color:#a0aec0; text-decoration:none; margin-right:6px; vertical-align:middle; }
    .back-to-top:hover { color:#4a5568; }
    .paragraph { margin-bottom:14px; text-align:justify; text-indent:20px; }
    .judge-line { margin:4px 0; color:#2d3436; }
    .divider { border:none; border-top:1px solid #e2e8f0; margin:30px 0; }
    .footer { text-align:center; margin-top:50px; padding-top:16px; border-top:double 3px #1a202c; color:#718096; font-size:0.85em; }
    .detected-header { font-size:1.2em; font-weight:bold; margin-top:24px; margin-bottom:10px; padding-bottom:4px; border-bottom:1px solid #e2e8f0; color:#1a202c; }
    .detected-subheader { font-size:1.05em; font-weight:bold; margin-top:14px; margin-bottom:6px; color:#2d3436; }
    .detected-reference { color:#718096; font-size:0.9em; margin:4px 0; padding-right:24px; font-style:italic; }
    .detected-quote { margin:12px 30px; padding:10px 20px; border-right:3px solid #1a202c; background:#f7fafc; font-style:italic; }
    .spacer { height:10px; }
    ${TOC_CSS}
    .toc { background:#f7fafc; border:1px solid #e2e8f0; }
    .toc-title { color:#1a202c; border-bottom-color:#1a202c; }
    .toc-list li::before { color:#4a5568; }
    .toc-link { color:#1a202c; }
    .toc-link:hover { color:#4a5568; }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="academic-header">
      <div class="institution">${esc(data.court || "בית דין רבני")}</div>
      <h1>פסק דין</h1>
      <div class="case-info">
        ${data.caseNumber ? `תיק ${esc(data.caseNumber)}` : ""}
        ${data.caseNumber && data.date ? " • " : ""}
        ${data.date ? esc(data.date) : ""}
      </div>
    </div>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <div id="sec-details" class="meta-block doc-section-content">
        ${data.title ? `<div class="row"><span class="label">כותרת:</span><span>${esc(data.title)}</span></div>` : ""}
        ${data.court ? `<div class="row"><span class="label">בית הדין:</span><span>${esc(data.court)}</span></div>` : ""}
        ${data.date ? `<div class="row"><span class="label">תאריך:</span><span>${esc(data.date)}</span></div>` : ""}
        ${data.sourceId ? `<div class="row"><span class="label">מזהה:</span><span>${esc(data.sourceId)}</span></div>` : ""}
        ${data.judges.length > 0 ? `<div class="row"><span class="label">הרכב:</span><span>${data.judges.map(j => esc(j)).join(", ")}</span></div>` : ""}
        ${data.sourceUrl ? `<div class="row"><span class="label">מקור:</span><span><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></span></div>` : ""}
      </div>
    </section>

    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><div id="sec-summary" class="academic-section">
      <h3 class="academic-section-title">תקציר</h3>
      <div class="paragraph doc-section-content">${esc(data.summary)}</div>
    </div></section>` : ""}

    <hr class="divider">
    ${data.topics ? `<div class="paragraph"><strong>נושאים נידונים:</strong> ${esc(data.topics)}</div>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}

    ${judgesHtml ? `<hr class="divider"><div id="sec-signature" style="margin-top:30px;" data-search-scope="sec-signature" data-search-label="חתימה">
      <div style="font-weight:bold;margin-bottom:8px;">חתימת הדיינים:</div>
      ${judgesHtml}
    </div>` : ""}
    <div class="footer">מסמך מחקרי — עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ─── Section icon helper ───
function getSectionIcon(type: string): string {
  switch (type) {
    case "plaintiff-claims": case "defendant-claims": return "📌";
    case "ruling": case "decision": return "✅";
    case "summary": return "📝";
    case "facts": return "📋";
    case "discussion": return "💬";
    case "reasoning": return "⚖️";
    case "chapters": return "📑";
    case "law-sources": return "📚";
    case "conclusion": return "🏁";
    default: return "📜";
  }
}

// ─── Main dispatch ───
export function generateFromTemplate(templateId: string, data: ParsedPsakDin): string {
  switch (templateId) {
    case "modern": return generateModernHtml(data);
    case "indexed": return generateIndexedHtml(data);
    case "academic": return generateAcademicHtml(data);
    case "classic":
    default:
      return generateClassicHtml(data);
  }
}
