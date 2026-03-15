import { useState, useCallback, useMemo, useEffect } from "react";
import { FileText, Bookmark, Download, Search, Trash2, Plus, ExternalLink, BookOpen, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usePDFAnnotations, type PDFAnnotation } from "@/hooks/usePDFAnnotations";
import { useUserBooks, type UserBook } from "@/hooks/useUserBooks";
import { PDFViewer } from "@embedpdf/react-pdf-viewer";

// ─── Constants ───────────────────────────────────────────────

const THEME_STORAGE_KEY = "embedpdf-theme-v1";
const VIEW_MODE_STORAGE_KEY = "embedpdf-view-mode-v1";

type ViewMode = "single" | "split" | "compare";
type ThemeKey = "cobalt" | "sand" | "noir";

const ANNOTATION_COLORS = [
  { label: "צהוב", value: "#FFEB3B" },
  { label: "ירוק", value: "#81C784" },
  { label: "כחול", value: "#64B5F6" },
  { label: "כתום", value: "#FF8A65" },
  { label: "סגול", value: "#CE93D8" },
  { label: "ורוד", value: "#F48FB1" },
];

// ─── Theme config for the EmbedPDF viewer ────────────────────

const embedViewerTheme = {
  preference: "light" as const,
  light: {
    background: {
      app: "#ffffff",
      surface: "#ffffff",
      surfaceAlt: "#ffffff",
      elevated: "#ffffff",
      overlay: "rgba(11, 31, 91, 0.18)",
      input: "#ffffff",
    },
    foreground: {
      primary: "#0B1F5B",
      secondary: "#1D3270",
      muted: "#4A5A86",
      disabled: "#8A95B8",
      onAccent: "#0B1F5B",
    },
    border: {
      default: "#D4AF37",
      subtle: "#E6C976",
      strong: "#B9901F",
    },
    accent: {
      primary: "#D4AF37",
      primaryHover: "#C6A132",
      primaryActive: "#AF8B21",
      primaryLight: "#FFF4D2",
      primaryForeground: "#0B1F5B",
    },
    interactive: {
      hover: "#FFF9E8",
      active: "#FFF1CC",
      selected: "#FFF1CC",
      focus: "#D4AF37",
      focusRing: "rgba(212, 175, 55, 0.35)",
    },
  },
};

// ─── Shell themes (header/background) ────────────────────────

