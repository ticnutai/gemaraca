import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FileText, Bookmark, Download, Search, Trash2, Plus, ExternalLink, BookOpen,
  Palette, Maximize2, Minimize2, RefreshCw, Bold, Italic, Underline, AlignRight,
  AlignCenter, AlignLeft, AlignJustify, Type, AArrowUp, AArrowDown, Highlighter,
  Copy, MessageSquarePlus, Hash, ZoomIn, ZoomOut, ChevronUp, ChevronDown,
  RotateCcw, Printer, StickyNote, Scissors, ClipboardPaste, Sparkles, Eye, Strikethrough,
  ListOrdered, WrapText, PilcrowSquare, ArrowRight, Link, BarChart3,
  Upload, HardDrive, Database, Loader2 as Loader2Icon, Save, CopyPlus, Columns, GripVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { usePDFAnnotations, type PDFAnnotation } from "@/hooks/usePDFAnnotations";
import { useUserBooks, type UserBook } from "@/hooks/useUserBooks";
import { supabase } from "@/integrations/supabase/client";
import PsakDinViewDialog from "@/components/PsakDinViewDialog";
import { TEMPLATES, generateFromTemplate } from "@/lib/psakDinTemplates";
import { parsePsakDinText } from "@/lib/psakDinParser";


// ─── Constants ───────────────────────────────────────────────

const VIEW_MODE_STORAGE_KEY = "embedpdf-view-mode-v1";
const EDITED_TEXT_STORAGE_PREFIX = "embedpdf-edited-text-v1:";

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

const IFRAME_FONTS = [
  { css: "Arial, sans-serif", label: "אריאל" },
  { css: "Times New Roman, serif", label: "טיימס" },
  { css: "Courier New, monospace", label: "מונו" },
  { css: "David Libre, David, serif", label: "דוד" },
  { css: "Frank Ruhl Libre, serif", label: "פרנק רוהל" },
  { css: "Rubik, sans-serif", label: "רוביק" },
  { css: "Noto Sans Hebrew, sans-serif", label: "נוטו" },
  { css: "Heebo, sans-serif", label: "חיבו" },
  { css: "Assistant, sans-serif", label: "אסיסטנט" },
  { css: "Georgia, serif", label: "ג׳ורג׳יה" },
  { css: "Tahoma, sans-serif", label: "טאהומה" },
];

