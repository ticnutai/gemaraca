import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, BookOpen, FileText, Filter, Sparkles, Brain, 
  Loader2, ChevronLeft, ChevronRight, Library, Tag, 
  BarChart3, Zap, CheckCircle2, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  analyzePsakDin, 
  batchAnalyze, 
  generateIndexSummary,
  AnalysisResult,
  DetectedSource,
  DetectedTopic
} from "@/lib/textAnalyzer";
import PsakDinViewDialog from "./PsakDinViewDialog";

const BATCH_SIZE = 100;

const SmartIndexTab = () => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [selectedForAI, setSelectedForAI] = useState<Set<string>>(new Set());
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMasechet, setSelectedMasechet] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedPsak, setSelectedPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Calculate summary statistics
  const summary = useMemo(() => {
    return generateIndexSummary(analysisResults);
  }, [analysisResults]);

  // Filter results based on search and filters
  const filteredResults = useMemo(() => {
    return analysisResults.filter(result => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = result.title.toLowerCase().includes(query);
        const matchesTopic = result.topics.some(t => t.topic.includes(query));
        const matchesMasechet = result.masechtot.some(m => m.includes(query));
        if (!matchesTitle && !matchesTopic && !matchesMasechet) return false;
      }

      // Category filter
      if (selectedCategory) {
        if (!result.topics.some(t => t.category === selectedCategory)) return false;
      }

      // Masechet filter
      if (selectedMasechet) {
        if (!result.masechtot.includes(selectedMasechet)) return false;
      }

      // Book filter
      if (selectedBook) {
        if (!result.books.includes(selectedBook)) return false;
      }

      return true;
    });
  }, [analysisResults, searchQuery, selectedCategory, selectedMasechet, selectedBook]);

  // Group results by category
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, AnalysisResult[]> = {};
    for (const result of filteredResults) {
      for (const topic of result.topics) {
        if (!groups[topic.category]) {
          groups[topic.category] = [];
        }
        if (!groups[topic.category].find(r => r.id === result.id)) {
          groups[topic.category].push(result);
        }
      }
    }
    return groups;
  }, [filteredResults]);

  // Group results by masechet
  const groupedByMasechet = useMemo(() => {
    const groups: Record<string, AnalysisResult[]> = {};
    for (const result of filteredResults) {
      for (const masechet of result.masechtot) {
        if (!groups[masechet]) {
          groups[masechet] = [];
        }
        groups[masechet].push(result);
      }
    }
    return groups;
  }, [filteredResults]);

  // Run text analysis on all psakim
  const runTextAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResults([]);
    
    try {
      // Get total count
      const { count } = await supabase
        .from('psakei_din')
        .select('*', { count: 'exact', head: true });
      
      const total = count || 0;
      setAnalysisProgress({ current: 0, total });

      const allResults: AnalysisResult[] = [];
      let offset = 0;

      while (offset < total) {
        const { data: psakim, error } = await supabase
          .from('psakei_din')
          .select('id, title, summary, full_text, tags')
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;
        if (!psakim || psakim.length === 0) break;

        const batchResults = batchAnalyze(psakim);
        allResults.push(...batchResults);

        offset += BATCH_SIZE;
        setAnalysisProgress({ current: Math.min(offset, total), total });
        setAnalysisResults([...allResults]);

        // Small delay to prevent UI freeze
        await new Promise(r => setTimeout(r, 50));
      }

      toast({
        title: "ניתוח הושלם",
        description: `נותחו ${allResults.length} פסקי דין`,
      });
    } catch (error) {
      console.error('Error analyzing:', error);
      toast({
        title: "שגיאה בניתוח",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle selection for AI analysis
  const toggleAISelection = (id: string) => {
    setSelectedForAI(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all filtered results for AI
  const selectAllForAI = () => {
    if (selectedForAI.size === filteredResults.length) {
      setSelectedForAI(new Set());
    } else {
      setSelectedForAI(new Set(filteredResults.map(r => r.id)));
    }
  };

  // Run AI analysis on selected items
  const runAIAnalysis = async () => {
    if (selectedForAI.size === 0) {
      toast({
        title: "בחר פסקי דין לניתוח AI",
        variant: "destructive",
      });
      return;
    }

    setAiAnalyzing(true);
    const idsToAnalyze = Array.from(selectedForAI);
    setAiProgress({ current: 0, total: idsToAnalyze.length });

    let successCount = 0;
    
    for (let i = 0; i < idsToAnalyze.length; i++) {
      setAiProgress({ current: i + 1, total: idsToAnalyze.length });
      
      try {
        const { error } = await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: idsToAnalyze[i] }
        });
        
        if (!error) {
          successCount++;
        }
      } catch (err) {
        console.error(`Error analyzing psak ${idsToAnalyze[i]}:`, err);
      }
      
      if (i < idsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setAiAnalyzing(false);
    setSelectedForAI(new Set());
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${successCount} פסקי דין בהצלחה`,
    });
  };

  // Load psak for dialog
  const handlePsakClick = async (id: string) => {
    const { data } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) {
      setSelectedPsak(data);
      setDialogOpen(true);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-row-reverse">
          <div className="text-right">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-row-reverse">
              אינדקס חכם
              <Library className="w-6 h-6 text-primary" />
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              ניתוח טקסט אוטומטי לזיהוי מקורות, נושאים וספרים - ללא שימוש ב-AI
            </p>
          </div>
          
          {analysisResults.length === 0 && !analyzing && (
            <Button onClick={runTextAnalysis} className="gap-2 flex-row-reverse">
              התחל ניתוח
              <Zap className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Analysis Progress */}
        {analyzing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="font-medium">מנתח פסקי דין...</span>
                <span className="mr-auto text-sm">
                  {analysisProgress.current}/{analysisProgress.total}
                </span>
              </div>
              <Progress 
                value={(analysisProgress.current / Math.max(analysisProgress.total, 1)) * 100} 
                className="h-2" 
              />
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {analysisResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{summary.totalAnalyzed}</div>
                <div className="text-sm text-muted-foreground">פסקי דין</div>
              </CardContent>
            </Card>
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-accent">{summary.withSources}</div>
                <div className="text-sm text-muted-foreground">עם מקורות</div>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-secondary/50">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{summary.topMasechtot.length}</div>
                <div className="text-sm text-muted-foreground">מסכתות</div>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-secondary/50">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{summary.topBooks.length}</div>
                <div className="text-sm text-muted-foreground">ספרים</div>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-secondary/50">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{summary.topCategories.length}</div>
                <div className="text-sm text-muted-foreground">קטגוריות</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        {analysisResults.length > 0 && (
          <Tabs defaultValue="browse" className="space-y-4">
            <TabsList className="grid w-full max-w-lg grid-cols-3 mx-auto">
              <TabsTrigger value="browse" className="gap-2 flex-row-reverse">
                עיון לפי נושא
                <Tag className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="masechtot" className="gap-2 flex-row-reverse">
                לפי מסכתות
                <BookOpen className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-2 flex-row-reverse">
                סטטיסטיקות
                <BarChart3 className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            {/* Search and Filters */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-center flex-row-reverse">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="חיפוש בכותרת, נושא או מסכת..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 text-right"
                    />
                  </div>
                  
                  {/* Filter badges */}
                  <div className="flex flex-wrap gap-2">
                    {selectedCategory && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedCategory(null)}
                      >
                        {selectedCategory} ✕
                      </Badge>
                    )}
                    {selectedMasechet && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedMasechet(null)}
                      >
                        {selectedMasechet} ✕
                      </Badge>
                    )}
                    {selectedBook && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer gap-1"
                        onClick={() => setSelectedBook(null)}
                      >
                        {selectedBook} ✕
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredResults.length} תוצאות
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Analysis Selection */}
            {filteredResults.length > 0 && (
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="p-3 flex items-center justify-between flex-row-reverse">
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <Brain className="w-5 h-5 text-accent" />
                    <div className="text-right">
                      <p className="font-medium text-sm">ניתוח AI מעמיק</p>
                      <p className="text-xs text-muted-foreground">
                        בחר פסקי דין לניתוח עמוק וחילוץ מקורות מדויקים
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllForAI}
                    >
                      {selectedForAI.size === filteredResults.length ? 'בטל הכל' : `בחר הכל (${filteredResults.length})`}
                    </Button>
                    {selectedForAI.size > 0 && (
                      <Button
                        size="sm"
                        onClick={runAIAnalysis}
                        disabled={aiAnalyzing}
                        className="gap-2 flex-row-reverse"
                      >
                        {aiAnalyzing ? (
                          <>
                            מנתח...
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </>
                        ) : (
                          <>
                            נתח {selectedForAI.size} פסקים
                            <Sparkles className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Analysis Progress */}
            {aiAnalyzing && (
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                    <Brain className="w-5 h-5 text-accent animate-pulse" />
                    <span className="font-medium">מנתח באמצעות AI...</span>
                    <span className="mr-auto text-sm">
                      {aiProgress.current}/{aiProgress.total}
                    </span>
                  </div>
                  <Progress 
                    value={(aiProgress.current / Math.max(aiProgress.total, 1)) * 100} 
                    className="h-2" 
                  />
                </CardContent>
              </Card>
            )}

            {/* Browse by Topic Tab */}
            <TabsContent value="browse">
              <ScrollArea className="h-[600px]">
                <Accordion type="multiple" className="space-y-2">
                  {Object.entries(groupedByCategory)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([category, results]) => (
                      <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                        <AccordionTrigger className="flex-row-reverse">
                          <div className="flex items-center gap-3 flex-row-reverse flex-1">
                            <Tag className="w-4 h-4 text-primary" />
                            <span className="font-medium">{category}</span>
                            <Badge variant="secondary">{results.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {results.slice(0, 20).map(result => (
                              <Card 
                                key={result.id}
                                className={`cursor-pointer hover:shadow-md transition-shadow ${
                                  selectedForAI.has(result.id) ? 'border-accent ring-1 ring-accent' : ''
                                }`}
                              >
                                <CardContent className="p-3 flex items-start gap-3 flex-row-reverse">
                                  <Checkbox
                                    checked={selectedForAI.has(result.id)}
                                    onCheckedChange={() => toggleAISelection(result.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div 
                                    className="flex-1 text-right"
                                    onClick={() => handlePsakClick(result.id)}
                                  >
                                    <div className="font-medium text-sm line-clamp-1">{result.title}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {result.masechtot.slice(0, 3).map(m => (
                                        <Badge key={m} variant="outline" className="text-xs">
                                          {m}
                                        </Badge>
                                      ))}
                                      {result.books.slice(0, 2).map(b => (
                                        <Badge key={b} variant="secondary" className="text-xs">
                                          {b}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  {result.sources.length > 0 && (
                                    <Badge variant="default" className="text-xs shrink-0">
                                      {result.sources.length} מקורות
                                    </Badge>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                            {results.length > 20 && (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                ועוד {results.length - 20} פסקי דין נוספים...
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </ScrollArea>
            </TabsContent>

            {/* Masechtot Tab */}
            <TabsContent value="masechtot">
              <ScrollArea className="h-[600px]">
                <Accordion type="multiple" className="space-y-2">
                  {Object.entries(groupedByMasechet)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([masechet, results]) => (
                      <AccordionItem key={masechet} value={masechet} className="border rounded-lg px-4">
                        <AccordionTrigger className="flex-row-reverse">
                          <div className="flex items-center gap-3 flex-row-reverse flex-1">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <span className="font-medium">{masechet}</span>
                            <Badge variant="secondary">{results.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {results.slice(0, 20).map(result => (
                              <Card 
                                key={result.id}
                                className={`cursor-pointer hover:shadow-md transition-shadow ${
                                  selectedForAI.has(result.id) ? 'border-accent ring-1 ring-accent' : ''
                                }`}
                              >
                                <CardContent className="p-3 flex items-start gap-3 flex-row-reverse">
                                  <Checkbox
                                    checked={selectedForAI.has(result.id)}
                                    onCheckedChange={() => toggleAISelection(result.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div 
                                    className="flex-1 text-right"
                                    onClick={() => handlePsakClick(result.id)}
                                  >
                                    <div className="font-medium text-sm line-clamp-1">{result.title}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {result.sources
                                        .filter(s => s.masechet === masechet && s.daf)
                                        .slice(0, 3)
                                        .map((s, i) => (
                                          <Badge key={i} variant="outline" className="text-xs">
                                            דף {s.daf}{s.amud ? ` ע"${s.amud}` : ''}
                                          </Badge>
                                        ))}
                                      {result.topics.slice(0, 2).map(t => (
                                        <Badge key={t.topic} variant="secondary" className="text-xs">
                                          {t.topic}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                            {results.length > 20 && (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                ועוד {results.length - 20} פסקי דין נוספים...
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </ScrollArea>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Top Masechtot */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse">
                      מסכתות מובילות
                      <BookOpen className="w-5 h-5 text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.topMasechtot.map((m, i) => (
                        <div 
                          key={m.name} 
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded"
                          onClick={() => setSelectedMasechet(m.name)}
                        >
                          <Badge variant={i < 3 ? "default" : "secondary"}>{m.count}</Badge>
                          <span className="text-sm">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Books */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse">
                      ספרים מובילים
                      <Library className="w-5 h-5 text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.topBooks.map((b, i) => (
                        <div 
                          key={b.name} 
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded"
                          onClick={() => setSelectedBook(b.name)}
                        >
                          <Badge variant={i < 3 ? "default" : "secondary"}>{b.count}</Badge>
                          <span className="text-sm">{b.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Categories */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 flex-row-reverse">
                      קטגוריות מובילות
                      <Tag className="w-5 h-5 text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.topCategories.map((c, i) => (
                        <div 
                          key={c.name} 
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded"
                          onClick={() => setSelectedCategory(c.name)}
                        >
                          <Badge variant={i < 3 ? "default" : "secondary"}>{c.count}</Badge>
                          <span className="text-sm">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {!analyzing && analysisResults.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <Library className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">אינדקס חכם</h3>
              <p className="text-muted-foreground mb-4">
                לחץ על "התחל ניתוח" כדי לסרוק את כל פסקי הדין במערכת ולבנות אינדקס לפי נושאים, מסכתות וספרים
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                <Badge variant="outline">זיהוי מסכתות גמרא</Badge>
                <Badge variant="outline">זיהוי שולחן ערוך</Badge>
                <Badge variant="outline">זיהוי רמב"ם</Badge>
                <Badge variant="outline">מיון לפי נושאים</Badge>
              </div>
              <Button onClick={runTextAnalysis} size="lg" className="gap-2 flex-row-reverse">
                התחל ניתוח
                <Zap className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Psak Dialog */}
        <PsakDinViewDialog
          psak={selectedPsak}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </div>
  );
};

export default SmartIndexTab;
