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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, BookOpen, Image, FileText, ExternalLink, Eye, Check, ZoomIn, ZoomOut, Type, AArrowUp, AArrowDown, AlignRight, AlignCenter, AlignLeft, Bold, Highlighter, MousePointer2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCachedGemaraText, setCachedGemaraText } from "@/lib/pageCache";
import { RichTextViewer } from "./RichTextViewer";

const FONTS = [
  { value: 'font-serif', label: 'דוד (סריף)' },
  { value: 'font-sans', label: 'אריאל (ללא סריף)' },
  { value: 'font-mono', label: 'קוריאר (מונו)' },
];

const HIGHLIGHT_COLORS = [
  { value: 'bg-yellow-200/60', label: 'צהוב' },
  { value: 'bg-green-200/60', label: 'ירוק' },
  { value: 'bg-blue-200/60', label: 'כחול' },
  { value: 'bg-pink-200/60', label: 'ורוד' },
  { value: 'bg-orange-200/60', label: 'כתום' },
  { value: 'bg-transparent', label: 'ללא' },
];

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
  masechet?: string; // Sefaria name e.g. "Megillah", "Bava_Batra"
}

type ViewMode = 'text' | 'sefaria' | 'edaf-image' | 'edaf-site';

const VIEW_LABELS: Record<ViewMode, { label: string; icon: React.ReactNode; description: string }> = {
  'text': { label: 'טקסט מעוצב', icon: <FileText className="h-4 w-4" />, description: 'טקסט נקי מ-Sefaria' },
  'sefaria': { label: 'תצוגת ספריא', icon: <BookOpen className="h-4 w-4" />, description: 'קורא ספריא מלא' },
  'edaf-image': { label: 'תמונה סרוקה', icon: <Image className="h-4 w-4" />, description: 'תמונת דף מ-E-Daf' },
  'edaf-site': { label: 'אתר E-Daf', icon: <ExternalLink className="h-4 w-4" />, description: 'תצוגת אתר E-Daf' },
};

const STORAGE_KEY = 'gemara-view-preference';
const TEXT_SETTINGS_KEY = 'gemara-text-settings';

interface TextSettings {
  fontSize: number;
  fontFamily: string;
  textAlign: 'right' | 'center' | 'left';
  isBold: boolean;
  highlightColor: string;
}

const defaultTextSettings: TextSettings = {
  fontSize: 18,
  fontFamily: 'font-serif',
  textAlign: 'right',
  isBold: false,
  highlightColor: 'bg-transparent',
};

