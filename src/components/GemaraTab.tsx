import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Download, CheckSquare, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MASECHTOT, SEDARIM, getMasechetByHebrewName, Masechet } from "@/lib/masechtotData";
import MasechetDownloader from "./MasechetDownloader";

const GemaraTab = () => {
  const [selectedMasechet, setSelectedMasechet] = useState<Masechet>(MASECHTOT.find(m => m.hebrewName === "בבא בתרא")!);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDaf, setLoadingDaf] = useState<number | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDafim, setSelectedDafim] = useState<Set<number>>(new Set());
  const [loadingMultiple, setLoadingMultiple] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPages();
  }, [selectedMasechet]);

  const loadPages = async () => {
    setLoading(true);
    try {
      // טעינת דפים לפי מסכת נבחרת - שימוש בעמודת masechet
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
    console.log('Starting to load daf:', dafNumber, 'from', selectedMasechet.hebrewName);
    
    try {
      const hebrewNumber = toHebrewNumeral(dafNumber);
      const sugya_id = `${selectedMasechet.sefariaName.toLowerCase()}_${dafNumber}a`;
      const title = `${selectedMasechet.hebrewName} דף ${hebrewNumber}`;
      
      console.log('Loading daf with params:', { dafNumber, sugya_id, title, masechet: selectedMasechet.hebrewName });
      
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

      console.log('Load daf response:', { data, error });

      if (error) {
        console.error('Load daf error:', error);
        throw error;
      }

      toast({
        title: "הדף נטען בהצלחה",
        description: `${title} זמין כעת`,
      });

      console.log('Reloading pages...');
      await loadPages();
      
      if (data?.data?.sugya_id) {
        console.log('Navigating to:', data.data.sugya_id);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 border border-border shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                בחר מסכת
              </label>
              <Select value={selectedMasechet.hebrewName} onValueChange={handleMasechetChange}>
                <SelectTrigger className="w-full bg-card border-border">
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

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">
                  בחר דף ({loadedDafNumbers.length}/{allDafim.length} טעונים)
                </label>
                
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
                      בחירה מרובה
                    </Button>
                  )}
                </div>
              </div>

              {/* פס פעולות בחירה מרובה */}
              {multiSelectMode && (
                <div className="flex items-center gap-2 mb-3 p-3 bg-accent/50 rounded-lg">
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
                    נקה בחירה
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
                        טען {selectedDafim.size} דפים
                      </>
                    )}
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  טוען...
                </div>
              ) : (
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                  {allDafim.map((dafNum) => {
                    const loadedPage = pages.find(p => p.daf_number === dafNum);
                    const isLoaded = !!loadedPage;
                    const isSelected = selectedDafim.has(dafNum);

                    return (
                      <div key={dafNum} className="relative group">
                        {/* Checkbox למצב בחירה מרובה */}
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
                          className={`w-full h-10 text-xs relative ${isSelected && !isLoaded ? 'ring-2 ring-primary ring-offset-1' : ''}`}
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
                        
                        {/* כפתור הורדה בודד (רק כשלא במצב בחירה מרובה) */}
                        {!isLoaded && !multiSelectMode && loadingDaf !== dafNum && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
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
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GemaraTab;
