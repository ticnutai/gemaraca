import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronDown, Scale, Download, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEDARIM, getMasechtotBySeder, Masechet } from "@/lib/masechtotData";
import { toDafFormat, toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SedarimNavigatorProps {
  className?: string;
}

interface PsakDinExample {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
}

interface LoadedPagesMap {
  [masechetName: string]: number[];
}

const SedarimNavigator = ({ className }: SedarimNavigatorProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setSelectedMasechet, setActiveTab } = useAppContext();
  const [selectedSeder, setSelectedSeder] = useState<string | null>(null);
  const [selectedMasechetLocal, setSelectedMasechetLocal] = useState<Masechet | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [psakDinExamples, setPsakDinExamples] = useState<PsakDinExample[]>([]);
  const [loadedPagesMap, setLoadedPagesMap] = useState<LoadedPagesMap>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const INITIAL_DAF_COUNT = 20;

  // Load sample Psakei Din and loaded pages
  useEffect(() => {
    const loadData = async () => {
      // Load Psakei Din examples
      const { data: psakData } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, summary')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (psakData) {
        setPsakDinExamples(psakData);
      }

      // Load all gemara pages to check what's already loaded
      const { data: pagesData } = await supabase
        .from('gemara_pages')
        .select('masechet, daf_number');
      
      if (pagesData) {
        const map: LoadedPagesMap = {};
        pagesData.forEach(page => {
          if (!map[page.masechet]) {
            map[page.masechet] = [];
          }
          map[page.masechet].push(page.daf_number);
        });
        setLoadedPagesMap(map);
      }
    };
    loadData();
  }, []);

  // Download masechet function
  const handleDownloadMasechet = async (masechet: Masechet) => {
    const loadedPages = loadedPagesMap[masechet.hebrewName] || [];
    const allDafim = Array.from({ length: masechet.maxDaf - 1 }, (_, i) => i + 2);
    const dafimToLoad = allDafim.filter(daf => !loadedPages.includes(daf));

    if (dafimToLoad.length === 0) {
      toast({
        title: "כל הדפים כבר נטענו",
        description: `מסכת ${masechet.hebrewName} טעונה במלואה`,
      });
      return;
    }

    setDownloading(masechet.hebrewName);
    setDownloadProgress(0);

    toast({
      title: "מתחיל הורדה",
      description: `מוריד ${dafimToLoad.length} דפים ממסכת ${masechet.hebrewName}`,
    });

    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 1000;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dafimToLoad.length; i += BATCH_SIZE) {
      if (downloading === null) break; // cancelled

      const batch = dafimToLoad.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (dafNumber) => {
          const hebrewNumber = toHebrewNumeral(dafNumber);
          const sugya_id = `${masechet.sefariaName.toLowerCase()}_${dafNumber}a`;
          const title = `${masechet.hebrewName} דף ${hebrewNumber}`;

          const { error } = await supabase.functions.invoke('load-daf', {
            body: { 
              dafNumber, 
              sugya_id, 
              title,
              masechet: masechet.hebrewName
            }
          });

          if (error) throw error;
          return dafNumber;
        })
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
        }
      });

      const totalProcessed = i + batch.length;
      setDownloadProgress((totalProcessed / dafimToLoad.length) * 100);

      if (i + BATCH_SIZE < dafimToLoad.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Refresh loaded pages
    const { data: pagesData } = await supabase
      .from('gemara_pages')
      .select('masechet, daf_number');
    
    if (pagesData) {
      const map: LoadedPagesMap = {};
      pagesData.forEach(page => {
        if (!map[page.masechet]) {
          map[page.masechet] = [];
        }
        map[page.masechet].push(page.daf_number);
      });
      setLoadedPagesMap(map);
    }

    setDownloading(null);
    setDownloadProgress(0);

    toast({
      title: "ההורדה הושלמה",
      description: `נטענו ${successCount} דפים${failCount > 0 ? `, ${failCount} נכשלו` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const getLoadStatus = (masechet: Masechet) => {
    const loaded = loadedPagesMap[masechet.hebrewName]?.length || 0;
    const total = masechet.maxDaf - 1;
    return { loaded, total, percent: Math.round((loaded / total) * 100) };
  };

  const handleSederClick = (seder: string) => {
    if (selectedSeder === seder) {
      setSelectedSeder(null);
      setSelectedMasechetLocal(null);
    } else {
      setSelectedSeder(seder);
      setSelectedMasechetLocal(null);
      setIsExpanded(false);
    }
  };

  const handleMasechetClick = (masechet: Masechet) => {
    if (selectedMasechetLocal?.englishName === masechet.englishName) {
      setSelectedMasechetLocal(null);
    } else {
      setSelectedMasechetLocal(masechet);
      setIsExpanded(false);
    }
  };

  const handleDafClick = (masechet: Masechet, dafNumber: number, amud: 'a' | 'b') => {
    const sugyaId = `${masechet.sefariaName.toLowerCase()}_${dafNumber}${amud}`;
    setSelectedMasechet(masechet.hebrewName);
    setActiveTab("gemara");
    navigate(`/sugya/${sugyaId}`);
  };

  const handlePsakDinClick = (id: string) => {
    setActiveTab("psak-din");
    // Could navigate to specific psak din view
  };

  const getMasechetCount = (seder: string) => {
    return getMasechtotBySeder(seder).length;
  };

  // Generate daf list for selected masechet
  const getAllDafim = () => {
    if (!selectedMasechetLocal) return [];
    const dafim = [];
    for (let daf = 2; daf <= selectedMasechetLocal.maxDaf; daf++) {
      dafim.push(daf);
    }
    return dafim;
  };

  const allDafim = getAllDafim();
  const displayedDafim = isExpanded ? allDafim : allDafim.slice(0, INITIAL_DAF_COUNT);
  const remainingCount = allDafim.length - INITIAL_DAF_COUNT;

  return (
    <div className={cn("space-y-3 md:space-y-6 overflow-x-hidden", className)}>
      {/* Spacing from header */}
      <div className="pt-2 md:pt-4" />

      {/* 6 Sedarim Cards - 3 columns on mobile for better fit */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 md:gap-3">
        {SEDARIM.map((seder) => (
          <button
            key={seder}
            onClick={() => handleSederClick(seder)}
            className={cn(
              "p-1.5 md:p-4 rounded-lg md:rounded-xl border transition-all duration-200 text-center",
              "hover:shadow-elegant active:scale-95",
              selectedSeder === seder
                ? "bg-primary text-primary-foreground border-accent shadow-gold"
                : "bg-card border-border hover:border-accent/50"
            )}
          >
            <BookOpen className="h-3 w-3 md:h-6 md:w-6 mx-auto mb-0.5 md:mb-1" />
            <span className="font-bold text-[10px] md:text-base block leading-tight">{seder}</span>
            <span className="text-[8px] md:text-xs opacity-70 hidden sm:inline">{getMasechetCount(seder)} מסכתות</span>
          </button>
        ))}
      </div>

      {/* Masechtot of Selected Seder */}
      {selectedSeder && (
        <div className="bg-card/50 rounded-lg md:rounded-xl border border-border p-2 md:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
            <button 
              onClick={() => setSelectedSeder(null)}
              className="p-0.5 md:p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-sm md:text-lg">סדר {selectedSeder}</h3>
          </div>
          
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {getMasechtotBySeder(selectedSeder).map((masechet) => {
              const status = getLoadStatus(masechet);
              const isDownloading = downloading === masechet.hebrewName;
              
              return (
                <div key={masechet.englishName} className="flex items-center gap-0.5 md:gap-1">
                  <Button
                    variant={selectedMasechetLocal?.englishName === masechet.englishName ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMasechetClick(masechet)}
                    className={cn(
                      "transition-all text-[10px] md:text-sm h-6 md:h-9 px-1.5 md:px-3",
                      selectedMasechetLocal?.englishName === masechet.englishName && "shadow-gold",
                      status.percent === 100 && "border-green-500/50"
                    )}
                  >
                    {masechet.hebrewName}
                    {status.loaded > 0 && (
                      <span className={cn(
                        "text-[8px] md:text-xs mr-0.5 md:mr-1",
                        status.percent === 100 ? "text-green-500" : "opacity-70"
                      )}>
                        {status.percent === 100 ? (
                          <Check className="h-3 w-3 inline" />
                        ) : (
                          `${status.loaded}/${status.total}`
                        )}
                      </span>
                    )}
                  </Button>
                  
                  {/* Download button */}
                  {status.percent < 100 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadMasechet(masechet);
                      }}
                      disabled={isDownloading}
                      className={cn(
                        "p-1 md:p-1.5 rounded-md transition-all",
                        "hover:bg-accent/20 text-accent hover:text-accent",
                        isDownloading && "animate-pulse"
                      )}
                      title={`הורד מסכת ${masechet.hebrewName}`}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 md:h-4 md:w-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Download progress bar */}
          {downloading && getMasechtotBySeder(selectedSeder).some(m => m.hebrewName === downloading) && (
            <div className="mt-2 md:mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
                <span>מוריד {downloading}...</span>
                <button
                  onClick={() => setDownloading(null)}
                  className="p-0.5 hover:bg-destructive/20 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Progress value={downloadProgress} className="h-1.5 md:h-2" />
              <span className="text-[8px] md:text-xs text-muted-foreground">{Math.round(downloadProgress)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Dafim Grid of Selected Masechet - Golden buttons like reference image */}
      {selectedMasechetLocal && (
        <div className="bg-card rounded-lg md:rounded-xl border border-border p-2 md:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-4">
            <button 
              onClick={() => setSelectedMasechetLocal(null)}
              className="p-0.5 md:p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 rtl-flip" />
            </button>
            <h3 className="font-bold text-sm md:text-lg">מסכת {selectedMasechetLocal.hebrewName}</h3>
            <span className="text-[10px] md:text-sm text-muted-foreground">({selectedMasechetLocal.maxDaf - 1} דפים)</span>
          </div>
          
          {/* Dafim grid with golden buttons - smaller on mobile */}
          <div className="flex flex-wrap gap-1 md:gap-2 p-1.5 md:p-3 rounded-lg bg-secondary/30">
            {displayedDafim.map((daf) => (
              <button
                key={daf}
                onClick={() => handleDafClick(selectedMasechetLocal, daf, 'a')}
                className={cn(
                  "px-1.5 py-1 md:px-3 md:py-2 text-[10px] md:text-sm rounded-md md:rounded-lg transition-all",
                  "min-w-[32px] md:min-w-[52px] font-medium",
                  "bg-accent text-accent-foreground",
                  "hover:brightness-110 hover:shadow-md",
                  "active:scale-95"
                )}
              >
                {toDafFormat(daf, 'a').replace(" ע\"א", "").replace("׳", "'")}
              </button>
            ))}
          </div>

          {/* Expand button */}
          {!isExpanded && remainingCount > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-1 mt-2 md:mt-4 mx-auto text-[10px] md:text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
              <span>הרחב ({remainingCount} נוספים)</span>
            </button>
          )}
          
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 mt-2 md:mt-4 mx-auto text-[10px] md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-3 w-3 md:h-4 md:w-4 rotate-180" />
              <span>צמצם</span>
            </button>
          )}
        </div>
      )}

      {/* Psak Din Examples Section */}
      {psakDinExamples.length > 0 && !selectedMasechetLocal && (
        <div className="bg-card rounded-lg md:rounded-xl border border-border p-2 md:p-4">
          <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-4">
            <Scale className="h-3.5 w-3.5 md:h-5 md:w-5 text-accent" />
            <h3 className="font-bold text-sm md:text-lg">דוגמאות פסקי דין</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 md:gap-3">
            {psakDinExamples.map((psak) => (
              <button
                key={psak.id}
                onClick={() => handlePsakDinClick(psak.id)}
                className={cn(
                  "p-1.5 md:p-3 rounded-md md:rounded-lg border text-right transition-all",
                  "bg-secondary/30 border-border hover:border-accent hover:shadow-sm",
                  "hover:bg-accent/10"
                )}
              >
                <h4 className="font-medium text-[10px] md:text-sm line-clamp-2 mb-0.5 md:mb-1">{psak.title}</h4>
                <div className="flex items-center gap-1 md:gap-2 text-[8px] md:text-xs text-muted-foreground">
                  <span className="truncate max-w-[60px] md:max-w-none">{psak.court}</span>
                  <span>•</span>
                  <span>{psak.year}</span>
                </div>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setActiveTab("psak-din")}
            className="flex items-center gap-1 mt-2 md:mt-4 mx-auto text-[10px] md:text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <span>צפה בכל פסקי הדין</span>
            <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 rtl-flip" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SedarimNavigator;
