import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText, Bookmark, Download, Search, Trash2, Plus, ExternalLink, BookOpen,
  Palette, Maximize2, Minimize2, RefreshCw, Bold, Italic, Underline, AlignRight,
  AlignCenter, AlignLeft, AlignJustify, Type, AArrowUp, AArrowDown, Highlighter,
  Copy, MessageSquarePlus, Hash, ZoomIn, ZoomOut, ChevronUp, ChevronDown,
  RotateCcw, Printer, StickyNote, Scissors, ClipboardPaste, Sparkles, Eye,
  ListOrdered, WrapText, PilcrowSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { usePDFAnnotations, type PDFAnnotation } from "@/hooks/usePDFAnnotations";
import { useUserBooks, type UserBook } from "@/hooks/useUserBooks";

// ─── Constants ───────────────────────────────────────────────

const VIEW_MODE_STORAGE_KEY = "embedpdf-view-mode-v1";

type ViewMode = "single" | "split" | "compare";

const ANNOTATION_COLORS = [
  { label: "צהוב", value: "#FFEB3B" },
  { label: "ירוק", value: "#81C784" },
  { label: "כחול", value: "#64B5F6" },
  { label: "כתום", value: "#FF8A65" },
  { label: "סגול", value: "#CE93D8" },
  { label: "ורוד", value: "#F48FB1" },
];

const HIGHLIGHT_COLORS = [
  { label: "צהוב", value: "#FFEB3B", bg: "bg-yellow-200" },
  { label: "ירוק", value: "#81C784", bg: "bg-green-200" },
  { label: "כחול", value: "#93C5FD", bg: "bg-blue-200" },
  { label: "כתום", value: "#FDBA74", bg: "bg-orange-200" },
  { label: "סגול", value: "#D8B4FE", bg: "bg-purple-200" },
  { label: "ורוד", value: "#F9A8D4", bg: "bg-pink-200" },
  { label: "אדום", value: "#FCA5A5", bg: "bg-red-200" },
];

const FONTS = [
  { value: "font-sans", label: "אריאל" },
  { value: "font-serif", label: "טיימס" },
  { value: "font-mono", label: "מונו" },
  { value: "font-david", label: "דוד" },
  { value: "font-frank", label: "פרנק רוהל" },
  { value: "font-rubik", label: "רוביק" },
];

interface TextFormat {
  fontSize: number;
  fontFamily: string;
  textAlign: "right" | "center" | "left" | "justify";
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  lineHeight: number;
  highlightColor: string | null;
  showLineNumbers: boolean;
  wordWrap: boolean;
}

const DEFAULT_FORMAT: TextFormat = {
  fontSize: 16,
  fontFamily: "font-serif",
  textAlign: "right",
  isBold: false,
  isItalic: false,
  isUnderline: false,
  lineHeight: 1.8,
  highlightColor: null,
  showLineNumbers: false,
  wordWrap: true,
};

interface TextHighlight {
  id: string;
  text: string;
  color: string;
  note?: string;
  startOffset: number;
  endOffset: number;
}

// ─── Selection Popup Component ───────────────────────────────

