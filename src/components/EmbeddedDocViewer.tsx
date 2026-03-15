import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  Globe,
  FileText,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Copy,
  Printer,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Loader2,
  Link2,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Monitor,
  Moon,
  Sun,
  StickyNote,
  Download,
  Bookmark,
  BookmarkCheck,
  PanelRightOpen,
  PanelRightClose,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── strategy types ─── */
type Strategy = "direct" | "google-viewer" | "allorigins" | "embedpdf";
const STRATEGY_LABELS: Record<Strategy, string> = {
  "direct": "טעינה ישירה",
  "google-viewer": "Google Docs Viewer",
  "allorigins": "פרוקסי חיצוני",
  "embedpdf": "EmbedPDF (pdfium)",
};

/* ─── Responsive presets ─── */
const DEVICE_PRESETS = [
  { key: "auto", label: "אוטומטי", icon: MonitorSmartphone, width: "100%" },
  { key: "desktop", label: "דסקטופ", icon: Monitor, width: "100%" },
  { key: "tablet", label: "טאבלט", icon: Tablet, width: "768px" },
  { key: "mobile", label: "נייד", icon: Smartphone, width: "375px" },
] as const;

interface EmbeddedDocViewerProps {
  url: string;
  title: string;
  onClose: () => void;
  onSwitchToRegular?: () => void;
  initialStrategy?: Strategy;
}

export type { Strategy };

