import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Image, FileText, ZoomIn, ZoomOut, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
}

// מיפוי מסכתות ל-book ID של HebrewBooks
const masechetToHebrewBooksReq: Record<string, number> = {
  "Berakhot": 37714, "Shabbat": 37715, "Eruvin": 37716, "Pesachim": 37717,
  "Yoma": 37719, "Sukkah": 37720, "Beitzah": 37721, "Rosh_Hashanah": 37722,
  "Taanit": 37723, "Megillah": 37724, "Moed_Katan": 37725, "Chagigah": 37726,
  "Yevamot": 37727, "Ketubot": 37728, "Nedarim": 37729, "Nazir": 37730,
  "Sotah": 37731, "Gittin": 37732, "Kiddushin": 37733,
  "Bava_Kamma": 37734, "Bava_Metzia": 37735, "Bava_Batra": 9585,
  "Sanhedrin": 37737, "Makkot": 37738, "Shevuot": 37739, "Avodah_Zarah": 37740,
  "Horayot": 37741, "Zevachim": 37742, "Menachot": 37743, "Chullin": 37744,
  "Bekhorot": 37745, "Arakhin": 37746, "Temurah": 37747, "Keritot": 37748,
  "Meilah": 37749, "Niddah": 37751
};

// חישוב מספר העמוד ב-PDF (דף 2a הוא עמוד 3 בדרך כלל)
const calculatePdfPage = (dafNumber: number, amud: 'a' | 'b'): number => {
  // בבבא בתרא: דף 2a מתחיל בעמוד 5 ב-PDF (עם כותרות)
  const basePage = 3; // עמוד ההתחלה
  const pageOffset = (dafNumber - 2) * 2; // כל דף = 2 עמודים
  const amudOffset = amud === 'b' ? 1 : 0;
  return basePage + pageOffset + amudOffset;
};

type ViewMode = 'text' | 'original';

export default function GemaraTextPanel({ sugyaId, dafYomi }: GemaraTextPanelProps) {
  const [gemaraText, setGemaraText] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrew, setShowHebrew] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadGemaraText();
    setImageError(false);
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

  const getDafInfo = (dafYomi: string): { masechet: string; daf: number; amud: 'a' | 'b' } => {
    const parts = dafYomi.trim().split(' ');
    const masechet = "Bava_Batra";
    
    if (parts.length >= 2) {
      // Handle format like "ל׳ ע״א" or just number
      let dafNum = parts[0].replace(/[׳\"]/g, '');
      let amud: 'a' | 'b' = 'a';
      
      if (parts.length >= 2 && parts[1].includes('ע')) {
        amud = parts[1].includes('ב') ? 'b' : 'a';
      }
      
      const hebrewToNumber: Record<string, number> = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
        'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
        'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15,
        'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20,
        'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25,
        'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29, 'ל': 30,
        'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35
      };
      
      return {
        masechet,
        daf: hebrewToNumber[dafNum] || 2,
        amud
      };
    }
    
    return { masechet, daf: 2, amud: 'a' };
  };

  const getHebrewBooksImageUrl = (): string => {
    const { masechet, daf, amud } = getDafInfo(dafYomi);
    const bookReq = masechetToHebrewBooksReq[masechet] || 9585;
    const pdfPage = calculatePdfPage(daf, amud);
    // HebrewBooks pdfpager URL - מציג את הדף ישירות
    return `https://hebrewbooks.org/pdfpager.aspx?req=${bookReq}&pgnum=${pdfPage}`;
  };

  // פונקציה לניקוי והמרת HTML tags לטקסט מעוצב
  const cleanAndFormatText = (html: string): string => {
    let cleaned = html
      .replace(/<big>/gi, '<span class="text-xl font-bold text-primary">')
      .replace(/<\/big>/gi, '</span>')
      .replace(/<small>/gi, '<span class="text-sm">')
      .replace(/<\/small>/gi, '</span>')
      .replace(/<strong>/gi, '<strong class="font-bold">')
      .replace(/<b>/gi, '<b class="font-semibold">')
      .replace(/<i>/gi, '<i class="italic text-muted-foreground">');
    return cleaned;
  };

  const renderGemaraText = () => {
    if (!gemaraText) return null;

    const textToShow = showHebrew ? gemaraText.he : gemaraText.text;
    
    if (Array.isArray(textToShow)) {
      return textToShow.map((line: string, index: number) => (
        <p 
          key={index} 
          className="mb-4 leading-loose text-lg font-serif" 
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: cleanAndFormatText(line) }}
        />
      ));
    }
    
    return (
      <p 
        className="leading-loose text-lg font-serif" 
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: cleanAndFormatText(textToShow) }}
      />
    );
  };

  const renderOriginalView = () => {
    const { daf, amud } = getDafInfo(dafYomi);
    const imageUrl = getHebrewBooksImageUrl();
    
    return (
      <div className="space-y-4">
        <div className="text-center text-muted-foreground text-sm mb-2 flex items-center justify-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>דף {daf}{amud === 'a' ? ' עמוד א' : ' עמוד ב'} - תלמוד בבלי מסכת בבא בתרא</span>
        </div>
        
        {/* תצוגת הדף המקורי */}
        <div 
          className="border rounded-lg overflow-hidden bg-[#f5f0e6] shadow-inner"
          style={{ height: '700px' }}
        >
          <iframe
            src={imageUrl}
            className="w-full h-full border-0"
            title={`דף גמרא ${daf}${amud}`}
            style={{ 
              backgroundColor: '#f5f0e6',
            }}
            onError={() => setImageError(true)}
          />
        </div>
        
        {imageError && (
          <div className="text-center text-muted-foreground py-4">
            <p>לא ניתן לטעון את הדף המקורי</p>
            <Button 
              variant="link" 
              onClick={() => window.open(imageUrl, '_blank')}
              className="mt-2"
            >
              פתח בחלון חדש
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
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
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={viewMode === 'text' ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode('text')}
                className="gap-1"
              >
                <FileText className="h-4 w-4" />
                טקסט
              </Button>
              <Button
                variant={viewMode === 'original' ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode('original')}
                className="gap-1"
              >
                <Image className="h-4 w-4" />
                דף מקורי
              </Button>
            </div>
            
            {viewMode === 'text' && (
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={showHebrew ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowHebrew(true)}
                >
                  עברית
                </Button>
                <Button
                  variant={!showHebrew ? "default" : "ghost"}
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
          <div className="prose prose-slate max-w-none dark:prose-invert bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-lg">
            {renderGemaraText()}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            טוען את טקסט הגמרא...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
