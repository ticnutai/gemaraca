import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Download, CheckSquare, Square, Loader2, ChevronDown, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MASECHTOT, SEDARIM, getMasechetByHebrewName, Masechet } from "@/lib/masechtotData";
import MasechetDownloader from "./MasechetDownloader";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GemaraTabProps {
  selectedMasechet?: string | null;
  onMasechetChange?: (masechetHebrewName: string) => void;
}

const GemaraTab = ({ selectedMasechet: selectedMasechetProp, onMasechetChange }: GemaraTabProps) => {
  const [selectedMasechet, setSelectedMasechet] = useState<Masechet>(
    selectedMasechetProp 
      ? (getMasechetByHebrewName(selectedMasechetProp) || MASECHTOT.find(m => m.hebrewName === "בבא בתרא")!)
      : MASECHTOT.find(m => m.hebrewName === "בבא בתרא")!
  );
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDaf, setLoadingDaf] = useState<number | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDafim, setSelectedDafim] = useState<Set<number>>(new Set());
  const [loadingMultiple, setLoadingMultiple] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sync with prop when it changes
  useEffect(() => {
    if (selectedMasechetProp) {
      const masechet = getMasechetByHebrewName(selectedMasechetProp);
      if (masechet) {
        setSelectedMasechet(masechet);
      }
    }
  }, [selectedMasechetProp]);

  useEffect(() => {
    loadPages();
  }, [selectedMasechet]);

  const loadPages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('*')
        .eq('masechet', selectedMasechet.sefariaName)
        .order('daf_number');

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDaf = async (dafNumber: number) => {
    setLoadingDaf(dafNumber);
    
    try {
      const hebrewNumber = toHebrewNumeral(dafNumber);
      const sugya_id = `${selectedMasechet.sefariaName.toLowerCase()}_${dafNumber}a`;
      const title = `${selectedMasechet.hebrewName} דף ${hebrewNumber}`;
      
      toast({
        title: "טוען דף...",
        description: `מוריד מידע עבור ${title}`,
      });

      const { data, error } = await supabase.functions.invoke('load-daf', {
        body: { 
          dafNumber,
          sugya_id,
          title,
          masechet: selectedMasechet.hebrewName
        }
      });

      if (error) throw error;

      toast({
        title: "הדף נטען בהצלחה",
        description: `${title} זמין כעת`,
      });

      await loadPages();
      
      if (data?.data?.sugya_id) {
        navigate(`/sugya/${data.data.sugya_id}`);
      }
    } catch (error) {
      console.error('Error loading daf:', error);
      toast({
        title: "שגיאה בטעינת הדף",
        description: error instanceof Error ? error.message : "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setLoadingDaf(null);
    }
  };

  const handleLoadMultipleDafim = async () => {
    if (selectedDafim.size === 0) return;
    
    setLoadingMultiple(true);
    const dafimArray = Array.from(selectedDafim).sort((a, b) => a - b);
    
    toast({
      title: "טוען דפים...",
      description: `מוריד ${dafimArray.length} דפים`,
    });

    let successCount = 0;
    let failCount = 0;

    for (const dafNumber of dafimArray) {
      try {
        const hebrewNumber = toHebrewNumeral(dafNumber);
        const sugya_id = `${selectedMasechet.sefariaName.toLowerCase()}_${dafNumber}a`;
        const title = `${selectedMasechet.hebrewName} דף ${hebrewNumber}`;

        const { error } = await supabase.functions.invoke('load-daf', {
          body: { dafNumber, sugya_id, title, masechet: selectedMasechet.hebrewName }
        });

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error(`Error loading daf ${dafNumber}:`, error);
        failCount++;
      }
    }

    await loadPages();
    setSelectedDafim(new Set());
    setMultiSelectMode(false);
    setLoadingMultiple(false);

    toast({
      title: "טעינה הושלמה",
      description: `נטענו ${successCount} דפים בהצלחה${failCount > 0 ? `, ${failCount} נכשלו` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const toggleDafSelection = (dafNum: number) => {
    const newSelected = new Set(selectedDafim);
    if (newSelected.has(dafNum)) {
      newSelected.delete(dafNum);
    } else {
      newSelected.add(dafNum);
    }
    setSelectedDafim(newSelected);
  };

  const selectAllUnloaded = () => {
    const unloadedDafim = allDafim.filter(dafNum => !pages.find(p => p.daf_number === dafNum));
    setSelectedDafim(new Set(unloadedDafim));
  };

  const clearSelection = () => {
    setSelectedDafim(new Set());
  };

  const handleMasechetChange = (hebrewName: string) => {
    const masechet = getMasechetByHebrewName(hebrewName);
    if (masechet) {
      setSelectedMasechet(masechet);
      setSelectedDafim(new Set());
      setMultiSelectMode(false);
      setShowAllPages(false);
      // Notify parent if callback provided
      if (onMasechetChange) {
        onMasechetChange(hebrewName);
      }
    }
  };

  // דפים מתחילים מב' (2)
  const allDafim = Array.from({ length: selectedMasechet.maxDaf - 1 }, (_, i) => i + 2);
  const loadedDafNumbers = pages.map(p => p.daf_number);
  const unloadedCount = allDafim.filter(dafNum => !loadedDafNumbers.includes(dafNum)).length;

  // קיבוץ מסכתות לפי סדר
  const groupedMasechtot = SEDARIM.map(seder => ({
    seder,
    masechtot: MASECHTOT.filter(m => m.seder === seder)
  }));

  // הצג רק 20 דפים ראשונים אם לא מורחב
  const visibleDafim = showAllPages ? allDafim : allDafim.slice(0, 20);
  const hasMorePages = allDafim.length > 20;

  return (
    <div className="p-4 md:p-6">
      <div className="space-y-6">
        {/* כותרת וסטטיסטיקה */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">לימוד גמרא</h2>
            <p className="text-muted-foreground text-sm mt-1">
              בחר מסכת ודף ללימוד
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-secondary/50 rounded-xl px-4 py-2 text-center">
              <div className="text-2xl font-bold text-accent">{loadedDafNumbers.length}</div>
              <div className="text-xs text-muted-foreground">דפים טעונים</div>
            </div>
            <div className="bg-secondary/50 rounded-xl px-4 py-2 text-center">
              <div className="text-2xl font-bold text-foreground">{allDafim.length}</div>
              <div className="text-xs text-muted-foreground">סה"כ דפים</div>
            </div>
          </div>
        </div>

        {/* בחירת מסכת */}
        <Card className="p-4 border border-border shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                בחר מסכת
              </label>
              <Select value={selectedMasechet.hebrewName} onValueChange={handleMasechetChange}>
                <SelectTrigger className="w-full md:w-80 bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-[400px]">
                  {groupedMasechtot.map(group => (
                    <div key={group.seder}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        סדר {group.seder}
                      </div>
                      {group.masechtot.map(masechet => (
                        <SelectItem key={masechet.englishName} value={masechet.hebrewName}>
                          {masechet.hebrewName} ({masechet.maxDaf - 1} דפים)
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* הורדת מסכת שלמה */}
            <MasechetDownloader
              masechet={selectedMasechet}
              loadedPages={loadedDafNumbers}
              onComplete={loadPages}
            />
          </div>
        </Card>

        {/* רשימת דפים */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <Collapsible open={showAllPages} onOpenChange={setShowAllPages}>
            {/* כותרת מתקפלת */}
            <div className="p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">
                    דפי {selectedMasechet.hebrewName}
                  </h3>
                  <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-1 rounded-full">
                    {loadedDafNumbers.length}/{allDafim.length} טעונים
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {unloadedCount > 0 && (
                    <Button
                      variant={multiSelectMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMultiSelectMode(!multiSelectMode);
                        if (multiSelectMode) {
                          setSelectedDafim(new Set());
                        }
                      }}
                      className="gap-2"
                    >
                      {multiSelectMode ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">בחירה מרובה</span>
                    </Button>
                  )}
                  
                  {hasMorePages && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        {showAllPages ? (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">הסתר</span>
                          </>
                        ) : (
                          <>
                            <ChevronLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">הרחב ({allDafim.length - 20} נוספים)</span>
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
              </div>

              {/* פס פעולות בחירה מרובה */}
              {multiSelectMode && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-accent/20 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    נבחרו: {selectedDafim.size} דפים
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllUnloaded}
                    disabled={loadingMultiple}
                  >
                    בחר הכל ({unloadedCount})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={loadingMultiple || selectedDafim.size === 0}
                  >
                    נקה
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleLoadMultipleDafim}
                    disabled={loadingMultiple || selectedDafim.size === 0}
                    className="gap-2"
                  >
                    {loadingMultiple ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        טוען...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        טען {selectedDafim.size}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* תוכן הדפים */}
            <div className="p-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  טוען...
                </div>
              ) : (
                <>
                  {/* דפים ראשונים (תמיד נראים) */}
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2" style={{ direction: 'rtl' }}>
                    {visibleDafim.map((dafNum) => {
                      const loadedPage = pages.find(p => p.daf_number === dafNum);
                      const isLoaded = !!loadedPage;
                      const isSelected = selectedDafim.has(dafNum);

                      return (
                        <div key={dafNum} className="relative group">
                          {multiSelectMode && !isLoaded && (
                            <div 
                              className="absolute -top-1 -right-1 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDafSelection(dafNum);
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                className="w-4 h-4 bg-background border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </div>
                          )}
                          
                          <Button
                            variant={isLoaded ? "default" : isSelected ? "secondary" : "outline"}
                            className={cn(
                              "w-full h-10 text-xs relative",
                              isLoaded && "bg-accent text-accent-foreground hover:bg-accent/90",
                              isSelected && !isLoaded && "ring-2 ring-primary ring-offset-1"
                            )}
                            onClick={() => {
                              if (multiSelectMode && !isLoaded) {
                                toggleDafSelection(dafNum);
                              } else if (isLoaded) {
                                navigate(`/sugya/${loadedPage.sugya_id}`);
                              }
                            }}
                            disabled={(!isLoaded && !multiSelectMode) || loadingDaf === dafNum || loadingMultiple}
                          >
                            {loadingDaf === dafNum ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              toHebrewNumeral(dafNum)
                            )}
                          </Button>
                          
                          {!isLoaded && !multiSelectMode && loadingDaf !== dafNum && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => handleLoadDaf(dafNum)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* כפתור הרחבה אם יש עוד */}
                  {hasMorePages && !showAllPages && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full mt-4 gap-2 border-dashed"
                      >
                        <ChevronDown className="w-4 h-4" />
                        הצג עוד {allDafim.length - 20} דפים
                      </Button>
                    </CollapsibleTrigger>
                  )}

                  <CollapsibleContent>
                    {/* דפים נוספים */}
                    {showAllPages && allDafim.length > 20 && (
                      <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2 mt-4 pt-4 border-t border-border/50" style={{ direction: 'rtl' }}>
                        {allDafim.slice(20).map((dafNum) => {
                          const loadedPage = pages.find(p => p.daf_number === dafNum);
                          const isLoaded = !!loadedPage;
                          const isSelected = selectedDafim.has(dafNum);

                          return (
                            <div key={dafNum} className="relative group">
                              {multiSelectMode && !isLoaded && (
                                <div 
                                  className="absolute -top-1 -right-1 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDafSelection(dafNum);
                                  }}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    className="w-4 h-4 bg-background border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                </div>
                              )}
                              
                              <Button
                                variant={isLoaded ? "default" : isSelected ? "secondary" : "outline"}
                                className={cn(
                                  "w-full h-10 text-xs relative",
                                  isLoaded && "bg-accent text-accent-foreground hover:bg-accent/90",
                                  isSelected && !isLoaded && "ring-2 ring-primary ring-offset-1"
                                )}
                                onClick={() => {
                                  if (multiSelectMode && !isLoaded) {
                                    toggleDafSelection(dafNum);
                                  } else if (isLoaded) {
                                    navigate(`/sugya/${loadedPage.sugya_id}`);
                                  }
                                }}
                                disabled={(!isLoaded && !multiSelectMode) || loadingDaf === dafNum || loadingMultiple}
                              >
                                {loadingDaf === dafNum ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  toHebrewNumeral(dafNum)
                                )}
                              </Button>
                              
                              {!isLoaded && !multiSelectMode && loadingDaf !== dafNum && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => handleLoadDaf(dafNum)}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleContent>
                </>
              )}
            </div>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
};

export default GemaraTab;