export default function EmbeddedDocViewer({ url, title, onClose, onSwitchToRegular, initialStrategy = "google-viewer" }: EmbeddedDocViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedRef = useRef<HTMLEmbedElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);

  // Editing features
  const [darkMode, setDarkMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`edv-notes-${url}`) || ""; } catch { return ""; }
  });
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      const bm = JSON.parse(localStorage.getItem("edv-bookmarks") || "[]") as string[];
      return bm.includes(url);
    } catch { return false; }
  });
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [devicePreset, setDevicePreset] = useState<string>("auto");

  // Build URL based on strategy
  const getStrategyUrl = useCallback((strat: Strategy, sourceUrl: string) => {
    switch (strat) {
      case "google-viewer":
        return `https://docs.google.com/gview?url=${encodeURIComponent(sourceUrl)}&embedded=true`;
      case "allorigins":
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(sourceUrl)}`;
      case "embedpdf":
        return sourceUrl;
      default:
        return sourceUrl;
    }
  }, []);

  const currentUrl = getStrategyUrl(strategy, url);

  // Simulate progress while loading
  useEffect(() => {
    if (loadState !== "loading") return;
    setLoadProgress(0);
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      // Asymptotic approach to 90%
      setLoadProgress(Math.min(90, (elapsed / 80) * (1 - elapsed / 30000)));
    }, 200);
    return () => clearInterval(iv);
  }, [loadState, currentUrl]);

  // Reset load state on URL change
  useEffect(() => {
    setLoadState("loading");
    setLoadProgress(0);
  }, [currentUrl]);

  // Detect load timeout → auto-fallback
  useEffect(() => {
    if (loadState !== "loading") return;
    const timer = setTimeout(() => {
      if (loadState === "loading") {
        // Auto-try next strategy
        if (strategy === "embedpdf") {
          setStrategy("direct");
        } else if (strategy === "direct") {
          setStrategy("google-viewer");
        } else if (strategy === "google-viewer") {
          setStrategy("allorigins");
        } else {
          setLoadState("error");
        }
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [loadState, strategy]);

  const handleIframeLoad = useCallback(() => {
    setLoadProgress(100);
    setTimeout(() => setLoadState("loaded"), 300);
  }, []);

  const handleIframeError = useCallback(() => {
    if (strategy === "embedpdf") {
      setStrategy("direct");
    } else if (strategy === "direct") {
      setStrategy("google-viewer");
    } else if (strategy === "google-viewer") {
      setStrategy("allorigins");
    } else {
      setLoadState("error");
    }
  }, [strategy]);

  const handleRetry = useCallback(() => {
    setRetryCount(r => r + 1);
    setStrategy("direct");
    setLoadState("loading");
    setLoadProgress(0);
  }, []);

  const handleForceStrategy = useCallback((s: Strategy) => {
    setStrategy(s);
    setLoadState("loading");
    setLoadProgress(0);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(200, z + 15)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(30, z - 15)), []);
  const handleZoomReset = useCallback(() => setZoom(100), []);
  const handleRotate = useCallback(() => setRotation(r => (r + 90) % 360), []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Copy URL
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => toast.success("קישור הועתק")).catch(() => {});
  }, [url]);

  // Print
  const handlePrint = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      // Cross-origin - open in new tab for printing
      window.open(url, "_blank");
    }
  }, [url]);

  // Download
  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "document"}.pdf`;
    a.rel = "noopener noreferrer";
    a.click();
  }, [url, title]);

  // Notes
  const handleSaveNotes = useCallback(() => {
    try {
      localStorage.setItem(`edv-notes-${url}`, notes);
      toast.success("הערות נשמרו");
    } catch { /* quota exceeded */ }
  }, [url, notes]);

  const handleClearNotes = useCallback(() => {
    setNotes("");
    try { localStorage.removeItem(`edv-notes-${url}`); } catch { /* ignore */ }
    toast("הערות נמחקו");
  }, [url]);

  // Bookmark
  const toggleBookmark = useCallback(() => {
    try {
      const bm = JSON.parse(localStorage.getItem("edv-bookmarks") || "[]") as string[];
      if (isBookmarked) {
        const next = bm.filter(b => b !== url);
        localStorage.setItem("edv-bookmarks", JSON.stringify(next));
        setIsBookmarked(false);
        toast("הסימניה הוסרה");
      } else {
        bm.push(url);
        localStorage.setItem("edv-bookmarks", JSON.stringify(bm));
        setIsBookmarked(true);
        toast.success("נוספה לסימניות");
      }
    } catch { /* ignore */ }
  }, [url, isBookmarked]);

  const deviceWidth = DEVICE_PRESETS.find(d => d.key === devicePreset)?.width || "100%";

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background">
      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0 gap-2 flex-wrap">
        {/* Left: title & status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Globe className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-bold text-xs truncate max-w-[200px]">{title}</span>
          <Badge variant={loadState === "loaded" ? "default" : loadState === "loading" ? "secondary" : "destructive"}
            className="text-[9px] shrink-0">
            {loadState === "loading" && <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" />}
            {loadState === "loaded" ? "נטען" : loadState === "loading" ? "טוען..." : "שגיאה"}
          </Badge>
          <Badge variant="outline" className="text-[9px] shrink-0">
            {STRATEGY_LABELS[strategy]}
          </Badge>
        </div>

        {/* Center: zoom & tools */}
        <div className="flex items-center gap-1">
          <ToolBtn icon={ZoomOut} tip="הקטן" onClick={handleZoomOut} />
          <div className="w-20 mx-1">
            <Slider value={[zoom]} min={30} max={200} step={5} onValueChange={v => setZoom(v[0])} />
          </div>
          <ToolBtn icon={ZoomIn} tip="הגדל" onClick={handleZoomIn} />
          <button onClick={handleZoomReset} className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1 min-w-[32px] text-center">
            {zoom}%
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn icon={RotateCw} tip="סובב" onClick={handleRotate} />
          <ToolBtn icon={isFullscreen ? Minimize2 : Maximize2} tip={isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"} onClick={toggleFullscreen} />
          <div className="w-px h-5 bg-border mx-1" />

          {/* Device presets */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MonitorSmartphone className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel className="text-[10px]">תצוגת מכשיר</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DEVICE_PRESETS.map(({ key, label, icon: DIcon }) => (
                <DropdownMenuItem key={key} onClick={() => setDevicePreset(key)} className="gap-2 text-xs">
                  <DIcon className="w-3.5 h-3.5" />{label}
                  {devicePreset === key && <Badge variant="default" className="text-[8px] mr-auto">פעיל</Badge>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Strategy selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] gap-1">
                <RefreshCw className="w-3 h-3" /> מנוע
                <ChevronDown className="w-2.5 h-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel className="text-[10px]">שיטת טעינה</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(STRATEGY_LABELS) as Strategy[]).map(s => (
                <DropdownMenuItem key={s} onClick={() => handleForceStrategy(s)} className="gap-2 text-xs">
                  {STRATEGY_LABELS[s]}
                  {strategy === s && <Badge variant="default" className="text-[8px] mr-auto">פעיל</Badge>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn icon={Copy} tip="העתק קישור" onClick={handleCopyUrl} />
          <ToolBtn icon={Printer} tip="הדפסה" onClick={handlePrint} />
          <ToolBtn icon={Download} tip="הורדה" onClick={handleDownload} />
          <ToolBtn icon={ExternalLink} tip="פתח בלשונית חדשה" onClick={() => window.open(url, "_blank", "noopener,noreferrer")} />
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn icon={darkMode ? Sun : Moon} tip={darkMode ? "מצב רגיל" : "מצב כהה"} onClick={() => setDarkMode(d => !d)} />
          <ToolBtn icon={isBookmarked ? BookmarkCheck : Bookmark} tip={isBookmarked ? "הסר סימניה" : "הוסף לסימניות"} onClick={toggleBookmark} />
          <ToolBtn icon={notesOpen ? PanelRightClose : PanelRightOpen} tip={notesOpen ? "סגור הערות" : "הערות"} onClick={() => setNotesOpen(o => !o)} />
          {onSwitchToRegular && <ToolBtn icon={FileText} tip="עבור לצפיין רגיל" onClick={onSwitchToRegular} />}
        </div>

        {/* Right: close */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ═══ URL Bar ═══ */}
      <div className="flex items-center px-3 py-1.5 border-b bg-muted/10 gap-2">
        <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground truncate font-mono flex-1" dir="ltr">{url}</span>
        <button onClick={handleCopyUrl} className="text-muted-foreground hover:text-foreground shrink-0">
          <Copy className="w-3 h-3" />
        </button>
      </div>

      {/* ═══ Progress bar ═══ */}
      {loadState === "loading" && (
        <Progress value={loadProgress} className="h-0.5 rounded-none" />
      )}

      {/* ═══ Content area ═══ */}
      <div className="flex-1 min-h-0 relative overflow-auto bg-muted/5">
        {/* Loading overlay */}
        {loadState === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-semibold text-foreground mb-1">טוען את המסמך...</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              {strategy === "embedpdf" ? "טוען עם EmbedPDF (pdfium)..." :
                strategy === "direct" ? "ניסיון טעינה ישירה..." :
                strategy === "google-viewer" ? "טוען דרך Google Docs Viewer..." :
                "טוען דרך פרוקסי חיצוני..."}
            </p>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}

        {/* Error state */}
        {loadState === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background">
            <AlertTriangle className="w-14 h-14 text-amber-500/60 mb-4" />
            <h3 className="text-base font-bold mb-1">לא ניתן לטעון את המסמך</h3>
            <p className="text-sm text-muted-foreground mb-1 text-center max-w-md">
              האתר חוסם הטמעה בתוך אפליקציות אחרות, או שמתרחשת בעיה ברשת.
            </p>
            <p className="text-[11px] text-muted-foreground mb-4">
              ניסיון {retryCount + 1} — נוסו כל שיטות הטעינה
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="w-3.5 h-3.5" /> פתח בלשונית חדשה
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRetry}>
                <RefreshCw className="w-3.5 h-3.5" /> נסה שוב
              </Button>
              {onSwitchToRegular && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onSwitchToRegular}>
                  <FileText className="w-3.5 h-3.5" /> צפיין רגיל
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Content: embed or iframe based on strategy */}
        <div className="w-full h-full flex justify-center"
          style={{ overflow: "auto", filter: darkMode ? "invert(0.88) hue-rotate(180deg)" : "none", transition: "filter 0.3s ease" }}>
          <div style={{
            width: devicePreset === "auto" ? "100%" : deviceWidth,
            height: "100%",
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease",
            maxWidth: "100%",
            margin: devicePreset !== "auto" && devicePreset !== "desktop" ? "0 auto" : undefined,
          }}>
            {strategy === "embedpdf" ? (
              <embed
                ref={embedRef}
                key={`embed-${currentUrl}-${retryCount}`}
                src={`${currentUrl}#toolbar=1&zoom=${zoom}`}
                type="application/pdf"
                className="w-full h-full"
                title={title}
                onLoad={() => { setLoadProgress(100); setTimeout(() => setLoadState("loaded"), 300); }}
                onError={() => handleIframeError()}
                style={{
                  minHeight: zoom < 100 ? `${100 / (zoom / 100)}%` : "100%",
                  boxShadow: devicePreset !== "auto" && devicePreset !== "desktop" ? "0 0 20px rgba(0,0,0,0.1)" : "none",
                  borderRadius: devicePreset === "mobile" ? "16px" : devicePreset === "tablet" ? "12px" : "0",
                }}
              />
            ) : (
              <iframe
                ref={iframeRef}
                key={`${currentUrl}-${retryCount}`}
                src={currentUrl}
                className="w-full h-full border-0"
                title={title}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                style={{
                  minHeight: zoom < 100 ? `${100 / (zoom / 100)}%` : "100%",
                  boxShadow: devicePreset !== "auto" && devicePreset !== "desktop" ? "0 0 20px rgba(0,0,0,0.1)" : "none",
                  borderRadius: devicePreset === "mobile" ? "16px" : devicePreset === "tablet" ? "12px" : "0",
                }}
              />
            )}
          </div>
        </div>

        {/* Notes panel */}
        {notesOpen && (
          <div className="absolute top-0 left-0 w-72 h-full bg-background border-l shadow-xl z-20 flex flex-col" dir="rtl">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">הערות</span>
              </div>
              <div className="flex items-center gap-1">
                <ToolBtn icon={Save} tip="שמור" onClick={handleSaveNotes} />
                <ToolBtn icon={Trash2} tip="מחק הכל" onClick={handleClearNotes} />
                <ToolBtn icon={X} tip="סגור" onClick={() => setNotesOpen(false)} />
              </div>
            </div>
            <textarea
              className="flex-1 p-3 resize-none text-sm bg-background focus:outline-none placeholder:text-muted-foreground"
              placeholder="הוסף הערות על המסמך..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              dir="rtl"
            />
            <div className="px-3 py-1.5 border-t bg-muted/10 text-[10px] text-muted-foreground">
              {notes.length > 0 ? `${notes.length} תווים` : "אין הערות"}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Status bar ═══ */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-muted/20 text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span>זום: {zoom}%</span>
          {rotation !== 0 && <span>סיבוב: {rotation}°</span>}
          <span>שיטה: {STRATEGY_LABELS[strategy]}</span>
          {darkMode && <span>🌙 מצב כהה</span>}
          {isBookmarked && <span>⭐ מסומן</span>}
        </div>
        <div className="flex items-center gap-3">
          {devicePreset !== "auto" && <span>מכשיר: {DEVICE_PRESETS.find(d => d.key === devicePreset)?.label}</span>}
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground truncate max-w-[300px]" dir="ltr">{url}</a>
        </div>
      </div>
    </div>
  );
}

/* ─── Toolbar button helper ─── */
function ToolBtn({ icon: Icon, tip, onClick }: { icon: React.ElementType; tip: string; onClick: () => void }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClick}>
        <Icon className="w-3.5 h-3.5" />
      </Button>
    </TooltipTrigger><TooltipContent side="bottom">{tip}</TooltipContent></Tooltip></TooltipProvider>
  );
}
