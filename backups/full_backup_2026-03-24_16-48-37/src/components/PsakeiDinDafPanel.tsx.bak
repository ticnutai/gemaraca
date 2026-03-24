import { useState, lazy, Suspense } from "react";
import { usePsakimForDaf, DafPsak } from "@/hooks/usePsakimForDaf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Scale,
  BookOpen,
  ExternalLink,
  Columns2,
  List,
  ChevronDown,
  ChevronUp,
  Brain,
  FileSearch,
  Eye,
  Star,
  Globe,
  FileText,
  X,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PsakDinViewDialog = lazy(() => import("@/components/PsakDinViewDialog"));
const GemaraTextPanel = lazy(() => import("@/components/GemaraTextPanel"));

const PSAK_VIEWER_DEFAULT_KEY = 'psak-din-default-viewer';
type ViewerType = 'regular' | 'embedded-pdf';

interface PsakeiDinDafPanelProps {
  tractate: string;       // Hebrew name e.g. "ברכות"
  daf: string;            // e.g. "2"
  sugyaId: string;        // e.g. "berakhot_2a"
  dafYomi: string;        // e.g. "ברכות ב׳ ע״א"
  masechet: string;       // Sefaria name e.g. "Berakhot"
}

type ViewMode = "list" | "split";

export default function PsakeiDinDafPanel({
  tractate,
  daf,
  sugyaId,
  dafYomi,
  masechet,
}: PsakeiDinDafPanelProps) {
  const { data: psakim, isLoading } = usePsakimForDaf(tractate, daf);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPsak, setSelectedPsak] = useState<DafPsak | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewerSelectOpen, setViewerSelectOpen] = useState(false);
  const [embeddedPdfOpen, setEmbeddedPdfOpen] = useState(false);
  const [defaultViewer, setDefaultViewer] = useState<ViewerType | null>(
    () => localStorage.getItem(PSAK_VIEWER_DEFAULT_KEY) as ViewerType | null
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenPsak = (psak: DafPsak) => {
    setSelectedPsak(psak);
    const saved = localStorage.getItem(PSAK_VIEWER_DEFAULT_KEY) as ViewerType | null;
    if (saved === 'regular') {
      setDialogOpen(true);
    } else if (saved === 'embedded-pdf') {
      setEmbeddedPdfOpen(true);
    } else {
      setViewerSelectOpen(true);
    }
  };

  const openViewer = (type: ViewerType) => {
    setViewerSelectOpen(false);
    if (type === 'regular') {
      setDialogOpen(true);
    } else {
      setEmbeddedPdfOpen(true);
    }
  };

  const setAsDefault = (type: ViewerType) => {
    localStorage.setItem(PSAK_VIEWER_DEFAULT_KEY, type);
    setDefaultViewer(type);
    toast.success(type === 'regular' ? 'צפיין רגיל נקבע כברירת מחדל' : 'PDF מוטמע נקבע כברירת מחדל');
    openViewer(type);
  };

  const clearDefault = () => {
    localStorage.removeItem(PSAK_VIEWER_DEFAULT_KEY);
    setDefaultViewer(null);
    toast.info('ברירת מחדל אופסה — תתבקש לבחור בכל פעם');
  };

  const handleSelectForSplit = (psak: DafPsak) => {
    setSelectedPsak(psak);
    setViewMode("split");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!psakim || psakim.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Scale className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-1">
          אין פסקי דין מקושרים
        </h3>
        <p className="text-sm text-muted-foreground">
          לא נמצאו פסקי דין שמפנים לדף זה באינדקס המתקדם.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">
            פסקי דין מהאינדקס ({psakim.length})
          </h3>
          {defaultViewer && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                    onClick={clearDefault}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {defaultViewer === 'regular' ? 'צפיין רגיל' : 'PDF מוטמע'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>לחץ לניקוי ברירת מחדל</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-1.5 h-8 text-xs"
          >
            <List className="w-3.5 h-3.5" />
            רשימה
          </Button>
          <Button
            variant={viewMode === "split" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("split");
              if (!selectedPsak && psakim.length > 0) setSelectedPsak(psakim[0]);
            }}
            className="gap-1.5 h-8 text-xs"
          >
            <Columns2 className="w-3.5 h-3.5" />
            תצוגה מקבילה
          </Button>
        </div>
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {psakim.map((psak) => (
            <PsakCard
              key={psak.id}
              psak={psak}
              expanded={expandedIds.has(psak.id)}
              onToggle={() => toggleExpand(psak.id)}
              onOpen={() => handleOpenPsak(psak)}
              onSplitView={() => handleSelectForSplit(psak)}
            />
          ))}
        </div>
      )}

      {/* Split View */}
      {viewMode === "split" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left panel - Gemara text */}
          <Card className="overflow-hidden">
            <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">טקסט הגמרא — {dafYomi}</span>
            </div>
            <div className="h-[60vh] overflow-auto">
              <Suspense
                fallback={
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                }
              >
                <GemaraTextPanel sugyaId={sugyaId} dafYomi={dafYomi} masechet={masechet} />
              </Suspense>
            </div>
          </Card>

          {/* Right panel - Selected Psak Din */}
          <Card className="overflow-hidden">
            <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm truncate">
                {selectedPsak?.title || "בחר פסק דין"}
              </span>
            </div>

            {/* Psak selector strip */}
            <ScrollArea className="border-b" dir="rtl">
              <div className="flex gap-1 p-2">
                {psakim.map((p) => (
                  <Button
                    key={p.id}
                    variant={selectedPsak?.id === p.id ? "default" : "ghost"}
                    size="sm"
                    className="shrink-0 text-xs h-7 px-2"
                    onClick={() => setSelectedPsak(p)}
                  >
                    {p.title.length > 30 ? p.title.slice(0, 30) + "…" : p.title}
                  </Button>
                ))}
              </div>
            </ScrollArea>

            {/* Psak content */}
            {selectedPsak ? (
              <ScrollArea className="h-[calc(60vh-80px)]" dir="rtl">
                <div className="p-4 space-y-4">
                  {/* Meta */}
                  <div className="space-y-2">
                    <h3 className="text-base font-bold">{selectedPsak.title}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{selectedPsak.court}</span>
                      <span>•</span>
                      <span>{selectedPsak.year}</span>
                      {selectedPsak.case_number && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{selectedPsak.case_number}</span>
                        </>
                      )}
                    </div>
                    {selectedPsak.tags && selectedPsak.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedPsak.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* References to this daf */}
                  <div className="bg-primary/5 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-primary">הפניות לדף זה:</p>
                    {selectedPsak.references.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] shrink-0",
                            ref.source === "ai"
                              ? "border-blue-300 text-blue-700"
                              : "border-amber-300 text-amber-700"
                          )}
                        >
                          {ref.source === "ai" ? "AI" : "Regex"}
                        </Badge>
                        <span className="truncate">
                          {ref.corrected_normalized || ref.normalized}
                        </span>
                        {ref.confidence === "high" && (
                          <Badge variant="default" className="text-[9px] h-4 bg-green-600">
                            גבוה
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">תקציר</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {selectedPsak.summary}
                    </p>
                  </div>

                  {/* Full text */}
                  {selectedPsak.full_text && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">טקסט מלא</h4>
                      <div className="text-sm leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto border rounded p-3 bg-background">
                        {selectedPsak.full_text}
                      </div>
                    </div>
                  )}

                  {/* Source URL */}
                  {selectedPsak.source_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      asChild
                    >
                      <a
                        href={selectedPsak.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        צפייה בפסק הדין המקורי
                      </a>
                    </Button>
                  )}

                  {/* Open full dialog */}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleOpenPsak(selectedPsak)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    פתח תצוגה מלאה
                  </Button>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                בחר פסק דין מהרשימה למעלה
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PsakDinViewDialog */}
      <Suspense fallback={null}>
        <PsakDinViewDialog
          psak={
            selectedPsak
              ? {
                  id: selectedPsak.id,
                  title: selectedPsak.title,
                  court: selectedPsak.court,
                  year: selectedPsak.year,
                  case_number: selectedPsak.case_number,
                  summary: selectedPsak.summary,
                  full_text: selectedPsak.full_text,
                  source_url: selectedPsak.source_url,
                  tags: selectedPsak.tags,
                }
              : null
          }
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </Suspense>

      {/* Viewer Selection Dialog */}
      <Dialog open={viewerSelectOpen} onOpenChange={setViewerSelectOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">בחר צפיין לפסק הדין</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Regular Viewer */}
            <div className="relative group">
              <button
                onClick={() => openViewer('regular')}
                className={cn(
                  "w-full flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all hover:shadow-md hover:border-primary/50",
                  defaultViewer === 'regular' ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <FileText className="w-10 h-10 text-primary" />
                <span className="font-semibold text-sm">צפיין רגיל</span>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  תצוגה עם עריכה, חיפוש ועיצוב טקסט
                </span>
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAsDefault('regular'); }}
                      className={cn(
                        "absolute top-2 left-2 p-1 rounded-full transition-colors",
                        defaultViewer === 'regular'
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-muted-foreground/40 hover:text-amber-500"
                      )}
                    >
                      <Star className={cn("w-4 h-4", defaultViewer === 'regular' && "fill-current")} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {defaultViewer === 'regular' ? 'ברירת מחדל נוכחית' : 'קבע כברירת מחדל'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {defaultViewer === 'regular' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearDefault(); }}
                        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground/40 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">נקה ברירת מחדל</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Embedded PDF Viewer */}
            <div className="relative group">
              <button
                onClick={() => openViewer('embedded-pdf')}
                className={cn(
                  "w-full flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all hover:shadow-md hover:border-primary/50",
                  defaultViewer === 'embedded-pdf' ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <Globe className="w-10 h-10 text-blue-600" />
                <span className="font-semibold text-sm">PDF מוטמע</span>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  צפייה ישירה בקובץ המקורי מהאתר
                </span>
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAsDefault('embedded-pdf'); }}
                      className={cn(
                        "absolute top-2 left-2 p-1 rounded-full transition-colors",
                        defaultViewer === 'embedded-pdf'
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-muted-foreground/40 hover:text-amber-500"
                      )}
                    >
                      <Star className={cn("w-4 h-4", defaultViewer === 'embedded-pdf' && "fill-current")} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {defaultViewer === 'embedded-pdf' ? 'ברירת מחדל נוכחית' : 'קבע כברירת מחדל'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {defaultViewer === 'embedded-pdf' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearDefault(); }}
                        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground/40 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">נקה ברירת מחדל</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded PDF Viewer Dialog */}
      <Dialog open={embeddedPdfOpen} onOpenChange={setEmbeddedPdfOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0" dir="rtl">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-5 h-5 text-blue-600 shrink-0" />
              <h3 className="font-bold text-sm truncate">{selectedPsak?.title}</h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {defaultViewer === 'embedded-pdf' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={clearDefault}>
                        <RotateCcw className="w-3 h-3" />
                        נקה ברירת מחדל
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>נקה ברירת מחדל כדי לבחור צפיין בכל פעם</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {selectedPsak?.source_url && (
                <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                  <a href={selectedPsak.source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEmbeddedPdfOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {selectedPsak?.source_url ? (
              <iframe
                src={selectedPsak.source_url}
                className="w-full h-full border-0"
                title={selectedPsak.title}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Globe className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-medium">אין כתובת מקור לפסק דין זה</p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => {
                  setEmbeddedPdfOpen(false);
                  setDialogOpen(true);
                }}>
                  <FileText className="w-3.5 h-3.5" />
                  פתח בצפיין הרגיל
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-component: Single Psak Card ─── */

function PsakCard({
  psak,
  expanded,
  onToggle,
  onOpen,
  onSplitView,
}: {
  psak: DafPsak;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSplitView: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h4 className="text-sm font-bold leading-tight">{psak.title}</h4>
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <span>{psak.court}</span>
              <span>•</span>
              <span>{psak.year}</span>
              {psak.case_number && (
                <>
                  <span>•</span>
                  <span className="font-mono">{psak.case_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="secondary" className="text-[10px] gap-1">
              <FileSearch className="w-3 h-3" />
              {psak.references.length} הפניות
            </Badge>
          </div>
        </div>

        {/* Tags */}
        {psak.tags && psak.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {psak.tags.slice(0, 5).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {psak.tags.length > 5 && (
              <Badge variant="outline" className="text-[10px]">
                +{psak.tags.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* References badges */}
        <div className="flex flex-wrap gap-1.5">
          {psak.references.map((ref) => (
            <Badge
              key={ref.id}
              variant="outline"
              className={cn(
                "text-[10px]",
                ref.source === "ai"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              )}
            >
              {ref.source === "ai" ? (
                <Brain className="w-2.5 h-2.5 mr-0.5" />
              ) : (
                <FileSearch className="w-2.5 h-2.5 mr-0.5" />
              )}
              {ref.corrected_normalized || ref.normalized}
            </Badge>
          ))}
        </div>

        {/* Summary - expandable */}
        <div>
          <p
            className={cn(
              "text-xs text-muted-foreground leading-relaxed",
              !expanded && "line-clamp-2"
            )}
          >
            {psak.summary}
          </p>
          {psak.summary.length > 120 && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-0.5"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> פחות
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> עוד
                </>
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 text-xs h-8 flex-1"
            onClick={onOpen}
          >
            <Eye className="w-3.5 h-3.5" />
            פתח פסק דין
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 flex-1"
            onClick={onSplitView}
          >
            <Columns2 className="w-3.5 h-3.5" />
            תצוגה מקבילה
          </Button>
          {psak.source_url && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8 px-2"
              asChild
            >
              <a
                href={psak.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
