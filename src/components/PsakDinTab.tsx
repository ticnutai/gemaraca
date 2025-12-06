import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, FileText, List, BookOpen, Sparkles, Brain, Loader2, Link } from "lucide-react";
import PsakDinViewDialog from "./PsakDinViewDialog";
import GemaraPsakDinIndex from "./GemaraPsakDinIndex";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    loadPsakim();
    loadLinkCounts();
    loadTotalUnlinkedCount();
  }, []);

  const loadPsakim = async () => {
    try {
      const { data, error } = await supabase
        .from('psakei_din')
        .select('*')
        .order('year', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPsakim(data || []);
    } catch (error) {
      console.error('Error loading psakim:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLinkCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');

      if (error) throw error;

      const counts = new Map<string, number>();
      data?.forEach(link => {
        counts.set(link.psak_din_id, (counts.get(link.psak_din_id) || 0) + 1);
      });
      setPsakLinks(counts);
    } catch (error) {
      console.error('Error loading link counts:', error);
    }
  };

  const loadTotalUnlinkedCount = async () => {
    try {
      // Get total psakei din count
      const { count: totalCount } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });

      // Get linked psakei din count  
      const { data: linkedData } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');
      
      const uniqueLinkedIds = new Set(linkedData?.map(l => l.psak_din_id) || []);
      
      setTotalUnlinkedCount((totalCount || 0) - uniqueLinkedIds.size);
    } catch (error) {
      console.error('Error loading unlinked count:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    setSelectedPsak(psak);
    setDialogOpen(true);
  };

  const toggleSelectForAnalysis = (id: string) => {
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

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
    
    await loadLinkCounts();
    
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
              <div className="text-center py-8 text-muted-foreground">טוען...</div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 flex-row-reverse">
                  <h2 className="text-2xl font-bold text-foreground">פסקי דין אחרונים</h2>
                  
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
                
                {psakim.map((psak) => {
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
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3 flex-row-reverse">
                          {/* Quick Analyze Button - Right side in RTL */}
                          {!hasLinks && !analyzing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setSelectedForAnalysis(new Set([psak.id]));
                                await runAIAnalysis();
                              }}
                              className="gap-1 flex-row-reverse shrink-0"
                            >
                              נתח
                              <Sparkles className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {/* Main Content */}
                          <div 
                            className="flex-1 cursor-pointer text-right"
                            onClick={() => handlePsakClick(psak)}
                          >
                            <div className="flex items-center gap-2 flex-row-reverse justify-start">
                              <CardTitle className="text-lg font-semibold text-foreground text-right">
                                {psak.title}
                              </CardTitle>
                              {hasLinks && (
                                <Badge variant="secondary" className="gap-1 text-xs flex-row-reverse">
                                  {linkCount} קישורים
                                  <Link className="w-3 h-3" />
                                </Badge>
                              )}
                              {!hasLinks && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  לא מנותח
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2 justify-start">
                              <div className="flex items-center gap-1 flex-row-reverse">
                                <Building2 className="w-3 h-3 text-primary" />
                                {psak.court}
                              </div>
                              <div className="flex items-center gap-1 flex-row-reverse">
                                <Calendar className="w-3 h-3 text-primary" />
                                {psak.year}
                              </div>
                              {psak.case_number && (
                                <div className="flex items-center gap-1 flex-row-reverse">
                                  <FileText className="w-3 h-3 text-primary" />
                                  {psak.case_number}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Checkbox - Left side in RTL */}
                          {!hasLinks && !analyzing && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectForAnalysis(psak.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 shrink-0"
                            />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent 
                        className="cursor-pointer text-right" 
                        onClick={() => handlePsakClick(psak)}
                      >
                        <p className="text-foreground mb-3 line-clamp-2 text-right">{psak.summary}</p>
                        {psak.tags && psak.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-start">
                            {psak.tags.map((tag: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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
      </div>
    </div>
  );
};

export default PsakDinTab;
