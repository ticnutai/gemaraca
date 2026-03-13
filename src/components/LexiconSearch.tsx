import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, BookA } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface LexiconSearchProps {
  dafYomi: string;
}

interface LexiconResult {
  word: string;
  definitions: any[];
  related_words: any[];
  forms: any[];
  examples: any[];
}

export default function LexiconSearch({ dafYomi }: LexiconSearchProps) {
  const [searchWord, setSearchWord] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const { toast } = useToast();

  const convertDafYomiToSefariaRef = (dafYomi: string): string => {
    const parts = dafYomi.trim().split(' ');
    const masechet = "Bava_Batra";
    
    if (parts.length >= 3) {
      const dafNum = parts[parts.length - 2];
      const amud = parts[parts.length - 1];
      const amudLetter = amud === 'א' ? 'a' : 'b';
      
      const hebrewToNumber: Record<string, string> = {
        'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
        'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
        'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
        'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20'
      };
      
      const dafNumber = hebrewToNumber[dafNum] || dafNum;
      return `${masechet}.${dafNumber}${amudLetter}`;
    }
    
    return "Bava_Batra.2a";
  };

  const ref = convertDafYomiToSefariaRef(dafYomi);

  const { data: result, isLoading } = useQuery({
    queryKey: ['lexicon', activeSearch, ref],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('search-lexicon', {
        body: { word: activeSearch.trim(), lookupRef: ref }
      });
      if (error) throw error;
      if (data?.success) return data.data as LexiconResult;
      throw new Error(data?.error || 'Failed to search lexicon');
    },
    enabled: !!activeSearch,
    staleTime: 60 * 60 * 1000, // cache 1 hour
  });

  const handleSearch = () => {
    if (!searchWord.trim()) {
      toast({ title: "נא להזין מילה לחיפוש", variant: "destructive" });
      return;
    }
    setActiveSearch(searchWord.trim());
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookA className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">מילון עברי-ארמי</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2" dir="rtl">
          <Input
            placeholder="הזן מילה לחיפוש..."
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="text-right"
            dir="rtl"
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {result && (
          <div className="space-y-4" dir="rtl">
            <div>
              <h3 className="font-bold text-lg mb-2">{result.word}</h3>
              
              {result.definitions && result.definitions.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">הגדרות:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.definitions.map((def: any, index: number) => (
                      <li key={index} className="text-sm">
                        {typeof def === 'string' ? def : def.definition || def.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.related_words && result.related_words.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">מילים קשורות:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.related_words.map((word: any, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {typeof word === 'string' ? word : word.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.forms && result.forms.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">צורות המילה:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.forms.map((form: any, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm"
                      >
                        {typeof form === 'string' ? form : form.form}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!result && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            חפש מילה במילון העברי-ארמי
          </div>
        )}
      </CardContent>
    </Card>
  );
}
