import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Image, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
}

// מיפוי מסכתות ל-mesechta ID של HebrewBooks
const masechetToHebrewBooksId: Record<string, number> = {
  "Berakhot": 1, "Shabbat": 2, "Eruvin": 3, "Pesachim": 4, "Shekalim": 5,
  "Yoma": 6, "Sukkah": 7, "Beitzah": 8, "Rosh_Hashanah": 9, "Taanit": 10,
  "Megillah": 11, "Moed_Katan": 12, "Chagigah": 13, "Yevamot": 14, "Ketubot": 15,
  "Nedarim": 16, "Nazir": 17, "Sotah": 18, "Gittin": 19, "Kiddushin": 20,
  "Bava_Kamma": 21, "Bava_Metzia": 22, "Bava_Batra": 23, "Sanhedrin": 24,
  "Makkot": 25, "Shevuot": 26, "Avodah_Zarah": 27, "Horayot": 28,
  "Zevachim": 29, "Menachot": 30, "Chullin": 31, "Bekhorot": 32,
  "Arakhin": 33, "Temurah": 34, "Keritot": 35, "Meilah": 36, "Niddah": 37
};

type ViewMode = 'text' | 'original';

export default function GemaraTextPanel({ sugyaId, dafYomi }: GemaraTextPanelProps) {
  const [gemaraText, setGemaraText] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrew, setShowHebrew] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  const { toast } = useToast();

  useEffect(() => {
    loadGemaraText();
  }, [dafYomi]);

  const loadGemaraText = async () => {
    setIsLoading(true);
    try {
      const ref = convertDafYomiToSefariaRef(dafYomi);
      console.log('Loading Gemara text for ref:', ref);
      
      const { data, error } = await supabase.functions.invoke('get-gemara-text', {
        body: { ref }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('Gemara text loaded successfully');
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
        'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20',
        'כא': '21', 'כב': '22', 'כג': '23', 'כד': '24', 'כה': '25',
        'כו': '26', 'כז': '27', 'כח': '28', 'כט': '29', 'ל': '30',
        'לא': '31', 'לב': '32', 'לג': '33', 'לד': '34', 'לה': '35'
      };
      
      const dafNumber = hebrewToNumber[dafNum] || dafNum;
      return `${masechet}.${dafNumber}${amudLetter}`;
    }
    
    return "Bava_Batra.2a";
  };

  const getDafInfo = (dafYomi: string): { masechet: string; daf: string; amud: 'a' | 'b' } => {
    const parts = dafYomi.trim().split(' ');
    const masechet = "Bava_Batra";
    
    if (parts.length >= 3) {
      const dafNum = parts[parts.length - 2];
      const amud = parts[parts.length - 1];
      
      const hebrewToNumber: Record<string, string> = {
        'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
        'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
        'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
        'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20',
        'כא': '21', 'כב': '22', 'כג': '23', 'כד': '24', 'כה': '25',
        'כו': '26', 'כז': '27', 'כח': '28', 'כט': '29', 'ל': '30',
        'לא': '31', 'לב': '32', 'לג': '33', 'לד': '34', 'לה': '35'
      };
      
      return {
        masechet,
        daf: hebrewToNumber[dafNum] || dafNum,
        amud: amud === 'א' ? 'a' : 'b'
      };
    }
    
    return { masechet, daf: '2', amud: 'a' };
  };

  const getHebrewBooksUrl = (): string => {
    const { masechet, daf, amud } = getDafInfo(dafYomi);
    const mesechetaId = masechetToHebrewBooksId[masechet] || 23;
    return `https://hebrewbooks.org/shas.aspx?mesechta=${mesechetaId}&daf=${daf}${amud}&format=pdf`;
  };

  const getSefariaUrl = (): string => {
    const ref = convertDafYomiToSefariaRef(dafYomi);
    return `https://www.sefaria.org/${ref}?lang=he`;
  };

  // פונקציה לניקוי והמרת HTML tags לטקסט מעוצב
  const cleanAndFormatText = (html: string): string => {
    // ניקוי תגיות לא נחוצות והמרה לתצוגה נכונה
    let cleaned = html
      .replace(/<big>/gi, '<span class="text-lg font-bold">')
      .replace(/<\/big>/gi, '</span>')
      .replace(/<small>/gi, '<span class="text-sm">')
      .replace(/<\/small>/gi, '</span>');
    return cleaned;
  };

  const renderGemaraText = () => {
    if (!gemaraText) return null;

    const textToShow = showHebrew ? gemaraText.he : gemaraText.text;
    
    if (Array.isArray(textToShow)) {
      return textToShow.map((line: string, index: number) => (
        <p 
          key={index} 
          className="mb-3 leading-loose text-lg" 
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: cleanAndFormatText(line) }}
        />
      ));
    }
    
    return (
      <p 
        className="leading-loose text-lg" 
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: cleanAndFormatText(textToShow) }}
      />
    );
  };

  const renderOriginalView = () => {
    const hebrewBooksUrl = getHebrewBooksUrl();
    const sefariaUrl = getSefariaUrl();
    
    return (
      <div className="space-y-4">
        <div className="text-center text-muted-foreground text-sm mb-4">
          צפייה בדף המקורי מתוך הש"ס וילנא
        </div>
        
        {/* תצוגת iframe מ-HebrewBooks */}
        <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
          <iframe
            src={hebrewBooksUrl}
            className="w-full h-full"
            title="דף גמרא מקורי"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
        
        {/* לינקים חיצוניים */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(hebrewBooksUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 ml-2" />
            HebrewBooks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(sefariaUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 ml-2" />
            ספריא
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">טקסט הגמרא</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground" dir="rtl">
              {gemaraText?.heRef || gemaraText?.ref}
            </div>
          </div>
          
          {/* בחירת מצב תצוגה */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'text' ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode('text')}
              >
                <FileText className="h-4 w-4 ml-1" />
                טקסט
              </Button>
              <Button
                variant={viewMode === 'original' ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode('original')}
              >
                <Image className="h-4 w-4 ml-1" />
                דף מקורי
              </Button>
            </div>
            
            {viewMode === 'text' && (
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
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : viewMode === 'original' ? (
          renderOriginalView()
        ) : gemaraText ? (
          <div className="prose prose-slate max-w-none dark:prose-invert">
            {renderGemaraText()}
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
