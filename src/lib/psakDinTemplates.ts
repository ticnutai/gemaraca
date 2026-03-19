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

function cleanReadableText(value: string | undefined | null): string {
  if (!value) return "";

  return value
    .replace(/\r\n?/g, "\n")
    // Strip CSS/HTML artifacts that leak from textContent extraction
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\t+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[�□▪■¤]/g, "")
    .replace(/[A-Za-z][A-Za-z0-9._\-/]*/g, "")
    // Strip leftover CSS blocks: { ... } with colons/semicolons inside
    .replace(/\{[^}]{0,500}\}/g, "")
    .replace(/@[^{;\n]{0,200}[{;]/g, "")
    // Strip lines that are only CSS-like syntax (colons, semicolons, braces)
    .replace(/^[\s:;{},.#()@'"\d%/\\*!>~+\[\]=|&^]+$/gm, "")
    // Strip footer boilerplate
    .replace(/מעוצב אוטומטית.*שמורות/g, "")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeParsedData(data: ParsedPsakDin): ParsedPsakDin {
  return {
    ...data,
    title: cleanReadableText(data.title),
    court: cleanReadableText(data.court),
    caseNumber: cleanReadableText(data.caseNumber),
    date: cleanReadableText(data.date),
    sourceId: cleanReadableText(data.sourceId),
    summary: cleanReadableText(data.summary),
    topics: cleanReadableText(data.topics),
    rawText: cleanReadableText(data.rawText),
    judges: (data.judges || []).map(cleanReadableText).filter(Boolean),
    sections: (data.sections || []).map((section) => ({
      ...section,
      title: cleanReadableText(section.title),
      content: cleanReadableText(section.content),
    })),
  };
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
    id: "navy-luxury",
    name: "יוקרה נייבי",
    description: "עיצוב יוקרתי נקי: רקע לבן, כותרות ואייקונים בנייבי חזק, מסגרת לבנה אלגנטית",
    requiresAi: false,
    icon: "💎",
    hasIndex: true,
  },
  {
    id: "navy-luxury-gold",
    name: "יוקרה נייבי זהב + אינדקס",
    description: "יוקרה עם אינדקס מובנה, מסגרת זהב, רקע לבן וכותרות/אייקונים בנייבי חזק",
    requiresAi: false,
    icon: "👑",
    hasIndex: true,
  },
  {
    id: "clean-merged",
    name: "נקי מאוחד",
    description: "עיצוב נקי ללא אימוג'ים, שורות מאוחדות לפסקאות זורמות — ללא AI",
    requiresAi: false,
    icon: "📃",
    hasIndex: false,
  },
  {
    id: "court-rtl-official",
    name: "בית משפט RTL רשמי",
    description: "A4 רשמי: שוליים 2.5 ס\"מ, David 12, רווח 1.5, אינדקס וניווט פנימי",
    requiresAi: false,
    icon: "⚖️",
    hasIndex: true,
  },
  {
    id: "rabbinic-court-structured",
    name: "רבני מובנה (בס\"ד)",
    description: "תבנית רבנית פורמלית עם בס\"ד, תוכן עניינים, מספור מודגש ועימוד בית-דין",
    requiresAi: false,
    icon: "🕍",
    hasIndex: true,
  },
  {
    id: "rabbinic-authentic",
    name: "רבני אותנטי מפורט",
    description: "תבנית אותנטית של פסק דין רבני: כותרות מודגשות, שקע פסקה ראשונה, אותיות עבריות (א׳ ב׳), הדגשת מקורות הלכתיים, חתימת דיינים עם תפקידים",
    requiresAi: false,
    icon: "📖",
    hasIndex: true,
  },
  {
    id: "psakim-formal",
    name: "פסקים רשמי (בסגנון פסקים.אורג)",
    description: "תבנית נאמנה לפורמט פסקים.אורג: מספור בעברית, ציטוט בבלוק, מקרא-החלטה, חתימות עם קו תחתון",
    requiresAi: false,
    icon: "📋",
    hasIndex: true,
  },
  {
    id: "court-decree",
    name: "גזר דין סמכותי",
    description: "עיצוב סמכותי עם חותמת בית דין, כותרות מודגשות, תיבת החלטה בולטת ופסקאות ממוספרות",
    requiresAi: false,
    icon: "🏛️",
    hasIndex: true,
  },
  {
    id: "scholarly-halachic",
    name: "עיוני הלכתי",
    description: "דגש על מקורות הלכתיים: הבלטת ציטוטים, פאנלים למקורות, רקע קלף חמים ואותיות עבריות",
    requiresAi: false,
    icon: "📚",
    hasIndex: true,
  },
  {
    id: "executive-brief",
    name: "תמצית מנהלים",
    description: "כרטיס סיכום בראש, נקודות מפתח מודגשות, תיבת החלטה בולטת וזרימה חזותית בין סעיפים",
    requiresAi: false,
    icon: "📊",
    hasIndex: true,
  },
  {
    id: "clean-sidebar",
    name: "נקי עם חיפוש צד",
    description: "עיצוב נקי ומקצועי ללא אימוג׳ים, חיפוש וניווט בפאנל צד ימין קבוע, תוכן עניינים ומבנה קריא",
    requiresAi: false,
    icon: "",
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

  // In iframe context: hide widget so parent sidebar controls take over
  if (window.parent !== window) {
    var _sw = document.querySelector('.search-widget');
    if (_sw) _sw.style.display = 'none';
  }

  function postState() {
    try { window.parent.postMessage({ type: 'psak-search-state', count: hits.length, current: hits.length ? activeIndex + 1 : 0 }, '*'); } catch (e) {}
  }

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
    postState();
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
    postState();
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
      event.preventDefault();
      event.stopPropagation();
      var href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      var id = href.slice(1);
      if (!id) return;
      jumpToAnchor(id);
    });
  });

  // Intercept all anchor clicks inside the document to prevent iframe navigation
  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
    var href = anchor.getAttribute('href') || '';
    var id = href.slice(1);
    if (id) jumpToAnchor(id);
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

  // Listen for commands from parent frame (sidebar controls)
  window.addEventListener('message', function (ev) {
    if (!ev.data || typeof ev.data !== 'object') return;
    var c = ev.data.cmd;
    if (!c) return;
    if (c === 'search') {
      if (input) { input.value = ev.data.query || ''; highlightTerm(input.value.trim()); }
    } else if (c === 'next') {
      focusHit(activeIndex + 1);
    } else if (c === 'prev') {
      focusHit(activeIndex - 1);
    } else if (c === 'clear') {
      if (input) input.value = '';
      clearHighlights();
    } else if (c === 'jump') {
      if (ev.data.anchor) jumpToAnchor(ev.data.anchor);
    } else if (c === 'expand') {
      document.querySelectorAll('.doc-section-content').forEach(function (el) { el.classList.remove('section-collapsed'); });
    } else if (c === 'collapse') {
      document.querySelectorAll('.doc-section-content').forEach(function (el) { el.classList.add('section-collapsed'); });
    } else if (c === 'prev-sec') {
      if (!allSecAnchors.length) return;
      var pidx = Math.max(0, currentSectionIndex() - 1);
      jumpToAnchor(allSecAnchors[pidx].id);
    } else if (c === 'next-sec') {
      if (!allSecAnchors.length) return;
      var nidx = Math.min(allSecAnchors.length - 1, currentSectionIndex() + 1);
      jumpToAnchor(allSecAnchors[nidx].id);
    }
  });

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
        <div class="toc-title">תוכן עניינים</div>
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

function isUiArtifactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const navHebrew = /^(דף\s+בית|מפתח\s+פסקי\s+הדין|חיפוש\s+מתקדם|מאמרים\s+ועיונים|צור\s+קשר|אודות|english)$/i;
  const onlyLatin = /^[A-Za-z0-9 .,_'"\-:/()]+$/;
  const hasUiEmoji = /[\u2600-\u27BF\u{1F000}-\u{1FAFF}]/u;
  // Detect CSS artifact lines (leftover from style blocks)
  const cssArtifact = /^[\s:;{},.#()@'"\d%/\\*!>~+\[\]=|&^]+$/;
  const cssPropertyLine = /^\.[\w-]+\s*\{|^\s*[a-z-]+\s*:/i;
  // Detect footer/signature boilerplate
  const footerBoilerplate = /^מעוצב\s+אוטומטית|^\u00a9|^כל\s+הזכויות\s+שמורות/;
  return navHebrew.test(trimmed) || onlyLatin.test(trimmed) || hasUiEmoji.test(trimmed) || cssArtifact.test(trimmed) || cssPropertyLine.test(trimmed) || footerBoilerplate.test(trimmed);
}

function applyNbspToTail(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (/https?:\/\//i.test(normalized)) return normalized;

  const words = normalized.split(" ");
  if (words.length < 8) return normalized;
  const idx = normalized.lastIndexOf(" ");
  if (idx < 0) return normalized;
  return normalized.slice(0, idx) + "\u00A0" + normalized.slice(idx + 1);
}

function renderCourtBlocks(content: string): string {
  const lines = content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const out: string[] = [];
  let paragraphBuffer: string[] = [];
  let orderedItems: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const merged = applyNbspToTail(paragraphBuffer.join(" "));
    if (merged) out.push(`<p class="doc-paragraph">${esc(merged)}</p>`);
    paragraphBuffer = [];
  };

  const flushOrdered = () => {
    if (!orderedItems.length) return;
    const itemsHtml = orderedItems
      .map((item, idx) => `<li><span class="marker"><strong>${idx + 1}.</strong></span> ${esc(applyNbspToTail(item))}</li>`)
      .join("");
    out.push(`<ol class="list list-num">${itemsHtml}</ol>`);
    orderedItems = [];
  };

  const flushBullets = () => {
    if (!bulletItems.length) return;
    const itemsHtml = bulletItems
      .map((item) => `<li><span class="marker"><strong>-</strong></span> ${esc(applyNbspToTail(item))}</li>`)
      .join("");
    out.push(`<ul class="list list-dash">${itemsHtml}</ul>`);
    bulletItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushOrdered();
      flushBullets();
      continue;
    }

    if (isUiArtifactLine(line)) {
      flushParagraph();
      flushOrdered();
      flushBullets();
      out.push(`<p class="ui-artifact" aria-hidden="true">${esc(line)}</p>`);
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushBullets();
      orderedItems.push(orderedMatch[2].trim());
      continue;
    }

    const bulletMatch = line.match(/^\s*[-•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushOrdered();
      bulletItems.push(bulletMatch[1].trim());
      continue;
    }

    // Lines ending with ":" are potential sub-headings,
    // but skip empty metadata labels (e.g. "שם בית דין:" or "תאריך:" with no value)
    if (/^[^.]{2,80}:$/.test(line)) {
      const isEmptyMetaLabel = /^(שם\s*בית\s*דין|תאריך|כותרת|שנה|מספר\s*תיק|דיינים):$/i.test(line);
      if (!isEmptyMetaLabel) {
        flushParagraph();
        flushOrdered();
        flushBullets();
        out.push(`<h4 class="inline-heading">${esc(line)}</h4>`);
        continue;
      }
      // Empty metadata labels are skipped entirely
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushOrdered();
  flushBullets();

  return out.join("\n");
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Court RTL Official
// ═════════════════════════════════════════════════════
function generateCourtRtlOfficialHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderCourtBlocks(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="section-l3">${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
      <div class="doc-section-content">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderCourtBlocks(data.rawText);

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root {
      --text: #000;
      --muted: #444;
      --border: #c9c9c9;
      --accent: #0B1F5B;
      --gold: #D4AF37;
    }
    html { direction: rtl; }
    body {
      margin: 0;
      background: #fff;
      color: var(--text);
      font-family: "David","Raanana","Calibri","Times New Roman",serif;
      font-size: 12pt;
      line-height: 1.5;
      text-align: right;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      border: 1px solid #ececec;
      box-shadow: 0 6px 24px rgba(0,0,0,0.06);
      border-radius: 10px;
      padding: 34px 44px;
      background: #fff;
    }
    .doc-header { text-align: center; margin-bottom: 22px; }
    .court-line { font-weight: 700; color: var(--accent); }
    h1 { margin: 6px 0; font-size: 18pt; color: #000; }
    .case-line { margin: 0; color: #000; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .meta th, .meta td { padding: 8px 0; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    .meta th { width: 170px; font-weight: 700; color: #000; text-align: start; }
    .section-l2 {
      font-size: 14pt;
      margin: 24px 0 12px;
      border-bottom: 2px solid var(--accent);
      padding-bottom: 6px;
      color: #000;
      font-weight: 700;
    }
    .section-l3 {
      font-size: 13pt;
      margin: 18px 0 8px;
      color: #000;
      font-weight: 700;
      scroll-margin-top: 20px;
    }
    .doc-paragraph {
      margin: 0 0 10px;
      text-align: justify;
      orphans: 3;
      widows: 3;
      text-wrap: pretty;
    }
    .inline-heading {
      margin: 14px 0 8px;
      font-size: 12.5pt;
      font-weight: 700;
      color: #000;
    }
    .list { margin: 0 0 12px; padding-inline-start: 0; }
    .list-num, .list-dash { list-style: none; }
    .list li { margin: 4px 0; }
    .marker { display: inline-block; min-width: 1.2em; }
    .toc {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      margin: 0 0 20px;
      background: #fff;
    }
    .toc-title {
      color: #000;
      font-size: 14pt;
      margin-bottom: 10px;
      font-weight: 700;
      border-bottom: 2px solid var(--accent);
      padding-bottom: 6px;
      text-align: center;
    }
    .toc-list { list-style: none; margin: 0; padding: 0; counter-reset: toc-counter; }
    .toc-list li { counter-increment: toc-counter; padding: 4px 0; border-bottom: 1px dotted #ddd; }
    .toc-list li:last-child { border-bottom: none; }
    .toc-list li::before { content: counter(toc-counter) ". "; color: #000; font-weight: 700; margin-left: 6px; }
    .toc-link { color: #000; text-decoration: none; }
    .toc-link:hover { text-decoration: underline; }
    .back-to-top { font-size: 0.6em; color: var(--accent); text-decoration: none; margin-right: 8px; }
    .ui-artifact { display: none !important; }
    .signature { margin-top: 28px; text-align: center; font-weight: 700; }
    .footer {
      margin-top: 30px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
      padding-top: 10px;
      color: var(--muted);
      font-size: 10.5pt;
    }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
    @page { size: A4; margin: 2.5cm; }
    @media print {
      body { padding: 0; font-size: 12pt; line-height: 1.5; color: #000; }
      .container { border: none; box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
      .toc { border: none; padding: 0; }
      a { color: #000; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <div class="court-line">${esc(data.court || "בית דין רבני")}</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<p class="case-line">תיק מס' ${esc(data.caseNumber)}</p>` : ""}
    </header>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="section-l2">פרטי התיק</h2>
      <div class="doc-section-content">
        <table class="meta">
          ${data.title ? `<tr><th>כותרת</th><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><th>בית הדין</th><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><th>תאריך</th><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><th>מזהה</th><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><th>מקור</th><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>

    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="section-l2">תקציר</h2><div class="doc-section-content"><p class="doc-paragraph">${esc(applyNbspToTail(data.summary))}</p></div></section>` : ""}

    <section class="doc-section" data-search-scope="sec-body" data-search-label="טקסט מלא של פסק הדין">
      <h2 class="section-l2">טקסט מלא של פסק הדין</h2>
      ${sectionsHtml}
      ${fallbackBody ? `<div class="doc-section-content">${fallbackBody}</div>` : ""}
    </section>

    ${data.judges.length ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה">${data.judges.map((j) => `<div>${esc(j)}</div>`).join("")}</div>` : ""}
    <div class="footer">מסמך בעימוד RTL משפטי • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Rabbinic Court Structured
// ═════════════════════════════════════════════════════
function generateRabbinicCourtStructuredHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderCourtBlocks(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="sub-head"><span class="sigil">◆</span> ${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
      <div class="doc-section-content">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderCourtBlocks(data.rawText);

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root {
      --navy: #0B1F5B;
      --gold: #D4AF37;
      --ink: #0f172a;
      --soft: #e6ecf6;
    }
    html { direction: rtl; }
    body {
      margin: 0;
      background: radial-gradient(circle at top, #ffffff 0%, #f8fbff 70%);
      color: var(--ink);
      font-family: "David","Raanana","Calibri","Times New Roman",serif;
      font-size: 12pt;
      line-height: 1.6;
      text-align: right;
      padding: 20px;
    }
    .container {
      max-width: 940px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid var(--gold);
      box-shadow: 0 10px 28px rgba(11,31,91,0.12);
      border-radius: 12px;
      padding: 34px 44px;
      position: relative;
    }
    .container::before {
      content: "";
      position: absolute;
      inset: 10px;
      border: 1px solid var(--soft);
      border-radius: 8px;
      pointer-events: none;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--navy);
      padding-bottom: 12px;
      position: relative;
      z-index: 1;
    }
    .basad { font-weight: 700; color: var(--navy); margin-bottom: 4px; }
    h1 { margin: 8px 0 4px; font-size: 18pt; color: var(--navy); }
    .header-meta { color: var(--ink); }
    .main-head {
      color: var(--navy);
      font-size: 14pt;
      margin: 24px 0 12px;
      border-bottom: 2px solid var(--gold);
      padding-bottom: 6px;
      font-weight: 700;
      position: relative;
      z-index: 1;
    }
    .sub-head {
      color: var(--navy);
      font-size: 13pt;
      margin: 18px 0 8px;
      font-weight: 700;
      scroll-margin-top: 20px;
      position: relative;
      z-index: 1;
    }
    .sigil { color: var(--gold); margin-left: 6px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 8px 12px;
      border: 1px solid var(--soft);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }
    .meta-grid .label { font-weight: 700; color: var(--navy); }
    .doc-paragraph {
      margin: 0 0 10px;
      text-align: justify;
      orphans: 3;
      widows: 3;
      text-wrap: pretty;
      position: relative;
      z-index: 1;
    }
    .inline-heading {
      margin: 14px 0 8px;
      font-size: 12.5pt;
      font-weight: 700;
      color: var(--navy);
      position: relative;
      z-index: 1;
    }
    .list { margin: 0 0 12px; padding-inline-start: 0; position: relative; z-index: 1; }
    .list-num, .list-dash { list-style: none; }
    .list li { margin: 4px 0; }
    .marker { display: inline-block; min-width: 1.2em; color: var(--navy); }
    .toc { background: #fff; border: 1px solid var(--soft); border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; position: relative; z-index: 1; }
    .toc-title { color: var(--navy); font-size: 14pt; font-weight: 700; margin-bottom: 8px; border-bottom: 2px solid var(--gold); padding-bottom: 4px; text-align: center; }
    .toc-list { list-style: none; margin: 0; padding: 0; counter-reset: toc-counter; }
    .toc-list li { counter-increment: toc-counter; padding: 4px 0; border-bottom: 1px dotted #d9e2f0; }
    .toc-list li:last-child { border-bottom: none; }
    .toc-list li::before { content: counter(toc-counter) ". "; color: var(--navy); font-weight: 700; margin-left: 6px; }
    .toc-link { color: var(--ink); text-decoration: none; }
    .toc-link:hover { color: var(--navy); text-decoration: underline; }
    .back-to-top { font-size: 0.6em; color: var(--navy); text-decoration: none; margin-right: 8px; }
    .ui-artifact { display: none !important; }
    .signature {
      margin-top: 28px;
      text-align: center;
      font-weight: 700;
      color: var(--navy);
      position: relative;
      z-index: 1;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      border-top: 1px solid var(--soft);
      padding-top: 10px;
      color: #475569;
      font-size: 10.5pt;
      position: relative;
      z-index: 1;
    }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
    @page { size: A4; margin: 2.5cm; }
    @media print {
      body { padding: 0; background: #fff; font-size: 12pt; line-height: 1.5; }
      .container { border: none; box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
      .container::before { display: none; }
      .toc { border: none; padding: 0; }
      a { color: #000; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="basad">בס"ד</div>
      <h1>פסק דין</h1>
      <div class="header-meta">${esc(data.court || "בית דין רבני")}${data.caseNumber ? ` • תיק ${esc(data.caseNumber)}` : ""}</div>
    </header>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="main-head">פרטי התיק</h2>
      <div class="doc-section-content">
        <div class="meta-grid">
          ${data.title ? `<div class="label">כותרת</div><div>${esc(data.title)}</div>` : ""}
          ${data.court ? `<div class="label">בית הדין</div><div>${esc(data.court)}</div>` : ""}
          ${data.date ? `<div class="label">תאריך</div><div>${esc(data.date)}</div>` : ""}
          ${data.sourceId ? `<div class="label">מזהה</div><div>${esc(data.sourceId)}</div>` : ""}
          ${data.sourceUrl ? `<div class="label">מקור</div><div><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></div>` : ""}
        </div>
      </div>
    </section>

    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="main-head">תקציר</h2><div class="doc-section-content"><p class="doc-paragraph">${esc(applyNbspToTail(data.summary))}</p></div></section>` : ""}

    <section class="doc-section" data-search-scope="sec-body" data-search-label="טקסט מלא של פסק הדין">
      <h2 class="main-head">טקסט מלא של פסק הדין</h2>
      ${sectionsHtml}
      ${fallbackBody ? `<div class="doc-section-content">${fallbackBody}</div>` : ""}
    </section>

    ${data.judges.length ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה"><div>בזאת באתי על החתום:</div><div>_________________</div>${data.judges.map((j) => `<div>${esc(j)}</div>`).join("")}</div>` : ""}
    <div class="footer">תבנית רבנית פורמלית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
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

// ═════════════════════════════════════════════════════
// TEMPLATE: Luxury Navy
// ═════════════════════════════════════════════════════
function generateNavyLuxuryHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type:none;padding:0;margin:0;">${data.judges.map(j => `<li>${esc(j)}</li>`).join("")}</ul>`
    : "";

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="subsection-title"><span class="icon">◆</span> ${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
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
    body { font-family:'Frank Ruhl Libre','David','Times New Roman',serif; line-height:1.85; color:#0B1F5B; background:#ffffff; margin:0; padding:24px; direction:rtl; text-align:right; }
    .container { max-width:920px; margin:24px auto; background:#ffffff; border:6px solid #ffffff; outline:2px solid #0B1F5B; box-shadow:0 12px 40px rgba(11,31,91,0.12); padding:42px 56px; border-radius:10px; }
    .header { text-align:center; margin-bottom:34px; border-bottom:3px solid #0B1F5B; padding-bottom:18px; }
    .header h1 { color:#0B1F5B; font-size:2.7em; margin:0; font-weight:800; letter-spacing:0.3px; }
    .header .logo { font-size:1.05em; color:#0B1F5B; margin-top:6px; font-weight:700; }
    .section-title { color:#0B1F5B; font-size:1.85em; margin-top:34px; margin-bottom:14px; border-bottom:2px solid #0B1F5B; padding-bottom:8px; font-weight:800; }
    .subsection-title { color:#0B1F5B; font-size:1.35em; margin-top:24px; margin-bottom:10px; font-weight:800; scroll-margin-top:20px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    .details-table td { padding:10px 0; border-bottom:1px solid #dbe4f1; vertical-align:top; }
    .details-table td:first-child { font-weight:800; width:160px; color:#0B1F5B; }
    .paragraph { margin-bottom:14px; text-align:justify; color:#0B1F5B; }
    .icon { margin-left:8px; color:#0B1F5B; font-weight:900; }
    .divider { border:none; border-top:1px solid #0B1F5B; opacity:0.25; margin:26px 0; }
    .footer { text-align:center; margin-top:48px; padding-top:18px; border-top:1px solid #dbe4f1; color:#0B1F5B; font-size:0.9em; font-weight:700; }
    .signature { text-align:center; margin-top:38px; font-weight:800; color:#0B1F5B; }
    .signature div { margin-top:10px; }
    .back-to-top { font-size:0.6em; color:#0B1F5B; text-decoration:none; margin-right:8px; vertical-align:middle; opacity:0.7; }
    .back-to-top:hover { opacity:1; }
    .detected-header { color:#0B1F5B; font-size:1.28em; font-weight:800; margin-top:26px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #0B1F5B; }
    .detected-subheader { color:#0B1F5B; font-size:1.08em; font-weight:800; margin-top:15px; margin-bottom:7px; }
    .detected-reference { color:#0B1F5B; font-size:0.94em; margin:4px 0; padding-right:20px; font-style:italic; }
    .detected-quote { margin:12px 28px; padding:10px 18px; border-right:4px solid #0B1F5B; background:#f8fbff; font-style:italic; color:#0B1F5B; }
    .spacer { height:10px; }
    ${TOC_CSS}
    .toc { background:#ffffff; border:1px solid #dbe4f1; }
    .toc-title { color:#0B1F5B; border-bottom-color:#0B1F5B; }
    .toc-list li { border-bottom:1px dotted #dbe4f1; }
    .toc-list li::before { color:#0B1F5B; }
    .toc-link { color:#0B1F5B; }
    .toc-link:hover { color:#0B1F5B; text-decoration:underline; }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">◇ בית דין רבני ◇</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<div style="font-size:1.05em;color:#0B1F5B;">תיק מס' ${esc(data.caseNumber)}</div>` : ""}
    </div>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="section-title"><span class="icon">◆</span> פרטי התיק</h2>
      <div class="doc-section-content">
        <table class="details-table">
          ${data.title ? `<tr><td><span class="icon">◆</span> כותרת:</td><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><td><span class="icon">◆</span> בית הדין:</td><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><td><span class="icon">◆</span> תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><td><span class="icon">◆</span> מזהה:</td><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><td><span class="icon">◆</span> קישור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>

    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="section-title"><span class="icon">◆</span> תקציר</h2><div class="doc-section-content"><div class="paragraph">${esc(data.summary)}</div></div></section>` : ""}
    <hr class="divider">
    <h2 class="section-title"><span class="icon">◆</span> גוף פסק הדין</h2>
    ${data.topics ? `<div class="paragraph"><strong>נושאים:</strong> ${esc(data.topics)}</div>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}
    ${judgesHtml ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה"><div>חתמו על פסק הדין:</div>${judgesHtml}</div>` : ""}
    <div class="footer">מסמך זה עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Luxury Navy Gold (Indexed)
// ═════════════════════════════════════════════════════
function generateNavyLuxuryGoldHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type:none;padding:0;margin:0;">${data.judges.map(j => `<li>${esc(j)}</li>`).join("")}</ul>`
    : "";

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderSectionContent(section.content);
    return `<section class="doc-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="subsection-title"><span class="icon">◆</span> ${esc(section.title)} <a href="#toc-top" class="back-to-top" title="חזרה לתוכן עניינים">↑</a></h3>
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
    body { font-family:'Frank Ruhl Libre','David','Times New Roman',serif; line-height:1.85; color:#0B1F5B; background:#ffffff; margin:0; padding:24px; direction:rtl; text-align:right; }
    .container { max-width:920px; margin:24px auto; background:#ffffff; border:4px solid #D4AF37; box-shadow:0 12px 40px rgba(11,31,91,0.12); padding:42px 56px; border-radius:10px; }
    .header { text-align:center; margin-bottom:34px; border-bottom:3px solid #0B1F5B; padding-bottom:18px; }
    .header h1 { color:#0B1F5B; font-size:2.7em; margin:0; font-weight:800; letter-spacing:0.3px; }
    .header .logo { font-size:1.05em; color:#0B1F5B; margin-top:6px; font-weight:700; }
    .section-title { color:#0B1F5B; font-size:1.85em; margin-top:34px; margin-bottom:14px; border-bottom:2px solid #0B1F5B; padding-bottom:8px; font-weight:800; }
    .subsection-title { color:#0B1F5B; font-size:1.35em; margin-top:24px; margin-bottom:10px; font-weight:800; scroll-margin-top:20px; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    .details-table td { padding:10px 0; border-bottom:1px solid #dbe4f1; vertical-align:top; }
    .details-table td:first-child { font-weight:800; width:160px; color:#0B1F5B; }
    .paragraph { margin-bottom:14px; text-align:justify; color:#0B1F5B; }
    .icon { margin-left:8px; color:#0B1F5B; font-weight:900; }
    .divider { border:none; border-top:1px solid #0B1F5B; opacity:0.25; margin:26px 0; }
    .footer { text-align:center; margin-top:48px; padding-top:18px; border-top:1px solid #dbe4f1; color:#0B1F5B; font-size:0.9em; font-weight:700; }
    .signature { text-align:center; margin-top:38px; font-weight:800; color:#0B1F5B; }
    .signature div { margin-top:10px; }
    .back-to-top { font-size:0.6em; color:#0B1F5B; text-decoration:none; margin-right:8px; vertical-align:middle; opacity:0.7; }
    .back-to-top:hover { opacity:1; }
    .detected-header { color:#0B1F5B; font-size:1.28em; font-weight:800; margin-top:26px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #0B1F5B; }
    .detected-subheader { color:#0B1F5B; font-size:1.08em; font-weight:800; margin-top:15px; margin-bottom:7px; }
    .detected-reference { color:#0B1F5B; font-size:0.94em; margin:4px 0; padding-right:20px; font-style:italic; }
    .detected-quote { margin:12px 28px; padding:10px 18px; border-right:4px solid #0B1F5B; background:#f8fbff; font-style:italic; color:#0B1F5B; }
    .spacer { height:10px; }
    ${TOC_CSS}
    .toc { background:#ffffff; border:1px solid #dbe4f1; }
    .toc-title { color:#0B1F5B; border-bottom-color:#0B1F5B; }
    .toc-list li { border-bottom:1px dotted #dbe4f1; }
    .toc-list li::before { color:#0B1F5B; }
    .toc-link { color:#0B1F5B; }
    .toc-link:hover { color:#0B1F5B; text-decoration:underline; }
    .toc-link.toc-active { color:#0B1F5B; }
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">◇ בית דין רבני ◇</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<div style="font-size:1.05em;color:#0B1F5B;">תיק מס' ${esc(data.caseNumber)}</div>` : ""}
    </div>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="doc-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h2 id="sec-details" class="section-title"><span class="icon">◆</span> פרטי התיק</h2>
      <div class="doc-section-content">
        <table class="details-table">
          ${data.title ? `<tr><td><span class="icon">◆</span> כותרת:</td><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><td><span class="icon">◆</span> בית הדין:</td><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><td><span class="icon">◆</span> תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><td><span class="icon">◆</span> מזהה:</td><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><td><span class="icon">◆</span> קישור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>

    ${data.summary ? `<section class="doc-section" data-search-scope="sec-summary" data-search-label="תקציר"><h2 id="sec-summary" class="section-title"><span class="icon">◆</span> תקציר</h2><div class="doc-section-content"><div class="paragraph">${esc(data.summary)}</div></div></section>` : ""}
    <hr class="divider">
    <h2 class="section-title"><span class="icon">◆</span> גוף פסק הדין</h2>
    ${data.topics ? `<div class="paragraph"><strong>נושאים:</strong> ${esc(data.topics)}</div>` : ""}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="doc-section" data-search-scope="sec-body" data-search-label="גוף פסק הדין"><div class="doc-section-content">${fallbackBody}</div></section>` : ""}
    ${judgesHtml ? `<div id="sec-signature" class="signature" data-search-scope="sec-signature" data-search-label="חתימה"><div>חתמו על פסק הדין:</div>${judgesHtml}</div>` : ""}
    <div class="footer">מסמך זה עוצב אוטומטית • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Clean Merged (no icons, merged paragraphs)
// ═════════════════════════════════════════════════════

/**
 * Merge consecutive short lines into flowing paragraphs.
 * Lines shorter than ~60 chars that appear consecutively are joined.
 */
function mergeContentLines(content: string): string {
  const lines = content.split('\n');
  const merged: string[] = [];
  let buffer = '';

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (buffer) { merged.push(buffer); buffer = ''; }
      continue;
    }
    // If it looks like a header (short + ends with colon, or starts with known patterns)
    const isHeader = /^[^.]{3,60}:$/.test(trimmed) || /^(פסק הדין|תקציר|רקע|הערה|חתימה|נושאים)/.test(trimmed);
    if (isHeader) {
      if (buffer) { merged.push(buffer); buffer = ''; }
      merged.push(trimmed);
      continue;
    }
    // Merge short consecutive lines
    if (buffer) {
      buffer += ' ' + trimmed;
    } else {
      buffer = trimmed;
    }
    // If the line ends with a period or is long enough, flush
    if (trimmed.endsWith('.') || trimmed.endsWith('。') || buffer.length > 200) {
      merged.push(buffer);
      buffer = '';
    }
  }
  if (buffer) merged.push(buffer);
  return merged.join('\n');
}

function renderMergedSectionContent(content: string): string {
  const merged = mergeContentLines(content);
  const lines = merged.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    // Check if it's a header-like line
    if (/^[^.]{3,60}:$/.test(trimmed) || /^(פסק הדין|תקציר|רקע|הערה|חתימה|נושאים)/.test(trimmed)) {
      return `<div class="detected-subheader"><b>${esc(trimmed)}</b></div>`;
    }
    return `<div class="paragraph">${esc(trimmed)}</div>`;
  }).filter(Boolean).join('\n        ');
}

function renderMergedBodyText(data: ParsedPsakDin): string {
  if (data.sections.length > 0) return '';
  return renderMergedSectionContent(data.rawText);
}

function generateCleanMergedHtml(data: ParsedPsakDin): string {
  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type:none;padding:0;margin:0;">${data.judges.map(j => `<li>${esc(j)}</li>`).join('')}</ul>`
    : '';

  const sectionsHtml = data.sections.map((section, i) => {
    const contentHtml = renderMergedSectionContent(section.content);
    return `<section class="doc-section">
      <h3 class="subsection-title"><u>${esc(section.title)}</u></h3>
      <div class="doc-section-content">${contentHtml}</div>
    </section>`;
  }).join('\n');

  const fallbackBody = renderMergedBodyText(data);

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
    .subsection-title { color:#0B1F5B; font-size:1.4em; margin-top:25px; margin-bottom:10px; font-weight:bold; }
    .details-table { width:100%; border-collapse:collapse; margin-bottom:25px; }
    .details-table td { padding:10px 0; border-bottom:1px dashed #eee; vertical-align:top; }
    .details-table td:first-child { font-weight:bold; width:150px; color:#0B1F5B; }
    .paragraph { margin-bottom:15px; text-align:justify; }
    .bold-text { font-weight:bold; color:#0B1F5B; }
    .divider { border:none; border-top:1px solid #eee; margin:30px 0; }
    .footer { text-align:center; margin-top:50px; padding-top:20px; border-top:1px solid #eee; color:#777; font-size:0.9em; }
    .signature { text-align:center; margin-top:40px; font-weight:bold; color:#0B1F5B; }
    .signature div { margin-top:10px; }
    .detected-header { color:#0B1F5B; font-size:1.3em; font-weight:bold; margin-top:28px; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #D4AF37; }
    .detected-subheader { color:#0B1F5B; font-size:1.1em; font-weight:bold; margin-top:16px; margin-bottom:8px; }
    .detected-reference { color:#555; font-size:0.95em; margin:4px 0; padding-right:20px; font-style:italic; }
    .detected-quote { margin:12px 30px; padding:10px 20px; border-right:4px solid #D4AF37; background:#faf8f0; font-style:italic; color:#333; }
    .spacer { height:12px; }
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">בית דין רבני</div>
      <h1>פסק דין</h1>
      ${data.caseNumber ? `<div style="font-size:1.1em;color:#555;">תיק מס' ${esc(data.caseNumber)}</div>` : ''}
    </div>

    <h2 class="section-title"><u>פרטי התיק</u></h2>
    <table class="details-table">
      ${data.title ? `<tr><td>כותרת:</td><td>${esc(data.title)}</td></tr>` : ''}
      ${data.court ? `<tr><td>בית הדין:</td><td>${esc(data.court)}</td></tr>` : ''}
      ${data.date ? `<tr><td>תאריך:</td><td>${esc(data.date)}</td></tr>` : ''}
      ${data.sourceId ? `<tr><td>מזהה:</td><td>${esc(data.sourceId)}</td></tr>` : ''}
      ${data.sourceUrl ? `<tr><td>קישור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank" style="color:#0B1F5B;">${esc(data.sourceUrl)}</a></td></tr>` : ''}
    </table>

    ${data.summary ? `<h2 class="section-title"><u>תקציר</u></h2>\n    <div class="paragraph">${esc(data.summary)}</div>` : ''}

    <h2 class="section-title"><u>טקסט מלא של פסק הדין</u></h2>

    ${data.caseNumber ? `<div style="text-align:center;margin-bottom:20px;">מס. סידורי: ${esc(data.caseNumber)}</div>` : ''}
    ${data.title ? `<h3 style="text-align:center;color:#0B1F5B;font-size:1.6em;margin-bottom:25px;">${esc(data.title)}</h3>` : ''}
    ${data.court ? `<div style="font-size:1.1em;margin-bottom:20px;"><span class="bold-text">שם בית דין:</span> ${esc(data.court)}</div>` : ''}
    ${judgesHtml ? `<div style="font-size:1.1em;margin-bottom:20px;"><span class="bold-text">דיינים:</span>${judgesHtml}</div>` : ''}
    ${data.topics ? `<div style="font-size:1.1em;margin-bottom:20px;"><span class="bold-text">נושאים הנידונים בפסק:</span> ${esc(data.topics)}</div>` : ''}

    ${sectionsHtml}
    ${fallbackBody ? `<div class="doc-section">${fallbackBody}</div>` : ''}

    ${judgesHtml ? `<div class="signature">\n      <div>בזאת באתי על החתום:</div>\n      <div>_________________</div>\n      ${judgesHtml}\n    </div>` : ''}
    <div class="footer">מסמך זה עוצב אוטומטית • ${new Date().toLocaleDateString('he-IL')}</div>
  </div>
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

// ═════════════════════════════════════════════════════
// TEMPLATE: Rabbinic Authentic — אותנטי מפורט
// ═════════════════════════════════════════════════════

/**
 * Enhanced content renderer for the authentic rabbinic template.
 * – Merges consecutive lines into justified paragraphs with first-line indent.
 * – Detects Hebrew-letter markers (א. / א' / א) and renders them as styled items.
 * – Highlights inline halachic source references.
 * – Detects inline sub-headings ending with ":".
 */
function renderAuthenticBlocks(content: string): string {
  const lines = content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const out: string[] = [];
  let paragraphBuffer: string[] = [];
  let hebrewListItems: { marker: string; text: string }[] = [];
  let orderedItems: string[] = [];
  let bulletItems: string[] = [];

  const highlightSources = (text: string): string => {
    const escaped = esc(text);
    return escaped.replace(
      /(שו&quot;ע|שו&quot;ת|רמב&quot;ם|רמ&quot;א|גמ(?:רא|&#39;)|טור|ב&quot;[קמגפ]|משנה\s+ברורה|חו&quot;מ|אה&quot;ע|או&quot;ח|יו&quot;ד|שו&quot;ע\s+(?:אורח\s+חיים|יורה\s+דעה|אבן\s+העזר|חושן\s+משפט))/g,
      '<span class="source-ref">$1</span>'
    );
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const merged = applyNbspToTail(paragraphBuffer.join(" "));
    if (merged) out.push(`<p class="auth-paragraph">${highlightSources(merged)}</p>`);
    paragraphBuffer = [];
  };

  const flushHebrewList = () => {
    if (!hebrewListItems.length) return;
    const itemsHtml = hebrewListItems
      .map((item) => `<li><span class="heb-marker">${esc(item.marker)}</span> ${highlightSources(applyNbspToTail(item.text))}</li>`)
      .join("");
    out.push(`<ol class="heb-list">${itemsHtml}</ol>`);
    hebrewListItems = [];
  };

  const flushOrdered = () => {
    if (!orderedItems.length) return;
    const itemsHtml = orderedItems
      .map((item, idx) => `<li><span class="num-marker">${idx + 1}.</span> ${highlightSources(applyNbspToTail(item))}</li>`)
      .join("");
    out.push(`<ol class="num-list">${itemsHtml}</ol>`);
    orderedItems = [];
  };

  const flushBullets = () => {
    if (!bulletItems.length) return;
    const itemsHtml = bulletItems
      .map((item) => `<li>${highlightSources(applyNbspToTail(item))}</li>`)
      .join("");
    out.push(`<ul class="bullet-list">${itemsHtml}</ul>`);
    bulletItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushHebrewList();
      flushOrdered();
      flushBullets();
      continue;
    }

    if (isUiArtifactLine(line)) {
      flushParagraph();
      flushHebrewList();
      flushOrdered();
      flushBullets();
      out.push(`<p class="ui-artifact" aria-hidden="true">${esc(line)}</p>`);
      continue;
    }

    // Hebrew letter markers: א. / א' / א) / (א)
    const hebLetterMatch = line.match(/^\s*[\u05D0-\u05EA]{1,2}[\.\'\)\u05F3\u05F4]\s+(.+)$/);
    const hebParenMatch = !hebLetterMatch ? line.match(/^\s*\([\u05D0-\u05EA]{1,2}\)\s+(.+)$/) : null;
    if (hebLetterMatch || hebParenMatch) {
      flushParagraph();
      flushOrdered();
      flushBullets();
      const markerEnd = line.indexOf(" ");
      const marker = line.slice(0, markerEnd).trim();
      const text = line.slice(markerEnd).trim();
      hebrewListItems.push({ marker, text });
      continue;
    }

    // Numeric markers: 1. / 1)
    const orderedMatch = line.match(/^\s*(\d+)[\.\)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushHebrewList();
      flushBullets();
      orderedItems.push(orderedMatch[2].trim());
      continue;
    }

    // Bullet markers
    const bulletMatch = line.match(/^\s*[-•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      flushHebrewList();
      flushOrdered();
      bulletItems.push(bulletMatch[1].trim());
      continue;
    }

    // Inline sub-heading (short line ending with ":")
    // but skip empty metadata labels
    if (/^[^.]{2,80}:$/.test(line)) {
      const isEmptyMetaLabel = /^(שם\s*בית\s*דין|תאריך|כותרת|שנה|מספר\s*תיק|דיינים):$/i.test(line);
      if (!isEmptyMetaLabel) {
        flushParagraph();
        flushHebrewList();
        flushOrdered();
        flushBullets();
        out.push(`<h4 class="auth-subhead">${esc(line)}</h4>`);
        continue;
      }
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushHebrewList();
  flushOrdered();
  flushBullets();

  return out.join("\n");
}

function generateRabbinicAuthenticHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  // Classify sections by type for visual treatment
  const sectionTypeClass = (title: string): string => {
    const t = title.trim();
    if (/עובד|רקע/.test(t)) return "sec-type-facts";
    if (/טענ/.test(t)) return "sec-type-claims";
    if (/דיון|ניתוח|הלכ/.test(t)) return "sec-type-discussion";
    if (/נימוק|הנמקה/.test(t)) return "sec-type-reasoning";
    if (/פסק|החלט|הכרע/.test(t)) return "sec-type-ruling";
    if (/מסקנ|סוף\s+דבר/.test(t)) return "sec-type-conclusion";
    if (/מקור|מרא/.test(t)) return "sec-type-sources";
    return "";
  };

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderAuthenticBlocks(section.content);
    const typeClass = sectionTypeClass(section.title);
    return `<section class="auth-section ${typeClass}" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="auth-section-head">${esc(section.title)} <a href="#toc-top" class="back-link" title="חזרה לתוכן עניינים">▲</a></h3>
      <div class="auth-section-body">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderAuthenticBlocks(data.rawText);

  // Build judge signature block with role titles
  let signatureHtml = "";
  if (data.judges.length > 0) {
    const roles = ["אב״ד", "דיין", "דיין"];
    const judgeLines = data.judges.map((j, i) => {
      const role = i < roles.length ? roles[i] : "דיין";
      return `<div class="sign-line">
        <div class="sign-name">${esc(j)}</div>
        <div class="sign-role">${role}</div>
        <div class="sign-underline"></div>
      </div>`;
    }).join("");

    signatureHtml = `<div id="sec-signature" class="auth-signature" data-search-scope="sec-signature" data-search-label="חתימה">
      <div class="sign-intro">בזאת באנו על החתום:</div>
      <div class="sign-grid">${judgeLines}</div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root {
      --ink: #1a1a1a;
      --heading: #0d0d0d;
      --accent: #1B3A6B;
      --accent-light: #2c5aa0;
      --rule: #8b7d6b;
      --rule-light: #d4cfc7;
      --bg: #ffffff;
      --bg-warm: #fdfcf9;
      --bg-section: #f9f8f5;
      --source-bg: #fef9e7;
      --source-border: #d4af37;
      --ruling-bg: #f0f7f0;
      --ruling-border: #2d7a3a;
    }
    html { direction: rtl; }
    body {
      margin: 0;
      background: var(--bg-warm);
      color: var(--ink);
      font-family: "David","Frank Ruehl","Raanana","Times New Roman",serif;
      font-size: 13pt;
      line-height: 1.85;
      text-align: right;
      padding: 24px 16px;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      background: var(--bg);
      border: 1px solid var(--rule-light);
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
      padding: 48px 56px;
    }

    /* ── Header ── */
    .doc-head {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 3px double var(--rule);
    }
    .basad-line {
      font-size: 11pt;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }
    .court-name {
      font-size: 14pt;
      font-weight: 700;
      color: var(--heading);
      margin: 4px 0;
    }
    .court-city {
      font-size: 12pt;
      color: var(--accent);
      margin: 2px 0 12px;
    }
    .main-title {
      font-size: 26pt;
      font-weight: 700;
      color: var(--heading);
      margin: 10px 0 6px;
      letter-spacing: 0.06em;
    }
    .case-num {
      font-size: 12pt;
      color: #444;
      margin: 4px 0 0;
    }
    .head-rule {
      border: none;
      border-top: 1px solid var(--rule-light);
      margin: 14px auto 0;
      width: 60%;
    }

    /* ── Case details ── */
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12pt;
    }
    .details-table th {
      text-align: start;
      width: 140px;
      font-weight: 700;
      color: var(--accent);
      padding: 6px 0;
      border-bottom: 1px dashed var(--rule-light);
      vertical-align: top;
    }
    .details-table td {
      padding: 6px 0;
      border-bottom: 1px dashed var(--rule-light);
    }
    .details-table tr:last-child th,
    .details-table tr:last-child td {
      border-bottom: none;
    }

    /* ── TOC ── */
    .toc {
      border: 1px solid var(--rule-light);
      background: var(--bg-section);
      padding: 14px 20px;
      margin-bottom: 24px;
    }
    .toc-title {
      font-size: 13pt;
      font-weight: 700;
      color: var(--heading);
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--rule);
      padding-bottom: 6px;
    }
    .toc-list {
      list-style: none;
      margin: 0;
      padding: 0;
      counter-reset: toc-counter;
    }
    .toc-list li {
      counter-increment: toc-counter;
      padding: 3px 0;
      border-bottom: 1px dotted var(--rule-light);
    }
    .toc-list li:last-child { border-bottom: none; }
    .toc-list li::before {
      content: counter(toc-counter, hebrew) ". ";
      font-weight: 700;
      color: var(--accent);
      margin-left: 6px;
    }
    .toc-link { color: var(--ink); text-decoration: none; }
    .toc-link:hover { color: var(--accent-light); text-decoration: underline; }

    /* ── Sections ── */
    .auth-section {
      margin-bottom: 24px;
    }
    .auth-section-head {
      font-size: 15pt;
      font-weight: 700;
      color: var(--heading);
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid var(--accent);
      scroll-margin-top: 20px;
    }
    .back-link {
      font-size: 0.5em;
      color: var(--accent-light);
      text-decoration: none;
      margin-right: 8px;
      vertical-align: middle;
    }
    .auth-section-body {
      padding-right: 8px;
    }

    /* Section type accents */
    .sec-type-ruling .auth-section-head {
      border-bottom-color: var(--ruling-border);
      color: var(--ruling-border);
    }
    .sec-type-ruling .auth-section-body {
      background: var(--ruling-bg);
      padding: 12px 16px;
      border-right: 4px solid var(--ruling-border);
      margin-bottom: 8px;
    }
    .sec-type-sources .auth-section-head {
      border-bottom-color: var(--source-border);
    }

    /* ── Paragraphs ── */
    .auth-paragraph {
      margin: 0 0 14px;
      text-align: justify;
      text-indent: 2em;
      orphans: 3;
      widows: 3;
      text-wrap: pretty;
    }
    .auth-paragraph:first-child {
      text-indent: 0;
    }

    /* ── Inline sub-headings ── */
    .auth-subhead {
      margin: 18px 0 8px;
      font-size: 13pt;
      font-weight: 700;
      color: var(--accent);
      text-indent: 0;
    }

    /* ── Source references highlighting ── */
    .source-ref {
      background: var(--source-bg);
      border-bottom: 1px solid var(--source-border);
      padding: 0 3px;
      font-weight: 700;
    }

    /* ── Hebrew letter lists (א', ב', ג') ── */
    .heb-list {
      list-style: none;
      margin: 8px 0 14px;
      padding: 0;
    }
    .heb-list li {
      margin: 6px 0;
      padding-right: 28px;
      text-indent: -28px;
    }
    .heb-marker {
      display: inline-block;
      min-width: 28px;
      font-weight: 700;
      color: var(--accent);
    }

    /* ── Numeric lists ── */
    .num-list {
      list-style: none;
      margin: 8px 0 14px;
      padding: 0;
    }
    .num-list li {
      margin: 6px 0;
      padding-right: 24px;
      text-indent: -24px;
    }
    .num-marker {
      display: inline-block;
      min-width: 24px;
      font-weight: 700;
      color: var(--heading);
    }

    /* ── Bullet lists ── */
    .bullet-list {
      margin: 8px 0 14px;
      padding-right: 24px;
    }
    .bullet-list li { margin: 4px 0; }

    /* ── Signature block ── */
    .auth-signature {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid var(--rule);
    }
    .sign-intro {
      text-align: center;
      font-weight: 700;
      font-size: 13pt;
      margin-bottom: 24px;
      color: var(--heading);
    }
    .sign-grid {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 20px;
    }
    .sign-line {
      text-align: center;
      min-width: 160px;
    }
    .sign-underline {
      border-bottom: 1px solid var(--ink);
      width: 140px;
      margin: 8px auto;
    }
    .sign-name {
      font-weight: 700;
      font-size: 12pt;
    }
    .sign-role {
      font-size: 10.5pt;
      color: var(--accent);
    }

    /* ── Footer ── */
    .doc-footer {
      margin-top: 32px;
      text-align: center;
      border-top: 1px solid var(--rule-light);
      padding-top: 10px;
      color: #888;
      font-size: 10pt;
    }

    .ui-artifact { display: none !important; }

    ${SEARCH_WIDGET_CSS}

    @page { size: A4; margin: 2.5cm; }
    @media print {
      body { padding: 0; background: #fff; font-size: 12pt; line-height: 1.7; }
      .page { border: none; box-shadow: none; padding: 0; max-width: none; }
      .toc { border: none; background: none; padding: 0; }
      .auth-signature { page-break-inside: avoid; }
      .sec-type-ruling .auth-section-body { background: none; border-right-color: #888; }
      a { color: #000; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="doc-head">
      <div class="basad-line">בס״ד</div>
      <div class="court-name">${esc(data.court || "בית הדין הרבני")}</div>
      <div class="main-title">פסק דין</div>
      ${data.caseNumber ? `<div class="case-num">תיק מס׳ ${esc(data.caseNumber)}</div>` : ""}
      <hr class="head-rule" />
    </header>

    <div id="toc-top"></div>
    ${tocHtml}
    ${renderSearchWidget(data)}

    <section class="auth-section" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <h3 id="sec-details" class="auth-section-head">פרטי התיק</h3>
      <div class="auth-section-body">
        <table class="details-table">
          ${data.title ? `<tr><th>כותרת</th><td>${esc(data.title)}</td></tr>` : ""}
          ${data.court ? `<tr><th>בית הדין</th><td>${esc(data.court)}</td></tr>` : ""}
          ${data.date ? `<tr><th>תאריך</th><td>${esc(data.date)}</td></tr>` : ""}
          ${data.sourceId ? `<tr><th>מספר סידורי</th><td>${esc(data.sourceId)}</td></tr>` : ""}
          ${data.judges.length ? `<tr><th>הרכב הדיינים</th><td>${data.judges.map(j => esc(j)).join("&ensp;·&ensp;")}</td></tr>` : ""}
          ${data.sourceUrl ? `<tr><th>קישור למקור</th><td><a href="${esc(data.sourceUrl)}" target="_blank">${esc(data.sourceUrl)}</a></td></tr>` : ""}
        </table>
      </div>
    </section>

    ${data.summary ? `<section class="auth-section" data-search-scope="sec-summary" data-search-label="תקציר">
      <h3 id="sec-summary" class="auth-section-head">תקציר <a href="#toc-top" class="back-link" title="חזרה לתוכן עניינים">▲</a></h3>
      <div class="auth-section-body"><p class="auth-paragraph" style="text-indent:0">${highlightSourcesStatic(esc(applyNbspToTail(data.summary)))}</p></div>
    </section>` : ""}

    <section class="auth-section" data-search-scope="sec-body" data-search-label="טקסט מלא של פסק הדין">
      <h3 class="auth-section-head">טקסט מלא של פסק הדין</h3>
      ${sectionsHtml}
      ${fallbackBody ? `<div class="auth-section-body">${fallbackBody}</div>` : ""}
    </section>

    ${signatureHtml}
    <div class="doc-footer">מסמך בעימוד בית דין רבני • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE 1: Psakim Formal (בסגנון פסקים.אורג)
// ═════════════════════════════════════════════════════
function generatePsakimFormalHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderAuthenticBlocks(section.content);
    return `<section class="pf-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="pf-section-head">${esc(section.title)} <a href="#toc-top" class="pf-back" title="חזרה לתוכן עניינים">▲</a></h3>
      <div class="pf-section-body">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderAuthenticBlocks(data.rawText);

  const judgesHtml = data.judges.length > 0
    ? `<div id="sec-signature" class="pf-signature" data-search-scope="sec-signature" data-search-label="חתימה">
        <div class="pf-sig-verse">"וְהָאֱמֶת וְהַשָּׁלוֹם אֱהָבוּ"</div>
        <div class="pf-sig-grid">
          ${data.judges.map((j) => `<div class="pf-sig-item"><div class="pf-sig-line"></div><div class="pf-sig-name">${esc(j)}</div></div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  const caseLabel = data.caseNumber ? `תיק מספר ${esc(data.caseNumber)}` : "";
  const serialLabel = data.sourceId ? `מס. סידורי: ${esc(data.sourceId)}` : "";

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root { --navy: #0B1F5B; --gold: #D4AF37; --bg: #FDFCF9; --text: #1a1a2e; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'David', 'Frank Ruhl Libre', 'Noto Serif Hebrew', Georgia, serif; background: #eee; color: var(--text); line-height: 1.85; margin: 0; padding: 20px; direction: rtl; }
    .pf-container { max-width: 780px; margin: 0 auto; background: var(--bg); border: 1px solid #ccc; border-radius: 6px; padding: 50px 55px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .pf-bsd { text-align: center; font-size: 1.3em; font-weight: bold; color: var(--navy); margin-bottom: 6px; }
    .pf-serial { text-align: left; font-size: 0.85em; color: #888; margin-bottom: 20px; }
    .pf-main-title { text-align: center; font-size: 2em; font-weight: bold; color: var(--navy); margin: 18px 0 6px; letter-spacing: 2px; }
    .pf-case-title { text-align: center; font-size: 1.25em; color: var(--gold); margin-bottom: 10px; font-weight: 600; }
    .pf-meta-table { width: 100%; border-collapse: collapse; margin: 18px 0 30px; }
    .pf-meta-table td { padding: 6px 14px; border-bottom: 1px solid #e8e4d8; font-size: 0.92em; vertical-align: top; }
    .pf-meta-table td:first-child { font-weight: bold; color: var(--navy); width: 130px; white-space: nowrap; }
    .pf-summary-box { background: #f5f3ec; border-right: 4px solid var(--gold); padding: 16px 22px; margin: 20px 0 30px; border-radius: 0 6px 6px 0; }
    .pf-summary-box h4 { color: var(--navy); margin: 0 0 8px; font-size: 1.05em; }
    .pf-section { margin-bottom: 28px; }
    .pf-section-head { color: var(--navy); font-size: 1.3em; font-weight: bold; padding-bottom: 6px; border-bottom: 2px solid var(--gold); margin-bottom: 14px; scroll-margin-top: 98px; }
    .pf-back { color: var(--gold); text-decoration: none; font-size: 0.65em; margin-right: 8px; }
    .pf-section-body { padding-right: 12px; }
    .auth-paragraph { text-indent: 1.5em; margin: 0 0 10px; text-align: justify; }
    .heb-list { list-style: none; padding: 0; margin: 10px 0; }
    .heb-list li { margin-bottom: 8px; padding-right: 10px; }
    .heb-marker { color: var(--gold); font-weight: bold; font-size: 1.05em; }
    .num-list { list-style: none; padding: 0; margin: 10px 0; }
    .num-list li { margin-bottom: 8px; padding-right: 10px; }
    .num-marker { color: var(--navy); font-weight: bold; }
    .bullet-list { padding-right: 20px; margin: 10px 0; }
    .auth-subhead { color: var(--navy); font-size: 1.05em; margin: 18px 0 6px; border-bottom: 1px dotted var(--gold); display: inline-block; padding-bottom: 2px; }
    .source-ref { background: rgba(212,175,55,.12); padding: 1px 4px; border-radius: 3px; color: var(--navy); font-weight: 600; }
    .pf-signature { text-align: center; margin: 45px 0 30px; padding-top: 20px; border-top: 2px solid var(--navy); }
    .pf-sig-verse { font-style: italic; color: var(--gold); font-size: 1.1em; margin-bottom: 20px; }
    .pf-sig-grid { display: flex; justify-content: center; gap: 60px; flex-wrap: wrap; }
    .pf-sig-item { text-align: center; min-width: 140px; }
    .pf-sig-line { border-bottom: 1px solid var(--navy); margin-bottom: 6px; width: 100%; }
    .pf-sig-name { font-weight: bold; color: var(--navy); font-size: 0.95em; }
    .pf-footer { text-align: center; font-size: 0.8em; color: #999; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0d9c8; }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="pf-container">
    <div class="pf-bsd">בס"ד</div>
    ${serialLabel ? `<div class="pf-serial">${serialLabel}</div>` : ""}
    <div class="pf-main-title">פסק דין</div>
    <div class="pf-case-title">${esc(data.title)}</div>
    ${caseLabel ? `<div style="text-align:center;font-size:0.9em;color:#666;margin-bottom:18px;">${caseLabel}</div>` : ""}

    <section id="sec-details" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <table class="pf-meta-table">
        ${data.court ? `<tr><td>שם בית דין:</td><td>${esc(data.court)}</td></tr>` : ""}
        ${data.judges.length ? `<tr><td>דיינים:</td><td>${data.judges.map(j => esc(j)).join("&ensp;|&ensp;")}</td></tr>` : ""}
        ${data.date ? `<tr><td>תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
        ${data.topics ? `<tr><td>נושאים:</td><td>${esc(data.topics)}</td></tr>` : ""}
        ${data.sourceUrl ? `<tr><td>מקור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--navy);">קישור לפסק המקורי</a></td></tr>` : ""}
      </table>
    </section>

    ${data.summary ? `<section id="sec-summary" data-search-scope="sec-summary" data-search-label="תקציר">
      <div class="pf-summary-box"><h4>תקציר:</h4><p style="margin:0;">${esc(data.summary)}</p></div>
    </section>` : ""}

    <div id="toc-top">${tocHtml}</div>
    ${renderSearchWidget(data)}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="pf-section" data-search-scope="sec-fallback"><div class="pf-section-body">${fallbackBody}</div></section>` : ""}
    ${judgesHtml}
    <div class="pf-footer">עוצב בסגנון פסקים.אורג • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE 2: Court Decree (גזר דין סמכותי)
// ═════════════════════════════════════════════════════
function generateCourtDecreeHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderCourtBlocks(section.content);
    const isDecision = /פסק|החלט|הכרע|גזר|מסקנ/.test(section.title);
    return `<section class="cd-section${isDecision ? " cd-decision-section" : ""}" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="cd-section-head"><span class="cd-head-marker"></span>${esc(section.title)} <a href="#toc-top" class="cd-back" title="חזרה לתוכן">↑</a></h3>
      <div class="cd-section-body">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderCourtBlocks(data.rawText);

  const judgesHtml = data.judges.length > 0
    ? `<div id="sec-signature" class="cd-signature" data-search-scope="sec-signature" data-search-label="חתימה">
        <div class="cd-seal">⚖</div>
        <div class="cd-sig-label">ניתן היום ${data.date ? esc(data.date) : new Date().toLocaleDateString("he-IL")}</div>
        <div class="cd-sig-grid">
          ${data.judges.map((j) => `<div class="cd-sig-item"><div class="cd-sig-line"></div><div class="cd-sig-name">${esc(j)}</div></div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root { --navy: #0B1F5B; --gold: #D4AF37; --dark-navy: #071340; --light-gold: rgba(212,175,55,.08); }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'David', 'Frank Ruhl Libre', 'Noto Serif Hebrew', Georgia, serif; background: #e8e8ec; color: #1e1e2e; line-height: 1.8; margin: 0; padding: 20px; direction: rtl; }
    .cd-container { max-width: 780px; margin: 0 auto; background: #fff; border-radius: 0; box-shadow: 0 4px 24px rgba(0,0,0,.12); overflow: hidden; }
    .cd-header { background: linear-gradient(135deg, var(--dark-navy) 0%, var(--navy) 100%); color: #fff; text-align: center; padding: 35px 40px 28px; position: relative; }
    .cd-header::after { content: ""; position: absolute; bottom: 0; right: 0; left: 0; height: 4px; background: linear-gradient(90deg, var(--gold), transparent, var(--gold)); }
    .cd-header .cd-bsd { font-size: 1em; color: rgba(255,255,255,.6); margin-bottom: 10px; }
    .cd-header .cd-emblem { font-size: 2.5em; margin-bottom: 8px; }
    .cd-header .cd-main-title { font-size: 2.2em; font-weight: bold; letter-spacing: 3px; margin-bottom: 6px; }
    .cd-header .cd-sub-title { color: var(--gold); font-size: 1.15em; font-weight: 500; }
    .cd-header .cd-case-num { font-size: 0.85em; color: rgba(255,255,255,.5); margin-top: 8px; }
    .cd-body { padding: 40px 50px; }
    .cd-meta-strip { display: flex; flex-wrap: wrap; gap: 18px; background: var(--light-gold); border: 1px solid rgba(212,175,55,.2); border-radius: 6px; padding: 14px 20px; margin-bottom: 28px; }
    .cd-meta-item { font-size: 0.9em; }
    .cd-meta-item strong { color: var(--navy); margin-left: 4px; }
    .cd-section { margin-bottom: 28px; }
    .cd-section-head { color: var(--navy); font-size: 1.25em; font-weight: bold; padding: 8px 14px; background: linear-gradient(90deg, rgba(11,31,91,.06), transparent); border-right: 4px solid var(--navy); margin-bottom: 14px; scroll-margin-top: 98px; }
    .cd-head-marker { display: inline-block; width: 8px; height: 8px; background: var(--gold); border-radius: 50%; margin-left: 10px; vertical-align: middle; }
    .cd-back { color: var(--gold); text-decoration: none; font-size: 0.6em; margin-right: 8px; }
    .cd-section-body { padding-right: 18px; }
    .cd-decision-section { background: linear-gradient(180deg, rgba(212,175,55,.04), rgba(212,175,55,.1)); border: 1px solid rgba(212,175,55,.3); border-radius: 8px; padding: 20px; margin: 30px 0; }
    .cd-decision-section .cd-section-head { border-right-color: var(--gold); color: var(--gold); background: none; }
    .doc-paragraph { text-align: justify; margin: 0 0 10px; }
    .list { list-style: none; padding: 0; margin: 10px 0; }
    .list li { margin-bottom: 6px; padding-right: 8px; }
    .marker { color: var(--navy); font-weight: bold; margin-left: 4px; }
    .inline-heading { color: var(--navy); font-size: 1em; margin: 16px 0 6px; }
    .cd-signature { text-align: center; margin: 40px 0 25px; padding-top: 25px; border-top: 3px double var(--navy); }
    .cd-seal { font-size: 3em; margin-bottom: 10px; }
    .cd-sig-label { color: #666; font-size: 0.9em; margin-bottom: 18px; }
    .cd-sig-grid { display: flex; justify-content: center; gap: 50px; flex-wrap: wrap; }
    .cd-sig-item { text-align: center; min-width: 130px; }
    .cd-sig-line { border-bottom: 2px solid var(--navy); margin-bottom: 6px; width: 100%; }
    .cd-sig-name { font-weight: bold; color: var(--navy); font-size: 1em; }
    .cd-footer { text-align: center; font-size: 0.78em; color: #aaa; padding: 18px; background: #f8f8fa; border-top: 1px solid #eee; }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="cd-container">
    <div class="cd-header">
      <div class="cd-bsd">בס"ד</div>
      <div class="cd-emblem">⚖</div>
      <div class="cd-main-title">פסק דין</div>
      <div class="cd-sub-title">${esc(data.title)}</div>
      ${data.caseNumber ? `<div class="cd-case-num">תיק ${esc(data.caseNumber)}</div>` : ""}
    </div>
    <div class="cd-body">
      <section id="sec-details" data-search-scope="sec-details" data-search-label="פרטי התיק">
        <div class="cd-meta-strip">
          ${data.court ? `<div class="cd-meta-item"><strong>בית דין:</strong> ${esc(data.court)}</div>` : ""}
          ${data.date ? `<div class="cd-meta-item"><strong>תאריך:</strong> ${esc(data.date)}</div>` : ""}
          ${data.judges.length ? `<div class="cd-meta-item"><strong>דיינים:</strong> ${data.judges.map(j => esc(j)).join(", ")}</div>` : ""}
        </div>
      </section>

      ${data.summary ? `<section id="sec-summary" data-search-scope="sec-summary" data-search-label="תקציר">
        <div style="background:var(--light-gold);border-right:4px solid var(--gold);padding:16px 22px;border-radius:0 6px 6px 0;margin-bottom:26px;">
          <h4 style="color:var(--navy);margin:0 0 8px;font-size:1.05em;">תקציר</h4>
          <p style="margin:0;">${esc(data.summary)}</p>
        </div>
      </section>` : ""}

      <div id="toc-top">${tocHtml}</div>
      ${renderSearchWidget(data)}
      ${sectionsHtml}
      ${fallbackBody ? `<section class="cd-section" data-search-scope="sec-fallback"><div class="cd-section-body">${fallbackBody}</div></section>` : ""}
      ${judgesHtml}
    </div>
    <div class="cd-footer">עוצב בסגנון גזר דין סמכותי • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE 3: Scholarly Halachic (עיוני הלכתי)
// ═════════════════════════════════════════════════════
function renderScholarlyBlocks(content: string): string {
  const lines = content.replace(/\r\n?/g, "\n").split("\n").map(l => l.trim());
  const out: string[] = [];
  let paragraphBuffer: string[] = [];
  let inBlockquote = false;
  let blockquoteBuffer: string[] = [];

  const highlightSources = (text: string): string => {
    const escaped = esc(text);
    return escaped.replace(
      /(שו&quot;ע|שו&quot;ת|רמב&quot;ם|רמ&quot;א|גמ(?:רא|&#39;)|טור|ב&quot;[קמגפ]|משנה\s+ברורה|חו&quot;מ|אה&quot;ע|או&quot;ח|יו&quot;ד|שו&quot;ע\s+(?:אורח\s+חיים|יורה\s+דעה|אבן\s+העזר|חושן\s+משפט)|בבא\s+(?:קמא|מציעא|בתרא)|שולחן\s+ערוך|משנה|תוספות|רש&quot;י|רשב&quot;ם|סמ&quot;ע|ערוך\s+השולחן|מסכת\s+\S+)/g,
      '<span class="sh-source-ref">$1</span>'
    );
  };

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const merged = applyNbspToTail(paragraphBuffer.join(" "));
    if (merged) out.push(`<p class="sh-paragraph">${highlightSources(merged)}</p>`);
    paragraphBuffer = [];
  };

  const flushBlockquote = () => {
    if (!blockquoteBuffer.length) return;
    const merged = blockquoteBuffer.join(" ");
    out.push(`<blockquote class="sh-citation"><span class="sh-cite-icon">❝</span>${highlightSources(applyNbspToTail(merged))}</blockquote>`);
    blockquoteBuffer = [];
    inBlockquote = false;
  };

  for (const line of lines) {
    if (!line) {
      if (inBlockquote) flushBlockquote();
      flushParagraph();
      continue;
    }

    if (isUiArtifactLine(line)) continue;

    // Detect blockquote-like lines (quoted halachic text in psakim.org format)
    if (line.startsWith('"') || line.startsWith('״') || line.startsWith('«')) {
      flushParagraph();
      inBlockquote = true;
      blockquoteBuffer.push(line);
      continue;
    }
    if (inBlockquote && (line.endsWith('"') || line.endsWith('״') || line.endsWith('»'))) {
      blockquoteBuffer.push(line);
      flushBlockquote();
      continue;
    }
    if (inBlockquote) {
      blockquoteBuffer.push(line);
      continue;
    }

    // Hebrew letter markers
    const hebLetterMatch = line.match(/^\s*[\u05D0-\u05EA]{1,2}[\.\'\)\u05F3\u05F4]\s+(.+)$/);
    if (hebLetterMatch) {
      flushParagraph();
      const markerEnd = line.indexOf(" ");
      const marker = line.slice(0, markerEnd).trim();
      const text = line.slice(markerEnd).trim();
      out.push(`<div class="sh-heb-item"><span class="sh-heb-marker">${esc(marker)}</span> ${highlightSources(applyNbspToTail(text))}</div>`);
      continue;
    }

    // Numbered items
    const orderedMatch = line.match(/^\s*(\d+)[\.\)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      out.push(`<div class="sh-num-item"><span class="sh-num-marker">${esc(orderedMatch[1])}.</span> ${highlightSources(applyNbspToTail(orderedMatch[2].trim()))}</div>`);
      continue;
    }

    // Sub-heading
    if (/^[^.]{2,80}:$/.test(line)) {
      const isEmptyMetaLabel = /^(שם\s*בית\s*דין|תאריך|כותרת|שנה|מספר\s*תיק|דיינים):$/i.test(line);
      if (!isEmptyMetaLabel) {
        flushParagraph();
        out.push(`<h4 class="sh-subhead">${esc(line)}</h4>`);
        continue;
      }
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushBlockquote();
  flushParagraph();
  return out.join("\n");
}

function generateScholarlyHalachicHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionTypeIcon = (title: string): string => {
    const t = title.trim();
    if (/עובד|רקע|תיאור/.test(t)) return "📋";
    if (/טענ/.test(t)) return "💬";
    if (/דיון|ניתוח|הלכ/.test(t)) return "📖";
    if (/מקור|מרא/.test(t)) return "🔍";
    if (/פסק|החלט|הכרע|מסקנ/.test(t)) return "⚖";
    return "§";
  };

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderScholarlyBlocks(section.content);
    const icon = sectionTypeIcon(section.title);
    return `<section class="sh-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="sh-section-head"><span class="sh-sec-icon">${icon}</span>${esc(section.title)} <a href="#toc-top" class="sh-back" title="חזרה לתוכן">▲</a></h3>
      <div class="sh-section-body">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderScholarlyBlocks(data.rawText);

  const judgesHtml = data.judges.length > 0
    ? `<div id="sec-signature" class="sh-signature" data-search-scope="sec-signature" data-search-label="חתימה">
        <div class="sh-sig-title">באנו על החתום</div>
        <div class="sh-sig-grid">
          ${data.judges.map((j) => `<div class="sh-sig-card"><div class="sh-sig-name">${esc(j)}</div></div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root { --navy: #0B1F5B; --gold: #D4AF37; --parchment: #FAF6ED; --text: #2c2416; --border: #e0d5c0; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'David', 'Frank Ruhl Libre', 'Noto Serif Hebrew', Georgia, serif; background: linear-gradient(180deg, #e8dfc8 0%, #d4c8a8 100%); color: var(--text); line-height: 1.9; margin: 0; padding: 20px; direction: rtl; }
    .sh-container { max-width: 800px; margin: 0 auto; background: var(--parchment); border: 2px solid var(--border); border-radius: 4px; padding: 50px 55px; box-shadow: 0 4px 20px rgba(0,0,0,.1), inset 0 0 80px rgba(212,175,55,.03); }
    .sh-header { text-align: center; margin-bottom: 30px; position: relative; }
    .sh-header::after { content: "✡"; font-size: 1.6em; color: var(--gold); display: block; margin: 8px 0; }
    .sh-bsd { font-size: 1.1em; color: var(--navy); margin-bottom: 4px; }
    .sh-main-title { font-size: 1.9em; font-weight: bold; color: var(--navy); margin: 8px 0 4px; }
    .sh-case-title { font-size: 1.15em; color: var(--gold); font-weight: 600; }
    .sh-meta-panel { background: rgba(11,31,91,.03); border: 1px solid var(--border); border-radius: 6px; padding: 16px 22px; margin: 20px 0 30px; }
    .sh-meta-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 0.9em; }
    .sh-meta-label { font-weight: bold; color: var(--navy); min-width: 90px; }
    .sh-summary { background: #fffaf0; border: 1px solid var(--gold); border-radius: 6px; padding: 18px 24px; margin: 20px 0 30px; position: relative; }
    .sh-summary::before { content: "תקציר"; position: absolute; top: -10px; right: 16px; background: var(--gold); color: #fff; padding: 2px 14px; border-radius: 10px; font-size: 0.82em; font-weight: bold; }
    .sh-section { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px dashed var(--border); }
    .sh-section:last-of-type { border-bottom: none; }
    .sh-section-head { color: var(--navy); font-size: 1.3em; font-weight: bold; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; scroll-margin-top: 98px; }
    .sh-sec-icon { font-size: 0.85em; }
    .sh-back { color: var(--gold); text-decoration: none; font-size: 0.55em; margin-right: auto; }
    .sh-section-body { padding-right: 8px; }
    .sh-paragraph { text-indent: 1.5em; text-align: justify; margin: 0 0 12px; }
    .sh-citation { background: rgba(212,175,55,.08); border-right: 4px solid var(--gold); padding: 14px 22px; margin: 16px 0; border-radius: 0 6px 6px 0; font-style: italic; position: relative; }
    .sh-cite-icon { font-size: 1.4em; color: var(--gold); position: absolute; top: 8px; left: 12px; font-style: normal; }
    .sh-source-ref { background: linear-gradient(180deg, rgba(212,175,55,.15), rgba(212,175,55,.25)); padding: 1px 6px; border-radius: 3px; color: var(--navy); font-weight: 700; border-bottom: 1px solid var(--gold); }
    .sh-heb-item { margin-bottom: 10px; padding-right: 8px; }
    .sh-heb-marker { color: var(--gold); font-weight: bold; font-size: 1.1em; }
    .sh-num-item { margin-bottom: 10px; padding-right: 8px; }
    .sh-num-marker { color: var(--navy); font-weight: bold; }
    .sh-subhead { color: var(--navy); font-size: 1.05em; margin: 20px 0 8px; padding: 4px 10px; background: rgba(11,31,91,.04); border-radius: 4px; display: inline-block; }
    .sh-signature { text-align: center; margin: 40px 0 20px; padding-top: 20px; border-top: 2px solid var(--navy); }
    .sh-sig-title { color: var(--navy); font-size: 1.1em; font-weight: bold; margin-bottom: 16px; }
    .sh-sig-grid { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; }
    .sh-sig-card { background: rgba(11,31,91,.04); border: 1px solid var(--border); border-radius: 6px; padding: 12px 24px; min-width: 130px; }
    .sh-sig-name { font-weight: bold; color: var(--navy); }
    .sh-footer { text-align: center; font-size: 0.8em; color: #999; margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border); }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="sh-container">
    <div class="sh-header">
      <div class="sh-bsd">בס"ד</div>
      <div class="sh-main-title">${esc(data.title)}</div>
      <div class="sh-case-title">${data.court ? esc(data.court) : "פסק דין"}</div>
    </div>

    <section id="sec-details" data-search-scope="sec-details" data-search-label="פרטי התיק">
      <div class="sh-meta-panel">
        ${data.caseNumber ? `<div class="sh-meta-row"><span class="sh-meta-label">תיק:</span><span>${esc(data.caseNumber)}</span></div>` : ""}
        ${data.date ? `<div class="sh-meta-row"><span class="sh-meta-label">תאריך:</span><span>${esc(data.date)}</span></div>` : ""}
        ${data.judges.length ? `<div class="sh-meta-row"><span class="sh-meta-label">דיינים:</span><span>${data.judges.map(j => esc(j)).join("&ensp;•&ensp;")}</span></div>` : ""}
        ${data.topics ? `<div class="sh-meta-row"><span class="sh-meta-label">נושאים:</span><span>${esc(data.topics)}</span></div>` : ""}
      </div>
    </section>

    ${data.summary ? `<section id="sec-summary" data-search-scope="sec-summary" data-search-label="תקציר">
      <div class="sh-summary"><p style="margin:0;padding-top:6px;">${esc(data.summary)}</p></div>
    </section>` : ""}

    <div id="toc-top">${tocHtml}</div>
    ${renderSearchWidget(data)}
    ${sectionsHtml}
    ${fallbackBody ? `<section class="sh-section" data-search-scope="sec-fallback"><div class="sh-section-body">${fallbackBody}</div></section>` : ""}
    ${judgesHtml}
    <div class="sh-footer">עוצב בסגנון עיוני הלכתי • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE 4: Executive Brief (תמצית מנהלים)
// ═════════════════════════════════════════════════════
function generateExecutiveBriefHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  // Find the ruling/decision section for the highlight card
  const decisionSection = data.sections.find(s => /פסק|החלט|הכרע|מסקנ|גזר/.test(s.title));

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderCourtBlocks(section.content);
    const isDecision = /פסק|החלט|הכרע|מסקנ|גזר/.test(section.title);
    return `<section class="eb-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <div class="eb-section-marker"></div>
      <h3 id="${anchor}" class="eb-section-head">${esc(section.title)} <a href="#toc-top" class="eb-back" title="חזרה">↑</a></h3>
      <div class="eb-section-body${isDecision ? " eb-decision-body" : ""}">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderCourtBlocks(data.rawText);

  // Extract first 200 chars of decision for the card
  const decisionSnippet = decisionSection
    ? esc(decisionSection.content.replace(/\s+/g, " ").trim().slice(0, 200)) + (decisionSection.content.length > 200 ? "..." : "")
    : "";

  const judgesHtml = data.judges.length > 0
    ? `<div id="sec-signature" class="eb-signature" data-search-scope="sec-signature" data-search-label="חתימה">
        <div class="eb-sig-grid">
          ${data.judges.map((j) => `<span class="eb-sig-badge">${esc(j)}</span>`).join("\n          ")}
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root { --navy: #0B1F5B; --gold: #D4AF37; --bg: #F7F8FC; --card: #fff; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Noto Sans Hebrew', 'Arial', sans-serif; background: var(--bg); color: #2d2d3a; line-height: 1.75; margin: 0; padding: 20px; direction: rtl; }
    .eb-container { max-width: 800px; margin: 0 auto; }
    .eb-hero { background: linear-gradient(135deg, var(--navy), #1a3a8a); border-radius: 12px; padding: 32px 40px; color: #fff; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(11,31,91,.2); }
    .eb-hero-bsd { font-size: 0.85em; color: rgba(255,255,255,.5); }
    .eb-hero-title { font-size: 1.8em; font-weight: 700; margin: 8px 0 6px; }
    .eb-hero-subtitle { color: var(--gold); font-size: 1.1em; }
    .eb-hero-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 14px; font-size: 0.85em; color: rgba(255,255,255,.7); }
    .eb-hero-meta span::before { content: "•"; margin-left: 6px; color: var(--gold); }
    .eb-cards-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    @media (max-width: 600px) { .eb-cards-row { grid-template-columns: 1fr; } }
    .eb-card { background: var(--card); border-radius: 10px; padding: 20px 24px; box-shadow: 0 2px 10px rgba(0,0,0,.05); border-top: 3px solid var(--gold); }
    .eb-card-title { color: var(--navy); font-size: 1em; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .eb-card p { margin: 0; font-size: 0.92em; color: #555; }
    .eb-decision-card { grid-column: 1 / -1; border-top-color: var(--navy); background: linear-gradient(180deg, rgba(11,31,91,.03), rgba(212,175,55,.06)); }
    .eb-decision-card .eb-card-title { color: var(--gold); font-size: 1.1em; }
    .eb-main { background: var(--card); border-radius: 10px; padding: 35px 40px; box-shadow: 0 2px 10px rgba(0,0,0,.05); margin-bottom: 20px; }
    .eb-section { margin-bottom: 28px; position: relative; padding-right: 18px; }
    .eb-section-marker { position: absolute; right: 0; top: 4px; width: 4px; height: 100%; background: linear-gradient(180deg, var(--gold), transparent); border-radius: 4px; }
    .eb-section-head { color: var(--navy); font-size: 1.2em; font-weight: 700; margin-bottom: 12px; scroll-margin-top: 98px; }
    .eb-back { color: var(--gold); text-decoration: none; font-size: 0.55em; margin-right: 8px; }
    .eb-section-body { }
    .eb-decision-body { background: rgba(212,175,55,.06); border: 1px solid rgba(212,175,55,.2); border-radius: 8px; padding: 16px; }
    .doc-paragraph { text-align: justify; margin: 0 0 10px; }
    .list { list-style: none; padding: 0; margin: 10px 0; }
    .list li { margin-bottom: 6px; padding-right: 8px; }
    .marker { color: var(--navy); font-weight: bold; margin-left: 4px; }
    .inline-heading { color: var(--navy); font-size: 1em; margin: 16px 0 6px; }
    .eb-signature { text-align: center; margin: 10px 0 20px; }
    .eb-sig-grid { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .eb-sig-badge { background: var(--navy); color: #fff; padding: 6px 18px; border-radius: 20px; font-size: 0.88em; font-weight: 600; }
    .eb-footer { text-align: center; font-size: 0.78em; color: #aaa; margin-top: 10px; }
    ${TOC_CSS}
    ${SEARCH_WIDGET_CSS}
    ${PRINT_CSS}
  </style>
</head>
<body>
  <div class="eb-container">
    <div class="eb-hero">
      <div class="eb-hero-bsd">בס"ד</div>
      <div class="eb-hero-title">${esc(data.title)}</div>
      <div class="eb-hero-subtitle">${data.court ? esc(data.court) : "פסק דין"}</div>
      <div class="eb-hero-meta">
        ${data.caseNumber ? `<span>תיק ${esc(data.caseNumber)}</span>` : ""}
        ${data.date ? `<span>${esc(data.date)}</span>` : ""}
        ${data.judges.length ? `<span>${data.judges.length} דיינים</span>` : ""}
        ${data.sections.length ? `<span>${data.sections.length} סעיפים</span>` : ""}
      </div>
    </div>

    <div class="eb-cards-row">
      ${data.summary ? `<div class="eb-card">
        <div class="eb-card-title">📋 תקציר</div>
        <p>${esc(data.summary)}</p>
      </div>` : ""}
      ${data.topics ? `<div class="eb-card">
        <div class="eb-card-title">📌 נושאים</div>
        <p>${esc(data.topics)}</p>
      </div>` : ""}
      ${decisionSnippet ? `<div class="eb-card eb-decision-card">
        <div class="eb-card-title">⚖ עיקר ההחלטה</div>
        <p>${decisionSnippet}</p>
      </div>` : ""}
    </div>

    <div class="eb-main">
      <section id="sec-details" data-search-scope="sec-details" data-search-label="פרטי התיק" style="display:none;"></section>
      ${data.summary ? `<section id="sec-summary" data-search-scope="sec-summary" data-search-label="תקציר" style="display:none;"></section>` : ""}
      <div id="toc-top">${tocHtml}</div>
      ${renderSearchWidget(data)}
      ${sectionsHtml}
      ${fallbackBody ? `<section class="eb-section" data-search-scope="sec-fallback"><div class="eb-section-body">${fallbackBody}</div></section>` : ""}
      ${judgesHtml}
    </div>
    <div class="eb-footer">עוצב בסגנון תמצית מנהלים • ${new Date().toLocaleDateString("he-IL")}</div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

// ═════════════════════════════════════════════════════
// TEMPLATE: Clean Sidebar (נקי עם חיפוש צד)
// ═════════════════════════════════════════════════════
function renderSidebarSearchWidget(data: ParsedPsakDin): string {
  const sectionOptions = [
    `<option value="">כל המסמך</option>`,
    `<option value="sec-details">פרטי תיק</option>`,
    data.summary ? `<option value="sec-summary">תקציר</option>` : "",
    ...data.sections.map((sec, i) => `<option value="sec-${i}">${esc(sec.title)}</option>`),
    data.judges.length > 0 ? `<option value="sec-signature">חתימה</option>` : "",
  ].join("");

  return `<aside class="cs-sidebar" aria-label="כלי חיפוש וניווט" data-testid="psak-doc-widget">
    <div class="cs-sidebar-title">חיפוש וניווט</div>
    <input id="psak-search-input" data-testid="psak-search-input" class="cs-search-input" type="search" placeholder="חיפוש בתוך פסק הדין..." />
    <select id="psak-search-section" data-testid="psak-search-section" class="cs-search-select">${sectionOptions}</select>
    <div class="cs-check-row">
      <label class="cs-check"><input id="psak-search-exact" type="checkbox" /> ביטוי מדויק</label>
      <label class="cs-check"><input id="psak-search-normalized" type="checkbox" checked /> התאמה חכמה</label>
    </div>
    <div class="cs-btn-row">
      <button id="psak-search-prev" data-testid="psak-search-prev" class="cs-btn" type="button">הקודם</button>
      <button id="psak-search-next" data-testid="psak-search-next" class="cs-btn" type="button">הבא</button>
      <button id="psak-search-clear" data-testid="psak-search-clear" class="cs-btn" type="button">נקה</button>
    </div>
    <span id="psak-search-count" data-testid="psak-search-count" class="cs-count">0/0</span>
    <hr class="cs-divider" />
    <div class="cs-btn-row">
      <button id="psak-prev-sec" data-testid="psak-prev-sec" class="cs-btn" type="button">סעיף קודם</button>
      <button id="psak-next-sec" data-testid="psak-next-sec" class="cs-btn" type="button">סעיף הבא</button>
    </div>
    <div class="cs-btn-row">
      <button id="psak-back-pos" data-testid="psak-back-pos" class="cs-btn" type="button">חזור למיקום</button>
    </div>
    <div class="cs-btn-row">
      <button id="psak-expand-all" data-testid="psak-expand-all" class="cs-btn" type="button">פתח הכל</button>
      <button id="psak-collapse-all" data-testid="psak-collapse-all" class="cs-btn" type="button">כווץ הכל</button>
    </div>
    <div class="cs-btn-row">
      <button id="psak-copy-quote" data-testid="psak-copy-quote" class="cs-btn" type="button">העתק ציטוט מסומן</button>
    </div>
    <span id="psak-breadcrumbs" data-testid="psak-breadcrumbs" class="cs-breadcrumbs">מיקום: תחילת מסמך</span>
    <hr class="cs-divider" />
    <textarea id="psak-notes" data-testid="psak-notes" class="cs-notes" placeholder="הערות אישיות..."></textarea>
    <button id="psak-save-notes" data-testid="psak-save-notes" class="cs-btn cs-btn-full" type="button">שמור הערות</button>
  </aside>`;
}

function generateCleanSidebarHtml(data: ParsedPsakDin): string {
  const { tocHtml, sectionAnchors } = buildTableOfContents(data);

  const sectionsHtml = data.sections.map((section, i) => {
    const anchor = sectionAnchors.get(i) || `sec-${i}`;
    const contentHtml = renderAuthenticBlocks(section.content);
    return `<section class="cs-section" data-search-scope="${anchor}" data-search-label="${esc(section.title)}">
      <h3 id="${anchor}" class="cs-section-head">${esc(section.title)} <a href="#toc-top" class="cs-back" title="חזרה לתוכן עניינים">&#x25B2;</a></h3>
      <div class="cs-section-body doc-section-content">${contentHtml}</div>
    </section>`;
  }).join("\n");

  const fallbackBody = data.sections.length ? "" : renderAuthenticBlocks(data.rawText);

  const judgesHtml = data.judges.length > 0
    ? `<div id="sec-signature" class="cs-signature" data-search-scope="sec-signature" data-search-label="חתימה">
        <div class="cs-sig-grid">
          ${data.judges.map((j) => `<div class="cs-sig-item"><div class="cs-sig-line"></div><div class="cs-sig-name">${esc(j)}</div></div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  const caseLabel = data.caseNumber ? `תיק מספר ${esc(data.caseNumber)}` : "";
  const serialLabel = data.sourceId ? `מס. סידורי: ${esc(data.sourceId)}` : "";

  return `<!DOCTYPE html>
<html lang="he-IL" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>פסק דין: ${esc(data.title)}</title>
  <style>
    :root { --navy: #0B1F5B; --gold: #D4AF37; --bg: #FDFCF9; --text: #1a1a2e; --sidebar-w: 240px; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'David', 'Frank Ruhl Libre', 'Noto Serif Hebrew', Georgia, serif; background: #eee; color: var(--text); line-height: 1.85; margin: 0; padding: 0; direction: rtl; }
    .cs-layout { display: flex; min-height: 100vh; }
    .cs-sidebar { width: var(--sidebar-w); position: fixed; top: 0; right: 0; height: 100vh; overflow-y: auto; background: #f8f9fb; border-left: 1px solid #ddd; padding: 16px 14px; z-index: 50; display: flex; flex-direction: column; gap: 8px; }
    .cs-sidebar-title { color: var(--navy); font-weight: bold; font-size: 1.05em; text-align: center; padding-bottom: 8px; border-bottom: 2px solid var(--gold); margin-bottom: 4px; }
    .cs-search-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; font-size: 13px; direction: rtl; width: 100%; background: #fff; }
    .cs-search-select { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; font-size: 13px; direction: rtl; width: 100%; background: #fff; }
    .cs-check-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .cs-check { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #334155; }
    .cs-btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .cs-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 5px 8px; cursor: pointer; font-size: 12px; flex: 1; text-align: center; }
    .cs-btn:hover { background: #eef2f7; }
    .cs-btn-full { width: 100%; }
    .cs-count { font-size: 12px; color: #475569; text-align: center; }
    .cs-divider { border: none; border-top: 1px solid #e2e8f0; margin: 4px 0; }
    .cs-breadcrumbs { font-size: 11px; color: #475569; background: #f0f2f5; border-radius: 4px; padding: 4px 8px; }
    .cs-notes { border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; font-size: 12px; direction: rtl; width: 100%; min-height: 60px; resize: vertical; background: #fff; }

    .cs-main { margin-right: var(--sidebar-w); flex: 1; padding: 30px 50px; }
    .cs-container { max-width: 780px; margin: 0 auto; background: var(--bg); border: 1px solid #ccc; border-radius: 6px; padding: 50px 55px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .cs-bsd { text-align: center; font-size: 1.2em; font-weight: bold; color: var(--navy); margin-bottom: 6px; }
    .cs-serial { text-align: left; font-size: 0.85em; color: #888; margin-bottom: 20px; }
    .cs-main-title { text-align: center; font-size: 2em; font-weight: bold; color: var(--navy); margin: 18px 0 6px; letter-spacing: 2px; }
    .cs-case-title { text-align: center; font-size: 1.2em; color: var(--gold); margin-bottom: 10px; font-weight: 600; }
    .cs-meta-table { width: 100%; border-collapse: collapse; margin: 18px 0 30px; }
    .cs-meta-table td { padding: 6px 14px; border-bottom: 1px solid #e8e4d8; font-size: 0.92em; vertical-align: top; }
    .cs-meta-table td:first-child { font-weight: bold; color: var(--navy); width: 130px; white-space: nowrap; }
    .cs-summary-box { background: #f5f3ec; border-right: 4px solid var(--gold); padding: 16px 22px; margin: 20px 0 30px; border-radius: 0 6px 6px 0; }
    .cs-summary-box h4 { color: var(--navy); margin: 0 0 8px; font-size: 1.05em; }
    .cs-section { margin-bottom: 28px; }
    .cs-section-head { color: var(--navy); font-size: 1.25em; font-weight: bold; padding-bottom: 6px; border-bottom: 2px solid var(--gold); margin-bottom: 14px; scroll-margin-top: 20px; }
    .cs-back { color: var(--gold); text-decoration: none; font-size: 0.65em; margin-right: 8px; }
    .cs-section-body { padding-right: 12px; }
    .auth-paragraph { text-indent: 1.5em; margin: 0 0 10px; text-align: justify; }
    .heb-list { list-style: none; padding: 0; margin: 10px 0; }
    .heb-list li { margin-bottom: 8px; padding-right: 10px; }
    .heb-marker { color: var(--gold); font-weight: bold; font-size: 1.05em; }
    .num-list { list-style: none; padding: 0; margin: 10px 0; }
    .num-list li { margin-bottom: 8px; padding-right: 10px; }
    .num-marker { color: var(--navy); font-weight: bold; }
    .bullet-list { padding-right: 20px; margin: 10px 0; }
    .auth-subhead { color: var(--navy); font-size: 1.05em; margin: 18px 0 6px; border-bottom: 1px dotted var(--gold); display: inline-block; padding-bottom: 2px; }
    .source-ref { background: rgba(212,175,55,.12); padding: 1px 4px; border-radius: 3px; color: var(--navy); font-weight: 600; }
    .cs-signature { text-align: center; margin: 45px 0 30px; padding-top: 20px; border-top: 2px solid var(--navy); }
    .cs-sig-grid { display: flex; justify-content: center; gap: 60px; flex-wrap: wrap; }
    .cs-sig-item { text-align: center; min-width: 140px; }
    .cs-sig-line { border-bottom: 1px solid var(--navy); margin-bottom: 6px; width: 100%; }
    .cs-sig-name { font-weight: bold; color: var(--navy); font-size: 0.95em; }
    .cs-footer { text-align: center; font-size: 0.8em; color: #999; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0d9c8; }

    /* Search widget hidden — sidebar is used instead */
    .search-widget { display: none !important; }

    /* TOC styles */
    ${TOC_CSS}
    /* Search highlighting */
    mark.psak-hit { background: #fde68a; color: #111827; border-radius: 2px; padding: 0 1px; }
    mark.psak-hit.active-hit { background: #f59e0b; color: #111827; }
    [id^="sec-"], #toc-top { scroll-margin-top: 20px; }
    .doc-section-content.section-collapsed { display: none; }
    .toc-link.toc-active { color: #b45309; font-weight: 700; text-decoration: underline; }

    ${PRINT_CSS}
    @media print {
      .cs-sidebar { display: none; }
      .cs-main { margin-right: 0; }
    }
    @media (max-width: 700px) {
      .cs-sidebar { position: static; width: 100%; height: auto; border-left: none; border-bottom: 1px solid #ddd; }
      .cs-main { margin-right: 0; padding: 16px; }
      .cs-layout { flex-direction: column; }
      .cs-container { padding: 24px 18px; }
    }
  </style>
</head>
<body>
  <div class="cs-layout">
    ${renderSidebarSearchWidget(data)}
    <div class="cs-main">
      <div class="cs-container">
        <div class="cs-bsd">בס"ד</div>
        ${serialLabel ? `<div class="cs-serial">${serialLabel}</div>` : ""}
        <div class="cs-main-title">פסק דין</div>
        <div class="cs-case-title">${esc(data.title)}</div>
        ${caseLabel ? `<div style="text-align:center;font-size:0.9em;color:#666;margin-bottom:18px;">${caseLabel}</div>` : ""}

        <section id="sec-details" data-search-scope="sec-details" data-search-label="פרטי התיק">
          <table class="cs-meta-table">
            ${data.court ? `<tr><td>שם בית דין:</td><td>${esc(data.court)}</td></tr>` : ""}
            ${data.judges.length ? `<tr><td>דיינים:</td><td>${data.judges.map(j => esc(j)).join("&ensp;|&ensp;")}</td></tr>` : ""}
            ${data.date ? `<tr><td>תאריך:</td><td>${esc(data.date)}</td></tr>` : ""}
            ${data.topics ? `<tr><td>נושאים:</td><td>${esc(data.topics)}</td></tr>` : ""}
            ${data.sourceUrl ? `<tr><td>מקור:</td><td><a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--navy);">קישור לפסק המקורי</a></td></tr>` : ""}
          </table>
        </section>

        ${data.summary ? `<section id="sec-summary" data-search-scope="sec-summary" data-search-label="תקציר">
          <div class="cs-summary-box"><h4>תקציר:</h4><p style="margin:0;">${esc(data.summary)}</p></div>
        </section>` : ""}

        <div id="toc-top">${tocHtml}</div>
        ${sectionsHtml}
        ${fallbackBody ? `<section class="cs-section" data-search-scope="sec-fallback"><div class="cs-section-body">${fallbackBody}</div></section>` : ""}
        ${judgesHtml}
        <div class="cs-footer">עוצב בסגנון נקי עם חיפוש צד -- ${new Date().toLocaleDateString("he-IL")}</div>
      </div>
    </div>
  </div>
  ${SEARCH_WIDGET_SCRIPT}
</body>
</html>`;
}

function highlightSourcesStatic(escaped: string): string {
  return escaped.replace(
    /(שו&quot;ע|שו&quot;ת|רמב&quot;ם|רמ&quot;א|גמ(?:רא|&#39;)|טור|ב&quot;[קמגפ]|משנה\s+ברורה|חו&quot;מ|אה&quot;ע|או&quot;ח|יו&quot;ד)/g,
    '<span class="source-ref">$1</span>'
  );
}

// ─── Main dispatch ───
export function generateFromTemplate(templateId: string, data: ParsedPsakDin): string {
  const sanitizedData = sanitizeParsedData(data);

  switch (templateId) {
    case "rabbinic-authentic": return generateRabbinicAuthenticHtml(sanitizedData);
    case "rabbinic-court-structured": return generateRabbinicCourtStructuredHtml(sanitizedData);
    case "court-rtl-official": return generateCourtRtlOfficialHtml(sanitizedData);
    case "navy-luxury-gold": return generateNavyLuxuryGoldHtml(sanitizedData);
    case "navy-luxury": return generateNavyLuxuryHtml(sanitizedData);
    case "modern": return generateModernHtml(sanitizedData);
    case "indexed": return generateIndexedHtml(sanitizedData);
    case "academic": return generateAcademicHtml(sanitizedData);
    case "clean-merged": return generateCleanMergedHtml(sanitizedData);
    case "psakim-formal": return generatePsakimFormalHtml(sanitizedData);
    case "court-decree": return generateCourtDecreeHtml(sanitizedData);
    case "scholarly-halachic": return generateScholarlyHalachicHtml(sanitizedData);
    case "executive-brief": return generateExecutiveBriefHtml(sanitizedData);
    case "clean-sidebar": return generateCleanSidebarHtml(sanitizedData);
    case "classic":
    default:
      return generateClassicHtml(sanitizedData);
  }
}
