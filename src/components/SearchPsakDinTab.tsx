import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, Calendar, Building2, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PsakDinViewDialog from "./PsakDinViewDialog";

const SearchPsakDinTab = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPsak, setSelectedPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "הזן מילות חיפוש",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-psak-din', {
        body: { query: query.trim() }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "שגיאה בחיפוש",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast({
          title: "לא נמצאו תוצאות",
          description: "נסה מילות חיפוש אחרות",
        });
      } else {
        toast({
          title: `נמצאו ${data.results.length} תוצאות`,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "שגיאה בחיפוש",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePsakClick = (psak: any) => {
    setSelectedPsak(psak);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground">חיפוש פסקי דין</CardTitle>
            <p className="text-sm text-muted-foreground">
              חיפוש במאגרים: פסקדין, דין תורה, דעת, ספריא, בתי הדין הרבניים ועוד
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="הזן נושא לחיפוש... (לדוגמה: שכנים, נזיקין, קניין)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch()}
                className="flex-1 bg-card border-border"
                disabled={loading}
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                חפש
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>מחפש במאגרי פסקי הדין...</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((psak, index) => (
              <Card 
                key={index} 
                className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handlePsakClick(psak)}
              >
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {psak.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
                    {psak.court && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-3 h-3 text-primary" />
                        </div>
                        {psak.court}
                      </div>
                    )}
                    {psak.year && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="w-3 h-3 text-primary" />
                        </div>
                        {psak.year}
                      </div>
                    )}
                    {psak.caseNumber && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <FileText className="w-3 h-3 text-primary" />
                        </div>
                        {psak.caseNumber}
                      </div>
                    )}
                    {psak.source && (
                      <Badge variant="outline" className="text-xs">
                        {psak.source}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-3 line-clamp-2">{psak.summary}</p>
                  {psak.connection && (
                    <p className="text-sm text-muted-foreground mb-3 italic line-clamp-1">
                      {psak.connection}
                    </p>
                  )}
                  {psak.tags && psak.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {psak.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {psak.sourceUrl && (
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                    >
                      <a
                        href={psak.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        לפסק הדין המלא
                      </a>
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PsakDinViewDialog 
        psak={selectedPsak} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </div>
  );
};

export default SearchPsakDinTab;
