import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Search, BookOpen, FileText, Sparkles, Brain, 
  Loader2, Library, Tag, BarChart3, Zap, Link2, 
  ExternalLink, Save, Database, RefreshCw, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  analyzePsakDin, 
  batchAnalyze, 
  generateIndexSummary,
  AnalysisResult,
  DetectedSource,
} from "@/lib/textAnalyzer";
import PsakDinViewDialog from "./PsakDinViewDialog";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";

const BATCH_SIZE = 500;
const STORAGE_KEY = 'smart_index_last_run';

const SmartIndexTab = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [savedCount, setSavedCount] = useState(0);
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

  // Load saved results on mount
  useEffect(() => {
    loadSavedResults();
  }, []);

  // Load previously saved analysis results from database
  const loadSavedResults = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('smart_index_results')
        .select(`
          *,
          psakei_din:psak_din_id (id, title, summary, court, year)
        `);

      if (error) throw error;

      if (data && data.length > 0) {
        const results: AnalysisResult[] = data.map((row: any) => ({
          id: row.psak_din_id,
          title: row.psakei_din?.title || '',
          sources: row.sources as DetectedSource[],
          topics: row.topics,
          masechtot: row.masechtot || [],
          books: row.books || [],
          wordCount: row.word_count,
          hasFullText: row.has_full_text
        }));
        
        setAnalysisResults(results);
        setSavedCount(results.length);
      }
    } catch (error) {
      console.error('Error loading saved results:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    return generateIndexSummary(analysisResults);
  }, [analysisResults]);

  // Filter results based on search and filters
  const filteredResults = useMemo(() => {
    return analysisResults.filter(result => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = result.title.toLowerCase().includes(query);
        const matchesTopic = result.topics.some(t => t.topic.includes(query));
        const matchesMasechet = result.masechtot.some(m => m.includes(query));
        if (!matchesTitle && !matchesTopic && !matchesMasechet) return false;
      }

      if (selectedCategory) {
        if (!result.topics.some(t => t.category === selectedCategory)) return false;
      }

      if (selectedMasechet) {
        if (!result.masechtot.includes(selectedMasechet)) return false;
      }

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

  // Run text analysis and save to database
  const runTextAnalysis = async (forceRefresh = false) => {
    setAnalyzing(true);
    
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

        await new Promise(r => setTimeout(r, 30));
      }

      // Save results to database
      setSaving(true);
      await saveResultsToDatabase(allResults);
      setSavedCount(allResults.length);

      // Save pattern-based links
      await savePatternLinks(allResults);

      toast({
        title: "ניתוח ושמירה הושלמו",
        description: `נותחו ונשמרו ${allResults.length} פסקי דין`,
      });
    } catch (error) {
      console.error('Error analyzing:', error);
      toast({
        title: "שגיאה בניתוח",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setSaving(false);
    }
  };

  // Save analysis results to database
  const saveResultsToDatabase = async (results: AnalysisResult[]) => {
    const batchSize = 50;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      const insertData = batch.map(result => ({
        psak_din_id: result.id,
        sources: JSON.parse(JSON.stringify(result.sources)),
        topics: JSON.parse(JSON.stringify(result.topics)),
        masechtot: result.masechtot,
        books: result.books,
        word_count: result.wordCount,
        has_full_text: result.hasFullText,
        analysis_method: 'pattern_matching'
      }));

      const { error } = await (supabase as any)
        .from('smart_index_results')
        .upsert(insertData, { onConflict: 'psak_din_id' });

      if (error) {
        console.error('Error saving batch:', error);
      }
    }
  };

  // Save pattern-based sugya links
  const savePatternLinks = async (results: AnalysisResult[]) => {
    // First, delete existing pattern links
    await supabase
      .from('pattern_sugya_links')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const allLinks: any[] = [];

    for (const result of results) {
      const gemaraSources = result.sources.filter(
        s => s.type === 'gemara' && s.sugyaId && s.masechet
      );

      for (const source of gemaraSources) {
        allLinks.push({
          psak_din_id: result.id,
          sugya_id: source.sugyaId,
          masechet: source.masechet,
          daf: source.daf,
          amud: source.amud === 'a' ? 'א' : source.amud === 'b' ? 'ב' : null,
          source_text: source.text,
          confidence: source.confidence
        });
      }
    }

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < allLinks.length; i += batchSize) {
      const batch = allLinks.slice(i, i + batchSize);
      const { error } = await supabase
        .from('pattern_sugya_links')
        .insert(batch);

      if (error) {
        console.error('Error saving pattern links batch:', error);
      }
    }

    console.log(`Saved ${allLinks.length} pattern-based links`);
  };

  // Navigate to Gemara page
  const navigateToGemara = (source: DetectedSource) => {
    if (source.sugyaId) {
      navigate(`/sugya/${source.sugyaId}`);
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
      .maybeSingle();
    
    if (data) {
      setSelectedPsak(data);
      setDialogOpen(true);
    }
  };

  // Render source badge with link
  const renderSourceBadge = (source: DetectedSource, index: number) => {
    if (source.type === 'gemara' && source.sugyaId) {
      const dafDisplay = source.dafNumber ? toHebrewNumeral(source.dafNumber) : '';
      const amudDisplay = source.amud === 'a' ? 'א' : source.amud === 'b' ? 'ב' : '';
      
      return (
        <Badge
          key={index}
          variant="default"
          className="cursor-pointer gap-1 hover:bg-primary/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            navigateToGemara(source);
          }}
        >
          <Link2 className="w-3 h-3" />
          {source.masechet} {dafDisplay}{amudDisplay ? ` ע"${amudDisplay}` : ''}
        </Badge>
      );
    }
    
    return (
      <Badge key={index} variant="outline" className="text-xs">
        {source.text.slice(0, 30)}...
      </Badge>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">טוען נתונים שמורים...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-row-reverse flex-wrap gap-4">
          <div className="text-right">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-row-reverse">
              אינדקס חכם
              <Library className="w-6 h-6 text-primary" />
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              זיהוי אוטומטי של מקורות תלמודיים והלכתיים • קישור ישיר לדפי גמרא
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {savedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Database className="w-3 h-3" />
                {savedCount} שמורים
              </Badge>
            )}
            
            {analysisResults.length === 0 && !analyzing ? (
              <Button onClick={() => runTextAnalysis()} className="gap-2 flex-row-reverse">
                התחל ניתוח
                <Zap className="w-4 h-4" />
              </Button>
            ) : !analyzing && (
              <Button 
                variant="outline" 
                onClick={() => runTextAnalysis(true)} 
                className="gap-2 flex-row-reverse"
              >
                רענן ניתוח
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Analysis Progress */}
        {analyzing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2 flex-row-reverse">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="font-medium">
                  {saving ? 'שומר תוצאות...' : 'מנתח פסקי דין...'}
                </span>
                <span className="mr-auto text-sm">
                  {analysisProgress.current}/{analysisProgress.total}
                </span>
              </div>
              <Progress 
                value={(analysisProgress.current / Math.max(analysisProgress.total, 1)) * 100} 
                className="h-2" 
              />
              {saving && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Save className="w-3 h-3" />
                  שומר לדאטאבייס...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {analysisResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{summary.withGemaraLinks}</div>
                <div className="text-sm text-muted-foreground">מקושרים לגמרא</div>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-secondary/50">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{summary.totalGemaraLinks}</div>
                <div className="text-sm text-muted-foreground">קישורים</div>
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
          </div>
        )}

        {/* Main Content */}
        {analysisResults.length > 0 && (
          <Tabs defaultValue="gemara-links" className="space-y-4">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 mx-auto">
              <TabsTrigger value="gemara-links" className="gap-2 flex-row-reverse">
                קישורי גמרא
                <Link2 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="browse" className="gap-2 flex-row-reverse">
                לפי נושא
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
                <CardContent className="p-3 flex items-center justify-between flex-row-reverse flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <Brain className="w-5 h-5 text-accent" />
                    <div className="text-right">
                      <p className="font-medium text-sm">ניתוח AI מעמיק</p>
                      <p className="text-xs text-muted-foreground">
                        ניתוח מתקדם עם AI לזיהוי מקורות מדויק יותר
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
                            נתח {selectedForAI.size} פסקים ב-AI
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

            {/* Gemara Links Tab */}
            <TabsContent value="gemara-links">
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {filteredResults
                    .filter(r => r.sources.some(s => s.type === 'gemara' && s.sugyaId))
                    .slice(0, 100)
                    .map(result => {
                      const gemaraSources = result.sources.filter(s => s.type === 'gemara' && s.sugyaId);
                      return (
                        <Card 
                          key={result.id}
                          className={`cursor-pointer hover:shadow-md transition-shadow ${
                            selectedForAI.has(result.id) ? 'border-accent ring-1 ring-accent' : ''
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3 flex-row-reverse">
                              <Checkbox
                                checked={selectedForAI.has(result.id)}
                                onCheckedChange={() => toggleAISelection(result.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 text-right">
                                <div 
                                  className="font-medium line-clamp-1 cursor-pointer hover:text-primary"
                                  onClick={() => handlePsakClick(result.id)}
                                >
                                  {result.title}
                                </div>
                                
                                {/* Gemara Links */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {gemaraSources.slice(0, 5).map((source, idx) => 
                                    renderSourceBadge(source, idx)
                                  )}
                                  {gemaraSources.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{gemaraSources.length - 5} נוספים
                                    </Badge>
                                  )}
                                </div>

                                {/* Topics */}
                                {result.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {result.topics.slice(0, 3).map((t, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {t.topic}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="default" className="text-xs">
                                  {gemaraSources.length} קישורים
                                </Badge>
                                <Badge 
                                  variant={gemaraSources[0]?.confidence === 'high' ? 'default' : 'outline'}
                                  className="text-xs"
                                >
                                  {gemaraSources[0]?.confidence === 'high' ? 'גבוה' : 
                                   gemaraSources[0]?.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </ScrollArea>
            </TabsContent>

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
                                      {result.sources
                                        .filter(s => s.type === 'gemara' && s.sugyaId)
                                        .slice(0, 2)
                                        .map((source, idx) => renderSourceBadge(source, idx))}
                                      {result.books.slice(0, 2).map(b => (
                                        <Badge key={b} variant="secondary" className="text-xs">
                                          {b}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
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
                                        .filter(s => s.type === 'gemara' && s.masechet === masechet && s.sugyaId)
                                        .slice(0, 3)
                                        .map((source, idx) => renderSourceBadge(source, idx))}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
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
                סריקה וזיהוי אוטומטי של מקורות תלמודיים והלכתיים בפסקי הדין
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                <Badge variant="outline">זיהוי מסכתות ודפים</Badge>
                <Badge variant="outline">קישור ישיר לגמרא</Badge>
                <Badge variant="outline">זיהוי שולחן ערוך</Badge>
                <Badge variant="outline">זיהוי רמב"ם</Badge>
                <Badge variant="outline">שמירה בדאטאבייס</Badge>
              </div>
              <Button onClick={() => runTextAnalysis()} size="lg" className="gap-2 flex-row-reverse">
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
