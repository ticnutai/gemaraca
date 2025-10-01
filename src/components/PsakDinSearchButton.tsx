import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface PsakDinSearchButtonProps {
  sugyaId: string;
  sugyaTitle: string;
  sugyaDescription: string;
  onSearchComplete?: () => void;
}

const PsakDinSearchButton = ({
  sugyaId,
  sugyaTitle,
  sugyaDescription,
  onSearchComplete,
}: PsakDinSearchButtonProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchResults(null);

    try {
      console.log("Starting psak din search...");
      
      const { data, error } = await supabase.functions.invoke("search-psak-din", {
        body: {
          sugyaId,
          sugyaTitle,
          sugyaDescription,
        },
      });

      if (error) {
        console.error("Search error:", error);
        throw error;
      }

      console.log("Search results:", data);
      setSearchResults(data);

      if (data.success && data.count > 0) {
        toast({
          title: "חיפוש הושלם בהצלחה!",
          description: `נמצאו ${data.count} פסקי דין אמיתיים חדשים`,
        });
        
        if (onSearchComplete) {
          onSearchComplete();
        }
      } else {
        toast({
          title: "לא נמצאו תוצאות",
          description: "לא נמצאו פסקי דין נוספים בחיפוש זה",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error searching:", error);
      toast({
        title: "שגיאה בחיפוש",
        description: error.message || "אירעה שגיאה בחיפוש פסקי דין",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-accent/10 to-primary/10 border-2 border-accent/30">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-accent/20">
              <Search className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">
                חיפוש פסקי דין אמיתיים ומקורות הלכתיים
              </h3>
              <p className="text-muted-foreground mb-4">
                מנוע החיפוש יסרוק אתרים רשמיים: פסקדין (www.psakdin.co.il), 
                אתר דעת (www.daat.ac.il), ספריא (www.sefaria.org.il), 
                בתי הדין הרבניים (www.gov.il) ומקורות אמינים נוספים כדי למצוא 
                פסקי דין אמיתיים וקישורים מאומתים הקשורים לסוגיה זו.
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-4">
                <span>• פסקדין (psakdin.co.il)</span>
                <span>• אתר דעת (daat.ac.il)</span>
                <span>• ספריא (sefaria.org.il)</span>
                <span>• בתי הדין הרבניים</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full bg-gradient-to-r from-accent to-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                מחפש פסקי דין...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 ml-2" />
                חפש פסקי דין אמיתיים
              </>
            )}
          </Button>
        </div>
      </Card>

      {searchResults && searchResults.success && (
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-2 border-green-500/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h4 className="text-lg font-bold text-green-800 dark:text-green-200">
                החיפוש הושלם בהצלחה!
              </h4>
            </div>
            <p className="text-green-700 dark:text-green-300">
              נמצאו ונשמרו {searchResults.count} פסקי דין אמיתיים חדשים עם קישורים מאומתים.
              הם מוצגים כעת בסוגיה.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PsakDinSearchButton;