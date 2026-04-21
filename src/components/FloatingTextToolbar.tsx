import { useState, useEffect, useCallback, useRef } from "react";
import {
  Type, AArrowUp, AArrowDown, Bold, Italic, Underline, Strikethrough,
  Search, Highlighter, Palette, Copy, AlignRight, AlignCenter, AlignLeft,
  AlignJustify, RotateCcw, Save, Bookmark
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

const HIGHLIGHT_COLORS = [
  { value: '#FEF08A', label: 'צהוב' },
  { value: '#BBF7D0', label: 'ירוק' },
  { value: '#BFDBFE', label: 'כחול' },
  { value: '#FBCFE8', label: 'ורוד' },
  { value: '#FED7AA', label: 'כתום' },
  { value: '#E9D5FF', label: 'סגול' },
];

const TEXT_COLORS = [
  { value: '#000000', label: 'שחור' },
  { value: '#0B1F5B', label: 'כחול כהה' },
  { value: '#b91c1c', label: 'אדום' },
  { value: '#15803d', label: 'ירוק' },
  { value: '#7e22ce', label: 'סגול' },
  { value: '#D4AF37', label: 'זהב' },
];

interface FloatingTextToolbarProps {
  /** The container element to listen for selections on */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Optional: an iframe ref if editing inside an iframe */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Whether inline edit mode is on (uses execCommand) */
  editMode?: boolean;
  /** Callback to apply annotation to selection for non-edit mode */
  onAnnotate?: (styles: Record<string, string>) => void;
  /** Called after any formatting command is applied (for auto-save) */
  onAfterFormat?: () => void;
}

export default function FloatingTextToolbar({ containerRef, iframeRef, editMode, onAnnotate, onAfterFormat }: FloatingTextToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const wordCountRef = useRef(0);

  const getDoc = useCallback(() => {
    if (iframeRef?.current?.contentDocument) return iframeRef.current.contentDocument;
    return document;
  }, [iframeRef]);

  const getSelection = useCallback(() => {
    const doc = getDoc();
    return doc.getSelection();
  }, [getDoc]);

  const exec = useCallback((cmd: string, val?: string) => {
    const doc = getDoc();
    doc.execCommand(cmd, false, val);
    onAfterFormat?.();
  }, [getDoc, onAfterFormat]);

  const handleSelectionChange = useCallback(() => {
    const sel = getSelection();
    const text = sel?.toString()?.trim() || "";

    if (!text || text.length < 1) {
      // Small delay to allow clicking toolbar buttons
      setTimeout(() => {
        const currentSel = getSelection();
        if (!currentSel?.toString()?.trim()) {
          setVisible(false);
          setShowHighlightPicker(false);
          setShowColorPicker(false);
        }
      }, 200);
      return;
    }

    setSelectedText(text);
    wordCountRef.current = text.split(/\s+/).filter(Boolean).length;

    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // If inside iframe, offset by iframe position
    let offsetX = 0, offsetY = 0;
    if (iframeRef?.current) {
      const iframeRect = iframeRef.current.getBoundingClientRect();
      offsetX = iframeRect.left;
      offsetY = iframeRect.top;
    }

    const x = rect.left + rect.width / 2 + offsetX;
    const y = rect.top + offsetY - 10;

    setPos({ x, y });
    setVisible(true);
  }, [getSelection, iframeRef]);

  useEffect(() => {
    const doc = getDoc();
    doc.addEventListener("selectionchange", handleSelectionChange);

    // Also listen on the main document if using iframe
    if (iframeRef?.current) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        iframeDoc.addEventListener("selectionchange", handleSelectionChange);
      }
    }

    return () => {
      doc.removeEventListener("selectionchange", handleSelectionChange);
      if (iframeRef?.current?.contentDocument) {
        iframeRef.current.contentDocument.removeEventListener("selectionchange", handleSelectionChange);
      }
    };
  }, [handleSelectionChange, getDoc, iframeRef]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    sonnerToast.success("הועתק");
  };

  const handleBookmark = useCallback(() => {
    if (!selectedText) return;
    const key = 'gemara-bookmarks';
    const existing: Array<Record<string, string>> = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: selectedText.substring(0, 300),
      location: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(existing));
    sonnerToast.success('הסמניה נשמרה');
  }, [selectedText]);

  const btnClass = "w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors text-white";

  if (!visible) return null;

  // Position the toolbar above the selection
  const toolbarWidth = 420;
  const left = Math.max(8, Math.min(pos.x - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
  const top = Math.max(8, pos.y - 90);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ left, top }}
      onMouseDown={e => e.preventDefault()}
    >
      {/* Main toolbar row */}
      <div className="bg-[#0B1F5B] rounded-xl shadow-2xl border border-[#D4AF37]/40 px-2 py-1.5 flex flex-col items-center gap-1">
        {/* Row 1: Formatting */}
        <div className="flex items-center gap-0.5">
          {/* Font change */}
          <button className={btnClass} title="גופן" onClick={() => exec('fontName', 'David')}>
            <Type className="h-4 w-4" />
          </button>
          {/* Size up/down */}
          <button className={btnClass} title="הגדל" onClick={() => exec('fontSize', '5')}>
            <AArrowUp className="h-4 w-4" />
          </button>
          <button className={btnClass} title="הקטן" onClick={() => exec('fontSize', '2')}>
            <AArrowDown className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-white/20 mx-0.5" />
          {/* Strikethrough */}
          <button className={btnClass} title="קו חוצה" onClick={() => exec('strikeThrough')}>
            <Strikethrough className="h-4 w-4" />
          </button>
          {/* Underline */}
          <button className={btnClass} title="קו תחתון" onClick={() => exec('underline')}>
            <Underline className="h-4 w-4" />
          </button>
          {/* Italic */}
          <button className={btnClass} title="נטוי" onClick={() => exec('italic')}>
            <Italic className="h-4 w-4" />
          </button>
          {/* Bold */}
          <button className={btnClass} title="הדגשה" onClick={() => exec('bold')}>
            <Bold className="h-4 w-4" />
          </button>
          {/* Bookmark */}
          <button className={btnClass} title="סמן מקום" onClick={handleBookmark}>
            <Bookmark className="h-4 w-4 text-[#D4AF37]" />
          </button>
          <div className="w-px h-5 bg-white/20 mx-0.5" />
          {/* Search */}
          <button className={btnClass} title="חפש" onClick={() => {
            const query = selectedText.substring(0, 50);
            window.open(`https://www.sefaria.org/search?q=${encodeURIComponent(query)}&tab=text`, '_blank');
          }}>
            <Search className="h-4 w-4" />
          </button>
          {/* Save/highlight */}
          <button className={`${btnClass} relative`} title="סמן בצבע" onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}>
            <Highlighter className="h-4 w-4 text-[#D4AF37]" />
          </button>
          {/* Color */}
          <button className={`${btnClass} relative`} title="צבע טקסט" onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}>
            <Palette className="h-4 w-4" />
          </button>
          {/* Copy */}
          <button className={btnClass} title="העתק" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {/* Row 2: Word count + alignment + remove format */}
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-white/60 px-2">{wordCountRef.current} מילים</span>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button className={btnClass} title="הסר עיצוב" onClick={() => exec('removeFormat')}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button className={btnClass} title="סימון בצבע" onClick={() => exec('hiliteColor', '#D4AF3744')}>
            <Highlighter className="h-3.5 w-3.5 text-[#D4AF37]" />
          </button>
          <div className="w-px h-4 bg-white/20 mx-0.5" />
          <button className={btnClass} title="ימין" onClick={() => exec('justifyRight')}>
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <button className={btnClass} title="מרכז" onClick={() => exec('justifyCenter')}>
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button className={btnClass} title="שמאל" onClick={() => exec('justifyLeft')}>
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button className={btnClass} title="מלא" onClick={() => exec('justifyFull')}>
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Color picker rows */}
        {showHighlightPicker && (
          <div className="flex items-center gap-1.5 py-1 px-2 bg-white/10 rounded-lg">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.value} className="w-5 h-5 rounded-full border border-white/30 hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} onClick={() => { exec('hiliteColor', c.value); setShowHighlightPicker(false); }} title={c.label} />
            ))}
          </div>
        )}
        {showColorPicker && (
          <div className="flex items-center gap-1.5 py-1 px-2 bg-white/10 rounded-lg">
            {TEXT_COLORS.map(c => (
              <button key={c.value} className="w-5 h-5 rounded-full border border-white/30 hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} onClick={() => { exec('foreColor', c.value); setShowColorPicker(false); }} title={c.label} />
            ))}
          </div>
        )}
      </div>

      {/* Arrow pointing down */}
      <div className="flex justify-center">
        <div className="w-3 h-3 bg-[#0B1F5B] rotate-45 -mt-1.5 border-r border-b border-[#D4AF37]/40" />
      </div>
    </div>
  );
}