const shellThemes: Record<ThemeKey, {
  label: string;
  shellClass: string;
  panelClass: string;
  mutedClass: string;
  pillClass: string;
}> = {
  cobalt: {
    label: "Cobalt",
    shellClass: "bg-[#0B1F5B] text-white",
    panelClass: "bg-white/95 border-[#D4AF37]/30",
    mutedClass: "bg-[#F0F4FF] border-[#D4AF37]/20",
    pillClass: "bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#0B1F5B]",
  },
  sand: {
    label: "Sand",
    shellClass: "bg-[#F5F0E8] text-[#3E2723]",
    panelClass: "bg-white/95 border-[#C9A96E]/30",
    mutedClass: "bg-[#FAF6EF] border-[#C9A96E]/20",
    pillClass: "bg-[#C9A96E]/20 border-[#C9A96E]/40 text-[#3E2723]",
  },
  noir: {
    label: "Noir",
    shellClass: "bg-[#1A1A2E] text-gray-100",
    panelClass: "bg-[#16213E]/95 border-gray-700/50",
    mutedClass: "bg-[#0F3460]/50 border-gray-700/30",
    pillClass: "bg-gray-700/40 border-gray-600/50 text-gray-200",
  },
};

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
  // PDF selection
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [comparePdfId, setComparePdfId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [compareManualUrl, setCompareManualUrl] = useState("");

  // Add book form
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookUrl, setNewBookUrl] = useState("");

  // View mode & theme
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode) || "single";
    } catch { return "single"; }
  });
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    try {
      return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey) || "cobalt";
    } catch { return "cobalt"; }
  });

  // Annotation form
  const [currentPage, setCurrentPage] = useState("1");
  const [highlightText, setHighlightText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [annotationColor, setAnnotationColor] = useState("#FFEB3B");
  const [annotationSearch, setAnnotationSearch] = useState("");

  // Persist theme/viewMode
  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, themeKey); } catch {}
  }, [themeKey]);
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode); } catch {}
  }, [viewMode]);

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

  const theme = shellThemes[themeKey];

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

  return (
    <div dir="rtl" className={`min-h-screen ${theme.shellClass} transition-colors duration-300`}>
      {/* ── Header ── */}
      <header className="border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <h1 className="text-xl font-bold">EmbedPDF Viewer</h1>
            <Badge className="text-xs bg-amber-400/20 text-amber-200 border-amber-400/40">חדש</Badge>
          </div>

          <Separator orientation="vertical" className="h-6 bg-white/20 hidden sm:block" />

          {/* View mode buttons */}
          <div className="flex gap-1">
            {(["single", "split", "compare"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewMode === mode ? "default" : "outline"}
                className={viewMode === mode ? "bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#C6A132]" : "border-white/30 text-inherit hover:bg-white/10"}
                onClick={() => setViewMode(mode)}
              >
                {mode === "single" ? "Single" : mode === "split" ? "Split" : "Compare"}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6 bg-white/20 hidden sm:block" />

          {/* Theme buttons */}
          <div className="flex gap-1">
            {(Object.keys(shellThemes) as ThemeKey[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={themeKey === k ? "default" : "outline"}
                className={themeKey === k ? "bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#C6A132]" : "border-white/30 text-inherit hover:bg-white/10"}
                onClick={() => setThemeKey(k)}
              >
                {shellThemes[k].label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body: 3-column grid ── */}
      <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 xl:grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 64px)" }}>
        {/* ═══ LEFT SIDEBAR: PDF List ═══ */}
        <aside className="xl:col-span-3 space-y-4">
          {/* Add book */}
          <Card className={`${theme.panelClass} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> הוספת מסמך
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="שם המסמך"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="קישור PDF (URL)"
                value={newBookUrl}
                onChange={(e) => setNewBookUrl(e.target.value)}
                className="text-sm"
                dir="ltr"
              />
              <Button size="sm" className="w-full bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#C6A132]" onClick={handleAddBook} disabled={addBook.isPending}>
                {addBook.isPending ? "שומר..." : "הוסף"}
              </Button>
            </CardContent>
          </Card>

          {/* Manual URL */}
          <Card className={`${theme.panelClass} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> קישור ידני
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="הדבק URL של PDF..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="text-sm"
                dir="ltr"
              />
              {viewMode !== "single" && (
                <Input
                  placeholder="URL להשוואה..."
                  value={compareManualUrl}
                  onChange={(e) => setCompareManualUrl(e.target.value)}
                  className="text-sm"
                  dir="ltr"
                />
              )}
            </CardContent>
          </Card>

          {/* Book list */}
          <Card className={`${theme.panelClass} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> מסמכים ({books.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                {books.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">אין מסמכים עדיין</p>
                ) : (
                  <div className="space-y-1">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                          selectedPdfId === book.id ? "bg-[#D4AF37]/20 font-medium" : "hover:bg-black/5"
                        }`}
                        onClick={() => setSelectedPdfId(book.id)}
                      >
                        <span className="truncate flex-1">{book.title}</span>
                        <div className="flex items-center gap-1">
                          {viewMode !== "single" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="בחר להשוואה"
                              onClick={(e) => { e.stopPropagation(); setComparePdfId(book.id); }}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
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
          <Card className={`${theme.mutedClass} border`}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span>אנוטציות:</span>
                <Badge variant="secondary" className={theme.pillClass}>{annotations.length}</Badge>
              </div>
              <div className="flex justify-between text-xs">
                <span>סימניות:</span>
                <Badge variant="secondary" className={theme.pillClass}>{bookmarks.length}</Badge>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleExportJSON}>
                  <Download className="h-3 w-3 ml-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleExportCSV}>
                  <Download className="h-3 w-3 ml-1" /> CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* ═══ CENTER: PDF Viewer ═══ */}
        <main className="xl:col-span-6 flex flex-col gap-4">
          {leftSourceUrl ? (
            <Card className={`${theme.panelClass} border flex-1`}>
              <CardContent className="p-0 h-full flex flex-col" style={{ minHeight: "600px" }}>
                {/* Viewer URL bar */}
                <div className="px-3 py-2 border-b flex items-center gap-2 text-xs text-muted-foreground" dir="ltr">
                  <FileText className="h-3 w-3" />
                  <span className="truncate flex-1">{leftSourceUrl}</span>
                </div>
                {/* EmbedPDF Viewer */}
                <div className="flex-1 relative">
                  <PDFViewer
                    src={leftSourceUrl}
                    theme={embedViewerTheme}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={`${theme.panelClass} border flex-1 flex items-center justify-center`} style={{ minHeight: "600px" }}>
              <div className="text-center space-y-3 p-8">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">בחר מסמך מהרשימה או הדבק קישור PDF</p>
              </div>
            </Card>
          )}

          {/* Second viewer for split/compare */}
          {viewMode !== "single" && rightSourceUrl && (
            <Card className={`${theme.panelClass} border flex-1`}>
              <CardContent className="p-0 h-full flex flex-col" style={{ minHeight: "400px" }}>
                <div className="px-3 py-2 border-b flex items-center gap-2 text-xs text-muted-foreground" dir="ltr">
                  <FileText className="h-3 w-3" />
                  <span className="truncate flex-1">{rightSourceUrl}</span>
                </div>
                <div className="flex-1 relative">
                  <PDFViewer
                    src={rightSourceUrl}
                    theme={embedViewerTheme}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* ═══ RIGHT SIDEBAR: Annotation Desk ═══ */}
        <aside className="xl:col-span-3 space-y-4">
          {/* Annotation form */}
          <Card className={`${theme.panelClass} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="h-4 w-4" /> שולחן אנוטציות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Page number */}
              <div className="flex items-center gap-2">
                <label className="text-xs whitespace-nowrap">עמוד:</label>
                <Input
                  type="number"
                  min={1}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  className="text-sm w-20"
                />
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs whitespace-nowrap">צבע:</label>
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
                className="text-sm"
              />

              {/* Note text */}
              <Textarea
                placeholder="כתוב הערה..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="text-sm min-h-[80px]"
              />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#D4AF37] text-[#0B1F5B] hover:bg-[#C6A132]"
                  onClick={handleSaveAnnotation}
                  disabled={addAnnotation.isPending}
                >
                  {addAnnotation.isPending ? "שומר..." : "שמור אנוטציה"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBookmark}
                  disabled={addBookmark.isPending}
                  title="הוסף סימניה לעמוד הנוכחי"
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>

              {!canPersist && leftSourceUrl && (
                <p className="text-xs text-amber-600">
                  שמירה למסד נתונים זמינה רק למסמך שנבחר מהרשימה
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <Card className={`${theme.panelClass} border`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-green-500" /> סימניות ({bookmarks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-1">
                    {bookmarks.map((bm) => (
                      <div key={bm.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-black/5">
                        <span>🔖 {bm.title}</span>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteBookmark.mutate(bm.id)}>
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
          <Card className={`${theme.panelClass} border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" /> הערות ({filteredAnnotations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="חיפוש בהערות..."
                value={annotationSearch}
                onChange={(e) => setAnnotationSearch(e.target.value)}
                className="text-sm"
              />
              <ScrollArea className="max-h-[350px]">
                {filteredAnnotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {annotationsLoading ? "טוען..." : "אין הערות"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAnnotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-2 rounded-md border text-xs space-y-1"
                        style={{ borderRightColor: ann.color, borderRightWidth: 3 }}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px]">עמוד {ann.page_number}</Badge>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteAnnotation.mutate(ann.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {ann.highlight_text && (
                          <p className="text-muted-foreground italic" style={{ backgroundColor: ann.color + "33", padding: "2px 4px", borderRadius: 2 }}>
                            "{ann.highlight_text}"
                          </p>
                        )}
                        <p>{ann.note_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
