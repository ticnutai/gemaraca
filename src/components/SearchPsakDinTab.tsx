import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, Calendar, Building2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SearchPsakDinTab = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
    try {
      const { data, error } = await supabase.functions.invoke('search-psak-din', {
        body: { query }
      });

      if (error) throw error;

      setResults(data.results || []);
      
      if (data.results.length === 0) {
        toast({
          title: "לא נמצאו תוצאות",
          description: "נסה מילות חיפוש אחרות",
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground">חיפוש פסקי דין</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="הזן מילות חיפוש..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-card border-border"
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                חפש
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center text-muted-foreground py-8">
            מחפש...
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((psak) => (
              <Card key={psak.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {psak.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {psak.court}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {psak.year}
                    </div>
                    {psak.case_number && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {psak.case_number}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-3">{psak.summary}</p>
                  {psak.tags && psak.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {psak.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPsakDinTab;