function SelectionPopup({
  position,
  selectedText,
  onHighlight,
  onAnnotate,
  onCopy,
  onSearch,
  onClose,
}: {
  position: { x: number; y: number };
  selectedText: string;
  onHighlight: (color: string) => void;
  onAnnotate: () => void;
  onCopy: () => void;
  onSearch: () => void;
  onClose: () => void;
}) {
  const [showColors, setShowColors] = useState(false);

  return (
    <div
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
    >
      <div className="bg-[#0B1F5B] rounded-xl shadow-2xl border-2 border-[#D4AF37] p-1.5 flex items-center gap-0.5">
        {/* Copy */}
        <button
          onClick={onCopy}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="העתק"
        >
          <Copy className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20" />

        {/* Highlight */}
        <div className="relative">
          <button
            onClick={() => setShowColors(!showColors)}
            className="p-1.5 rounded-lg text-[#D4AF37] hover:text-[#D4AF37] hover:bg-white/10 transition-colors"
            title="הדגש"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          {showColors && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white rounded-lg shadow-xl border-2 border-[#D4AF37] p-2 flex gap-1.5 z-50">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { onHighlight(c.value); setShowColors(false); }}
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-white/20" />

        {/* Annotate */}
        <button
          onClick={onAnnotate}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="הוסף הערה"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20" />

        {/* Search */}
        <button
          onClick={onSearch}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="חפש"
        >
          <Search className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20" />

        {/* Word count for selection */}
        <span className="px-2 text-[10px] text-white/50 whitespace-nowrap">
          {selectedText.split(/\s+/).filter(Boolean).length} מילים
        </span>
      </div>
      {/* Arrow pointing down */}
      <div className="flex justify-center">
        <div className="w-3 h-3 bg-[#0B1F5B] rotate-45 -mt-1.5 border-r-2 border-b-2 border-[#D4AF37]" />
      </div>
    </div>
  );
}

// ─── Design: White + Navy + Gold ─────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────

function safePage(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────

export default function EmbedPdfViewerPage() {
  const [searchParams] = useSearchParams();

  // PDF selection
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [comparePdfId, setComparePdfId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState(() => searchParams.get("url") || "");
  const [compareManualUrl, setCompareManualUrl] = useState("");
  const [viewerFullscreen, setViewerFullscreen] = useState(false);

  // Add book form
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookUrl, setNewBookUrl] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode) || "single";
    } catch { return "single"; }
  });

  // Annotation form
  const [currentPage, setCurrentPage] = useState("1");
  const [highlightText, setHighlightText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [annotationColor, setAnnotationColor] = useState("#FFEB3B");
  const [annotationSearch, setAnnotationSearch] = useState("");

  // ── Text Formatting ──
  const [textFormat, setTextFormat] = useState<TextFormat>(DEFAULT_FORMAT);
  const updateFormat = useCallback((patch: Partial<TextFormat>) => {
    setTextFormat(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Selection Popup ──
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number; y: number; text: string;
  } | null>(null);
  const textViewerRef = useRef<HTMLDivElement>(null);

  // ── In-text highlights ──
  const [textHighlights, setTextHighlights] = useState<TextHighlight[]>([]);

  // ── Search in text ──
  const [textSearch, setTextSearch] = useState("");
  const [textSearchResults, setTextSearchResults] = useState<number[]>([]);
  const [currentSearchIdx, setCurrentSearchIdx] = useState(0);
  const [showTextSearch, setShowTextSearch] = useState(false);

  // Persist viewMode
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode); } catch (e) { /* ignore */ }
  }, [viewMode]);

  // Auto-load URL from query params when they change
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam && urlParam !== manualUrl) setManualUrl(urlParam);
  }, [searchParams]);

  // Data hooks
  const { books, addBook, deleteBook } = useUserBooks();
  const selectedPdf = books.find((b) => b.id === selectedPdfId) ?? null;
  const comparePdf = books.find((b) => b.id === comparePdfId) ?? null;

  const canPersist = Boolean(selectedPdf?.id && !manualUrl.trim());
  const {
    annotations,
    bookmarks,
    annotationCountsByPage,
    addAnnotation,
    deleteAnnotation,
    addBookmark,
    deleteBookmark,
    isLoading: annotationsLoading,
  } = usePDFAnnotations(canPersist ? selectedPdf!.id : null);

  // Source URLs
  const leftSourceUrl = manualUrl.trim() || selectedPdf?.file_url || "";
  const rightSourceUrl = compareManualUrl.trim() || comparePdf?.file_url || "";

  // Smart viewer strategy: detect if URL is a direct file (PDF/TXT/DOCX) or an HTML page
  type ContentViewType = 'pdf' | 'text' | 'docx' | 'image' | 'html-page';

  const detectContentType = useCallback((url: string): ContentViewType => {
    if (!url) return 'html-page';
    const lower = url.toLowerCase();
    if (/\.(pdf)(\?|#|$)/.test(lower)) return 'pdf';
    if (/\.(txt|text|log|csv|md)(\?|#|$)/.test(lower)) return 'text';
    if (/\.(docx?|rtf|odt|xls|xlsx|ppt|pptx)(\?|#|$)/.test(lower)) return 'docx';
    if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|#|$)/.test(lower)) return 'image';
    return 'html-page';
  }, []);

  const getViewerUrl = useCallback((url: string, type: ContentViewType): string => {
    if (!url) return "";
    switch (type) {
      case 'pdf':
      case 'image':
        return url;
      case 'text':
      case 'html-page':
        // Text: fetched via JS. HTML pages: show open-in-new-tab UI
        return "";
      case 'docx':
        // Use Google Docs Viewer for office documents
        return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }
  }, []);

  const leftContentType = detectContentType(leftSourceUrl);
  const rightContentType = detectContentType(rightSourceUrl);
  const leftViewerUrl = getViewerUrl(leftSourceUrl, leftContentType);
  const rightViewerUrl = getViewerUrl(rightSourceUrl, rightContentType);

  // Iframe loading state
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Text content state (for .txt files fetched via JS)
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [fetchingText, setFetchingText] = useState(false);
  const [fetchTextError, setFetchTextError] = useState<string | null>(null);

  // Reset loading state when URL changes
  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
    setFetchedText(null);
    setFetchTextError(null);
  }, [leftSourceUrl]);

  // Fetch text content for .txt files
  useEffect(() => {
    if (leftContentType !== 'text' || !leftSourceUrl) return;
    let cancelled = false;
    setFetchingText(true);
    setFetchTextError(null);
    fetch(leftSourceUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        if (!cancelled) {
          setFetchedText(text);
          setFetchingText(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setFetchTextError(err.message);
          setFetchingText(false);
        }
      });
    return () => { cancelled = true; };
  }, [leftSourceUrl, leftContentType]);

  // ── Text Selection Handler ──
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      // Delay to allow click handlers to fire before hiding
      setTimeout(() => setSelectionPopup(null), 200);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 2) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      x: rect.left + rect.width / 2,
      y: rect.top - 12,
      text,
    });
  }, []);

  // ── Selection popup actions ──
  const handlePopupHighlight = useCallback((color: string) => {
    if (!selectionPopup) return;
    const newHL: TextHighlight = {
      id: crypto.randomUUID(),
      text: selectionPopup.text,
      color,
      startOffset: 0,
      endOffset: 0,
    };
    setTextHighlights(prev => [...prev, newHL]);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    toast.success("טקסט הודגש");
  }, [selectionPopup]);

  const handlePopupAnnotate = useCallback(() => {
    if (!selectionPopup) return;
    setHighlightText(selectionPopup.text);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    toast.info("הטקסט הועתק לשדה ההערות — כתוב הערה ושמור");
  }, [selectionPopup]);

  const handlePopupCopy = useCallback(() => {
    if (!selectionPopup) return;
    navigator.clipboard.writeText(selectionPopup.text);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    toast.success("הועתק ללוח");
  }, [selectionPopup]);

  const handlePopupSearch = useCallback(() => {
    if (!selectionPopup) return;
    setTextSearch(selectionPopup.text.slice(0, 50));
    setShowTextSearch(true);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopup]);

  // ── Search in text logic ──
  useEffect(() => {
    if (!textSearch.trim() || !fetchedText) {
      setTextSearchResults([]);
      setCurrentSearchIdx(0);
      return;
    }
    const q = textSearch.toLowerCase();
    const indices: number[] = [];
    let pos = fetchedText.toLowerCase().indexOf(q);
    while (pos !== -1) {
      indices.push(pos);
      pos = fetchedText.toLowerCase().indexOf(q, pos + 1);
    }
    setTextSearchResults(indices);
    setCurrentSearchIdx(0);
  }, [textSearch, fetchedText]);

  // ── Text stats ──
  const textStats = useMemo(() => {
    if (!fetchedText) return { words: 0, chars: 0, lines: 0, paragraphs: 0 };
    const words = fetchedText.split(/\s+/).filter(Boolean).length;
    const chars = fetchedText.length;
    const lines = fetchedText.split("\n").length;
    const paragraphs = fetchedText.split(/\n\s*\n/).filter(s => s.trim()).length;
    return { words, chars, lines, paragraphs };
  }, [fetchedText]);

  // ── Render text with highlights and search marks ──
  const renderedText = useMemo(() => {
    if (!fetchedText) return null;
    // Build a list of marked ranges
    const marks: { start: number; end: number; type: "highlight" | "search" | "searchActive"; color?: string }[] = [];

    // Add highlights
    textHighlights.forEach(hl => {
      let pos = fetchedText.indexOf(hl.text);
      while (pos !== -1) {
        marks.push({ start: pos, end: pos + hl.text.length, type: "highlight", color: hl.color });
        pos = fetchedText.indexOf(hl.text, pos + 1);
      }
    });

    // Add search results
    if (textSearch.trim() && textSearchResults.length > 0) {
      textSearchResults.forEach((pos, idx) => {
        marks.push({
          start: pos,
          end: pos + textSearch.length,
          type: idx === currentSearchIdx ? "searchActive" : "search",
        });
      });
    }

    if (marks.length === 0) return fetchedText;

    // Sort marks by start position
    marks.sort((a, b) => a.start - b.start);

    // Build JSX fragments
    const fragments: React.ReactNode[] = [];
    let lastEnd = 0;
    marks.forEach((mark, i) => {
      if (mark.start > lastEnd) {
        fragments.push(fetchedText.slice(lastEnd, mark.start));
      }
      const text = fetchedText.slice(mark.start, mark.end);
      if (mark.type === "searchActive") {
        fragments.push(
          <mark key={`s-${i}`} className="bg-[#D4AF37] text-[#0B1F5B] rounded px-0.5 ring-2 ring-[#D4AF37]" id="active-search-result">
            {text}
          </mark>
        );
      } else if (mark.type === "search") {
        fragments.push(
          <mark key={`s-${i}`} className="bg-[#D4AF37]/30 text-[#0B1F5B] rounded px-0.5">
            {text}
          </mark>
        );
      } else {
        fragments.push(
          <mark key={`h-${i}`} style={{ backgroundColor: mark.color + "66" }} className="rounded px-0.5">
            {text}
          </mark>
        );
      }
      lastEnd = mark.end;
    });
    if (lastEnd < fetchedText.length) {
      fragments.push(fetchedText.slice(lastEnd));
    }
    return fragments;
  }, [fetchedText, textHighlights, textSearch, textSearchResults, currentSearchIdx]);

  // ── Filtered annotations ──
  const filteredAnnotations = useMemo(() => {
    if (!annotationSearch.trim()) return annotations;
    const q = annotationSearch.toLowerCase();
    return annotations.filter(
      (a) =>
        a.note_text.toLowerCase().includes(q) ||
        (a.highlight_text ?? "").toLowerCase().includes(q) ||
        String(a.page_number).includes(q)
    );
  }, [annotations, annotationSearch]);

  // ── Add annotation ──
  const handleSaveAnnotation = useCallback(async () => {
    if (!noteText.trim()) {
      toast.error("יש לכתוב הערה");
      return;
    }
    if (!canPersist) {
      toast.info("שמירה למסד נתונים זמינה רק למסמך שנבחר מהרשימה");
      return;
    }
    await addAnnotation.mutateAsync({
      bookId: selectedPdf!.id,
      pageNumber: safePage(currentPage),
      noteText: noteText.trim(),
      highlightText: highlightText.trim() || undefined,
      color: annotationColor,
    });
    setNoteText("");
    setHighlightText("");
  }, [noteText, highlightText, currentPage, annotationColor, canPersist, selectedPdf, addAnnotation]);

  // ── Add bookmark ──
  const handleAddBookmark = useCallback(async () => {
    if (!canPersist) {
      toast.info("שמירה למסד נתונים זמינה רק למסמך שנבחר מהרשימה");
      return;
    }
    await addBookmark.mutateAsync({
      bookId: selectedPdf!.id,
      pageNumber: safePage(currentPage),
    });
  }, [currentPage, canPersist, selectedPdf, addBookmark]);

  // ── Export ──
  const handleExportJSON = useCallback(() => {
    if (!filteredAnnotations.length) return toast.info("אין אנוטציות לייצוא");
    const payload = JSON.stringify(filteredAnnotations, null, 2);
    downloadBlob(payload, `embedpdf-annotations-${Date.now()}.json`, "application/json");
    toast.success("JSON יוצא בהצלחה");
  }, [filteredAnnotations]);

  const handleExportCSV = useCallback(() => {
    if (!filteredAnnotations.length) return toast.info("אין אנוטציות לייצוא");
    const header = ["id", "page_number", "note_text", "highlight_text", "color", "created_at"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredAnnotations.map((a) =>
      header.map((h) => esc((a as any)[h])).join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    downloadBlob(csv, `embedpdf-annotations-${Date.now()}.csv`, "text/csv");
    toast.success("CSV יוצא בהצלחה");
  }, [filteredAnnotations]);

  // ── Add book ──
  const handleAddBook = useCallback(async () => {
    if (!newBookUrl.trim()) return toast.error("יש להזין קישור");
    await addBook.mutateAsync({
      title: newBookTitle.trim() || "מסמך ללא שם",
      fileUrl: newBookUrl.trim(),
    });
    setNewBookTitle("");
    setNewBookUrl("");
  }, [newBookTitle, newBookUrl, addBook]);

  // ─── Render ────────────────────────────────────────────────

  const panelCls = "bg-white border-[#D4AF37]/40";
  const pillCls = "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#0B1F5B]";

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#0B1F5B]">
      {/* ── Header ── */}
      <header className="border-b-2 border-[#D4AF37] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-xl font-bold text-[#0B1F5B]">EmbedPDF Viewer</h1>
            <Badge className="text-xs bg-[#D4AF37]/15 text-[#0B1F5B] border-[#D4AF37]/50">חדש</Badge>
          </div>

          <Separator orientation="vertical" className="h-6 bg-[#D4AF37]/30 hidden sm:block" />

          {/* View mode buttons */}
          <div className="flex gap-1">
            {(["single", "split", "compare"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewMode === mode ? "default" : "outline"}
                className={viewMode === mode
                  ? "bg-[#0B1F5B] text-white hover:bg-[#0B1F5B]/90"
                  : "border-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/10"}
                onClick={() => setViewMode(mode)}
              >
                {mode === "single" ? "יחיד" : mode === "split" ? "מפוצל" : "השוואה"}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body: 3-column grid ── */}
      <div className={`max-w-[1600px] mx-auto p-4 gap-4 ${viewerFullscreen ? "" : "grid grid-cols-1 xl:grid-cols-12"}`} style={{ minHeight: "calc(100vh - 64px)" }}>

        {/* ═══ LEFT SIDEBAR: PDF List ═══ */}
        {!viewerFullscreen && (
        <aside className="xl:col-span-3 space-y-4">
          {/* Add book */}
          <Card className={`${panelCls} border-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                <Plus className="h-4 w-4 text-[#D4AF37]" /> הוספת מסמך
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="שם המסמך"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
              />
              <Input
                placeholder="קישור PDF (URL)"
                value={newBookUrl}
                onChange={(e) => setNewBookUrl(e.target.value)}
                className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
                dir="ltr"
              />
              <Button size="sm" className="w-full bg-[#0B1F5B] text-white hover:bg-[#0B1F5B]/90 border-2 border-[#D4AF37]" onClick={handleAddBook} disabled={addBook.isPending}>
                {addBook.isPending ? "שומר..." : "הוסף"}
              </Button>
            </CardContent>
          </Card>

          {/* Manual URL */}
          <Card className={`${panelCls} border-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                <ExternalLink className="h-4 w-4 text-[#D4AF37]" /> קישור ידני
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="הדבק URL של PDF..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
                dir="ltr"
              />
              {viewMode !== "single" && (
                <Input
                  placeholder="URL להשוואה..."
                  value={compareManualUrl}
                  onChange={(e) => setCompareManualUrl(e.target.value)}
                  className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
                  dir="ltr"
                />
              )}
            </CardContent>
          </Card>

          {/* Book list */}
          <Card className={`${panelCls} border-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                <BookOpen className="h-4 w-4 text-[#D4AF37]" /> מסמכים ({books.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                {books.length === 0 ? (
                  <p className="text-xs text-[#0B1F5B]/50 text-center py-4">אין מסמכים עדיין</p>
                ) : (
                  <div className="space-y-1">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                          selectedPdfId === book.id ? "bg-[#D4AF37]/20 font-semibold border border-[#D4AF37]/40" : "hover:bg-[#D4AF37]/5"
                        }`}
                        onClick={() => setSelectedPdfId(book.id)}
                      >
                        <span className="truncate flex-1 text-[#0B1F5B]">{book.title}</span>
                        <div className="flex items-center gap-1">
                          {viewMode !== "single" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-[#0B1F5B]"
                              title="בחר להשוואה"
                              onClick={(e) => { e.stopPropagation(); setComparePdfId(book.id); }}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteBook.mutate(book.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Stats & Export */}
          <Card className={`${panelCls} border-2 bg-[#FAFAF5]`}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-xs text-[#0B1F5B]">
                <span>אנוטציות:</span>
                <Badge variant="secondary" className={pillCls}>{annotations.length}</Badge>
              </div>
              <div className="flex justify-between text-xs text-[#0B1F5B]">
                <span>סימניות:</span>
                <Badge variant="secondary" className={pillCls}>{bookmarks.length}</Badge>
              </div>
              <Separator className="bg-[#D4AF37]/20" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs border-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/10" onClick={handleExportJSON}>
                  <Download className="h-3 w-3 ml-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs border-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/10" onClick={handleExportCSV}>
                  <Download className="h-3 w-3 ml-1" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
        )}

        {/* ═══ CENTER: PDF Viewer ═══ */}
        <main className={`${viewerFullscreen ? "" : "xl:col-span-6"} flex flex-col gap-4`}>
          {leftSourceUrl ? (
            <Card className={`${panelCls} border-2 flex-1`}>
              <CardContent className="p-0 h-full flex flex-col" style={{ minHeight: viewerFullscreen ? "calc(100vh - 120px)" : "600px" }}>
                {/* Viewer URL bar */}
                <div className="px-3 py-2 border-b-2 border-[#D4AF37]/30 flex items-center gap-2 text-xs text-[#0B1F5B]/60" dir="ltr">
                  <FileText className="h-3 w-3 text-[#D4AF37]" />
                  <span className="truncate flex-1">{leftSourceUrl}</span>
                  <div className="flex items-center gap-1">
                    <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer" title="פתח בחלון חדש">
                      <ExternalLink className="h-3.5 w-3.5 text-[#0B1F5B]/50 hover:text-[#0B1F5B]" />
                    </a>
                    <button onClick={() => setViewerFullscreen(v => !v)} title={viewerFullscreen ? "צמצם" : "הגדל"}>
                      {viewerFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-[#0B1F5B]/50 hover:text-[#0B1F5B]" /> : <Maximize2 className="h-3.5 w-3.5 text-[#0B1F5B]/50 hover:text-[#0B1F5B]" />}
                    </button>
                  </div>
                </div>
                {/* ═══ TEXT FORMATTING TOOLBAR ═══ */}
                {leftContentType === 'text' && fetchedText !== null && (
                  <div className="border-b-2 border-[#D4AF37]/20 bg-white/80 backdrop-blur-sm">
                    {/* Main toolbar row */}
                    <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
                      {/* Font selector */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-[#D4AF37]/40 text-[#0B1F5B] gap-1">
                            <Type className="h-3 w-3" />
                            {FONTS.find(f => f.value === textFormat.fontFamily)?.label || "גופן"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-36 p-1" align="start">
                          {FONTS.map(f => (
                            <button
                              key={f.value}
                              className={`w-full text-right px-2 py-1.5 text-xs rounded hover:bg-[#D4AF37]/10 ${textFormat.fontFamily === f.value ? "bg-[#D4AF37]/20 font-bold" : ""}`}
                              onClick={() => updateFormat({ fontFamily: f.value })}
                            >
                              {f.label}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Font size controls */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.max(10, textFormat.fontSize - 1) })} title="הקטן גופן">
                        <AArrowDown className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <span className="text-xs font-mono min-w-[2rem] text-center text-[#0B1F5B]">{textFormat.fontSize}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.min(36, textFormat.fontSize + 1) })} title="הגדל גופן">
                        <AArrowUp className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Bold / Italic / Underline */}
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isBold ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isBold: !textFormat.isBold })} title="מודגש">
                        <Bold className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isItalic ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isItalic: !textFormat.isItalic })} title="נטוי">
                        <Italic className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isUnderline ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isUnderline: !textFormat.isUnderline })} title="קו תחתון">
                        <Underline className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Text alignment */}
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "right" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "right" })} title="ימין">
                        <AlignRight className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "center" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "center" })} title="מרכז">
                        <AlignCenter className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "left" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "left" })} title="שמאל">
                        <AlignLeft className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "justify" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "justify" })} title="מיושר">
                        <AlignJustify className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Line height */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" title="מרווח שורות">
                            <PilcrowSquare className="h-3.5 w-3.5 text-[#0B1F5B]" />
                            <span className="text-[10px] text-[#0B1F5B]/60">{textFormat.lineHeight}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-28 p-1" align="start">
                          {[1.2, 1.5, 1.8, 2.0, 2.5, 3.0].map(lh => (
                            <button
                              key={lh}
                              className={`w-full text-right px-2 py-1 text-xs rounded hover:bg-[#D4AF37]/10 ${textFormat.lineHeight === lh ? "bg-[#D4AF37]/20 font-bold" : ""}`}
                              onClick={() => updateFormat({ lineHeight: lh })}
                            >
                              {lh}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Zoom */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.max(10, textFormat.fontSize - 2) })} title="הקטן">
                        <ZoomOut className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.min(36, textFormat.fontSize + 2) })} title="הגדל">
                        <ZoomIn className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Line numbers toggle */}
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.showLineNumbers ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ showLineNumbers: !textFormat.showLineNumbers })} title="מספרי שורות">
                        <ListOrdered className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      {/* Word wrap toggle */}
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.wordWrap ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ wordWrap: !textFormat.wordWrap })} title="גלישת שורות">
                        <WrapText className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      <div className="w-px h-5 bg-[#D4AF37]/20" />

                      {/* Search toggle */}
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${showTextSearch ? "bg-[#D4AF37]/20" : ""}`} onClick={() => setShowTextSearch(v => !v)} title="חיפוש בטקסט">
                        <Search className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      {/* Copy all */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(fetchedText); toast.success("כל הטקסט הועתק"); }} title="העתק הכל">
                        <Copy className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      {/* Print */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        const win = window.open("", "_blank");
                        if (win) {
                          win.document.write(`<html dir="rtl"><head><title>הדפסה</title><style>body{font-family:serif;font-size:${textFormat.fontSize}px;line-height:${textFormat.lineHeight};text-align:${textFormat.textAlign};padding:40px;white-space:pre-wrap;}</style></head><body>${fetchedText.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`);
                          win.document.close();
                          win.print();
                        }
                      }} title="הדפסה">
                        <Printer className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      {/* Reset format */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTextFormat(DEFAULT_FORMAT)} title="אפס עיצוב">
                        <RotateCcw className="h-3.5 w-3.5 text-[#0B1F5B]" />
                      </Button>

                      {/* Spacer + word count */}
                      <div className="flex-1" />
                      <span className="text-[10px] text-[#0B1F5B]/40">
                        {textStats.words} מילים · {textStats.lines} שורות · {textStats.chars} תווים
                      </span>
                    </div>

                    {/* Search bar */}
                    {showTextSearch && (
                      <div className="px-2 pb-1.5 flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-[#D4AF37]" />
                        <Input
                          placeholder="חפש בטקסט..."
                          value={textSearch}
                          onChange={(e) => setTextSearch(e.target.value)}
                          className="h-7 text-xs flex-1 border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]"
                          autoFocus
                        />
                        {textSearchResults.length > 0 && (
                          <>
                            <span className="text-[10px] text-[#0B1F5B]/60 whitespace-nowrap">
                              {currentSearchIdx + 1}/{textSearchResults.length}
                            </span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCurrentSearchIdx(i => (i - 1 + textSearchResults.length) % textSearchResults.length)}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCurrentSearchIdx(i => (i + 1) % textSearchResults.length)}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {textSearch && textSearchResults.length === 0 && (
                          <span className="text-[10px] text-red-500">לא נמצא</span>
                        )}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setShowTextSearch(false); setTextSearch(""); }}>
                          <Trash2 className="h-3 w-3 text-[#0B1F5B]/40" />
                        </Button>
                      </div>
                    )}

                    {/* Highlights list */}
                    {textHighlights.length > 0 && (
                      <div className="px-2 pb-1.5 flex items-center gap-1 flex-wrap">
                        <Highlighter className="h-3 w-3 text-[#D4AF37]" />
                        {textHighlights.map((hl) => (
                          <Badge
                            key={hl.id}
                            variant="secondary"
                            className="text-[10px] cursor-pointer hover:opacity-70 gap-1"
                            style={{ backgroundColor: hl.color + "44" }}
                            onClick={() => setTextHighlights(prev => prev.filter(h => h.id !== hl.id))}
                          >
                            "{hl.text.slice(0, 15)}{hl.text.length > 15 ? "..." : ""}" ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Document Viewer — smart strategy per file type */}
                <div className="flex-1 relative bg-[#f8f8f6]">
                  {/* TEXT files — rendered directly */}
                  {leftContentType === 'text' && (
                    <>
                      {fetchingText && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="text-center space-y-2">
                            <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-[#0B1F5B]/50">טוען מסמך טקסט...</p>
                          </div>
                        </div>
                      )}
                      {fetchTextError && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
                          <div className="text-center space-y-3 p-6">
                            <FileText className="h-12 w-12 mx-auto text-[#D4AF37]/40" />
                            <p className="text-sm text-[#0B1F5B]/70">שגיאה בטעינת הטקסט: {fetchTextError}</p>
                            <div className="flex gap-2 justify-center flex-wrap">
                              <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B]" onClick={() => {
                                setFetchTextError(null);
                                setFetchedText(null);
                                // Re-trigger fetch by resetting URL
                                const url = leftSourceUrl;
                                setManualUrl("");
                                setTimeout(() => setManualUrl(url), 50);
                              }}>
                                <RefreshCw className="h-3.5 w-3.5 ml-1" /> נסה שוב
                              </Button>
                              <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]">
                                  <ExternalLink className="h-3.5 w-3.5 ml-1" /> פתח בחלון חדש
                                </Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                      {fetchedText !== null && (
                        <ScrollArea className="absolute inset-0">
                          <div
                            ref={textViewerRef}
                            onMouseUp={handleTextSelection}
                            className={`p-4 text-[#0B1F5B] ${textFormat.fontFamily} select-text`}
                            dir="rtl"
                            style={{
                              fontSize: `${textFormat.fontSize}px`,
                              lineHeight: textFormat.lineHeight,
                              textAlign: textFormat.textAlign,
                              fontWeight: textFormat.isBold ? "bold" : "normal",
                              fontStyle: textFormat.isItalic ? "italic" : "normal",
                              textDecoration: textFormat.isUnderline ? "underline" : "none",
                              whiteSpace: textFormat.wordWrap ? "pre-wrap" : "pre",
                            }}
                          >
                            {textFormat.showLineNumbers ? (
                              <div className="flex">
                                <div className="pr-3 pl-3 border-l-2 border-[#D4AF37]/20 text-[#0B1F5B]/25 text-right select-none" style={{ fontSize: `${Math.max(10, textFormat.fontSize - 2)}px`, minWidth: "3rem" }}>
                                  {fetchedText.split("\n").map((_, i) => (
                                    <div key={i}>{i + 1}</div>
                                  ))}
                                </div>
                                <div className="flex-1 pr-3">{renderedText}</div>
                              </div>
                            ) : (
                              renderedText
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </>
                  )}

                  {/* IMAGE files — rendered with img tag */}
                  {leftContentType === 'image' && (
                    <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
                      <img
                        src={leftSourceUrl}
                        alt="מסמך"
                        className="max-w-full max-h-full object-contain"
                        onLoad={() => setIframeLoaded(true)}
                        onError={() => setIframeError(true)}
                      />
                    </div>
                  )}

                  {/* HTML-PAGE — external sites that block iframe embedding */}
                  {leftContentType === 'html-page' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                      <div className="text-center space-y-4 p-8 max-w-md">
                        <ExternalLink className="h-16 w-16 mx-auto text-[#D4AF37]" />
                        <h3 className="text-lg font-semibold text-[#0B1F5B]">דף אינטרנט חיצוני</h3>
                        <p className="text-sm text-[#0B1F5B]/60">
                          דף זה מגיע מאתר חיצוני ולא ניתן להציגו במסגרת. לחץ לפתיחה בחלון חדש.
                        </p>
                        <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="lg" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37] hover:bg-[#0B1F5B]/90 text-base px-8">
                            <ExternalLink className="h-5 w-5 ml-2" /> פתח בחלון חדש
                          </Button>
                        </a>
                        <p className="text-xs text-[#0B1F5B]/40 break-all" dir="ltr">{leftSourceUrl}</p>
                      </div>
                    </div>
                  )}

                  {/* PDF / DOCX files — rendered in iframe */}
                  {(leftContentType === 'pdf' || leftContentType === 'docx') && (
                    <>
                      {!iframeLoaded && !iframeError && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="text-center space-y-2">
                            <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-[#0B1F5B]/50">טוען מסמך...</p>
                          </div>
                        </div>
                      )}
                      {iframeError && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
                          <div className="text-center space-y-3 p-6">
                            <FileText className="h-12 w-12 mx-auto text-[#D4AF37]/40" />
                            <p className="text-sm text-[#0B1F5B]/70">לא ניתן לטעון את המסמך במסגרת</p>
                            <div className="flex gap-2 justify-center flex-wrap">
                              <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B]" onClick={() => { setIframeError(false); setIframeLoaded(false); }}>
                                <RefreshCw className="h-3.5 w-3.5 ml-1" /> נסה שוב
                              </Button>
                              {leftContentType !== 'docx' && (
                                <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B]" onClick={() => {
                                  setIframeError(false);
                                  setIframeLoaded(false);
                                  setManualUrl(`https://docs.google.com/gview?url=${encodeURIComponent(leftSourceUrl)}&embedded=true`);
                                }}>
                                  נסה דרך Google Viewer
                                </Button>
                              )}
                              <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]">
                                  <ExternalLink className="h-3.5 w-3.5 ml-1" /> פתח בחלון חדש
                                </Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                      <iframe
                        key={leftViewerUrl}
                        src={leftViewerUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        title="PDF Viewer"
                        allow="fullscreen"
                        onLoad={() => setIframeLoaded(true)}
                        onError={() => setIframeError(true)}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={`${panelCls} border-2 flex-1 flex items-center justify-center`} style={{ minHeight: "600px" }}>
              <div className="text-center space-y-3 p-8">
                <FileText className="h-16 w-16 mx-auto text-[#D4AF37]/30" />
                <p className="text-[#0B1F5B]/50 text-sm">בחר מסמך מהרשימה או הדבק קישור</p>
              </div>
            </Card>
          )}

          {/* Second viewer for split/compare */}
          {viewMode !== "single" && rightSourceUrl && (
            <Card className={`${panelCls} border-2 flex-1`}>
              <CardContent className="p-0 h-full flex flex-col" style={{ minHeight: "400px" }}>
                <div className="px-3 py-2 border-b-2 border-[#D4AF37]/30 flex items-center gap-2 text-xs text-[#0B1F5B]/60" dir="ltr">
                  <FileText className="h-3 w-3 text-[#D4AF37]" />
                  <span className="truncate flex-1">{rightSourceUrl}</span>
                </div>
                <div className="flex-1 relative bg-[#f8f8f6]">
                  <iframe
                    src={rightViewerUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    title="PDF Viewer (compare)"
                    allow="fullscreen"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* ═══ RIGHT SIDEBAR: Annotation Desk ═══ */}
        {!viewerFullscreen && (
        <aside className="xl:col-span-3 space-y-4">
          {/* Annotation form */}
          <Card className={`${panelCls} border-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                <Palette className="h-4 w-4 text-[#D4AF37]" /> שולחן אנוטציות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Page number */}
              <div className="flex items-center gap-2">
                <label className="text-xs whitespace-nowrap text-[#0B1F5B]">עמוד:</label>
                <Input
                  type="number"
                  min={1}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  className="text-sm w-20 border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
                />
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs whitespace-nowrap text-[#0B1F5B]">צבע:</label>
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      annotationColor === c.value ? "border-[#0B1F5B] scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => setAnnotationColor(c.value)}
                  />
                ))}
              </div>

              {/* Highlight text */}
              <Input
                placeholder="טקסט מודגש (אופציונלי)"
                value={highlightText}
                onChange={(e) => setHighlightText(e.target.value)}
                className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
              />

              {/* Note text */}
              <Textarea
                placeholder="כתוב הערה..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="text-sm min-h-[80px] border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#0B1F5B] text-white hover:bg-[#0B1F5B]/90 border-2 border-[#D4AF37]"
                  onClick={handleSaveAnnotation}
                  disabled={addAnnotation.isPending}
                >
                  {addAnnotation.isPending ? "שומר..." : "שמור אנוטציה"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/10"
                  onClick={handleAddBookmark}
                  disabled={addBookmark.isPending}
                  title="הוסף סימניה לעמוד הנוכחי"
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>

              {!canPersist && leftSourceUrl && (
                <p className="text-xs text-[#D4AF37]">
                  שמירה למסד נתונים זמינה רק למסמך שנבחר מהרשימה
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <Card className={`${panelCls} border-2`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                  <Bookmark className="h-4 w-4 text-[#D4AF37]" /> סימניות ({bookmarks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-1">
                    {bookmarks.map((bm) => (
                      <div key={bm.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-[#D4AF37]/5">
                        <span className="text-[#0B1F5B]">🔖 {bm.title}</span>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-red-600" onClick={() => deleteBookmark.mutate(bm.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Annotation search & list */}
          <Card className={`${panelCls} border-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-[#0B1F5B]">
                <Search className="h-4 w-4 text-[#D4AF37]" /> הערות ({filteredAnnotations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="חיפוש בהערות..."
                value={annotationSearch}
                onChange={(e) => setAnnotationSearch(e.target.value)}
                className="text-sm border-[#D4AF37]/30 text-[#0B1F5B] focus-visible:ring-[#D4AF37]"
              />
              <ScrollArea className="max-h-[350px]">
                {filteredAnnotations.length === 0 ? (
                  <p className="text-xs text-[#0B1F5B]/40 text-center py-4">
                    {annotationsLoading ? "טוען..." : "אין הערות"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAnnotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-2 rounded-md border border-[#D4AF37]/30 text-xs space-y-1 text-[#0B1F5B]"
                        style={{ borderRightColor: ann.color, borderRightWidth: 3 }}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px] bg-[#D4AF37]/15 text-[#0B1F5B] border-[#D4AF37]/30">עמוד {ann.page_number}</Badge>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-red-600" onClick={() => deleteAnnotation.mutate(ann.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {ann.highlight_text && (
                          <p className="text-[#0B1F5B]/70 italic" style={{ backgroundColor: ann.color + "33", padding: "2px 4px", borderRadius: 2 }}>
                            "{ann.highlight_text}"
                          </p>
                        )}
                        <p className="text-[#0B1F5B]">{ann.note_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
        )}
      </div>

      {/* ═══ SELECTION POPUP ═══ */}
      {selectionPopup && (
        <SelectionPopup
          position={{ x: selectionPopup.x, y: selectionPopup.y }}
          selectedText={selectionPopup.text}
          onHighlight={handlePopupHighlight}
          onAnnotate={handlePopupAnnotate}
          onCopy={handlePopupCopy}
          onSearch={handlePopupSearch}
          onClose={() => setSelectionPopup(null)}
        />
      )}
    </div>
  );
}
