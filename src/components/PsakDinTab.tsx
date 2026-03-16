import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Building2, FileText, List, BookOpen, Sparkles, Brain, Loader2,
  Link, Plus, Pencil, Trash2, Download, Search, Filter, ArrowUpDown, FileSpreadsheet,
  Paintbrush,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import PsakDinViewDialog from "./PsakDinViewDialog";
import PsakPreviewPopover from "./PsakPreviewPopover";
import PsakDinEditDialog from "./PsakDinEditDialog";
import BulkActionsBar from "./BulkActionsBar";
import FileTypeBadge from "./FileTypeBadge";
import GemaraPsakDinIndex from "./GemaraPsakDinIndex";
import { useToast } from "@/hooks/use-toast";
import { cachePsakim, getAllCachedPsakim, type CachedPsak } from "@/lib/psakCache";
import { exportPsakimToCsv } from "@/lib/csvExporter";
import { cn } from "@/lib/utils";
import type { PsakDinRow } from "@/types/psakDin";

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAGE_SIZE = 50;

const PsakDinTab = () => {
  const [psakim, setPsakim] = useState<PsakDinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPsak, setSelectedPsak] = useState<PsakDinRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [psakLinks, setPsakLinks] = useState<Map<string, number>>(new Map());
  const [totalUnlinkedCount, setTotalUnlinkedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPsak, setEditingPsak] = useState<PsakDinRow | null>(null);
  const [isNewPsak, setIsNewPsak] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("year-desc");
  const [courts, setCourts] = useState<string[]>([]);
  const { toast } = useToast();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPsakim([]);
      setHasMore(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset on filter/sort change
  useEffect(() => {
    setPsakim([]);
    setHasMore(true);
  }, [courtFilter, sortOrder]);

  // Load courts for filter
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('psakei_din').select('court').order('court');
      if (data) setCourts([...new Set(data.map(r => r.court).filter(Boolean))].sort());
    })();
  }, []);

  useEffect(() => {
    loadPsakim(0, true);
    loadTotalUnlinkedCount();
  }, [debouncedSearch, courtFilter, sortOrder]);

  // React Query for link counts
  const psakIds = psakim.map(p => p.id);
  const { data: linkCountsData } = useQuery({
    queryKey: ['psak-link-counts', psakIds],
    queryFn: async () => {
      if (psakIds.length === 0) return new Map<string, number>();
      const counts = new Map<string, number>();
      const { data, error } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id')
        .in('psak_din_id', psakIds);
      if (error) throw error;
      (data || []).forEach(link => {
        counts.set(link.psak_din_id, (counts.get(link.psak_din_id) || 0) + 1);
      });
      return counts;
    },
    enabled: psakIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (linkCountsData) {
      setPsakLinks(prev => {
        const merged = new Map(prev);
        linkCountsData.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }
  }, [linkCountsData]);

  const loadPsakim = useCallback(async (offset: number, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      // Show cached data on first load (only without filters)
      if (isInitial && offset === 0 && !debouncedSearch && courtFilter === 'all') {
        const cached = await getAllCachedPsakim();
        if (cached.length > 0) {
          const sorted = cached.sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, PAGE_SIZE);
          setPsakim(sorted as unknown as PsakDinRow[]);
          setLoading(false);
        }
      }

      const ascending = sortOrder === 'year-asc' || sortOrder === 'title-asc';
      const orderCol = sortOrder.startsWith('title') ? 'title' : 'year';

      let query = supabase
        .from('psakei_din')
        .select('*', { count: 'exact' })
        .order(orderCol, { ascending });

      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,court.ilike.%${debouncedSearch}%,summary.ilike.%${debouncedSearch}%`);
      }
      if (courtFilter !== 'all') {
        query = query.eq('court', courtFilter);
      }

      const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const newData = data || [];
      setTotalCount(count || 0);
      setHasMore(newData.length === PAGE_SIZE);

      if (isInitial) {
        setPsakim(newData);
      } else {
        setPsakim(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const unique = newData.filter(i => !existingIds.has(i.id));
          return [...prev, ...unique];
        });
      }

      // Cache
      if (newData.length > 0) {
        const toCache: CachedPsak[] = newData.map((p) => ({
          id: p.id, title: p.title, court: p.court || '', year: p.year || 0,
          summary: p.summary || '', full_text: p.full_text || null,
          source_url: p.source_url || null, case_number: p.case_number || null,
          tags: p.tags || [], _cachedAt: Date.now(),
        }));
        cachePsakim(toCache);
      }
    } catch (error) {
      console.error('Error loading psakim:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, courtFilter, sortOrder]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadPsakim(psakim.length, false);
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, psakim.length, loadPsakim]);

  const loadTotalUnlinkedCount = async () => {
    try {
      const { count: totalPsakim } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });
      const { count: linkedCount } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id', { count: 'exact', head: true });
      setTotalUnlinkedCount(Math.max(0, (totalPsakim || 0) - (linkedCount || 0)));
    } catch (error) {
      console.error('Error loading unlinked count:', error);
    }
  };

  const handlePsakClick = (psak: PsakDinRow) => {
    if (psak.source_url) {
      navigate(`/embedpdf-viewer?url=${encodeURIComponent(psak.source_url)}&psakId=${psak.id}`);
    } else {
      setSelectedPsak(psak);
      setDialogOpen(true);
    }
  };

  const handleEditPsak = (psakId: string) => {
    const psak = psakim.find(p => p.id === psakId);
    if (psak) {
      setEditingPsak(psak);
      setIsNewPsak(false);
      setEditDialogOpen(true);
    }
  };

  const handleAddNew = () => {
    setEditingPsak(null);
    setIsNewPsak(true);
    setEditDialogOpen(true);
  };

  const handleEditSaved = () => {
    loadPsakim(0, true);
  };

  const handleDeletePsak = async (psakId?: string) => {
    if (psakId) {
      // Single delete
      try {
        await supabase.from('sugya_psak_links').delete().eq('psak_din_id', psakId);
        await supabase.from('pattern_sugya_links').delete().eq('psak_din_id', psakId);
        await supabase.from('talmud_references').delete().eq('psak_din_id', psakId);
        await supabase.from('psakei_din').delete().eq('id', psakId);
        setPsakim(prev => prev.filter(p => p.id !== psakId));
        setTotalCount(prev => prev - 1);
        toast({ title: 'פסק הדין נמחק בהצלחה' });
      } catch (err) {
        toast({ title: 'שגיאה במחיקה', variant: 'destructive' });
      }
    } else {
      loadPsakim(0, true);
      loadTotalUnlinkedCount();
    }
  };

  const handleDownloadSingle = (psak: PsakDinRow) => {
    const content = psak.full_text || psak.summary || '';
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>${escapeHtml(psak.title)}</title>
<style>body{font-family:'David',serif;max-width:800px;margin:0 auto;padding:20px;direction:rtl;line-height:1.8}h1{color:#1a365d;border-bottom:2px solid #2b6cb0;padding-bottom:10px}.meta{background:#f7fafc;padding:12px;border-radius:8px;margin-bottom:20px;color:#4a5568}.content{white-space:pre-wrap}</style>
</head><body><h1>${escapeHtml(psak.title)}</h1><div class="meta"><span>בית דין: ${escapeHtml(psak.court)}</span> <span>שנה: ${psak.year}</span></div><div class="content">${escapeHtml(content)}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${psak.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedForBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllForBulk = () => {
    setSelectedForBulk(new Set(psakim.map(p => p.id)));
  };

  const clearBulkSelection = () => {
    setSelectedForBulk(new Set());
  };

  const toggleSelectForAnalysis = useCallback((id: string) => {
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const selectAllForAnalysis = () => {
    const unlinkedPsakim = psakim.filter(p => !psakLinks.has(p.id));
    if (selectedForAnalysis.size === unlinkedPsakim.length) {
      setSelectedForAnalysis(new Set());
    } else {
      setSelectedForAnalysis(new Set(unlinkedPsakim.map(p => p.id)));
    }
  };

  const runAIAnalysis = async () => {
    if (selectedForAnalysis.size === 0) {
      toast({ title: "בחר פסקי דין לניתוח", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    const idsToAnalyze = Array.from(selectedForAnalysis);
    setAnalysisProgress({ current: 0, total: idsToAnalyze.length });
    let successCount = 0;
    let failedCount = 0;
    for (let i = 0; i < idsToAnalyze.length; i++) {
      setAnalysisProgress({ current: i + 1, total: idsToAnalyze.length });
      try {
        const { error } = await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: idsToAnalyze[i] }
        });
        if (!error) successCount++;
        else failedCount++;
      } catch (err) {
        console.error(`Error analyzing psak ${idsToAnalyze[i]}:`, err);
        failedCount++;
      }
      if (i < idsToAnalyze.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
    }
    setAnalyzing(false);
    setSelectedForAnalysis(new Set());
    await loadTotalUnlinkedCount();
    await loadPsakim(0, true);
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${successCount} פסקי דין בהצלחה${failedCount > 0 ? ` (${failedCount} נכשלו)` : ''}`,
      variant: failedCount > 0 ? 'destructive' : 'default',
    });
  };

  const displayedUnlinkedCount = psakim.filter(p => !psakLinks.has(p.id)).length;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 ml-auto">
            <TabsTrigger value="recent" className="gap-2 flex-row-reverse">
              פסקי דין אחרונים
              <List className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="index" className="gap-2 flex-row-reverse">
              אינדקס לפי מסכתות
              <BookOpen className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            {loading && psakim.length === 0 ? (
              <div className="space-y-4 py-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 flex-row-reverse">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">פסקי דין</h2>
                    <Badge variant="secondary">{totalCount.toLocaleString()} פסקים</Badge>
                    <Button size="sm" onClick={handleAddNew} className="gap-2">
                      <Plus className="w-4 h-4" />
                      הוסף
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportPsakimToCsv(psakim)}
                      disabled={psakim.length === 0}
                      className="gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      ייצא CSV
                    </Button>
                  </div>
                  {totalUnlinkedCount > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {totalUnlinkedCount} פסקים ללא קישור
                      </span>
                      {selectedForAnalysis.size > 0 && (
                        <Button size="sm" onClick={runAIAnalysis} disabled={analyzing} className="gap-2 flex-row-reverse">
                          {analyzing ? (<><span>מנתח...</span><Loader2 className="w-4 h-4 animate-spin" /></>) : (<><span>נתח {selectedForAnalysis.size} פסקים</span><Sparkles className="w-4 h-4" /></>)}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-lg p-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש לפי כותרת, בית דין, תקציר..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-9"
                    />
                  </div>
                  <Select value={courtFilter} onValueChange={setCourtFilter}>
                    <SelectTrigger className="w-[170px]">
                      <Filter className="w-4 h-4 ml-2" />
                      <SelectValue placeholder="בית דין" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל בתי הדין</SelectItem>
                      {courts.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger className="w-[140px]">
                      <ArrowUpDown className="w-4 h-4 ml-2" />
                      <SelectValue placeholder="מיון" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="year-desc">שנה (חדש→ישן)</SelectItem>
                      <SelectItem value="year-asc">שנה (ישן→חדש)</SelectItem>
                      <SelectItem value="title-asc">שם (א-ת)</SelectItem>
                      <SelectItem value="title-desc">שם (ת-א)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                  selectedCount={selectedForBulk.size}
                  totalCount={psakim.length}
                  onSelectAll={selectAllForBulk}
                  onClearSelection={clearBulkSelection}
                  selectedIds={Array.from(selectedForBulk)}
                  onDeleted={() => handleDeletePsak()}
                />

                {/* Analysis Progress */}
                {analyzing && (
                  <Card className="border border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                        <Brain className="w-5 h-5 text-primary animate-pulse" />
                        <span className="font-medium">מנתח פסקי דין באמצעות AI...</span>
                        <span className="ml-auto text-sm">{analysisProgress.current}/{analysisProgress.total}</span>
                      </div>
                      <Progress value={(analysisProgress.current / analysisProgress.total) * 100} className="h-2" />
                    </CardContent>
                  </Card>
                )}

                {/* Select All for Analysis */}
                {displayedUnlinkedCount > 0 && !analyzing && (
                  <Card className="border border-accent/30 bg-accent/5">
                    <CardContent className="p-3 flex items-center justify-between flex-row-reverse">
                      <div className="flex items-center gap-3 flex-row-reverse">
                        <Sparkles className="w-5 h-5 text-accent" />
                        <div className="text-right">
                          <p className="font-medium text-sm">ניתוח AI לפסקי דין קיימים</p>
                          <p className="text-xs text-muted-foreground">בחר פסקי דין לניתוח וקישור אוטומטי למקורות גמרא</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={selectAllForAnalysis}>
                        {selectedForAnalysis.size === displayedUnlinkedCount ? 'בטל בחירה' : `בחר הכל (${displayedUnlinkedCount})`}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Items list - infinite scroll */}
                {psakim.length === 0 ? (
                  <Card className="border-dashed border-2">
                    <CardContent className="p-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">אין פסקי דין עדיין</h3>
                      <p className="text-sm text-muted-foreground mb-4">התחל בהעלאת פסקי דין כדי לראות אותם כאן</p>
                      <Button onClick={handleAddNew} className="gap-2">
                        <Plus className="w-4 h-4" />
                        הוסף פסק דין ראשון
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div
                    ref={scrollContainerRef}
                    className="max-h-[70vh] overflow-y-auto space-y-4 pr-1"
                  >
                    {psakim.map((psak) => {
                      const hasLinks = psakLinks.has(psak.id);
                      const linkCount = psakLinks.get(psak.id) || 0;
                      const isSelected = selectedForAnalysis.has(psak.id);
                      const isHovered = hoveredId === psak.id;

                      return (
                        <Card
                          key={psak.id}
                          className={cn(
                            "border shadow-sm hover:shadow-md transition-all relative",
                            isSelected && "border-accent ring-1 ring-accent",
                            selectedForBulk.has(psak.id) && "border-primary ring-1 ring-primary"
                          )}
                          onMouseEnter={() => setHoveredId(psak.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <CardContent className="p-4">
                            {/* Top Row: Title + Hover Actions */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 cursor-pointer" onClick={() => handlePsakClick(psak)}>
                                <h3 className="text-lg font-semibold text-foreground text-right mb-2 leading-tight flex items-center gap-2 justify-end">
                                  {(psak as Record<string, unknown>).beautify_count && Number((psak as Record<string, unknown>).beautify_count) > 0 && (
                                    <Badge className="gap-1 text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:text-amber-400">
                                      <Paintbrush className="w-3 h-3" />
                                      עוצב {Number((psak as Record<string, unknown>).beautify_count)}
                                    </Badge>
                                  )}
                                  <FileTypeBadge url={psak.source_url} size="sm" />
                                  {psak.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground justify-end">
                                  <div className="flex items-center gap-1">
                                    <span>{psak.court}</span>
                                    <Building2 className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>{psak.year}</span>
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                  {psak.case_number && (
                                    <div className="flex items-center gap-1">
                                      <span>{psak.case_number}</span>
                                      <FileText className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Hover action icons + checkbox */}
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Hover icons - only visible on hover */}
                                <div className={cn(
                                  "flex items-center gap-0.5 transition-opacity duration-150",
                                  isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
                                )}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    title="ערוך שם"
                                    onClick={(e) => { e.stopPropagation(); handleEditPsak(psak.id); }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    title="מחק"
                                    onClick={(e) => { e.stopPropagation(); handleDeletePsak(psak.id); }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    title="הורד"
                                    onClick={(e) => { e.stopPropagation(); handleDownloadSingle(psak); }}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>

                                <Checkbox
                                  checked={selectedForBulk.has(psak.id)}
                                  onCheckedChange={() => toggleBulkSelect(psak.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />

                                {!hasLinks && !analyzing && (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelectForAnalysis(psak.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="בחר לניתוח AI"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Summary */}
                            <p
                              className="text-foreground mb-4 line-clamp-2 text-right cursor-pointer"
                              onClick={() => handlePsakClick(psak)}
                            >
                              {psak.summary}
                            </p>

                            {/* Bottom Row: Status + Tags */}
                            <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                              <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                                {psak.tags && psak.tags.slice(0, 4).map((tag: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 bg-muted/60 text-muted-foreground">
                                    {tag}
                                  </Badge>
                                ))}
                                {psak.tags && psak.tags.length > 4 && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5">+{psak.tags.length - 4}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <PsakPreviewPopover psakDinId={psak.id} psakTitle={psak.title} mode="facts" />
                                <PsakPreviewPopover psakDinId={psak.id} psakTitle={psak.title} mode="summary" />
                                {hasLinks ? (
                                  <Badge className="gap-1.5 text-xs px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                                    <Link className="w-3 h-3" />
                                    <span>{linkCount} קישורים</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground border-dashed">לא מנותח</Badge>
                                )}
                                {!hasLinks && !analyzing && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setSelectedForAnalysis(new Set([psak.id]));
                                      await runAIAnalysis();
                                    }}
                                    className="h-7 px-2 gap-1 text-xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>נתח</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Sentinel for infinite scroll */}
                    {hasMore && (
                      <div ref={sentinelRef} className="p-4 flex justify-center">
                        {loadingMore && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">טוען עוד...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Loaded count */}
                {psakim.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    מוצגים {psakim.length.toLocaleString()} מתוך {totalCount.toLocaleString()} פסקי דין
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="index">
            <GemaraPsakDinIndex />
          </TabsContent>
        </Tabs>

        <PsakDinViewDialog psak={selectedPsak} open={dialogOpen} onOpenChange={setDialogOpen} />
        <PsakDinEditDialog psak={editingPsak} open={editDialogOpen} onOpenChange={setEditDialogOpen} onSaved={handleEditSaved} isNew={isNewPsak} />
      </div>
    </div>
  );
};

export default PsakDinTab;
