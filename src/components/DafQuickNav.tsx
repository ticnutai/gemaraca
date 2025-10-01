import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";

const dafMapping: Record<number, string> = {
  2: "shnayim-ochazin",
  21: "eilu-metziot",
  27: "hashavat-aveida",
  28: "geneiva-aveida",
  18: "hamotzei-shtarot",
  29: "hamaafil"
};

const DafQuickNav = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleDafClick = (dafNum: number) => {
    const sugyaId = dafMapping[dafNum];
    if (sugyaId) {
      navigate(`/sugya/${sugyaId}`);
      setOpen(false);
    } else {
      toast.info(`דף ${dafNum} טרם נוסף למערכת`, {
        description: "בקרוב נוסיף עוד סוגיות מהמסכת"
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
              דפים ב-ל (בבא מציעא)
            </h3>
            <p className="text-sm text-muted-foreground">
              בחר דף לקפיצה מהירה לסוגיה
            </p>
          </div>
          
          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-5 gap-2 p-1">
              {dafim.map((dafNum) => {
                const hasSugya = !!dafMapping[dafNum];
                return (
                  <Button
                    key={dafNum}
                    variant={hasSugya ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleDafClick(dafNum)}
                    className={`
                      h-12 font-bold text-base
                      ${hasSugya 
                        ? "bg-gradient-to-br from-primary to-secondary hover:shadow-lg" 
                        : "opacity-50 hover:opacity-75"
                      }
                    `}
                  >
                    {toHebrewNumeral(dafNum)}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-primary to-secondary"></div>
              <span>דף זמין</span>
              <div className="w-3 h-3 rounded bg-muted mr-4"></div>
              <span>בקרוב</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DafQuickNav;
