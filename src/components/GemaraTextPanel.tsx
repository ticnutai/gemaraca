import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Loader2, BookOpen, Image, FileText, ExternalLink, Eye, Check, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
}

type ViewMode = 'text' | 'sefaria' | 'edaf-image' | 'edaf-site';

const VIEW_LABELS: Record<ViewMode, { label: string; icon: React.ReactNode; description: string }> = {
  'text': { label: 'טקסט מעוצב', icon: <FileText className="h-4 w-4" />, description: 'טקסט נקי מ-Sefaria' },
  'sefaria': { label: 'תצוגת ספריא', icon: <BookOpen className="h-4 w-4" />, description: 'קורא ספריא מלא' },
  'edaf-image': { label: 'תמונה סרוקה', icon: <Image className="h-4 w-4" />, description: 'תמונת דף מ-E-Daf' },
  'edaf-site': { label: 'אתר E-Daf', icon: <ExternalLink className="h-4 w-4" />, description: 'תצוגת אתר E-Daf' },
};

const STORAGE_KEY = 'gemara-view-preference';

export default function GemaraTextPanel({ sugyaId, dafYomi }: GemaraTextPanelProps) {
  const [gemaraText, setGemaraText] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrew, setShowHebrew] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ViewMode) || 'text';
  });
  const [imageZoom, setImageZoom] = useState(100);
  const { toast } = useToast();

  useEffect(() => {
    loadGemaraText();
  }, [dafYomi]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

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
    
    if (parts.length >= 2) {
      let dafNum = parts[0].replace(/[׳\"]/g, '');
      let amud = 'a';
      
      if (parts.length >= 2 && parts[1].includes('ע')) {
        amud = parts[1].includes('ב') ? 'b' : 'a';
      }
      
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
      return `${masechet}.${dafNumber}${amud}`;
    }
    
    return "Bava_Batra.2a";
  };

  const getDafInfo = (dafYomi: string): { daf: number; amud: 'a' | 'b' } => {
    const parts = dafYomi.trim().split(' ');
    
    if (parts.length >= 2) {
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
        daf: hebrewToNumber[dafNum] || 2,
        amud
      };
    }
    
    return { daf: 2, amud: 'a' };
  };

  const getSefariaEmbedUrl = (): string => {
    const ref = convertDafYomiToSefariaRef(dafYomi);
    return `https://www.sefaria.org/${ref}?lang=he&layout=book&sidebarLang=hebrew`;
  };

  const getEdafSiteUrl = (): string => {
    const { daf, amud } = getDafInfo(dafYomi);
    return `https://www.e-daf.com/index.asp?ID=23&masession=${daf}${amud.toUpperCase()}`;
  };

  // URL ישיר לתמונת הדף מ-E-Daf
  const getEdafImageUrl = (): string => {
    const { daf, amud } = getDafInfo(dafYomi);
    return `https://www.e-daf.com/dafImages/bavabatra/${daf}${amud}.gif`;
  };

  const getSefariaDirectUrl = (): string => {
    const ref = convertDafYomiToSefariaRef(dafYomi);
    return `https://www.sefaria.org/${ref}?lang=he`;
  };

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

  const renderSefariaView = () => {
    const { daf, amud } = getDafInfo(dafYomi);
    const embedUrl = getSefariaEmbedUrl();
    const directUrl = getSefariaDirectUrl();
    
    return (
      <div className="space-y-3">
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>דף {daf} עמוד {amud === 'a' ? 'א' : 'ב'} - תצוגת ספריא</span>
        </div>
        
        <div 
          className="border rounded-lg overflow-hidden bg-white shadow-sm"
          style={{ height: '650px' }}
        >
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title={`דף גמרא ${daf}${amud} - ספריא`}
            allow="fullscreen"
          />
        </div>
        
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(directUrl, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            פתח בספריא
          </Button>
        </div>
      </div>
    );
  };

  const renderEdafImageView = () => {
    const { daf, amud } = getDafInfo(dafYomi);
    const imageUrl = getEdafImageUrl();
    const siteUrl = getEdafSiteUrl();
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span>דף {daf} עמוד {amud === 'a' ? 'א' : 'ב'} - תמונה סרוקה</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setImageZoom(z => Math.max(50, z - 25))}
              disabled={imageZoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{imageZoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setImageZoom(z => Math.min(200, z + 25))}
              disabled={imageZoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div 
          className="border rounded-lg overflow-auto bg-[#f8f5eb] shadow-sm flex justify-center"
          style={{ height: '650px' }}
        >
          <img
            src={imageUrl}
            alt={`דף גמרא ${daf}${amud}`}
            className="h-auto transition-transform"
            style={{ width: `${imageZoom}%`, maxWidth: 'none' }}
            onError={(e) => {
              console.error('Failed to load E-Daf image');
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
        </div>
        
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(siteUrl, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            פתח באתר E-Daf
          </Button>
        </div>
      </div>
    );
  };

  const renderEdafSiteView = () => {
    const { daf, amud } = getDafInfo(dafYomi);
    const edafUrl = getEdafSiteUrl();
    
    return (
      <div className="space-y-3">
        <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <ExternalLink className="h-4 w-4" />
          <span>דף {daf} עמוד {amud === 'a' ? 'א' : 'ב'} - אתר E-Daf</span>
        </div>
        
        <div 
          className="border rounded-lg overflow-hidden bg-[#f8f5eb] shadow-sm"
          style={{ height: '650px' }}
        >
          <iframe
            src={edafUrl}
            className="w-full h-full border-0"
            title={`דף גמרא ${daf}${amud} - E-Daf`}
          />
        </div>
        
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(edafUrl, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            פתח ב-E-Daf
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading && viewMode === 'text') {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    switch (viewMode) {
      case 'sefaria':
        return renderSefariaView();
      case 'edaf-image':
        return renderEdafImageView();
      case 'edaf-site':
        return renderEdafSiteView();
      case 'text':
      default:
        return gemaraText ? (
          <div className="prose prose-slate max-w-none dark:prose-invert bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-lg">
            {renderGemaraText()}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            טוען את טקסט הגמרא...
          </div>
        );
    }
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
          
          {/* בחירת מצב תצוגה - Dropdown */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  {VIEW_LABELS[viewMode].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {VIEW_LABELS[mode].icon}
                    <div className="flex flex-col flex-1">
                      <span className="font-medium">{VIEW_LABELS[mode].label}</span>
                      <span className="text-xs text-muted-foreground">{VIEW_LABELS[mode].description}</span>
                    </div>
                    {viewMode === mode && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
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
        {renderContent()}
      </CardContent>
    </Card>
  );
}
