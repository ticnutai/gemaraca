import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpen, Scale, ExternalLink, Lightbulb, FileText, HelpCircle } from "lucide-react";
import DafAmudNavigator from "@/components/DafAmudNavigator";
import FAQSection from "@/components/FAQSection";
import PsakDinSearchButton from "@/components/PsakDinSearchButton";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MASECHTOT } from "@/lib/masechtotData";
import { getCachedPage, setCachedPage } from "@/lib/pageCache";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";

// Lazy-loaded heavy sub-panels
const GemaraTextPanel = lazy(() => import("@/components/GemaraTextPanel"));
const CommentariesPanel = lazy(() => import("@/components/CommentariesPanel"));
const LexiconSearch = lazy(() => import("@/components/LexiconSearch"));
const RelatedPsakimSidebar = lazy(() => import("@/components/RelatedPsakimSidebar"));
const LinkedPsakimSection = lazy(() => import("@/components/LinkedPsakimSection"));
const ModernExamplesPanel = lazy(() => import("@/components/ModernExamplesPanel").then(m => ({ default: m.ModernExamplesPanel })));

const PanelFallback = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-6 w-40" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-24 w-full" />
  </div>
);

// Helper function to get Hebrew name from Sefaria name
const getMasechetHebrewName = (sefariaName: string): string => {
  const masechet = MASECHTOT.find(m => m.sefariaName === sefariaName);
  return masechet?.hebrewName || sefariaName;
};

// Parse sugya_id like "bava_batra_2a" into masechet + daf + amud
const parseSugyaId = (sugyaId: string) => {
  for (const m of MASECHTOT) {
    const prefix = m.sefariaName.toLowerCase() + '_';
    if (sugyaId.startsWith(prefix)) {
      const rest = sugyaId.slice(prefix.length);
      const match = rest.match(/^(\d+)([ab])$/);
      if (match) {
        return { masechet: m, dafNumber: parseInt(match[1]), amud: match[2] as 'a' | 'b' };
      }
    }
  }
  return null;
};

const SugyaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [realCases, setRealCases] = useState<any[]>([]);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedPage, setLoadedPage] = useState<any>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [mainTab, setMainTab] = useState("gemara");
  
  const sugya = loadedPage;

  useEffect(() => {
    if (id) {
      // Run both queries in parallel instead of sequentially
      Promise.all([loadPageFromDB(), fetchRealCases()]);
    }
  }, [id]);

  const loadPageFromDB = async () => {
    if (!id) return;
    
    // Check cache first
    const cached = getCachedPage(id);
    if (cached) {
      console.log('Using cached page for:', id);
      setLoadedPage(cached);
      setIsPageLoading(false);
      return;
    }

    setIsPageLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('*')
        .eq('sugya_id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Extract masechet name from the data
        const masechetName = data.masechet || 'Bava_Batra';
        const hebrewMasechetName = getMasechetHebrewName(masechetName);
        
        // Convert DB format to component format
        const pageData = {
          title: data.title,
          dafYomi: data.daf_yomi,
          summary: `דף ${data.daf_yomi}`,
          tags: data.tags || ["גמרא", hebrewMasechetName],
          masechet: masechetName,
          gemaraText: data.gemara_text || "",
          fullText: data.full_text || "",
          cases: data.cases || []
        };
        
        // Save to cache
        setCachedPage(id, pageData);
        setLoadedPage(pageData);
      } else {
        // Page not in DB — create a fallback page from the sugya_id
        const parsed = parseSugyaId(id);
        if (parsed) {
          const { masechet, dafNumber, amud } = parsed;
          const amudStr = amud === 'a' ? 'ע"א' : 'ע"ב';
          const dafYomi = `${masechet.hebrewName} ${toHebrewNumeral(dafNumber)} ${amudStr}`;
          const fallbackPage = {
            title: `${masechet.hebrewName} דף ${toHebrewNumeral(dafNumber)}`,
            dafYomi,
            summary: `דף ${dafYomi}`,
            tags: ["גמרא", masechet.hebrewName],
            masechet: masechet.sefariaName,
            gemaraText: "",
            fullText: "",
            cases: []
          };
          setCachedPage(id, fallbackPage);
          setLoadedPage(fallbackPage);
        }
      }
    } catch (error) {
      console.error('Error loading page from DB:', error);
    } finally {
      setIsPageLoading(false);
    }
  };

  const fetchRealCases = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('sugya_psak_links')
        .select(`
          *,
          psakei_din:psak_din_id (*)
        `)
        .eq('sugya_id', id)
        .order('relevance_score', { ascending: false });

      if (error) {
        console.error('Error fetching real cases:', error);
      } else {
        setRealCases(data || []);
        // Fetch FAQ items in parallel — don't wait for cases to finish rendering
        if (data && data.length > 0) {
          const psakDinIds = data.map((link: any) => link.psak_din_id);
          // Fire and forget — don't cascade
          fetchFAQItems(psakDinIds);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFAQItems = async (psakDinIds: string[]) => {
    try {
      const { data, error } = await (supabase as any)
        .from('faq_items')
        .select('*')
        .in('psak_din_id', psakDinIds)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching FAQ items:', error);
      } else {
        setFaqItems(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Extract masechet info for LinkedPsakimSection
  const getMasechetInfo = () => {
    if (!id) return null;
    const parsed = parseSugyaId(id);
    if (parsed) {
      return { masechet: parsed.masechet.hebrewName, dafNumber: parsed.dafNumber };
    }
    return null;
  };

  const masechetInfo = getMasechetInfo();

  // Show loading state while page is being fetched
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">טוען דף...</p>
        </div>
      </div>
    );
  }

  if (!sugya) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">סוגיה לא נמצאה</h1>
          <Button onClick={() => navigate("/")}>חזרה לדף הבית</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
        {/* Header - Compact navigation */}
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            חזרה
          </Button>
        </div>

        {/* Daf/Amud Navigator - Single source of truth for masechet name */}
        <DafAmudNavigator className="mb-6" />

        {/* Page Title - Simple, no duplications */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{sugya.title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{sugya.summary}</p>
        </div>

        {/* Main Tabs - 4 Primary Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-4 mb-6 h-auto">
            <TabsTrigger value="gemara" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4 hidden sm:block" />
              גמרא
            </TabsTrigger>
            <TabsTrigger value="illustration" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <Lightbulb className="w-4 h-4 hidden sm:block" />
              המחשה
            </TabsTrigger>
            <TabsTrigger value="psakim" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <Scale className="w-4 h-4 hidden sm:block" />
              פסקי דין
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <HelpCircle className="w-4 h-4 hidden sm:block" />
              הסבר
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: גמרא - Gemara Text with nested tabs */}
          <TabsContent value="gemara" className="mt-0 space-y-6">
            {/* Original Gemara Text */}
            {sugya.gemaraText && (
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20">
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  לשון הגמרא
                </h2>
                <div className="prose prose-sm max-w-none text-foreground leading-loose whitespace-pre-line font-serif">
                  {sugya.gemaraText}
                </div>
              </Card>
            )}

            {/* Nested tabs for Gemara tools */}
            <Tabs defaultValue="text" className="w-full" dir="rtl">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text">טקסט מקורי</TabsTrigger>
                <TabsTrigger value="commentaries">מפרשים</TabsTrigger>
                <TabsTrigger value="lexicon">מילון</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <Suspense fallback={<PanelFallback />}>
                  <GemaraTextPanel sugyaId={id || ""} dafYomi={sugya.dafYomi} masechet={sugya.masechet} />
                </Suspense>
              </TabsContent>
              <TabsContent value="commentaries" className="mt-4">
                <Suspense fallback={<PanelFallback />}>
                  <CommentariesPanel dafYomi={sugya.dafYomi} masechet={sugya.masechet} />
                </Suspense>
              </TabsContent>
              <TabsContent value="lexicon" className="mt-4">
                <Suspense fallback={<PanelFallback />}>
                  <LexiconSearch dafYomi={sugya.dafYomi} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tab 2: המחשה - Modern Examples */}
          <TabsContent value="illustration" className="mt-0 space-y-6">
            <Suspense fallback={<PanelFallback />}>
              <ModernExamplesPanel
                gemaraText={sugya.gemaraText || sugya.fullText}
                sugyaTitle={sugya.title}
                dafYomi={sugya.dafYomi}
                masechet={sugya.masechet || "בבא בתרא"}
              />
            </Suspense>

            {/* Sample Cases for illustration */}
            {sugya.cases && sugya.cases.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-bold text-muted-foreground">
                      דוגמאות להמחשה ({sugya.cases.length})
                    </h3>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                      💡 אלו דוגמאות להמחשה בלבד. להשגת פסקי דין אמיתיים, עבור לטאב "פסקי דין".
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {sugya.cases.map((case_: any, index: number) => (
                    <Card key={index} className="p-4 space-y-3 hover:shadow-lg transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-foreground">{case_.title}</h4>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{case_.court}</span>
                          <span>•</span>
                          <span>{case_.year}</span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{case_.summary}</p>
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-medium text-primary">
                          <span className="text-muted-foreground">קשר לגמרא: </span>
                          {case_.connection}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: פסקי דין - Legal Rulings */}
          <TabsContent value="psakim" className="mt-0 space-y-6">
            {/* Search Button */}
            <PsakDinSearchButton
              sugyaId={id || ""}
              sugyaTitle={sugya.title}
              sugyaDescription={sugya.summary}
              onSearchComplete={fetchRealCases}
            />

            {/* Linked Psakim from Smart Index */}
            {masechetInfo && (
              <Suspense fallback={<PanelFallback />}>
                <LinkedPsakimSection 
                  sugyaId={id || ""} 
                  masechet={masechetInfo.masechet}
                  dafNumber={masechetInfo.dafNumber}
                />
              </Suspense>
            )}

            {/* Real Cases from Database */}
            {realCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Scale className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-bold text-foreground">
                    פסקי דין אמיתיים ({realCases.length})
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {realCases.map((link: any) => {
                    const caseData = link.psakei_din;
                    const caseFaqItems = faqItems.filter(
                      (faq) => faq.psak_din_id === caseData.id
                    );
                    
                    return (
                      <Card key={link.id} className="p-4 space-y-3 hover:shadow-lg transition-all border-2 border-primary/20">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-gradient-to-r from-primary to-secondary text-xs">
                              רלוונטיות: {link.relevance_score}/10
                            </Badge>
                          </div>
                          <h4 className="text-base font-bold text-foreground">{caseData.title}</h4>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{caseData.court}</span>
                            <span>•</span>
                            <span>{caseData.year}</span>
                            {caseData.case_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{caseData.case_number}</span>
                              </>
                            )}
                          </div>
                          {caseData.tags && caseData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(caseData.tags as string[]).map((tag: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {caseData.source_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            asChild
                          >
                            <a 
                              href={caseData.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              צפייה בפסק הדין המלא
                            </a>
                          </Button>
                        )}
                        
                        <p className="text-sm text-foreground leading-relaxed">{caseData.summary}</p>
                        
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs font-medium text-primary">
                            <span className="text-muted-foreground">קשר לגמרא: </span>
                            {link.connection_explanation}
                          </p>
                        </div>

                        {caseFaqItems.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <FAQSection 
                              items={caseFaqItems} 
                              title="שאלות ותשובות"
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">טוען פסקי דין...</p>
              </div>
            )}

            {/* Related Psakim Sidebar content */}
            <Suspense fallback={<PanelFallback />}>
              <RelatedPsakimSidebar sugyaId={id || ""} />
            </Suspense>
          </TabsContent>

          {/* Tab 4: הסבר וניתוח - Explanation and Analysis */}
          <TabsContent value="analysis" className="mt-0 space-y-6">
            {/* Full Text Explanation */}
            {sugya.fullText && (
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-card/80">
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  הסבר וניתוח הסוגיה
                </h2>
                <div className="prose prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-line">
                  {sugya.fullText}
                </div>
              </Card>
            )}

            {/* Tags */}
            {sugya.tags && sugya.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">נושאים קשורים:</h3>
                <div className="flex flex-wrap gap-2">
                  {sugya.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ items if available */}
            {faqItems.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  שאלות נפוצות
                </h3>
                <FAQSection items={faqItems} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SugyaDetail;