export default function GemaraTextPanel({ sugyaId, dafYomi, masechet = "Bava_Batra" }: GemaraTextPanelProps) {
  const [gemaraText, setGemaraText] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrew, setShowHebrew] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ViewMode) || 'sefaria';
  });
  const [imageZoom, setImageZoom] = useState(100);
  const [textSettings, setTextSettings] = useState<TextSettings>(() => {
    const saved = localStorage.getItem(TEXT_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : defaultTextSettings;
  });
  const { toast } = useToast();

  useEffect(() => {
    loadGemaraText();
  }, [dafYomi]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(TEXT_SETTINGS_KEY, JSON.stringify(textSettings));
  }, [textSettings]);

  const updateTextSetting = <K extends keyof TextSettings>(key: K, value: TextSettings[K]) => {
    setTextSettings(prev => ({ ...prev, [key]: value }));
  };

  const loadGemaraText = async () => {
    const ref = convertDafYomiToSefariaRef(dafYomi);
    
    // Check cache first
    const cached = getCachedGemaraText(ref);
    if (cached) {
      console.log('Using cached Gemara text for ref:', ref);
      setGemaraText(cached);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Loading Gemara text for ref:', ref);
      
      const { data, error } = await supabase.functions.invoke('get-gemara-text', {
        body: { ref }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('Gemara text loaded successfully');
        // Save to cache
        setCachedGemaraText(ref, data.data);
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

  const convertDafYomiToSefariaRef = (dafYomiStr: string): string => {
    // First, try to extract daf number from dafYomi string
    // Format can be: "מגילה י״ט ע״א" or "י״ט ע״א" etc.
    const parts = dafYomiStr.trim().split(' ');
    
    // Find the daf number part (Hebrew numeral)
    let dafNum = '';
    let amud = 'a';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('ע')) {
        // This is the amud indicator
        amud = part.includes('ב') ? 'b' : 'a';
      } else if (/^[א-ת״׳]+$/.test(part.replace(/[״׳]/g, ''))) {
        // This looks like a Hebrew numeral
        dafNum = part.replace(/[״׳]/g, '');
      }
    }
    
    if (!dafNum) {
      // Fallback: try parsing from sugya_id
      return `${masechet}.2a`;
    }
    
    const hebrewToNumber: Record<string, string> = {
      'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
      'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
      'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
      'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20',
      'כא': '21', 'כב': '22', 'כג': '23', 'כד': '24', 'כה': '25',
      'כו': '26', 'כז': '27', 'כח': '28', 'כט': '29', 'ל': '30',
      'לא': '31', 'לב': '32', 'לג': '33', 'לד': '34', 'לה': '35',
      'לו': '36', 'לז': '37', 'לח': '38', 'לט': '39', 'מ': '40'
    };
    
    const dafNumber = hebrewToNumber[dafNum] || dafNum;
    return `${masechet}.${dafNumber}${amud}`;
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
    // Map masechet to E-Daf ID
    const edafMasechetMap: Record<string, number> = {
      'Bava_Batra': 23, 'Megillah': 12, 'Berachot': 1, 'Shabbat': 2,
      'Eruvin': 3, 'Pesachim': 4, 'Shekalim': 5, 'Yoma': 6,
      'Sukkah': 7, 'Beitzah': 8, 'Rosh_Hashanah': 9, 'Taanit': 10,
      'Chagigah': 11, 'Moed_Katan': 13, 'Yevamot': 14, 'Ketubot': 15,
      'Nedarim': 16, 'Nazir': 17, 'Sotah': 18, 'Gittin': 19,
      'Kiddushin': 20, 'Bava_Kamma': 21, 'Bava_Metzia': 22,
      'Sanhedrin': 24, 'Makkot': 25, 'Shevuot': 26, 'Avodah_Zarah': 27,
      'Horayot': 28, 'Zevachim': 29, 'Menachot': 30, 'Chullin': 31,
      'Bechorot': 32, 'Arachin': 33, 'Temurah': 34, 'Keritot': 35,
      'Meilah': 36, 'Niddah': 37
    };
    const masechetId = edafMasechetMap[masechet] || 23;
    return `https://www.e-daf.com/index.asp?ID=${masechetId}&masession=${daf}${amud.toUpperCase()}`;
  };

  // URL ישיר לתמונת הדף מ-E-Daf
  const getEdafImageUrl = (): string => {
    const { daf, amud } = getDafInfo(dafYomi);
    // Convert Sefaria name to E-Daf folder name
    const edafFolderMap: Record<string, string> = {
      'Bava_Batra': 'bavabatra', 'Megillah': 'megillah', 'Berachot': 'berachot',
      'Shabbat': 'shabbat', 'Eruvin': 'eruvin', 'Pesachim': 'pesachim',
      'Yoma': 'yoma', 'Sukkah': 'sukkah', 'Beitzah': 'beitzah',
      'Rosh_Hashanah': 'roshhashanah', 'Taanit': 'taanis', 'Chagigah': 'chagigah',
      'Moed_Katan': 'moedkatan', 'Yevamot': 'yevamos', 'Ketubot': 'kesubos',
      'Nedarim': 'nedarim', 'Nazir': 'nazir', 'Sotah': 'sotah',
      'Gittin': 'gittin', 'Kiddushin': 'kiddushin', 'Bava_Kamma': 'bavakama',
      'Bava_Metzia': 'bavametzia', 'Sanhedrin': 'sanhedrin', 'Makkot': 'makkos',
      'Shevuot': 'shevuos', 'Avodah_Zarah': 'avodazarah', 'Horayot': 'horayos',
      'Zevachim': 'zevachim', 'Menachot': 'menachos', 'Chullin': 'chullin',
      'Bechorot': 'bechoros', 'Arachin': 'erchin', 'Temurah': 'temurah',
      'Keritot': 'kerisus', 'Meilah': 'meilah', 'Niddah': 'niddah'
    };
    const folder = edafFolderMap[masechet] || masechet.toLowerCase().replace(/_/g, '');
    return `https://www.e-daf.com/dafImages/${folder}/${daf}${amud}.gif`;
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

  const getTextAlignClass = () => {
    switch (textSettings.textAlign) {
      case 'center': return 'text-center';
      case 'left': return 'text-left';
      default: return 'text-right';
    }
  };

  const getPlainText = (htmlOrArray: any): string => {
    if (Array.isArray(htmlOrArray)) {
      return htmlOrArray.map(line => {
        const temp = document.createElement('div');
        temp.innerHTML = line;
        return temp.textContent || temp.innerText || '';
      }).join('\n\n');
    }
    const temp = document.createElement('div');
    temp.innerHTML = htmlOrArray;
    return temp.textContent || temp.innerText || '';
  };

  const renderGemaraText = () => {
    if (!gemaraText) return null;

    const textToShow = showHebrew ? gemaraText.he : gemaraText.text;
    const plainText = getPlainText(textToShow);
    const textClasses = `leading-loose ${textSettings.fontFamily} ${getTextAlignClass()} ${textSettings.isBold ? 'font-bold' : ''} ${textSettings.highlightColor}`;
    
    return (
      <RichTextViewer
        text={plainText}
        sourceType="gemara"
        sourceId={sugyaId}
        className={textClasses}
        baseStyle={{ fontSize: `${textSettings.fontSize}px` }}
      />
    );
  };

  const renderTextToolbar = () => (
    <div className="flex items-center gap-1 flex-wrap p-2 bg-muted/50 rounded-lg border">
      {/* Hint for word selection */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground border-l pl-2 ml-1">
        <MousePointer2 className="h-3 w-3" />
        <span>סמן מילים לעיצוב</span>
      </div>
      {/* Font Size Controls */}
      <div className="flex items-center gap-1 border-l pl-2 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => updateTextSetting('fontSize', Math.max(12, textSettings.fontSize - 2))}
          title="הקטן גופן"
        >
          <AArrowDown className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center">{textSettings.fontSize}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => updateTextSetting('fontSize', Math.min(32, textSettings.fontSize + 2))}
          title="הגדל גופן"
        >
          <AArrowUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Font Family */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="שנה גופן">
            <Type className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {FONTS.map(font => (
            <DropdownMenuItem
              key={font.value}
              onClick={() => updateTextSetting('fontFamily', font.value)}
              className="flex items-center gap-2"
            >
              <span className={font.value}>{font.label}</span>
              {textSettings.fontFamily === font.value && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Text Alignment */}
      <div className="flex items-center gap-0.5 border-x px-2 mx-1">
        <Button
          variant={textSettings.textAlign === 'right' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => updateTextSetting('textAlign', 'right')}
          title="יישור לימין"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'center' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => updateTextSetting('textAlign', 'center')}
          title="יישור למרכז"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'left' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => updateTextSetting('textAlign', 'left')}
          title="יישור לשמאל"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Bold */}
      <Button
        variant={textSettings.isBold ? 'secondary' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => updateTextSetting('isBold', !textSettings.isBold)}
        title="הדגשה"
      >
        <Bold className="h-4 w-4" />
      </Button>

      {/* Highlight Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="סימון בצבע">
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-3 gap-1">
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => updateTextSetting('highlightColor', color.value)}
                className={`h-8 rounded border ${color.value} ${textSettings.highlightColor === color.value ? 'ring-2 ring-primary' : ''}`}
                title={color.label}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

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
          <div className="space-y-3">
            {renderTextToolbar()}
            <div className="prose prose-slate max-w-none dark:prose-invert bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-lg">
              {renderGemaraText()}
            </div>
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
