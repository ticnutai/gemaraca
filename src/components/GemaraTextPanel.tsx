import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
}

export default function GemaraTextPanel({ sugyaId, dafYomi }: GemaraTextPanelProps) {
  const [gemaraText, setGemaraText] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrew, setShowHebrew] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadGemaraText();
  }, [dafYomi]);

  const loadGemaraText = async () => {
    setIsLoading(true);
    try {
      // המרת dafYomi לפורמט Sefaria (לדוגמה: "בבא בתרא ב א" -> "Bava_Batra.2a")
      const ref = convertDafYomiToSefariaRef(dafYomi);
      
      const { data, error } = await supabase.functions.invoke('get-gemara-text', {
        body: { ref }
      });

      if (error) throw error;

      if (data?.success) {
        setGemaraText(data.data);
      } else {
        throw new Error(data?.error || 'Failed to load Gemara text');
      }
    } catch (error) {
      console.error('Error loading Gemara text:', error);
      toast({
        title: "שגיאה בטעינת טקסט הגמרא",
        description: "לא הצלחנו לטעון את טקסט הגמרא. נסה שוב מאוחר יותר.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const convertDafYomiToSefariaRef = (dafYomi: string): string => {
    // המרה מפורמט עברי לפורמט Sefaria
    // לדוגמה: "בבא בתרא ב א" -> "Bava_Batra.2a"
    const parts = dafYomi.trim().split(' ');
    const masechet = "Bava_Batra"; // כרגע רק בבא בתרא
    
    if (parts.length >= 3) {
      const dafNum = parts[parts.length - 2];
      const amud = parts[parts.length - 1];
      const amudLetter = amud === 'א' ? 'a' : 'b';
      
      // המרת מספר עברי למספר רגיל
      const hebrewToNumber: Record<string, string> = {
        'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
        'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
        'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
        'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20'
      };
      
      const dafNumber = hebrewToNumber[dafNum] || dafNum;
      return `${masechet}.${dafNumber}${amudLetter}`;
    }
    
    return "Bava_Batra.2a"; // ברירת מחדל
  };

  const renderGemaraText = () => {
    if (!gemaraText) return null;

    const textToShow = showHebrew ? gemaraText.he : gemaraText.text;
    
    if (Array.isArray(textToShow)) {
      return textToShow.map((line: string, index: number) => (
        <p key={index} className="mb-2 leading-relaxed" dir="rtl">
          {line}
        </p>
      ));
    }
    
    return <p className="leading-relaxed" dir="rtl">{textToShow}</p>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">טקסט הגמרא</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showHebrew ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHebrew(true)}
            >
              עברית
            </Button>
            <Button
              variant={!showHebrew ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHebrew(false)}
            >
              English
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : gemaraText ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground" dir="rtl">
              {gemaraText.heRef || gemaraText.ref}
            </div>
            <div className="prose prose-slate max-w-none dark:prose-invert">
              {renderGemaraText()}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            לחץ על הכפתור למעלה כדי לטעון את טקסט הגמרא
          </div>
        )}
      </CardContent>
    </Card>
  );
}
