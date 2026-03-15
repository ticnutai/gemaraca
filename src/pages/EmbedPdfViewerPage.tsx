import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Bookmark, Download, Search, Trash2, Plus, ExternalLink, BookOpen, Palette, Maximize2, Minimize2 } from "lucide-react";
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
                {/* Document Viewer — iframe for universal file support */}
                <div className="flex-1 relative bg-[#f8f8f6]">
                  <iframe
                    src={leftSourceUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    title="PDF Viewer"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
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
                    src={rightSourceUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    title="PDF Viewer (compare)"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
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
    </div>
  );
}