// ─── Typography Popover for iframe formatting ────────────────
function TypographyPopover({ iframeRef, source }: { iframeRef: React.RefObject<HTMLIFrameElement>; source: string }) {
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [currentFont, setCurrentFont] = useState("Arial, sans-serif");

  const getDoc = () => iframeRef.current?.contentDocument ?? null;

  // Apply whole-page style
  const applyBodyStyle = (prop: string, val: string) => {
    const doc = getDoc();
    if (doc?.body) (doc.body.style as any)[prop] = val;
  };

  // Apply to selection via execCommand or CSS wrap
  const applyToSelection = (prop: string, val: string) => {
    const doc = getDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      doc.execCommand('styleWithCSS', false, 'true');
      // For fontName we can use execCommand directly
      if (prop === 'fontFamily') {
        doc.execCommand('fontName', false, val);
      } else if (prop === 'fontSize') {
        // Wrap selection in span with font-size
        const range = sel.getRangeAt(0);
        const span = doc.createElement('span');
        span.style.fontSize = val;
        try {
          range.surroundContents(span);
        } catch {
          // If surroundContents fails (partial selection), use insertHTML
          const html = `<span style="font-size:${val}">${range.toString()}</span>`;
          doc.execCommand('insertHTML', false, html);
        }
      } else {
        const range = sel.getRangeAt(0);
        const span = doc.createElement('span');
        (span.style as any)[prop] = val;
        try {
          range.surroundContents(span);
        } catch {
          const escaped = range.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const html = `<span style="${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}:${val}">${escaped}</span>`;
          doc.execCommand('insertHTML', false, html);
        }
      }
    } else {
      // No selection — apply to whole page
      applyBodyStyle(prop, val);
    }
  };

  const handleFontChange = (fontCss: string) => {
    setCurrentFont(fontCss);
    applyToSelection('fontFamily', fontCss);
  };

  const handleFontSizeChange = (val: number[]) => {
    const v = val[0];
    setFontSize(v);
    applyBodyStyle('fontSize', `${v}px`);
  };

  const handleFontSizeSelection = (val: number[]) => {
    const v = val[0];
    setFontSize(v);
    applyToSelection('fontSize', `${v}px`);
  };

  const handleLineHeightChange = (val: number[]) => {
    const v = val[0];
    setLineHeight(v);
    applyBodyStyle('lineHeight', `${v}`);
  };

  const handleLetterSpacingChange = (val: number[]) => {
    const v = val[0];
    setLetterSpacing(v);
    applyBodyStyle('letterSpacing', `${v}px`);
  };

  const handleAlign = (align: string) => {
    const doc = getDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      doc.execCommand(`justify${align}`, false);
    } else {
      applyBodyStyle('textAlign', align.toLowerCase() === 'full' ? 'justify' : align.toLowerCase());
    }
  };

  const sliderThumb = "[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5";

  return (
    <div className="w-64 space-y-3 p-1" dir="rtl">
      <p className="text-[11px] font-bold text-[#0B1F5B] border-b border-[#D4AF37]/30 pb-1">עיצוב טקסט</p>

      {/* Font Family */}
      <div>
        <p className="text-[10px] text-[#0B1F5B]/70 mb-1">גופן</p>
        <div className="grid grid-cols-3 gap-1">
          {IFRAME_FONTS.map(f => (
            <button
              key={f.css}
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleFontChange(f.css)}
              className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
                currentFont === f.css
                  ? 'bg-[#D4AF37] text-[#0B1F5B] border-[#D4AF37] font-bold'
                  : 'border-[#D4AF37]/30 hover:bg-[#D4AF37]/10'
              }`}
              style={{ fontFamily: f.css }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size — whole page */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-[#0B1F5B]/70">גודל גופן (כל העמוד)</p>
          <span className="text-[10px] font-mono text-[#D4AF37]">{fontSize}px</span>
        </div>
        <Slider
          value={[fontSize]} onValueChange={handleFontSizeChange}
          min={10} max={36} step={1}
          className={`${sliderThumb} [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-[#0B1F5B]`}
        />
      </div>

      {/* Font Size — selection only */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-[#0B1F5B]/70">גודל גופן (לבחירה)</p>
          <span className="text-[10px] font-mono text-[#D4AF37]">{fontSize}px</span>
        </div>
        <Slider
          value={[fontSize]} onValueChange={handleFontSizeSelection}
          min={10} max={48} step={1}
          className={`${sliderThumb} [&_[role=slider]]:bg-[#0B1F5B] [&_[role=slider]]:border-[#D4AF37]`}
        />
      </div>

      {/* Line Height */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-[#0B1F5B]/70">מרווח שורות</p>
          <span className="text-[10px] font-mono text-[#D4AF37]">{lineHeight.toFixed(1)}</span>
        </div>
        <Slider
          value={[lineHeight]} onValueChange={handleLineHeightChange}
          min={1} max={3.5} step={0.1}
          className={`${sliderThumb} [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-[#0B1F5B]`}
        />
      </div>

      {/* Letter Spacing */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-[#0B1F5B]/70">מרווח אותיות</p>
          <span className="text-[10px] font-mono text-[#D4AF37]">{letterSpacing}px</span>
        </div>
        <Slider
          value={[letterSpacing]} onValueChange={handleLetterSpacingChange}
          min={-2} max={10} step={0.5}
          className={`${sliderThumb} [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-[#0B1F5B]`}
        />
      </div>

      {/* Alignment */}
      <div>
        <p className="text-[10px] text-[#0B1F5B]/70 mb-1">יישור</p>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" className="h-7 w-7 border-[#D4AF37]/30" onMouseDown={e => e.preventDefault()} onClick={() => handleAlign('Right')}>
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7 border-[#D4AF37]/30" onMouseDown={e => e.preventDefault()} onClick={() => handleAlign('Center')}>
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7 border-[#D4AF37]/30" onMouseDown={e => e.preventDefault()} onClick={() => handleAlign('Left')}>
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7 border-[#D4AF37]/30" onMouseDown={e => e.preventDefault()} onClick={() => handleAlign('Full')}>
            <AlignJustify className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick reset */}
      <Button size="sm" variant="ghost" className="w-full text-[10px] text-[#0B1F5B]/60 h-6" onClick={() => {
        setFontSize(16); setLineHeight(1.6); setLetterSpacing(0); setCurrentFont("Arial, sans-serif");
        const doc = getDoc();
        if (doc?.body) {
          doc.body.style.fontSize = ''; doc.body.style.lineHeight = ''; doc.body.style.letterSpacing = '';
          doc.body.style.fontFamily = ''; doc.body.style.textAlign = '';
        }
      }}>
        <RotateCcw className="h-3 w-3 ml-1" /> איפוס עיצוב
      </Button>
    </div>
  );
}

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

const TEXT_COLORS_POPUP = [
  { value: "#000000", label: "שחור" },
  { value: "#0B1F5B", label: "כחול כהה" },
  { value: "#b91c1c", label: "אדום" },
  { value: "#15803d", label: "ירוק" },
  { value: "#7e22ce", label: "סגול" },
  { value: "#b45309", label: "כתום" },
  { value: "#D4AF37", label: "זהב" },
];

function SelectionPopup({
  position,
  selectedText,
  onHighlight,
  onAnnotate,
  onCopy,
  onSearch,
  onClose,
  onFormat,
  canEdit,
}: {
  position: { x: number; y: number };
  selectedText: string;
  onHighlight: (color: string) => void;
  onAnnotate: () => void;
  onCopy: () => void;
  onSearch: () => void;
  onClose: () => void;
  onFormat?: (command: string, value?: string) => void;
  canEdit?: boolean;
}) {
  const [showColors, setShowColors] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);

  const popupBtn = "p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors";
  const popupBtnGold = "p-1.5 rounded-lg text-[#D4AF37] hover:text-[#D4AF37] hover:bg-white/10 transition-colors";
  const sep = <div className="w-px h-5 bg-white/20" />;

  return (
    <div
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
    >
      <div className="bg-[#0B1F5B] rounded-xl shadow-2xl border-2 border-[#D4AF37] p-1.5 flex items-center gap-0.5 flex-wrap max-w-[420px]">
        {/* Copy */}
        <button onClick={onCopy} className={popupBtn} title="העתק"><Copy className="h-4 w-4" /></button>
        {sep}

        {/* Highlight */}
        <div className="relative">
          <button onClick={() => { setShowColors(!showColors); setShowTextColors(false); }} className={popupBtnGold} title="הדגש">
            <Highlighter className="h-4 w-4" />
          </button>
          {showColors && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white rounded-lg shadow-xl border-2 border-[#D4AF37] p-2 flex gap-1.5 z-50">
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c.value} onClick={() => { onHighlight(c.value); setShowColors(false); }} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} title={c.label} />
              ))}
            </div>
          )}
        </div>
        {sep}

        {/* Annotate */}
        <button onClick={onAnnotate} className={popupBtn} title="הוסף הערה"><MessageSquarePlus className="h-4 w-4" /></button>
        {sep}

        {/* Search */}
        <button onClick={onSearch} className={popupBtn} title="חפש"><Search className="h-4 w-4" /></button>

        {/* ── Advanced editing (only when editable context) ── */}
        {canEdit && onFormat && (
          <>
            {sep}
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('bold')} className={popupBtn} title="מודגש"><Bold className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('italic')} className={popupBtn} title="נטוי"><Italic className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('underline')} className={popupBtn} title="קו תחתון"><Underline className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('strikeThrough')} className={popupBtn} title="קו חוצה"><Strikethrough className="h-4 w-4" /></button>
            {sep}
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('fontSize', '2')} className={popupBtn} title="הקטן גופן"><AArrowDown className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('fontSize', '5')} className={popupBtn} title="הגדל גופן"><AArrowUp className="h-4 w-4" /></button>
            {sep}
            {/* Font family picker for selection */}
            <div className="relative">
              <button onMouseDown={e => e.preventDefault()} onClick={() => { setShowFontPicker(!showFontPicker); setShowColors(false); setShowTextColors(false); }} className={popupBtn} title="שנה גופן">
                <Type className="h-4 w-4" />
              </button>
              {showFontPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white rounded-lg shadow-xl border-2 border-[#D4AF37] p-2 grid grid-cols-2 gap-1 z-50 w-44">
                  {IFRAME_FONTS.map((f) => (
                    <button key={f.css} onMouseDown={e => e.preventDefault()} onClick={() => { onFormat('fontName', f.css); setShowFontPicker(false); }} className="text-[10px] px-2 py-1.5 rounded border border-[#D4AF37]/30 hover:bg-[#D4AF37]/10 text-[#0B1F5B] transition-colors text-right" style={{ fontFamily: f.css }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sep}
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('justifyRight')} className={popupBtn} title="ימין"><AlignRight className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('justifyCenter')} className={popupBtn} title="מרכז"><AlignCenter className="h-4 w-4" /></button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('justifyLeft')} className={popupBtn} title="שמאל"><AlignLeft className="h-4 w-4" /></button>
            {sep}
            {/* Text color picker */}
            <div className="relative">
              <button onMouseDown={e => e.preventDefault()} onClick={() => { setShowTextColors(!showTextColors); setShowColors(false); }} className={popupBtn} title="צבע טקסט">
                <Palette className="h-4 w-4" />
              </button>
              {showTextColors && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 bg-white rounded-lg shadow-xl border-2 border-[#D4AF37] p-2 flex gap-1.5 z-50">
                  {TEXT_COLORS_POPUP.map((c) => (
                    <button key={c.value} onMouseDown={e => e.preventDefault()} onClick={() => { onFormat('foreColor', c.value); setShowTextColors(false); }} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              )}
            </div>
            {sep}
            <button onMouseDown={e => e.preventDefault()} onClick={() => onFormat('removeFormat')} className={popupBtn} title="נקה עיצוב"><RotateCcw className="h-4 w-4" /></button>
          </>
        )}

        {sep}
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
  const navigate = useNavigate();
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [comparePdfId, setComparePdfId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState(() => searchParams.get("url") || "");
  const [compareManualUrl, setCompareManualUrl] = useState("");
  const [targetPane, setTargetPane] = useState<"left" | "right">("left");
  const [viewerFullscreen, setViewerFullscreen] = useState(false);
  const [regularViewerOpen, setRegularViewerOpen] = useState(false);

  // ── Psak Din context (for beautify) ──
  const psakIdParam = searchParams.get("psakId");
  const [psakData, setPsakData] = useState<any>(null);
  const [beautifiedHtml, setBeautifiedHtml] = useState<string | null>(null);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [isSavingBeautified, setIsSavingBeautified] = useState(false);
  const [isSavingHtmlEmbed, setIsSavingHtmlEmbed] = useState(false);
  const beautifyIframeRef = useRef<HTMLIFrameElement>(null);
  const htmlEmbedIframeRef = useRef<HTMLIFrameElement>(null);
  const [htmlEditMode, setHtmlEditMode] = useState(false);

  // Fetch psak din data when psakId is provided
  useEffect(() => {
    if (!psakIdParam) { setPsakData(null); return; }
    (async () => {
      const { data } = await (supabase as any).from("psakei_din").select("*").eq("id", psakIdParam).single();
      if (data) setPsakData(data);
    })();
  }, [psakIdParam]);

  const handleBeautify = useCallback(async () => {
    if (!psakData) { toast.error("לא נמצא פסק דין לעיצוב"); return; }
    setIsBeautifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("beautify-psak-din", {
        body: {
          title: psakData.title,
          court: psakData.court,
          year: psakData.year,
          caseNumber: psakData.case_number,
          summary: psakData.summary,
          fullText: psakData.full_text,
          tags: psakData.tags,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "שגיאה בעיצוב");
      setBeautifiedHtml(data.html);
      setActivePanel("beautify");
      toast.success("פסק הדין עוצב בהצלחה!");
    } catch (err: unknown) {
      console.error("Beautify error:", err);
      toast.error(err instanceof Error ? err.message : "שגיאה בעיצוב פסק הדין");
    } finally {
      setIsBeautifying(false);
    }
  }, [psakData]);

  // Add book form
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookUrl, setNewBookUrl] = useState("");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode) || "single";
    } catch { return "single"; }
  });

  // Split pane resizing
  const [splitRatio, setSplitRatio] = useState(50); // percentage for left pane
  const isDraggingSplitter = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitter.current || !mainRef.current) return;
      e.preventDefault();
      const rect = mainRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, pct)));
    };
    const onMouseUp = () => {
      if (isDraggingSplitter.current) {
        isDraggingSplitter.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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
    x: number; y: number; text: string; source: 'text' | 'html-embed' | 'html-page' | 'beautify';
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
  const { books, addBook, deleteBook, updateBookEditedText } = useUserBooks();
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

  // ── Save Beautified Handlers ──
  const handleSaveBeautified = useCallback(async () => {
    if (!beautifiedHtml) return;
    const docId = psakData?.id || selectedPdf?.id || `manual-${Date.now()}`;
    setIsSavingBeautified(true);
    try {
      const doc = beautifyIframeRef.current?.contentDocument;
      const currentHtml = doc?.documentElement?.outerHTML || beautifiedHtml;
      // 1. Upload to Supabase Storage (cloud)
      const fileName = `beautified/${docId}-${Date.now()}.html`;
      const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);
      // 2. Save to psakei_din DB if psakData exists
      if (psakData?.id) {
        const { error } = await supabase.from("psakei_din").update({ full_text: currentHtml, source_url: urlData?.publicUrl || undefined }).eq("id", psakData.id);
        if (error) throw error;
      }
      // 3. Save to user_books DB if selectedPdf exists
      if (canPersist && selectedPdf?.id) {
        await updateBookEditedText.mutateAsync({ id: selectedPdf.id, editedText: currentHtml });
      }
      toast.success("פסק הדין המעוצב נשמר בענן ובמסד הנתונים");
    } catch (err: unknown) {
      toast.error("שגיאה בשמירת פסק הדין המעוצב");
    } finally {
      setIsSavingBeautified(false);
    }
  }, [psakData, beautifiedHtml, canPersist, selectedPdf?.id, updateBookEditedText]);

  const handleCopyAndSaveBeautified = useCallback(async () => {
    if (!beautifiedHtml) return;
    setIsSavingBeautified(true);
    try {
      const doc = beautifyIframeRef.current?.contentDocument;
      const currentHtml = doc?.documentElement?.outerHTML || beautifiedHtml;
      const newId = crypto.randomUUID();
      // 1. Upload to Supabase Storage (cloud)
      const fileName = `beautified/${newId}.html`;
      const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);
      const newUrl = urlData?.publicUrl || null;
      // 2. Insert into psakei_din DB if psakData exists
      if (psakData) {
        const { error } = await supabase.from("psakei_din").insert({
          id: newId,
          title: `${psakData.title} (מעוצב)`,
          court: psakData.court || "",
          year: psakData.year || new Date().getFullYear(),
          case_number: psakData.case_number || null,
          summary: psakData.summary || "",
          full_text: currentHtml,
          source_url: newUrl,
          tags: [...(psakData.tags || []), "מעוצב"],
        });
        if (error) throw error;
      }
      // 3. Add as new user_book
      if (newUrl) {
        const title = psakData?.title || selectedPdf?.title || "מסמך מעוצב";
        await addBook.mutateAsync({ title: `${title} (עותק)`, fileUrl: newUrl });
      }
      toast.success("פסק הדין המעוצב שוכפל ונשמר בענן ובמסד הנתונים");
    } catch (err: unknown) {
      toast.error("שגיאה בהעתקה ושמירה");
    } finally {
      setIsSavingBeautified(false);
    }
  }, [psakData, beautifiedHtml, selectedPdf?.title, addBook]);

  // Smart viewer strategy: detect if URL is a direct file (PDF/TXT/DOCX) or an HTML page
  type ContentViewType = 'pdf' | 'text' | 'docx' | 'image' | 'html-embed' | 'html-page';

  const detectContentType = useCallback((url: string): ContentViewType => {
    if (!url) return 'html-page';
    const lower = url.toLowerCase();
    // Decode URL to catch encoded extensions in storage paths
    let decoded = lower;
    try { decoded = decodeURIComponent(lower); } catch {}
    if (/\.(pdf)(\?|#|$)/.test(decoded) || /\.(pdf)(\?|#|$)/.test(lower)) return 'pdf';
    if (/\.(txt|text|log|csv|md)(\?|#|$)/.test(decoded) || /\.(txt|text|log|csv|md)(\?|#|$)/.test(lower)) return 'text';
    if (/\.(docx?|rtf|odt|xls|xlsx|ppt|pptx)(\?|#|$)/.test(decoded) || /\.(docx?|rtf|odt|xls|xlsx|ppt|pptx)(\?|#|$)/.test(lower)) return 'docx';
    if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|#|$)/.test(decoded) || /\.(png|jpg|jpeg|gif|svg|webp|bmp)(\?|#|$)/.test(lower)) return 'image';
    if (/\.(html?|htm)(\?|#|$)/.test(decoded) || /\.(html?|htm)(\?|#|$)/.test(lower)) return 'html-embed';
    // Check if it's a known storage URL with html/pdf in path (beautified files etc.)
    if (lower.includes('supabase.co/storage') && decoded.includes('.html')) return 'html-embed';
    if (lower.includes('supabase.co/storage') && decoded.includes('.pdf')) return 'pdf';
    // Supabase storage URLs that contain known file names in path
    if (lower.includes('supabase.co/storage')) {
      // Try to detect from the path segments
      if (/\bpdf\b/.test(decoded)) return 'pdf';
      if (/\b(docx?|rtf)\b/.test(decoded)) return 'docx';
      if (/\b(txt|text)\b/.test(decoded)) return 'text';
      if (/\b(png|jpg|jpeg|webp)\b/.test(decoded)) return 'image';
    }
    return 'html-page';
  }, []);

  const getViewerUrl = useCallback((url: string, type: ContentViewType): string => {
    if (!url) return "";
    switch (type) {
      case 'pdf':
      case 'image':
      case 'html-embed':
        return url;
      case 'text':
      case 'html-page':
        return url;
      case 'docx':
        return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }
  }, []);

  const leftContentType = detectContentType(leftSourceUrl);
  const rightContentType = detectContentType(rightSourceUrl);
  const leftViewerUrl = getViewerUrl(leftSourceUrl, leftContentType);
  const rightViewerUrl = getViewerUrl(rightSourceUrl, rightContentType);

  // ── Right pane HTML fetch (for html-embed in split/compare) ──
  const [rightFetchedHtml, setRightFetchedHtml] = useState<string | null>(null);
  const [rightFetchingHtml, setRightFetchingHtml] = useState(false);
  const rightIframeRef = useRef<HTMLIFrameElement>(null);

  // ── Template switcher per pane ──
  const [leftTemplate, setLeftTemplate] = useState<string | null>(null);
  const [rightTemplate, setRightTemplate] = useState<string | null>(null);
  const [leftTemplateHtml, setLeftTemplateHtml] = useState<string | null>(null);
  const [rightTemplateHtml, setRightTemplateHtml] = useState<string | null>(null);

  // Iframe loading state
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Text content state (for .txt files fetched via JS)
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [fetchingText, setFetchingText] = useState(false);
  const [fetchTextError, setFetchTextError] = useState<string | null>(null);
  const [fetchedHtml, setFetchedHtml] = useState<string | null>(null);
  const [fetchingHtml, setFetchingHtml] = useState(false);
  const [fetchHtmlError, setFetchHtmlError] = useState<string | null>(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [textEditBuffer, setTextEditBuffer] = useState("");

  const currentTextStorageKey = useMemo(() => {
    if (!leftSourceUrl) return null;
    return `${EDITED_TEXT_STORAGE_PREFIX}${leftSourceUrl}`;
  }, [leftSourceUrl]);

  // Reset loading state when URL changes
  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
    setFetchedText(null);
    setFetchTextError(null);
    setFetchedHtml(null);
    setFetchHtmlError(null);
    setIsTextEditing(false);
    setTextEditBuffer("");
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
          let finalText = text;

          // Priority 1: cloud-edited text for selected documents
          if (canPersist && selectedPdf?.edited_text) {
            finalText = selectedPdf.edited_text;
          }

          // Priority 2: local edited text cache (for manual URLs)
          if (!canPersist && currentTextStorageKey) {
            try {
              const locallyEdited = localStorage.getItem(currentTextStorageKey);
              if (locallyEdited !== null) {
                finalText = locallyEdited;
              }
            } catch {
              // ignore localStorage issues
            }
          }
          setFetchedText(finalText);
          setTextEditBuffer(finalText);
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
  }, [leftSourceUrl, leftContentType, currentTextStorageKey, canPersist, selectedPdf?.edited_text]);

  // Fetch HTML content for beautified .html files and render via srcDoc
  useEffect(() => {
    if (leftContentType !== 'html-embed' || !leftSourceUrl) return;
    let cancelled = false;
    setFetchingHtml(true);
    setFetchHtmlError(null);

    fetch(leftSourceUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buffer = await r.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
      })
      .then((html) => {
        if (cancelled) return;
        setFetchedHtml(html);
        setFetchingHtml(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchHtmlError(err.message);
        setFetchingHtml(false);
      });

    return () => { cancelled = true; };
  }, [leftSourceUrl, leftContentType]);

  // ── Save HTML Embed Handlers ──
  const handleSaveHtmlEmbed = useCallback(async () => {
    const docId = psakData?.id || selectedPdf?.id || `manual-${Date.now()}`;
    setIsSavingHtmlEmbed(true);
    try {
      const doc = htmlEmbedIframeRef.current?.contentDocument;
      const currentHtml = doc?.documentElement?.outerHTML || fetchedHtml || "";
      // 1. Upload to Supabase Storage (cloud)
      const fileName = `html-embed/${docId}-${Date.now()}.html`;
      const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);
      // 2. Save to psakei_din DB if psakData exists
      if (psakData?.id) {
        const { error } = await supabase.from("psakei_din").update({ full_text: currentHtml, source_url: urlData?.publicUrl || undefined }).eq("id", psakData.id);
        if (error) throw error;
      }
      // 3. Save to user_books DB if selectedPdf exists
      if (canPersist && selectedPdf?.id) {
        await updateBookEditedText.mutateAsync({ id: selectedPdf.id, editedText: currentHtml });
      }
      toast.success("המסמך נשמר בענן ובמסד הנתונים");
    } catch (err: unknown) {
      toast.error("שגיאה בשמירת המסמך");
    } finally {
      setIsSavingHtmlEmbed(false);
    }
  }, [psakData, fetchedHtml, canPersist, selectedPdf?.id, updateBookEditedText]);

  const handleCopyAndSaveHtmlEmbed = useCallback(async () => {
    setIsSavingHtmlEmbed(true);
    try {
      const doc = htmlEmbedIframeRef.current?.contentDocument;
      const currentHtml = doc?.documentElement?.outerHTML || fetchedHtml || "";
      const newId = crypto.randomUUID();
      // 1. Upload to Supabase Storage (cloud)
      const fileName = `html-embed/${newId}.html`;
      const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);
      const newUrl = urlData?.publicUrl || null;
      // 2. Insert into psakei_din DB if psakData exists
      if (psakData) {
        const { error } = await supabase.from("psakei_din").insert({
          id: newId,
          title: `${psakData.title} (עותק)`,
          court: psakData.court || "",
          year: psakData.year || new Date().getFullYear(),
          case_number: psakData.case_number || null,
          summary: psakData.summary || "",
          full_text: currentHtml,
          source_url: newUrl,
          tags: [...(psakData.tags || []), "עותק"],
        });
        if (error) throw error;
      }
      // 3. Add as new user_book
      if (newUrl) {
        const title = psakData?.title || selectedPdf?.title || "מסמך";
        await addBook.mutateAsync({ title: `${title} (עותק)`, fileUrl: newUrl });
      }
      toast.success("המסמך שוכפל ונשמר בענן ובמסד הנתונים");
    } catch (err: unknown) {
      toast.error("שגיאה בשכפול ושמירה");
    } finally {
      setIsSavingHtmlEmbed(false);
    }
  }, [psakData, fetchedHtml, selectedPdf?.title, addBook]);

  // ── Duplicate & open in compare mode ──
  const handleDuplicateAndCompare = useCallback(async (source: 'beautify' | 'html-embed') => {
    const iframeRef = source === 'beautify' ? beautifyIframeRef : htmlEmbedIframeRef;
    const fallbackHtml = source === 'beautify' ? beautifiedHtml : fetchedHtml;
    const doc = iframeRef.current?.contentDocument;
    const currentHtml = doc?.documentElement?.outerHTML || fallbackHtml || "";
    if (!currentHtml) { toast.error("אין תוכן לשכפול"); return; }

    try {
      const newId = crypto.randomUUID();
      const fileName = `compare/${newId}.html`;
      const blob = new Blob([currentHtml], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);
      const newUrl = urlData?.publicUrl;
      if (!newUrl) { toast.error("שגיאה ביצירת קישור"); return; }

      const title = psakData?.title || selectedPdf?.title || "מסמך";
      await addBook.mutateAsync({ title: `${title} (עותק להשוואה)`, fileUrl: newUrl });

      setViewMode("split");
      setComparePdfId(null);
      setCompareManualUrl(newUrl);
      toast.success("המסמך שוכפל ונפתח במצב השוואה");
    } catch (err: unknown) {
      toast.error("שגיאה בשכפול להשוואה");
    }
  }, [beautifiedHtml, fetchedHtml, psakData, selectedPdf?.title, addBook]);

  // Fetch HTML for right pane when html-embed in split/compare
  useEffect(() => {
    if (rightContentType !== 'html-embed' || !rightSourceUrl) {
      setRightFetchedHtml(null);
      return;
    }
    let cancelled = false;
    setRightFetchingHtml(true);
    fetch(rightSourceUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buffer = await r.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
      })
      .then((html) => {
        if (!cancelled) { setRightFetchedHtml(html); setRightFetchingHtml(false); }
      })
      .catch(() => {
        if (!cancelled) { setRightFetchedHtml(null); setRightFetchingHtml(false); }
      });
    return () => { cancelled = true; };
  }, [rightSourceUrl, rightContentType]);

  // Apply template to a pane
  const applyTemplate = useCallback((pane: 'left' | 'right', templateId: string | null) => {
    if (pane === 'left') {
      setLeftTemplate(templateId);
      if (!templateId) { setLeftTemplateHtml(null); return; }
      // Extract text from fetched HTML or fetched text
      let rawText = fetchedText || '';
      if (!rawText && fetchedHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = fetchedHtml;
        rawText = tmp.textContent || '';
      }
      if (!rawText && psakData?.full_text) rawText = psakData.full_text;
      if (!rawText) { toast.error('אין טקסט לעיצוב'); setLeftTemplate(null); return; }
      try {
        const parsed = parsePsakDinText(rawText);
        if (psakData) {
          parsed.title = parsed.title || psakData.title || '';
          parsed.court = parsed.court || psakData.court || '';
          parsed.caseNumber = parsed.caseNumber || psakData.case_number || '';
        }
        setLeftTemplateHtml(generateFromTemplate(templateId, parsed));
      } catch { toast.error('שגיאה בהחלת תבנית'); setLeftTemplate(null); }
    } else {
      setRightTemplate(templateId);
      if (!templateId) { setRightTemplateHtml(null); return; }
      let rawText = '';
      if (rightFetchedHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = rightFetchedHtml;
        rawText = tmp.textContent || '';
      }
      if (!rawText && psakData?.full_text) rawText = psakData.full_text;
      if (!rawText) { toast.error('אין טקסט לעיצוב'); setRightTemplate(null); return; }
      try {
        const parsed = parsePsakDinText(rawText);
        if (psakData) {
          parsed.title = parsed.title || psakData.title || '';
          parsed.court = parsed.court || psakData.court || '';
          parsed.caseNumber = parsed.caseNumber || psakData.case_number || '';
        }
        setRightTemplateHtml(generateFromTemplate(templateId, parsed));
      } catch { toast.error('שגיאה בהחלת תבנית'); setRightTemplate(null); }
    }
  }, [fetchedText, fetchedHtml, rightFetchedHtml, psakData]);

  const startTextEdit = useCallback(() => {
    if (fetchedText === null) return;
    setTextEditBuffer(fetchedText);
    setIsTextEditing(true);
    setSelectionPopup(null);
  }, [fetchedText]);

  const cancelTextEdit = useCallback(() => {
    setTextEditBuffer(fetchedText ?? "");
    setIsTextEditing(false);
  }, [fetchedText]);

  const saveTextEdit = useCallback(async () => {
    const nextText = textEditBuffer;
    setFetchedText(nextText);
    setIsTextEditing(false);

    let savedToCloud = false;
    let savedToDb = false;

    // 1. Upload to Supabase Storage (cloud)
    try {
      const docId = selectedPdf?.id || `manual-${Date.now()}`;
      const fileName = `edited-text/${docId}-${Date.now()}.txt`;
      const blob = new Blob([nextText], { type: "text/plain;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/plain", upsert: true });
      savedToCloud = true;
    } catch {
      // Cloud upload failed, continue to DB save
    }

    // 2. Save to user_books DB if selectedPdf exists
    if (canPersist && selectedPdf?.id) {
      try {
        await updateBookEditedText.mutateAsync({
          id: selectedPdf.id,
          editedText: nextText,
        });
        savedToDb = true;
      } catch {
        // DB save failed
      }
    }

    // 3. Fallback to localStorage for manual URLs
    if (!savedToDb && currentTextStorageKey) {
      try {
        localStorage.setItem(currentTextStorageKey, nextText);
      } catch {
        // localStorage failed
      }
    }

    if (savedToCloud && savedToDb) {
      toast.success("הטקסט נשמר בענן ובמסד הנתונים");
    } else if (savedToCloud) {
      toast.success("הטקסט נשמר בענן");
    } else if (savedToDb) {
      toast.success("הטקסט נשמר במסד הנתונים");
    } else {
      toast.warning("הטקסט נשמר מקומית בלבד");
    }
  }, [textEditBuffer, currentTextStorageKey, canPersist, selectedPdf?.id, updateBookEditedText]);

  const clearTextEdit = useCallback(() => {
    if (!leftSourceUrl) return;
    setFetchingText(true);
    setFetchTextError(null);
    fetch(leftSourceUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        if (canPersist && selectedPdf?.id) {
          updateBookEditedText.mutate({
            id: selectedPdf.id,
            editedText: null,
          });
        } else if (currentTextStorageKey) {
          localStorage.removeItem(currentTextStorageKey);
        }
        setFetchedText(text);
        setTextEditBuffer(text);
        setIsTextEditing(false);
        setFetchingText(false);
        toast.success("הטקסט חזר לגרסה המקורית");
      })
      .catch(err => {
        setFetchTextError(err.message);
        setFetchingText(false);
        toast.error("לא ניתן לשחזר את הטקסט המקורי");
      });
  }, [leftSourceUrl, currentTextStorageKey, canPersist, selectedPdf?.id, updateBookEditedText]);

  useEffect(() => {
    if (!isTextEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveTextEdit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTextEditing, saveTextEdit]);

  // ── Text Selection Handler ──
  const handleTextSelection = useCallback((source: 'text' | 'html-embed' | 'html-page' | 'beautify' = 'text') => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
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
      source,
    });
  }, []);

  // ── Iframe selection handler (for html-embed / beautify iframes) ──
  const setupIframeSelectionListener = useCallback((iframe: HTMLIFrameElement | null, source: 'html-embed' | 'beautify') => {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const handler = () => {
        const sel = doc.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setTimeout(() => setSelectionPopup(null), 200);
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 2) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        // Offset by iframe position
        const iframeRect = iframe.getBoundingClientRect();
        setSelectionPopup({
          x: iframeRect.left + rect.left + rect.width / 2,
          y: iframeRect.top + rect.top - 12,
          text,
          source,
        });
      };
      doc.addEventListener('mouseup', handler);
      doc.addEventListener('keyup', handler);
    } catch {
      // cross-origin iframes will throw — ignore
    }
  }, []);

  // ── Format command handler for popup ──
  const handlePopupFormat = useCallback((command: string, value?: string) => {
    if (!selectionPopup) return;
    let doc: Document | null = null;
    if (selectionPopup.source === 'html-embed') {
      doc = htmlEmbedIframeRef.current?.contentDocument ?? null;
    } else if (selectionPopup.source === 'beautify') {
      doc = beautifyIframeRef.current?.contentDocument ?? null;
    }
    if (doc) {
      if (command === 'hiliteColor' || command === 'foreColor') {
        doc.execCommand('styleWithCSS', false, 'true');
      }
      doc.execCommand(command, false, value);
    }
  }, [selectionPopup]);

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

  const assignSourceToTarget = useCallback((sourceUrl: string, bookId?: string | null) => {
    if (targetPane === "right" && viewMode !== "single") {
      if (bookId) {
        setComparePdfId(bookId);
        setCompareManualUrl("");
      } else {
        setComparePdfId(null);
        setCompareManualUrl(sourceUrl);
      }
      return;
    }

    if (bookId) {
      setSelectedPdfId(bookId);
      setManualUrl("");
    } else {
      setSelectedPdfId(null);
      setManualUrl(sourceUrl);
    }
  }, [targetPane, viewMode]);

  // ── Add book ──
  const handleAddBook = useCallback(async () => {
    if (!newBookUrl.trim()) return toast.error("יש להזין קישור");
    const result = await addBook.mutateAsync({
      title: newBookTitle.trim() || "מסמך ללא שם",
      fileUrl: newBookUrl.trim(),
    });
    assignSourceToTarget(newBookUrl.trim(), result.id);
    setNewBookTitle("");
    setNewBookUrl("");
    setActivePanel(null);
  }, [newBookTitle, newBookUrl, addBook, assignSourceToTarget]);

  // ─── Active panel state ──
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const togglePanel = (id: string) => setActivePanel(prev => prev === id ? null : id);

  // ─── Render ────────────────────────────────────────────────

  const panelCls = "bg-white border-[#D4AF37]/40";
  const pillCls = "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#0B1F5B]";

  // File name from URL for tooltip
  const fileName = useMemo(() => {
    try {
      const url = leftSourceUrl || "";
      const parts = decodeURIComponent(url).split("/");
      return parts[parts.length - 1]?.split("?")[0] || "מסמך";
    } catch { return "מסמך"; }
  }, [leftSourceUrl]);

  // ── File upload state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const processFileUpload = useCallback(async (file: File) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|png|jpg|jpeg|webp|docx)$/i)) {
      toast.error("סוג קובץ לא נתמך. נתמכים: PDF, TXT, תמונות, DOCX");
      return;
    }
    setIsUploading(true);
    try {
      const filePath = `uploads/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('user-books').upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('user-books').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to get public URL");
      const result = await addBook.mutateAsync({
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        fileUrl: publicUrl,
      });
      assignSourceToTarget(publicUrl, result.id);
      setActivePanel(null);
      toast.success(`הקובץ "${file.name}" הועלה בהצלחה`);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(`שגיאה בהעלאה: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addBook, assignSourceToTarget]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFileUpload(file);
  }, [processFileUpload]);

  // ── Drag & Drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFileUpload(file);
  }, [processFileUpload]);

  // ── Cloud documents (from psakei_din with source_url) ──
  const [cloudDocs, setCloudDocs] = useState<any[]>([]);
  const [loadingCloudDocs, setLoadingCloudDocs] = useState(false);
  const [cloudSearch, setCloudSearch] = useState("");
  const [cloudCourtFilter, setCloudCourtFilter] = useState("all");
  const [cloudYearFilter, setCloudYearFilter] = useState("all");

  const loadCloudDocs = useCallback(async () => {
    setLoadingCloudDocs(true);
    try {
      const { data, error } = await supabase
        .from('psakei_din')
        .select('id, title, source_url, court, year')
        .not('source_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setCloudDocs(data || []);
    } catch (err) {
      toast.error("שגיאה בטעינת מסמכים מהענן");
    } finally {
      setLoadingCloudDocs(false);
    }
  }, []);

  // Derived: unique courts and years for filters
  const cloudCourts = useMemo(() => {
    const courts = new Set<string>();
    cloudDocs.forEach(d => { if (d.court) courts.add(d.court); });
    return Array.from(courts).sort();
  }, [cloudDocs]);

  const cloudYears = useMemo(() => {
    const years = new Set<number>();
    cloudDocs.forEach(d => { if (d.year) years.add(d.year); });
    return Array.from(years).sort((a, b) => b - a);
  }, [cloudDocs]);

  // Filtered cloud docs
  const filteredCloudDocs = useMemo(() => {
    return cloudDocs.filter(doc => {
      const matchesSearch = !cloudSearch.trim() || 
        doc.title?.toLowerCase().includes(cloudSearch.toLowerCase());
      const matchesCourt = cloudCourtFilter === "all" || doc.court === cloudCourtFilter;
      const matchesYear = cloudYearFilter === "all" || String(doc.year) === cloudYearFilter;
      return matchesSearch && matchesCourt && matchesYear;
    });
  }, [cloudDocs, cloudSearch, cloudCourtFilter, cloudYearFilter]);

  // Icon toolbar items
  const toolbarItems = [
    { id: "add", icon: Plus, label: "הוסף מסמך", badge: undefined },
    { id: "docs", icon: BookOpen, label: `מסמכים (${books.length})`, badge: books.length > 0 ? books.length : undefined },
    { id: "annotations", icon: Palette, label: "אנוטציות", badge: annotations.length > 0 ? annotations.length : undefined },
    { id: "bookmarks", icon: Bookmark, label: `סימניות (${bookmarks.length})`, badge: bookmarks.length > 0 ? bookmarks.length : undefined },
    { id: "stats", icon: BarChart3, label: "סטטיסטיקות", badge: undefined },
    ...(psakIdParam ? [{ id: "beautify", icon: Sparkles, label: "עצב פסק דין", badge: beautifiedHtml ? 1 : undefined }] : []),
  ];

  // Hidden file input
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#0B1F5B] flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag & Drop Overlay ── */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#0B1F5B]/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-4 border-dashed border-[#D4AF37] rounded-3xl p-16 text-center space-y-4 animate-pulse">
            <Upload className="h-20 w-20 mx-auto text-[#D4AF37]" />
            <p className="text-2xl font-bold text-white">שחרר כאן להעלאה</p>
            <p className="text-sm text-white/60">PDF, TXT, תמונות, DOCX</p>
          </div>
        </div>
      )}
      {/* ── Compact Header ── */}
      <header className="border-b-2 border-[#D4AF37] bg-white px-3 py-2 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 max-w-[1800px] mx-auto">
          {/* Back button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-[#0B1F5B] hover:bg-[#D4AF37]/10"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            title="חזור"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>

          {/* Home button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-[#0B1F5B] hover:bg-[#D4AF37]/10"
            onClick={() => navigate('/')}
            title="דף הבית"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </Button>

          <FileText className="h-5 w-5 text-[#D4AF37] shrink-0" />
          <h1 className="text-base font-bold text-[#0B1F5B] hidden sm:block">EmbedPDF</h1>

          <Separator orientation="vertical" className="h-5 bg-[#D4AF37]/30 hidden sm:block" />

          {/* View mode buttons */}
          <div className="flex gap-0.5">
            {(["single", "split", "compare"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewMode === mode ? "default" : "ghost"}
                className={`h-7 text-xs px-2 ${viewMode === mode
                  ? "bg-[#0B1F5B] text-white hover:bg-[#0B1F5B]/90"
                  : "text-[#0B1F5B]/60 hover:bg-[#D4AF37]/10"}`}
                onClick={() => setViewMode(mode)}
              >
                {mode === "single" ? "יחיד" : mode === "split" ? "מפוצל" : "השוואה"}
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          {/* File name tooltip icon */}
          {leftSourceUrl && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-[#D4AF37]/10 text-[#0B1F5B]/50 hover:text-[#0B1F5B]" title={fileName}>
                  <FileText className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[400px] p-2 text-xs" dir="ltr" align="end">
                <p className="break-all text-[#0B1F5B]/70">{leftSourceUrl}</p>
              </PopoverContent>
            </Popover>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Icon toolbar */}
          <div className="flex items-center gap-0.5 border border-[#D4AF37]/30 rounded-lg px-1 py-0.5 bg-[#D4AF37]/5">
            {toolbarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "add") {
                    loadCloudDocs();
                  }
                  togglePanel(item.id);
                }}
                className={`relative p-1.5 rounded-md transition-all ${
                  item.id === "upload" && isUploading
                    ? "bg-[#D4AF37] text-white animate-pulse"
                    : activePanel === item.id
                    ? "bg-[#0B1F5B] text-white"
                    : "text-[#0B1F5B]/60 hover:bg-[#D4AF37]/15 hover:text-[#0B1F5B]"
                }`}
                title={item.label}
                disabled={item.id === "upload" && isUploading}
              >
                {item.id === "upload" && isUploading ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <item.icon className="h-4 w-4" />
                )}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[#D4AF37] text-[#0B1F5B] text-[8px] font-bold px-0.5">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setViewerFullscreen(v => !v)}
            className="p-1.5 rounded-md text-[#0B1F5B]/50 hover:text-[#0B1F5B] hover:bg-[#D4AF37]/10"
            title={viewerFullscreen ? "צמצם" : "מסך מלא"}
          >
            {viewerFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* External link */}
          {leftSourceUrl && (
            <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-[#0B1F5B]/50 hover:text-[#0B1F5B] hover:bg-[#D4AF37]/10" title="פתח בחלון חדש">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          {psakData && (
            <button
              onClick={() => setRegularViewerOpen(true)}
              className="p-1.5 rounded-md text-[#0B1F5B]/50 hover:text-[#0B1F5B] hover:bg-[#D4AF37]/10"
              title="החלף לצפיין רגיל"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex-1 flex min-h-0">
        {/* Panel overlay (slides from right) */}
        {activePanel && (
          <aside className="w-72 xl:w-80 border-l-2 border-[#D4AF37]/30 bg-white flex-shrink-0 overflow-y-auto">
            <div className="p-3 space-y-3">
              {/* Close */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F5B]">
                  {toolbarItems.find(t => t.id === activePanel)?.label}
                </h3>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setActivePanel(null)}>
                  <Trash2 className="h-3 w-3 text-[#0B1F5B]/40" />
                </Button>
              </div>

              {/* ADD DOCUMENT (unified panel) */}
              {activePanel === "add" && (
                <div className="space-y-3">
                  {viewMode !== "single" && (
                    <div className="border border-[#D4AF37]/30 rounded-lg p-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-[#0B1F5B]">יעד הוספה</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={targetPane === "left" ? "default" : "outline"}
                          className={targetPane === "left" ? "h-7 flex-1 bg-[#0B1F5B] text-white" : "h-7 flex-1 border-[#D4AF37]"}
                          onClick={() => setTargetPane("left")}
                        >
                          צד שמאל
                        </Button>
                        <Button
                          size="sm"
                          variant={targetPane === "right" ? "default" : "outline"}
                          className={targetPane === "right" ? "h-7 flex-1 bg-[#0B1F5B] text-white" : "h-7 flex-1 border-[#D4AF37]"}
                          onClick={() => setTargetPane("right")}
                        >
                          צד ימין
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload from computer with drag & drop */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-3 space-y-2 transition-colors ${
                      isDragging ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-[#D4AF37]/30"
                    }`}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dragCounterRef.current = 0;
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processFileUpload(file);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#D4AF37]" />
                      <p className="text-xs font-semibold text-[#0B1F5B]">העלה מהמחשב</p>
                    </div>
                    <p className="text-[10px] text-[#0B1F5B]/40">PDF, TXT, תמונות, DOCX — גרור לכאן או לחץ</p>
                    <Button size="sm" className="w-full bg-[#0B1F5B] text-white border-2 border-[#D4AF37] gap-2" onClick={triggerFileUpload} disabled={isUploading}>
                      {isUploading ? <><Loader2Icon className="h-4 w-4 animate-spin" /> מעלה...</> : <><Upload className="h-4 w-4" /> בחר קובץ</>}
                    </Button>
                  </div>

                  {/* From cloud/database */}
                  <div className="border border-[#D4AF37]/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#D4AF37]" />
                      <p className="text-xs font-semibold text-[#0B1F5B]">מהמאגר</p>
                    </div>

                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#0B1F5B]/40" />
                      <Input
                        placeholder="חפש לפי שם..."
                        value={cloudSearch}
                        onChange={(e) => setCloudSearch(e.target.value)}
                        className="h-7 text-xs pr-7 border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]"
                      />
                    </div>

                    <div className="flex gap-1">
                      <select
                        value={cloudCourtFilter}
                        onChange={(e) => setCloudCourtFilter(e.target.value)}
                        className="flex-1 h-6 text-[10px] rounded border border-[#D4AF37]/30 bg-white text-[#0B1F5B] px-1"
                      >
                        <option value="all">כל בתי הדין</option>
                        {cloudCourts.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={cloudYearFilter}
                        onChange={(e) => setCloudYearFilter(e.target.value)}
                        className="w-16 h-6 text-[10px] rounded border border-[#D4AF37]/30 bg-white text-[#0B1F5B] px-1"
                      >
                        <option value="all">שנה</option>
                        {cloudYears.map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>

                    {cloudDocs.length > 0 && (
                      <p className="text-[10px] text-[#0B1F5B]/40">
                        {filteredCloudDocs.length} מתוך {cloudDocs.length} מסמכים
                      </p>
                    )}

                    {loadingCloudDocs ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2Icon className="h-5 w-5 animate-spin text-[#D4AF37]" />
                      </div>
                    ) : filteredCloudDocs.length === 0 ? (
                      <p className="text-[10px] text-[#0B1F5B]/40 text-center py-3">
                        {cloudDocs.length === 0 ? "אין מסמכים זמינים" : "לא נמצאו תוצאות"}
                      </p>
                    ) : (
                      <div className="overflow-y-auto max-h-[300px] border border-[#D4AF37]/20 rounded-md">
                        <div className="divide-y divide-[#D4AF37]/10">
                          {filteredCloudDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              className="w-full flex items-start gap-2 px-2 py-2 text-right hover:bg-[#D4AF37]/10 transition-colors"
                              onClick={() => {
                                assignSourceToTarget(doc.source_url, null);
                                setActivePanel(null);
                                toast.success(`נטען: ${doc.title || "מסמך"}`);
                              }}
                            >
                              <FileText className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0 text-right">
                                <p className="text-xs font-medium truncate" style={{ color: "#0B1F5B" }}>{doc.title || "ללא כותרת"}</p>
                                <p className="text-[10px]" style={{ color: "#0B1F5B99" }}>{doc.court || "—"} · {doc.year || "—"}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="w-full text-xs border-[#D4AF37] gap-1" onClick={loadCloudDocs} disabled={loadingCloudDocs}>
                      <RefreshCw className={`h-3 w-3 ${loadingCloudDocs ? "animate-spin" : ""}`} /> רענן
                    </Button>
                  </div>

                  {/* Manual URL */}
                  <div className="border border-[#D4AF37]/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-[#D4AF37]" />
                      <p className="text-xs font-semibold text-[#0B1F5B]">קישור ידני</p>
                    </div>
                    <Input placeholder="שם המסמך" value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} className="h-7 text-xs border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" />
                    <Input placeholder="הדבק URL..." value={newBookUrl} onChange={(e) => setNewBookUrl(e.target.value)} className="h-7 text-xs border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" dir="ltr" />
                    <Button size="sm" className="w-full bg-[#0B1F5B] text-white border-2 border-[#D4AF37] text-xs" onClick={handleAddBook} disabled={addBook.isPending}>
                      {addBook.isPending ? "שומר..." : "הוסף"}
                    </Button>
                  </div>
                </div>
              )}

              {/* DOCS LIST */}
              {activePanel === "docs" && (
                <div className="space-y-2">
                  {viewMode !== "single" && (
                    <div className="border border-[#D4AF37]/30 rounded-lg p-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-[#0B1F5B]">טעינה לרכיב</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={targetPane === "left" ? "default" : "outline"}
                          className={targetPane === "left" ? "h-7 flex-1 bg-[#0B1F5B] text-white" : "h-7 flex-1 border-[#D4AF37]"}
                          onClick={() => setTargetPane("left")}
                        >
                          שמאל
                        </Button>
                        <Button
                          size="sm"
                          variant={targetPane === "right" ? "default" : "outline"}
                          className={targetPane === "right" ? "h-7 flex-1 bg-[#0B1F5B] text-white" : "h-7 flex-1 border-[#D4AF37]"}
                          onClick={() => setTargetPane("right")}
                        >
                          ימין
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button size="sm" variant="outline" className="w-full text-xs border-[#D4AF37]" onClick={() => { loadCloudDocs(); setActivePanel("add"); }}>
                    <Plus className="h-3.5 w-3.5 ml-1" /> הוסף מסמך חדש
                  </Button>

                  <ScrollArea className="max-h-[360px]">
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
                            onClick={() => {
                              if (targetPane === "right" && viewMode !== "single") {
                                setComparePdfId(book.id);
                                setCompareManualUrl("");
                              } else {
                                setSelectedPdfId(book.id);
                                setManualUrl("");
                              }
                              setActivePanel(null);
                            }}
                          >
                            <span className="truncate flex-1 text-[#0B1F5B]">{book.title}</span>
                            <div className="flex items-center gap-1">
                              {viewMode !== "single" && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-[#0B1F5B]" title="בחר להשוואה" onClick={(e) => { e.stopPropagation(); setComparePdfId(book.id); }}>
                                  <FileText className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={(e) => { e.stopPropagation(); deleteBook.mutate(book.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* ANNOTATIONS */}
              {activePanel === "annotations" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs whitespace-nowrap">עמוד:</label>
                    <Input type="number" min={1} value={currentPage} onChange={(e) => setCurrentPage(e.target.value)} className="text-sm w-20 border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs whitespace-nowrap">צבע:</label>
                    {ANNOTATION_COLORS.map((c) => (
                      <button key={c.value} className={`w-5 h-5 rounded-full border-2 transition-transform ${annotationColor === c.value ? "border-[#0B1F5B] scale-110" : "border-transparent"}`} style={{ backgroundColor: c.value }} onClick={() => setAnnotationColor(c.value)} />
                    ))}
                  </div>
                  <Input placeholder="טקסט מודגש (אופציונלי)" value={highlightText} onChange={(e) => setHighlightText(e.target.value)} className="text-sm border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" />
                  <Textarea placeholder="כתוב הערה..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className="text-sm min-h-[60px] border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-[#0B1F5B] text-white border-2 border-[#D4AF37]" onClick={handleSaveAnnotation} disabled={addAnnotation.isPending}>
                      {addAnnotation.isPending ? "שומר..." : "שמור"}
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#D4AF37]" onClick={handleAddBookmark} disabled={addBookmark.isPending} title="סימניה">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>
                  {!canPersist && leftSourceUrl && <p className="text-[10px] text-[#D4AF37]">שמירה זמינה רק למסמך מהרשימה</p>}
                  {/* Annotations list */}
                  <Separator className="bg-[#D4AF37]/20" />
                  <Input placeholder="חיפוש בהערות..." value={annotationSearch} onChange={(e) => setAnnotationSearch(e.target.value)} className="text-xs border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" />
                  <ScrollArea className="max-h-[300px]">
                    {filteredAnnotations.length === 0 ? (
                      <p className="text-xs text-[#0B1F5B]/40 text-center py-3">{annotationsLoading ? "טוען..." : "אין הערות"}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredAnnotations.map((ann) => (
                          <div key={ann.id} className="p-2 rounded-md border border-[#D4AF37]/30 text-xs space-y-1" style={{ borderRightColor: ann.color, borderRightWidth: 3 }}>
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="text-[10px] bg-[#D4AF37]/15 border-[#D4AF37]/30">עמוד {ann.page_number}</Badge>
                              <Button size="icon" variant="ghost" className="h-5 w-5 text-red-600" onClick={() => deleteAnnotation.mutate(ann.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {ann.highlight_text && <p className="text-[#0B1F5B]/70 italic" style={{ backgroundColor: ann.color + "33", padding: "2px 4px", borderRadius: 2 }}>"{ann.highlight_text}"</p>}
                            <p>{ann.note_text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* BOOKMARKS */}
              {activePanel === "bookmarks" && (
                <ScrollArea className="max-h-[300px]">
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-[#0B1F5B]/40 text-center py-4">אין סימניות</p>
                  ) : (
                    <div className="space-y-1">
                      {bookmarks.map((bm) => (
                        <div key={bm.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-[#D4AF37]/5">
                          <span>🔖 {bm.title}</span>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-red-600" onClick={() => deleteBookmark.mutate(bm.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {/* STATS */}
              {activePanel === "stats" && (
                <div className="space-y-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>אנוטציות:</span><Badge variant="secondary" className={pillCls}>{annotations.length}</Badge></div>
                    <div className="flex justify-between"><span>סימניות:</span><Badge variant="secondary" className={pillCls}>{bookmarks.length}</Badge></div>
                  </div>
                  <Separator className="bg-[#D4AF37]/20" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs border-[#D4AF37]" onClick={handleExportJSON}>
                      <Download className="h-3 w-3 ml-1" /> JSON
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs border-[#D4AF37]" onClick={handleExportCSV}>
                      <Download className="h-3 w-3 ml-1" /> CSV
                    </Button>
                  </div>
                </div>
              )}

              {/* BEAUTIFY */}
              {activePanel === "beautify" && (
                <div className="space-y-3">
                  {!beautifiedHtml ? (
                    <div className="text-center py-4 space-y-3">
                      <Sparkles className="h-8 w-8 mx-auto text-[#D4AF37]" />
                      <p className="text-xs text-[#0B1F5B]/60">עצב את פסק הדין באמצעות AI</p>
                      <Button
                        size="sm"
                        className="w-full bg-[#0B1F5B] text-white border-2 border-[#D4AF37] gap-2"
                        onClick={handleBeautify}
                        disabled={isBeautifying || !psakData}
                      >
                        {isBeautifying ? <><Loader2Icon className="h-4 w-4 animate-spin" /> מעצב...</> : <><Sparkles className="h-4 w-4" /> עצב פסק דין ✨</>}
                      </Button>
                      {!psakData && <p className="text-[10px] text-red-500">טוען נתוני פסק דין...</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-green-600 font-semibold">✓ פסק הדין עוצב בהצלחה</p>
                      <Button size="sm" variant="outline" className="w-full text-xs gap-1 border-[#D4AF37]" onClick={handleBeautify} disabled={isBeautifying}>
                        {isBeautifying ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} עצב מחדש
                      </Button>
                      <Separator className="bg-[#D4AF37]/20" />
                      <p className="text-[10px] text-[#0B1F5B]/50">שמירה:</p>
                      <Button size="sm" className="w-full text-xs bg-[#0B1F5B] text-white border-2 border-[#D4AF37] gap-1" onClick={handleSaveBeautified} disabled={isSavingBeautified}>
                        {isSavingBeautified ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} שמור (דרוס מקור)
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs border-[#D4AF37] gap-1" onClick={handleCopyAndSaveBeautified} disabled={isSavingBeautified}>
                        {isSavingBeautified ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} העתק ושמור כחדש
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-xs border-[#D4AF37] gap-1 text-[#0B1F5B]" onClick={() => handleDuplicateAndCompare('beautify')}>
                        <Columns className="h-3 w-3" /> שכפול והשוואה
                      </Button>
                      <Separator className="bg-[#D4AF37]/20" />
                      <Button size="sm" variant="ghost" className="w-full text-xs gap-1" onClick={() => {
                        const win = window.open("", "_blank");
                        if (win) { win.document.write(beautifiedHtml); win.document.close(); win.print(); }
                      }}>
                        <Printer className="h-3 w-3" /> הדפס
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ═══ VIEWER ═══ */}
        <main ref={mainRef} className={`flex-1 min-w-0 ${viewMode === "split" ? "flex flex-row" : "flex flex-col"}`}>
          {leftSourceUrl ? (
            <div className="flex-1 flex flex-col" style={{ minHeight: viewerFullscreen ? "calc(100vh - 50px)" : "calc(100vh - 50px)", ...(viewMode === "split" ? { width: `${splitRatio}%`, flexShrink: 0, flexGrow: 0 } : {}) }}>
              {/* ═══ BEAUTIFIED FORMATTING TOOLBAR ═══ */}
              {beautifiedHtml && activePanel === "beautify" && (
                <div className="border-b-2 border-[#D4AF37]/20 bg-white/80 backdrop-blur-sm flex-shrink-0">
                  <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-[#D4AF37] font-semibold ml-2">עריכת מסמך מעוצב</span>
                    <div className="w-px h-5 bg-[#D4AF37]/20" />

                    {/* Typography T popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="עיצוב טקסט">
                          <Type className="h-4 w-4 text-[#D4AF37]" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start" side="bottom">
                        <TypographyPopover iframeRef={beautifyIframeRef} source="beautify" />
                      </PopoverContent>
                    </Popover>

                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("fontSize", false, "2");
                    }}><AArrowDown className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("fontSize", false, "5");
                    }}><AArrowUp className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("bold");
                    }}><Bold className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("italic");
                    }}><Italic className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("underline");
                    }}><Underline className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("justifyRight");
                    }}><AlignRight className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("justifyCenter");
                    }}><AlignCenter className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("justifyLeft");
                    }}><AlignLeft className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      beautifyIframeRef.current?.contentDocument?.execCommand("justifyFull");
                    }}><AlignJustify className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Highlighter className="h-3.5 w-3.5 text-[#D4AF37]" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start">
                        <div className="flex gap-1.5">
                          {HIGHLIGHT_COLORS.map((c) => (
                            <button key={c.value} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} onClick={() => {
                              beautifyIframeRef.current?.contentDocument?.execCommand("hiliteColor", false, c.value);
                            }} />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Palette className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start">
                        <div className="flex gap-1.5">
                          {["#000000", "#0B1F5B", "#b91c1c", "#15803d", "#7e22ce", "#b45309", "#D4AF37"].map((color) => (
                            <button key={color} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => {
                              beautifyIframeRef.current?.contentDocument?.execCommand("foreColor", false, color);
                            }} />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { beautifyIframeRef.current?.contentDocument?.execCommand("removeFormat"); }} title="הסר עיצוב"><RotateCcw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { beautifyIframeRef.current?.contentDocument?.execCommand("undo"); }} title="בטל"><RefreshCw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const sel = beautifyIframeRef.current?.contentDocument?.getSelection()?.toString() || "";
                      if (sel) { navigator.clipboard.writeText(sel); toast.success("הועתק"); }
                    }} title="העתק בחירה"><Copy className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const html = beautifyIframeRef.current?.contentDocument?.documentElement?.outerHTML || beautifiedHtml;
                      if (html) { const win = window.open("", "_blank"); if (win) { win.document.write(html); win.document.close(); win.print(); } }
                    }} title="הדפסה"><Printer className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveBeautified} disabled={isSavingBeautified} title="שמור (דריסה)">
                      {isSavingBeautified ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-[#0B1F5B]" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyAndSaveBeautified} disabled={isSavingBeautified} title="שכפול ושמירה">
                      {isSavingBeautified ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5 text-[#0B1F5B]" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicateAndCompare('beautify')} title="שכפול והשוואה">
                      <Columns className="h-3.5 w-3.5 text-[#0B1F5B]" />
                    </Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    {/* Template Switcher */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant={leftTemplate ? "default" : "outline"} className={`h-7 text-xs gap-1 ${leftTemplate ? 'bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/90' : 'border-[#D4AF37]/40'}`} title="החלף תבנית עיצוב">
                          <Sparkles className="h-3 w-3" />
                          {leftTemplate ? TEMPLATES.find(t => t.id === leftTemplate)?.name : 'תבניות'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1.5" align="start" dir="rtl">
                        <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">תבניות עיצוב פסק דין</p>
                        <button onClick={() => applyTemplate('left', null)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${!leftTemplate ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                          <span>📄</span> מקורי (ללא תבנית)
                        </button>
                        {TEMPLATES.filter(t => !t.requiresAi).map(t => (
                          <button key={t.id} onClick={() => applyTemplate('left', t.id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${leftTemplate === t.id ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                            <span>{t.icon}</span> {t.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* ═══ TEXT FORMATTING TOOLBAR ═══ */}
              {leftContentType === 'text' && fetchedText !== null && !(beautifiedHtml && activePanel === "beautify") && (
                <div className="border-b-2 border-[#D4AF37]/20 bg-white/80 backdrop-blur-sm flex-shrink-0">
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
                          <button key={f.value} className={`w-full text-right px-2 py-1.5 text-xs rounded hover:bg-[#D4AF37]/10 ${textFormat.fontFamily === f.value ? "bg-[#D4AF37]/20 font-bold" : ""}`} onClick={() => updateFormat({ fontFamily: f.value })}>
                            {f.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.max(10, textFormat.fontSize - 1) })}><AArrowDown className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <span className="text-xs font-mono min-w-[2rem] text-center">{textFormat.fontSize}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateFormat({ fontSize: Math.min(36, textFormat.fontSize + 1) })}><AArrowUp className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isBold ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isBold: !textFormat.isBold })}><Bold className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isItalic ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isItalic: !textFormat.isItalic })}><Italic className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.isUnderline ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ isUnderline: !textFormat.isUnderline })}><Underline className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "right" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "right" })}><AlignRight className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "center" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "center" })}><AlignCenter className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "left" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "left" })}><AlignLeft className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.textAlign === "justify" ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ textAlign: "justify" })}><AlignJustify className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><PilcrowSquare className="h-3.5 w-3.5 text-[#0B1F5B]" /><span className="text-[10px] text-[#0B1F5B]/60">{textFormat.lineHeight}</span></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-28 p-1" align="start">
                        {[1.2, 1.5, 1.8, 2.0, 2.5, 3.0].map(lh => (
                          <button key={lh} className={`w-full text-right px-2 py-1 text-xs rounded hover:bg-[#D4AF37]/10 ${textFormat.lineHeight === lh ? "bg-[#D4AF37]/20 font-bold" : ""}`} onClick={() => updateFormat({ lineHeight: lh })}>{lh}</button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.showLineNumbers ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ showLineNumbers: !textFormat.showLineNumbers })}><ListOrdered className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${textFormat.wordWrap ? "bg-[#D4AF37]/20" : ""}`} onClick={() => updateFormat({ wordWrap: !textFormat.wordWrap })}><WrapText className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${showTextSearch ? "bg-[#D4AF37]/20" : ""}`} onClick={() => setShowTextSearch(v => !v)}><Search className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    {!isTextEditing ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={startTextEdit} title="ערוך"><Scissors className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-[#D4AF37]" onClick={saveTextEdit}><ClipboardPaste className="h-3.5 w-3.5 ml-1" /> שמור</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelTextEdit}>ביטול</Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearTextEdit} title="שחזר"><RefreshCw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(fetchedText); toast.success("הועתק"); }} title="העתק"><Copy className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const win = window.open("", "_blank");
                      if (win) { win.document.write(`<html dir="rtl"><head><title>הדפסה</title><style>body{font-family:serif;font-size:${textFormat.fontSize}px;line-height:${textFormat.lineHeight};text-align:${textFormat.textAlign};padding:40px;white-space:pre-wrap;}</style></head><body>${fetchedText.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`); win.document.close(); win.print(); }
                    }} title="הדפסה"><Printer className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTextFormat(DEFAULT_FORMAT)} title="אפס"><RotateCcw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    {/* Template Switcher */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant={leftTemplate ? "default" : "outline"} className={`h-7 text-xs gap-1 ${leftTemplate ? 'bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/90' : 'border-[#D4AF37]/40'}`} title="החלף תבנית עיצוב">
                          <Sparkles className="h-3 w-3" />
                          {leftTemplate ? TEMPLATES.find(t => t.id === leftTemplate)?.name : 'תבניות'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1.5" align="start" dir="rtl">
                        <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">תבניות עיצוב פסק דין</p>
                        <button onClick={() => applyTemplate('left', null)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${!leftTemplate ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                          <span>📄</span> מקורי (ללא תבנית)
                        </button>
                        {TEMPLATES.filter(t => !t.requiresAi).map(t => (
                          <button key={t.id} onClick={() => applyTemplate('left', t.id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${leftTemplate === t.id ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                            <span>{t.icon}</span> {t.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    <div className="flex-1" />
                    <span className="text-[10px] text-[#0B1F5B]/40">{textStats.words} מילים · {textStats.lines} שורות</span>
                  </div>

                  {showTextSearch && (
                    <div className="px-2 pb-1.5 flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <Input placeholder="חפש בטקסט..." value={textSearch} onChange={(e) => setTextSearch(e.target.value)} className="h-7 text-xs flex-1 border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]" autoFocus />
                      {textSearchResults.length > 0 && (
                        <>
                          <span className="text-[10px] text-[#0B1F5B]/60 whitespace-nowrap">{currentSearchIdx + 1}/{textSearchResults.length}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCurrentSearchIdx(i => (i - 1 + textSearchResults.length) % textSearchResults.length)}><ChevronUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCurrentSearchIdx(i => (i + 1) % textSearchResults.length)}><ChevronDown className="h-3 w-3" /></Button>
                        </>
                      )}
                      {textSearch && textSearchResults.length === 0 && <span className="text-[10px] text-red-500">לא נמצא</span>}
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setShowTextSearch(false); setTextSearch(""); }}><Trash2 className="h-3 w-3 text-[#0B1F5B]/40" /></Button>
                    </div>
                  )}

                  {textHighlights.length > 0 && (
                    <div className="px-2 pb-1.5 flex items-center gap-1 flex-wrap">
                      <Highlighter className="h-3 w-3 text-[#D4AF37]" />
                      {textHighlights.map((hl) => (
                        <Badge key={hl.id} variant="secondary" className="text-[10px] cursor-pointer hover:opacity-70 gap-1" style={{ backgroundColor: hl.color + "44" }} onClick={() => setTextHighlights(prev => prev.filter(h => h.id !== hl.id))}>
                          "{hl.text.slice(0, 15)}{hl.text.length > 15 ? "..." : ""}" ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ HTML-EMBED EDITING TOOLBAR ═══ */}
              {leftContentType === 'html-embed' && fetchedHtml && !(beautifiedHtml && activePanel === "beautify") && (
                <div className="border-b-2 border-[#D4AF37]/20 bg-white/80 backdrop-blur-sm flex-shrink-0">
                  <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-[#D4AF37] font-semibold ml-2">עריכת מסמך HTML</span>
                    <div className="w-px h-5 bg-[#D4AF37]/20" />

                    <Button size="sm" variant={htmlEditMode ? "default" : "outline"} className={`h-7 text-xs gap-1 ${htmlEditMode ? "bg-[#D4AF37] text-[#0B1F5B]" : "border-[#D4AF37]/40"}`} onClick={() => {
                      const next = !htmlEditMode;
                      setHtmlEditMode(next);
                      const doc = htmlEmbedIframeRef.current?.contentDocument;
                      if (doc?.body) doc.designMode = next ? "on" : "off";
                    }}>
                      <Scissors className="h-3 w-3" />
                      {htmlEditMode ? "מצב עריכה פעיל" : "ערוך"}
                    </Button>

                    {htmlEditMode && (
                      <>
                        <div className="w-px h-5 bg-[#D4AF37]/20" />

                        {/* Typography T popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="עיצוב טקסט">
                              <Type className="h-4 w-4 text-[#D4AF37]" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start" side="bottom">
                            <TypographyPopover iframeRef={htmlEmbedIframeRef} source="html-embed" />
                          </PopoverContent>
                        </Popover>

                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("fontSize", false, "2"); }}><AArrowDown className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("fontSize", false, "5"); }}><AArrowUp className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                        <div className="w-px h-5 bg-[#D4AF37]/20" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("bold"); }}><Bold className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("italic"); }}><Italic className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("underline"); }}><Underline className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                        <div className="w-px h-5 bg-[#D4AF37]/20" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("justifyRight"); }}><AlignRight className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("justifyCenter"); }}><AlignCenter className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("justifyLeft"); }}><AlignLeft className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("justifyFull"); }}><AlignJustify className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

                        <div className="w-px h-5 bg-[#D4AF37]/20" />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><Highlighter className="h-3.5 w-3.5 text-[#D4AF37]" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <div className="flex gap-1.5">
                              {HIGHLIGHT_COLORS.map((c) => (
                                <button key={c.value} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} onClick={() => {
                                  htmlEmbedIframeRef.current?.contentDocument?.execCommand("hiliteColor", false, c.value);
                                }} />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><Palette className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <div className="flex gap-1.5">
                              {["#000000", "#0B1F5B", "#b91c1c", "#15803d", "#7e22ce", "#b45309", "#D4AF37"].map((color) => (
                                <button key={color} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => {
                                  htmlEmbedIframeRef.current?.contentDocument?.execCommand("foreColor", false, color);
                                }} />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div className="w-px h-5 bg-[#D4AF37]/20" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("removeFormat"); }} title="הסר עיצוב"><RotateCcw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { htmlEmbedIframeRef.current?.contentDocument?.execCommand("undo"); }} title="בטל"><RefreshCw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                      </>
                    )}

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const sel = htmlEmbedIframeRef.current?.contentDocument?.getSelection()?.toString() || fetchedHtml || "";
                      if (sel) { navigator.clipboard.writeText(sel); toast.success("הועתק"); }
                    }} title="העתק"><Copy className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const html = htmlEmbedIframeRef.current?.contentDocument?.documentElement?.outerHTML || fetchedHtml;
                      if (html) { const win = window.open("", "_blank"); if (win) { win.document.write(html); win.document.close(); win.print(); } }
                    }} title="הדפסה"><Printer className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="פתח בחלון חדש"><ExternalLink className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                    </a>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveHtmlEmbed} disabled={isSavingHtmlEmbed} title="שמור (דריסה)">
                      {isSavingHtmlEmbed ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-[#0B1F5B]" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyAndSaveHtmlEmbed} disabled={isSavingHtmlEmbed} title="שכפול ושמירה">
                      {isSavingHtmlEmbed ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5 text-[#0B1F5B]" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDuplicateAndCompare('html-embed')} title="שכפול והשוואה">
                      <Columns className="h-3.5 w-3.5 text-[#0B1F5B]" />
                    </Button>

                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    {/* Template Switcher */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant={leftTemplate ? "default" : "outline"} className={`h-7 text-xs gap-1 ${leftTemplate ? 'bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/90' : 'border-[#D4AF37]/40'}`} title="החלף תבנית עיצוב">
                          <Sparkles className="h-3 w-3" />
                          {leftTemplate ? TEMPLATES.find(t => t.id === leftTemplate)?.name : 'תבניות'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1.5" align="start" dir="rtl">
                        <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">תבניות עיצוב פסק דין</p>
                        <button onClick={() => applyTemplate('left', null)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${!leftTemplate ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                          <span>📄</span> מקורי (ללא תבנית)
                        </button>
                        {TEMPLATES.filter(t => !t.requiresAi).map(t => (
                          <button key={t.id} onClick={() => applyTemplate('left', t.id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${leftTemplate === t.id ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                            <span>{t.icon}</span> {t.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* ═══ HTML-PAGE TOOLBAR ═══ */}
              {leftContentType === 'html-page' && !(beautifiedHtml && activePanel === "beautify") && (
                <div className="border-b-2 border-[#D4AF37]/20 bg-white/80 backdrop-blur-sm flex-shrink-0">
                  <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-[#D4AF37] font-semibold ml-2">צפייה בדף חיצוני</span>
                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    {/* Template Switcher */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant={leftTemplate ? "default" : "outline"} className={`h-7 text-xs gap-1 ${leftTemplate ? 'bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#D4AF37]/90' : 'border-[#D4AF37]/40'}`} title="החלף תבנית עיצוב">
                          <Sparkles className="h-3 w-3" />
                          {leftTemplate ? TEMPLATES.find(t => t.id === leftTemplate)?.name : 'תבניות'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1.5" align="start" dir="rtl">
                        <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">תבניות עיצוב פסק דין</p>
                        <button onClick={() => applyTemplate('left', null)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${!leftTemplate ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                          <span>📄</span> מקורי (ללא תבנית)
                        </button>
                        {TEMPLATES.filter(t => !t.requiresAi).map(t => (
                          <button key={t.id} onClick={() => applyTemplate('left', t.id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${leftTemplate === t.id ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                            <span>{t.icon}</span> {t.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <div className="w-px h-5 bg-[#D4AF37]/20" />
                    <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#D4AF37]/40"><ExternalLink className="h-3 w-3" /> פתח בחלון חדש</Button>
                    </a>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#D4AF37]/40" onClick={() => { navigator.clipboard.writeText(leftSourceUrl); toast.success("הקישור הועתק"); }}><Copy className="h-3 w-3" /> העתק קישור</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#D4AF37]/40" onClick={() => { window.frames[0]?.print?.(); }}><Printer className="h-3 w-3" /> הדפסה</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#D4AF37]/40" asChild>
                      <a href={leftSourceUrl} download><Download className="h-3 w-3" /> הורד</a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Document Viewer */}
              <div className="flex-1 relative bg-[#f8f8f6]">
                {/* BEAUTIFIED VIEW */}
                {leftTemplateHtml && !beautifiedHtml ? (
                  <iframe srcDoc={leftTemplateHtml} className="absolute inset-0 w-full h-full border-0" title="Template View" sandbox="allow-same-origin allow-scripts allow-popups" />
                ) : beautifiedHtml && activePanel === "beautify" ? (
                  <iframe
                    ref={beautifyIframeRef}
                    srcDoc={beautifiedHtml}
                    className="absolute inset-0 w-full h-full border-0"
                    title="Beautified Psak Din"
                    sandbox="allow-same-origin allow-popups allow-scripts allow-modals"
                    onLoad={() => {
                      const doc = beautifyIframeRef.current?.contentDocument;
                      if (doc?.body) doc.designMode = "on";
                      setupIframeSelectionListener(beautifyIframeRef.current, 'beautify');
                    }}
                  />
                ) : (
                <>
                {/* TEXT */}
                {leftContentType === 'text' && (
                  <>
                    {fetchingText && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center space-y-2">
                          <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-[#0B1F5B]/50">טוען...</p>
                        </div>
                      </div>
                    )}
                    {fetchTextError && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
                        <div className="text-center space-y-3 p-6">
                          <FileText className="h-12 w-12 mx-auto text-[#D4AF37]/40" />
                          <p className="text-sm text-[#0B1F5B]/70">שגיאה: {fetchTextError}</p>
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" className="border-[#D4AF37]" onClick={() => { setFetchTextError(null); setFetchedText(null); const url = leftSourceUrl; setManualUrl(""); setTimeout(() => setManualUrl(url), 50); }}>
                              <RefreshCw className="h-3.5 w-3.5 ml-1" /> נסה שוב
                            </Button>
                            <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]"><ExternalLink className="h-3.5 w-3.5 ml-1" /> פתח</Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                    {fetchedText !== null && (
                      <ScrollArea className="absolute inset-0">
                        {isTextEditing ? (
                          <div className="p-4 h-full">
                            <Textarea
                              value={textEditBuffer}
                              onChange={(e) => setTextEditBuffer(e.target.value)}
                              className={`h-full min-h-[450px] resize-none text-[#0B1F5B] ${textFormat.fontFamily} border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]`}
                              dir="rtl"
                              style={{ fontSize: `${textFormat.fontSize}px`, lineHeight: textFormat.lineHeight, textAlign: textFormat.textAlign, fontWeight: textFormat.isBold ? "bold" : "normal", fontStyle: textFormat.isItalic ? "italic" : "normal", textDecoration: textFormat.isUnderline ? "underline" : "none", whiteSpace: textFormat.wordWrap ? "pre-wrap" : "pre" }}
                            />
                          </div>
                        ) : (
                          <div ref={textViewerRef} onMouseUp={() => handleTextSelection('text')} className={`p-4 text-[#0B1F5B] ${textFormat.fontFamily} select-text`} dir="rtl" style={{ fontSize: `${textFormat.fontSize}px`, lineHeight: textFormat.lineHeight, textAlign: textFormat.textAlign, fontWeight: textFormat.isBold ? "bold" : "normal", fontStyle: textFormat.isItalic ? "italic" : "normal", textDecoration: textFormat.isUnderline ? "underline" : "none", whiteSpace: textFormat.wordWrap ? "pre-wrap" : "pre" }}>
                            {textFormat.showLineNumbers ? (
                              <div className="flex">
                                <div className="pr-3 pl-3 border-l-2 border-[#D4AF37]/20 text-[#0B1F5B]/25 text-right select-none" style={{ fontSize: `${Math.max(10, textFormat.fontSize - 2)}px`, minWidth: "3rem" }}>
                                  {fetchedText.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
                                </div>
                                <div className="flex-1 pr-3">{renderedText}</div>
                              </div>
                            ) : renderedText}
                          </div>
                        )}
                      </ScrollArea>
                    )}
                  </>
                )}

                {/* IMAGE */}
                {leftContentType === 'image' && (
                  <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
                    <img src={leftSourceUrl} alt="מסמך" className="max-w-full max-h-full object-contain" onLoad={() => setIframeLoaded(true)} onError={() => setIframeError(true)} />
                  </div>
                )}

                {/* HTML-EMBED */}
                {leftContentType === 'html-embed' && (
                  <>
                    {fetchingHtml && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center space-y-2">
                          <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-[#0B1F5B]/50">טוען HTML...</p>
                        </div>
                      </div>
                    )}
                    {fetchHtmlError && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
                        <div className="text-center space-y-3 p-6">
                          <FileText className="h-12 w-12 mx-auto text-[#D4AF37]/40" />
                          <p className="text-sm text-[#0B1F5B]/70">לא ניתן לטעון את הקובץ</p>
                          <p className="text-xs text-[#0B1F5B]/50">{fetchHtmlError}</p>
                          <div className="flex gap-2 justify-center flex-wrap">
                            <Button size="sm" variant="outline" className="border-[#D4AF37]" onClick={() => { setFetchHtmlError(null); setFetchedHtml(null); const url = leftSourceUrl; setManualUrl(""); setTimeout(() => setManualUrl(url), 50); }}><RefreshCw className="h-3.5 w-3.5 ml-1" /> נסה שוב</Button>
                            <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]"><ExternalLink className="h-3.5 w-3.5 ml-1" /> חלון חדש</Button></a>
                          </div>
                        </div>
                      </div>
                    )}
                    {fetchedHtml && (
                      <iframe
                        ref={htmlEmbedIframeRef}
                        key={leftSourceUrl}
                        srcDoc={fetchedHtml}
                        className="absolute inset-0 w-full h-full border-0 bg-white"
                        title="HTML Viewer"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
                        onLoad={() => {
                          setIframeLoaded(true);
                          if (htmlEditMode) {
                            const doc = htmlEmbedIframeRef.current?.contentDocument;
                            if (doc?.body) doc.designMode = "on";
                          }
                          setupIframeSelectionListener(htmlEmbedIframeRef.current, 'html-embed');
                        }}
                      />
                    )}
                  </>
                )}

                {/* HTML-PAGE — try to embed, with fallback */}
                {leftContentType === 'html-page' && (
                  <div className="absolute inset-0">
                    <iframe
                      key={leftSourceUrl}
                      src={leftSourceUrl}
                      className="absolute inset-0 w-full h-full border-0"
                      title="External Viewer"
                      allow="fullscreen"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      onLoad={() => setIframeLoaded(true)}
                      onError={() => setIframeError(true)}
                    />
                    {iframeError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <div className="text-center space-y-4 p-8 max-w-md">
                          <ExternalLink className="h-16 w-16 mx-auto text-[#D4AF37]" />
                          <h3 className="text-lg font-semibold">לא ניתן להטמיע את הדף</h3>
                          <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="lg" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]"><ExternalLink className="h-5 w-5 ml-2" /> פתח בחלון חדש</Button>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF / DOCX */}
                {(leftContentType === 'pdf' || leftContentType === 'docx') && (
                  <>
                    <div className="absolute top-2 right-2 z-20">
                      <Badge variant="secondary" className="text-[10px] bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#0B1F5B]">
                        עריכת טקסט מלאה זמינה בקבצי TXT/HTML
                      </Badge>
                    </div>
                    {!iframeLoaded && !iframeError && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                      </div>
                    )}
                    {iframeError && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
                        <div className="text-center space-y-3 p-6">
                          <FileText className="h-12 w-12 mx-auto text-[#D4AF37]/40" />
                          <p className="text-sm text-[#0B1F5B]/70">לא ניתן לטעון את המסמך</p>
                          <div className="flex gap-2 justify-center flex-wrap">
                            <Button size="sm" variant="outline" className="border-[#D4AF37]" onClick={() => { setIframeError(false); setIframeLoaded(false); }}><RefreshCw className="h-3.5 w-3.5 ml-1" /> נסה שוב</Button>
                            {leftContentType !== 'docx' && (
                              <Button size="sm" variant="outline" className="border-[#D4AF37]" onClick={() => { setIframeError(false); setIframeLoaded(false); setManualUrl(`https://docs.google.com/gview?url=${encodeURIComponent(leftSourceUrl)}&embedded=true`); }}>Google Viewer</Button>
                            )}
                            <a href={leftSourceUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37]"><ExternalLink className="h-3.5 w-3.5 ml-1" /> חלון חדש</Button></a>
                          </div>
                        </div>
                      </div>
                    )}
                    <iframe key={leftViewerUrl} src={leftViewerUrl} className="absolute inset-0 w-full h-full border-0" title="PDF Viewer" allow="fullscreen" onLoad={() => setIframeLoaded(true)} onError={() => setIframeError(true)} />
                  </>
                )}
                </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                <div className="border-2 border-dashed border-[#D4AF37]/40 rounded-2xl p-10 hover:border-[#D4AF37] transition-colors">
                  <FileText className="h-16 w-16 mx-auto text-[#D4AF37]/30 mb-4" />
                  <p className="text-[#0B1F5B]/50 text-sm mb-1">גרור קובץ לכאן או בחר מסמך</p>
                  <p className="text-[10px] text-[#0B1F5B]/30 mb-4">PDF, TXT, תמונות, DOCX</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37] gap-1" onClick={triggerFileUpload} disabled={isUploading}>
                      {isUploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} העלה מהמחשב
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B] gap-1" onClick={() => { loadCloudDocs(); togglePanel("add"); }}>
                      <Database className="h-4 w-4" /> מסמכים מהענן
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B] gap-1" onClick={() => togglePanel("add")}>
                      <Plus className="h-4 w-4" /> הוסף קישור
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ DRAGGABLE SPLIT DIVIDER ═══ */}
          {viewMode === "split" && (
            <div
              className="w-2 flex-shrink-0 cursor-col-resize bg-[#D4AF37]/20 hover:bg-[#D4AF37]/50 active:bg-[#D4AF37]/70 transition-colors relative group flex items-center justify-center"
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingSplitter.current = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              title="גרור לשינוי גודל"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <GripVertical className="h-5 w-5 text-[#D4AF37]/60 group-hover:text-[#D4AF37] transition-colors" />
            </div>
          )}

          {/* Second viewer for split/compare */}
          {viewMode !== "single" && (
            rightSourceUrl ? (
              <div className={`${viewMode !== "split" ? "h-[400px]" : ""} border-t-2 sm:border-t-0 border-[#D4AF37]/30 relative bg-[#f8f8f6] flex flex-col`} style={viewMode === "split" ? { width: `${100 - splitRatio}%`, flexShrink: 0, flexGrow: 0 } : {}}>
                {/* ── Right pane toolbar ── */}
                <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-[#D4AF37]/20 px-2 py-1 flex items-center gap-1">
                  <span className="text-[10px] text-[#0B1F5B]/50 truncate flex-1" dir="ltr">{rightSourceUrl.split('/').pop()?.split('?')[0] || 'מסמך'}</span>
                  {/* Template switcher */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="p-1 rounded text-[#0B1F5B]/50 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors" title="החלף תבנית עיצוב">
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1.5" align="end" dir="rtl">
                      <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">תבניות עיצוב פסק דין</p>
                      <button onClick={() => applyTemplate('right', null)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${!rightTemplate ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                        <span>📄</span> מקורי (ללא תבנית)
                      </button>
                      {TEMPLATES.filter(t => !t.requiresAi).map(t => (
                        <button key={t.id} onClick={() => applyTemplate('right', t.id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${rightTemplate === t.id ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                          <span>{t.icon}</span> {t.name}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <a href={rightSourceUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[#0B1F5B]/50 hover:text-[#0B1F5B] hover:bg-[#D4AF37]/10" title="פתח בחלון חדש">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {/* ── Right pane content ── */}
                <div className="flex-1 relative">
                  {rightTemplateHtml ? (
                    <iframe srcDoc={rightTemplateHtml} className="absolute inset-0 w-full h-full border-0" title="Template View" sandbox="allow-same-origin allow-scripts allow-popups" />
                  ) : rightContentType === 'html-embed' ? (
                    rightFetchingHtml ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : rightFetchedHtml ? (
                      <iframe ref={rightIframeRef} srcDoc={rightFetchedHtml} className="absolute inset-0 w-full h-full border-0 bg-white" title="HTML Compare" sandbox="allow-same-origin allow-scripts allow-popups" />
                    ) : (
                      <iframe src={rightViewerUrl} className="absolute inset-0 w-full h-full border-0" title="Compare Viewer" allow="fullscreen" />
                    )
                  ) : (
                    <iframe src={rightViewerUrl} className="absolute inset-0 w-full h-full border-0" title="Compare Viewer" allow="fullscreen" />
                  )}
                </div>
              </div>
            ) : (
              <div className={`${viewMode !== "split" ? "h-[300px]" : ""} border-t-2 sm:border-t-0 border-[#D4AF37]/30 flex items-center justify-center bg-[#f8f8f6]`} style={viewMode === "split" ? { width: `${100 - splitRatio}%`, flexShrink: 0, flexGrow: 0 } : {}}>
                <div className="text-center space-y-3 p-6">
                  <FileText className="h-10 w-10 mx-auto text-[#D4AF37]/30" />
                  <p className="text-xs text-[#0B1F5B]/50">בחר מסמך שני להשוואה</p>
                  <div className="space-y-1.5">
                    <Button size="sm" className="bg-[#0B1F5B] text-white border-2 border-[#D4AF37] text-xs w-full gap-1" onClick={() => { setTargetPane("right"); triggerFileUpload(); }} disabled={isUploading}>
                      {isUploading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} העלה מהמחשב
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B] text-xs w-full gap-1" onClick={() => { setTargetPane("right"); loadCloudDocs(); togglePanel("add"); }}>
                      <Database className="h-3.5 w-3.5" /> מסמכים מהענן
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#0B1F5B] text-xs w-full gap-1" onClick={() => { setTargetPane("right"); togglePanel("docs"); }}>
                      <BookOpen className="h-3.5 w-3.5" /> בחר מהרשימה
                    </Button>
                    <Input
                      placeholder="או הדבק URL..."
                      value={compareManualUrl}
                      onChange={(e) => setCompareManualUrl(e.target.value)}
                      className="text-xs border-[#D4AF37]/30 focus-visible:ring-[#D4AF37]"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </main>
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
          onFormat={handlePopupFormat}
          canEdit={selectionPopup.source === 'html-embed' ? htmlEditMode : selectionPopup.source === 'beautify'}
        />
      )}

      <PsakDinViewDialog
        psak={psakData ? {
          id: psakData.id,
          title: psakData.title,
          court: psakData.court,
          year: psakData.year,
          case_number: psakData.case_number,
          summary: psakData.summary,
          full_text: psakData.full_text,
          source_url: psakData.source_url,
          tags: psakData.tags,
        } : null}
        open={regularViewerOpen}
        onOpenChange={setRegularViewerOpen}
      />
    </div>
  );
}
