import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GemaraTab = () => {
  const [selectedMasechet, setSelectedMasechet] = useState("בבא מציעא");
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('*')
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
    try {
      toast({
        title: "טוען דף...",
        description: `מוריד מידע עבור דף ${toHebrewNumeral(dafNumber)}`,
      });

      const { data, error } = await supabase.functions.invoke('load-daf', {
        body: { dafNumber }
      });

      if (error) throw error;

      toast({
        title: "הדף נטען בהצלחה",
        description: `דף ${toHebrewNumeral(dafNumber)} זמין כעת`,
      });

      await loadPages();
    } catch (error) {
      console.error('Error loading daf:', error);
      toast({
        title: "שגיאה בטעינת הדף",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  };

  const allDafim = Array.from({ length: 30 }, (_, i) => i + 2);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 border border-border shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                בחר מסכת
              </label>
              <Select value={selectedMasechet} onValueChange={setSelectedMasechet}>
                <SelectTrigger className="w-full bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="בבא מציעא">בבא מציעא</SelectItem>
                  <SelectItem value="בבא קמא">בבא קמא</SelectItem>
                  <SelectItem value="בבא בתרא">בבא בתרא</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                בחר דף
              </label>
              <div className="grid grid-cols-5 gap-2">
                {allDafim.map((dafNum) => {
                  const loadedPage = pages.find(p => p.daf_number === dafNum);
                  const isLoaded = !!loadedPage;

                  return (
                    <div key={dafNum} className="relative group">
                      <Button
                        variant={isLoaded ? "default" : "outline"}
                        className="w-full h-12 relative"
                        onClick={() => {
                          if (isLoaded) {
                            navigate(`/sugya/${loadedPage.sugya_id}`);
                          }
                        }}
                        disabled={!isLoaded}
                      >
                        {toHebrewNumeral(dafNum)}
                      </Button>
                      
                      {!isLoaded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground hover:bg-accent/90 w-6 h-6 p-0"
                          onClick={() => handleLoadDaf(dafNum)}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GemaraTab;
