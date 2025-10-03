import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { BookOpen, Sparkles, Search, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toHebrewNumeral, fromHebrewNumeral } from "@/lib/hebrewNumbers";
import { supabase } from "@/integrations/supabase/client";

const DafQuickNav = () => {
  const [open, setOpen] = useState(false);
  const [customDaf, setCustomDaf] = useState("");
  const [loadedPages, setLoadedPages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadExistingPages();
  }, []);

  const loadExistingPages = async () => {
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('daf_number, sugya_id');

      if (error) throw error;

      const mapping: Record<number, string> = {};
      data?.forEach((page) => {
        mapping[page.daf_number] = page.sugya_id;
      });
      setLoadedPages(mapping);
    } catch (error) {
      console.error('Error loading pages:', error);
    }
  };

  const handleDafClick = (dafNum: number) => {
    const sugyaId = loadedPages[dafNum];
    if (sugyaId) {
      navigate(`/sugya/${sugyaId}`);
      setOpen(false);
    } else {
      toast.info(`דף ${toHebrewNumeral(dafNum)} טרם נטען`, {
        description: "השתמש בכפתור 'טען דף' כדי לטעון דף חדש"
      });
    }
  };

  const handleLoadDaf = async (dafNum: number) => {
    if (loadedPages[dafNum]) {
      toast.info("דף זה כבר קיים במערכת");
      return;
    }

    setIsLoading(true);
    try {
      const hebrewDaf = toHebrewNumeral(dafNum);
      const sugya_id = `daf-${dafNum}`;
      const title = `דף ${hebrewDaf}`;

      const { data, error } = await supabase.functions.invoke('load-daf', {
        body: {
          dafNumber: dafNum,
          sugya_id: sugya_id,
          title: title
        }
      });

      if (error) throw error;

      toast.success(data.message || `דף ${hebrewDaf} נטען בהצלחה!`);
      await loadExistingPages();
      navigate(`/sugya/${sugya_id}`);
      setOpen(false);
    } catch (error: any) {
      console.error('Error loading daf:', error);
      toast.error("שגיאה בטעינת הדף", {
        description: error.message || "אנא נסה שוב"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomDafSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dafNum = fromHebrewNumeral(customDaf.trim());
    if (dafNum && dafNum >= 2 && dafNum <= 176) {
      handleDafClick(dafNum);
      setCustomDaf("");
    } else {
      toast.error("מספר דף לא תקין", {
        description: "הזן מספר דף בין ב' לקע\"ו (2-176)"
      });
    }
  };

  // Create array of daf numbers 2-30 (דפים א-ל)
  const dafim = Array.from({ length: 29 }, (_, i) => i + 2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 hover:from-primary/20 hover:to-secondary/20"
        >
          <Sparkles className="w-4 h-4" />
          <span className="font-bold">בחירה מהירה לפי דף</span>
          <BookOpen className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              דפים ב-ל (בבא בתרא)
            </h3>
            <p className="text-sm text-muted-foreground">
              בחר דף לקפיצה מהירה לסוגיה
            </p>
          </div>

          <form onSubmit={handleCustomDafSubmit} className="flex gap-2">
            <Input
              value={customDaf}
              onChange={(e) => setCustomDaf(e.target.value)}
              placeholder="הזן דף (לדוגמה: כג)"
              className="text-right"
              dir="rtl"
            />
            <Button type="submit" size="icon" variant="secondary">
              <Search className="w-4 h-4" />
            </Button>
          </form>
          
          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-5 gap-2 p-1">
              {dafim.map((dafNum) => {
                const isLoaded = !!loadedPages[dafNum];
                return (
                  <div key={dafNum} className="relative group">
                    <Button
                      variant={isLoaded ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleDafClick(dafNum)}
                      disabled={isLoading}
                      className={`
                        w-full h-12 font-bold text-base
                        ${isLoaded 
                          ? "bg-gradient-to-br from-primary to-secondary hover:shadow-lg" 
                          : "opacity-50 hover:opacity-75"
                        }
                      `}
                    >
                      {toHebrewNumeral(dafNum)}
                    </Button>
                    {!isLoaded && (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadDaf(dafNum);
                        }}
                        disabled={isLoading}
                        className="absolute -top-1 -left-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-primary to-secondary"></div>
                <span>נטען</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted"></div>
                <span>טען בעמידה על דף</span>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DafQuickNav;
