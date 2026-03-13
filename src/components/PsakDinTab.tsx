import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, FileText, List, BookOpen, Sparkles, Brain, Loader2, Link, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import PsakDinViewDialog from "./PsakDinViewDialog";
import PsakDinEditDialog from "./PsakDinEditDialog";
import PsakDinActions from "./PsakDinActions";
import BulkActionsBar from "./BulkActionsBar";
import GemaraPsakDinIndex from "./GemaraPsakDinIndex";
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 50;

const PsakDinTab = () => {
  const [psakim, setPsakim] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPsak, setSelectedPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [psakLinks, setPsakLinks] = useState<Map<string, number>>(new Map());
  const [totalUnlinkedCount, setTotalUnlinkedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPsak, setEditingPsak] = useState<any | null>(null);
  const [isNewPsak, setIsNewPsak] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    loadPsakim(currentPage);
    loadTotalUnlinkedCount();
  }, [currentPage]);

  // React Query for link counts — cached per page of psakim IDs
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
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  // Sync React Query result to state (for compatibility)
  useEffect(() => {
    if (linkCountsData) {
      setPsakLinks(prev => {
        const merged = new Map(prev);
        linkCountsData.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }
  }, [linkCountsData]);

  const loadPsakim = async (page: number) => {
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact' })
        .order('year', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setPsakim(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading psakim:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTotalUnlinkedCount = async () => {
    try {
      const { count: totalPsakim } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });

      // Count distinct linked psakei din (paginated)
      const linkedIds = new Set<string>();
      let offset = 0;
      const PAGE = 1000;
      let more = true;
      while (more) {
        const { data } = await supabase
          .from('sugya_psak_links')
          .select('psak_din_id')
          .range(offset, offset + PAGE - 1);
        if (!data || data.length === 0) { more = false; break; }
        data.forEach(l => linkedIds.add(l.psak_din_id));
        if (data.length < PAGE) more = false;
        offset += PAGE;
      }
      
      setTotalUnlinkedCount((totalPsakim || 0) - linkedIds.size);
    } catch (error) {
      console.error('Error loading unlinked count:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    setSelectedPsak(psak);
    setDialogOpen(true);
  };

  const handleEditPsak = async (psakId: string) => {
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
    loadPsakim(currentPage);
  };

  const handleDeletePsak = () => {
    loadPsakim(currentPage);
    loadTotalUnlinkedCount();
  };

  const toggleBulkSelect = (id: string) => {
    setSelectedForBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
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
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
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
      toast({
        title: "בחר פסקי דין לניתוח",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    const idsToAnalyze = Array.from(selectedForAnalysis);
    setAnalysisProgress({ current: 0, total: idsToAnalyze.length });

    let successCount = 0;
    
    for (let i = 0; i < idsToAnalyze.length; i++) {
      setAnalysisProgress({ current: i + 1, total: idsToAnalyze.length });
      
      try {
        const { error } = await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: idsToAnalyze[i] }
        });
        
        if (!error) {
          successCount++;
        }
        console.log(`Analyzed psak ${idsToAnalyze[i]}`);
      } catch (err) {
        console.error(`Error analyzing psak ${idsToAnalyze[i]}:`, err);
      }
      
      if (i < idsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setAnalyzing(false);
    setSelectedForAnalysis(new Set());
    
    // Reload link counts, page data and refresh the list to update status badges
    await loadLinkCounts();
    await loadTotalUnlinkedCount();
    await loadPsakim(currentPage); // Reload the current page to refresh badges
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${successCount} פסקי דין בהצלחה`,
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
            {loading ? (
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
                <div className="flex items-center justify-between mb-6 flex-row-reverse">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">פסקי דין אחרונים</h2>
                    <Button
                      size="sm"
                      onClick={handleAddNew}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף פסק דין
                    </Button>
                  </div>
                  
                  {totalUnlinkedCount > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {totalUnlinkedCount} פסקים ללא קישור
                      </span>
                      {selectedForAnalysis.size > 0 && (
                        <Button
                          size="sm"
                          onClick={runAIAnalysis}
                          disabled={analyzing}
                          className="gap-2 flex-row-reverse"
                        >
                          {analyzing ? (
                            <>
                              מנתח...
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </>
                          ) : (
                            <>
                              נתח {selectedForAnalysis.size} פסקים
                              <Sparkles className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                  selectedCount={selectedForBulk.size}
                  totalCount={psakim.length}
                  onSelectAll={selectAllForBulk}
                  onClearSelection={clearBulkSelection}
                  selectedIds={Array.from(selectedForBulk)}
                  onDeleted={handleDeletePsak}
                />

                {/* Analysis Progress */}
                {analyzing && (
                  <Card className="border border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                        <Brain className="w-5 h-5 text-primary animate-pulse" />
                        <span className="font-medium">מנתח פסקי דין באמצעות AI...</span>
                        <span className="ml-auto text-sm">
                          {analysisProgress.current}/{analysisProgress.total}
                        </span>
                      </div>
                      <Progress 
                        value={(analysisProgress.current / analysisProgress.total) * 100} 
                        className="h-2" 
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-right">
                        מזהה מקורות תלמודיים ומקשר לדפי גמרא רלוונטיים
                      </p>
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
                          <p className="text-xs text-muted-foreground">
                            בחר פסקי דין לניתוח וקישור אוטומטי למקורות גמרא
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllForAnalysis}
                      >
                        {selectedForAnalysis.size === displayedUnlinkedCount ? 'בטל בחירה' : `בחר הכל (${displayedUnlinkedCount})`}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
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
                ) : psakim.map((psak) => {
                  const hasLinks = psakLinks.has(psak.id);
                  const linkCount = psakLinks.get(psak.id) || 0;
                  const isSelected = selectedForAnalysis.has(psak.id);
                  
                  return (
                    <Card 
                      key={psak.id} 
                      className={`border shadow-sm hover:shadow-md transition-shadow ${
                        isSelected ? 'border-accent ring-1 ring-accent' : 'border-border'
                      }`}
                    >
                      <CardContent className="p-4">
                        {/* Top Row: Title + Action Items */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          {/* Right Side: Title and Meta */}
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => handlePsakClick(psak)}
                          >
                            <h3 className="text-lg font-semibold text-foreground text-right mb-2 leading-tight">
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

                          {/* Left Side: Actions + Checkbox */}
                          <div className="flex items-center gap-1 shrink-0">
                            <PsakDinActions
                              psakId={psak.id}
                              onEdit={handleEditPsak}
                              onDelete={handleDeletePsak}
                              showCheckbox={true}
                              isSelected={selectedForBulk.has(psak.id)}
                              onSelectChange={() => toggleBulkSelect(psak.id)}
                              compact
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

                        {/* Bottom Row: Status Badge + Tags */}
                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                          {/* Right Side: Tags */}
                          <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                            {psak.tags && psak.tags.slice(0, 4).map((tag: string, idx: number) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="text-xs px-2 py-0.5 bg-muted/60 text-muted-foreground"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {psak.tags && psak.tags.length > 4 && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5">
                                +{psak.tags.length - 4}
                              </Badge>
                            )}
                          </div>

                          {/* Left Side: Status Badge + Quick Action */}
                          <div className="flex items-center gap-2 shrink-0">
                            {hasLinks ? (
                              <Badge className="gap-1.5 text-xs px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                                <Link className="w-3 h-3" />
                                <span>{linkCount} קישורים</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground border-dashed">
                                לא מנותח
                              </Badge>
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      הקודם
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="px-2 text-muted-foreground">...</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={loading}
                            className="w-10"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      הבא
                    </Button>
                    <span className="text-sm text-muted-foreground mr-4">
                      עמוד {currentPage} מתוך {totalPages} ({totalCount} פסקי דין)
                    </span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="index">
            <GemaraPsakDinIndex />
          </TabsContent>
        </Tabs>

        <PsakDinViewDialog 
          psak={selectedPsak} 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
        />

        <PsakDinEditDialog
          psak={editingPsak}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={handleEditSaved}
          isNew={isNewPsak}
        />
      </div>
    </div>
  );
};

export default PsakDinTab;
