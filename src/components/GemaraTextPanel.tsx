import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, BookOpen, Image, FileText, ExternalLink, Eye, Check, ZoomIn, ZoomOut, Type, AArrowUp, AArrowDown, AlignRight, AlignCenter, AlignLeft, AlignJustify, Bold, Italic, Underline, Strikethrough, Highlighter, MousePointer2, Database, Copy, Printer, MoveVertical, FileDown, Save, Palette, RotateCcw, Scissors, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast as sonnerToast } from "sonner";
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
  { value: 'bg-yellow-200/60', label: 'צהוב', hex: '#FEF08A' },
  { value: 'bg-green-200/60', label: 'ירוק', hex: '#BBF7D0' },
  { value: 'bg-blue-200/60', label: 'כחול', hex: '#BFDBFE' },
  { value: 'bg-pink-200/60', label: 'ורוד', hex: '#FBCFE8' },
  { value: 'bg-orange-200/60', label: 'כתום', hex: '#FED7AA' },
  { value: 'bg-purple-200/60', label: 'סגול', hex: '#E9D5FF' },
  { value: 'bg-transparent', label: 'ללא', hex: 'transparent' },
];

const TEXT_COLORS = [
  { value: '#000000', label: 'שחור' },
  { value: '#0B1F5B', label: 'כחול כהה' },
  { value: '#b91c1c', label: 'אדום' },
  { value: '#15803d', label: 'ירוק' },
  { value: '#7e22ce', label: 'סגול' },
  { value: '#b45309', label: 'כתום' },
  { value: '#D4AF37', label: 'זהב' },
];

interface GemaraTextPanelProps {
  sugyaId: string;
  dafYomi: string;
  masechet?: string; // Sefaria name e.g. "Megillah", "Bava_Batra"
}

type ViewMode = 'text' | 'sefaria' | 'edaf-image' | 'edaf-site' | 'cloud';

// Pre-defined lookup maps — avoid re-creating on every render
const HEBREW_TO_NUMBER_STR: Record<string, string> = {
  'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
  'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
  'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
  'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20',
  'כא': '21', 'כב': '22', 'כג': '23', 'כד': '24', 'כה': '25',
  'כו': '26', 'כז': '27', 'כח': '28', 'כט': '29', 'ל': '30',
  'לא': '31', 'לב': '32', 'לג': '33', 'לד': '34', 'לה': '35',
  'לו': '36', 'לז': '37', 'לח': '38', 'לט': '39', 'מ': '40'
};

const HEBREW_TO_NUMBER_INT: Record<string, number> = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
  'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15,
  'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20,
  'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25,
  'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29, 'ל': 30,
  'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35
};

const EDAF_MASECHET_MAP: Record<string, number> = {
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

const EDAF_FOLDER_MAP: Record<string, string> = {
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

const VIEW_LABELS: Record<ViewMode, { label: string; icon: React.ReactNode; description: string }> = {
  'text': { label: 'טקסט מעוצב', icon: <FileText className="h-4 w-4" />, description: 'טקסט נקי מ-Sefaria' },
  'sefaria': { label: 'תצוגת ספריא', icon: <BookOpen className="h-4 w-4" />, description: 'קורא ספריא מלא' },
  'edaf-image': { label: 'תמונה סרוקה', icon: <Image className="h-4 w-4" />, description: 'תמונת דף מ-E-Daf' },
  'edaf-site': { label: 'אתר E-Daf', icon: <ExternalLink className="h-4 w-4" />, description: 'תצוגת אתר E-Daf' },
  'cloud': { label: 'גמרא מהענן', icon: <Database className="h-4 w-4" />, description: 'גמרות שהורדו ונשמרו' },
};

const CLOUD_HIGHLIGHT_COLORS = [
  { value: '#FFF9C4', label: 'צהוב' },
  { value: '#C8E6C9', label: 'ירוק' },
  { value: '#BBDEFB', label: 'כחול' },
  { value: '#F8BBD0', label: 'ורוד' },
  { value: '#FFE0B2', label: 'כתום' },
  { value: '#E1BEE7', label: 'סגול' },
];

const STORAGE_KEY = 'gemara-view-preference';
const TEXT_SETTINGS_KEY = 'gemara-text-settings';

interface TextSettings {
  fontSize: number;
  fontFamily: string;
  textAlign: 'right' | 'center' | 'left' | 'justify';
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  highlightColor: string;
  textColor: string;
  lineHeight: number;
}

const defaultTextSettings: TextSettings = {
  fontSize: 18,
  fontFamily: 'font-serif',
  textAlign: 'right',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  highlightColor: 'bg-transparent',
  textColor: '',
  lineHeight: 1.8,
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
    try {
      const saved = localStorage.getItem(TEXT_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultTextSettings, ...parsed };
      }
    } catch {}
    return defaultTextSettings;
  });
  const { toast } = useToast();
  const textIframeRef = useRef<HTMLIFrameElement>(null);
  const [textEditMode, setTextEditMode] = useState(false);

  // Cloud editor state
  const cloudIframeRef = useRef<HTMLIFrameElement>(null);
  const [cloudEditMode, setCloudEditMode] = useState(false);
  const [cloudPages, setCloudPages] = useState<Array<{ sugya_id: string; title: string; daf_yomi: string; masechet: string }>>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudContent, setCloudContent] = useState<string>("");
  const [cloudLineHeight, setCloudLineHeight] = useState(1.8);
  const [cloudParagraphSpacing, setCloudParagraphSpacing] = useState(10);

  // Load cloud pages list when switching to cloud mode
  useEffect(() => {
    if (viewMode === 'cloud') {
      loadCloudPages();
    }
  }, [viewMode]);

  // Load the current daf's cloud content when entering cloud mode
  useEffect(() => {
    if (viewMode === 'cloud' && sugyaId) {
      loadCloudContent(sugyaId);
    }
  }, [viewMode, sugyaId]);

  const loadCloudPages = async () => {
    setCloudLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('sugya_id, title, daf_yomi, masechet')
        .order('masechet')
        .order('daf_number');
      if (error) throw error;
      setCloudPages((data || []) as Array<{ sugya_id: string; title: string; daf_yomi: string; masechet: string }>);
    } catch {
      sonnerToast.error("שגיאה בטעינת רשימת הדפים");
    } finally {
      setCloudLoading(false);
    }
  };

  const loadCloudContent = async (sid: string) => {
    setCloudLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('*')
        .eq('sugya_id', sid)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const ext = data as Record<string, unknown>;
        const text = (ext.gemara_text as string) || (ext.full_text as string) || "";
        setCloudContent(text);
      } else {
        setCloudContent("");
      }
    } catch {
      sonnerToast.error("שגיאה בטעינת תוכן הדף");
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudCopy = useCallback(() => {
    const doc = cloudIframeRef.current?.contentDocument;
    const sel = doc?.getSelection()?.toString() || cloudContent || "";
    if (sel) { navigator.clipboard.writeText(sel); sonnerToast.success("הועתק"); }
  }, [cloudContent]);

  const handleCloudPrint = useCallback(() => {
    const doc = cloudIframeRef.current?.contentDocument;
    const html = doc?.documentElement?.outerHTML || cloudContent;
    if (html) {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.print(); }
    }
  }, [cloudContent]);

  const handleCloudDownload = useCallback((format: string) => {
    const doc = cloudIframeRef.current?.contentDocument;
    const content = doc?.body?.innerHTML || cloudContent;
    if (!content) { sonnerToast.error("אין תוכן להורדה"); return; }
    const title = `gemara_${sugyaId}`;
    let blob: Blob;
    let ext: string;
    if (format === "html") {
      blob = new Blob([`<!DOCTYPE html><html dir=\"rtl\" lang=\"he\"><head><meta charset=\"utf-8\"><title>${title}</title></head><body>${content}</body></html>`], { type: "text/html;charset=utf-8" });
      ext = "html";
    } else if (format === "txt") {
      const text = doc?.body?.innerText || content.replace(/<[^>]+>/g, '');
      blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      ext = "txt";
    } else {
      blob = new Blob([`<!DOCTYPE html><html dir=\"rtl\"><head><meta charset=\"utf-8\"><title>${title}</title></head><body>${content}</body></html>`], { type: "text/html;charset=utf-8" });
      ext = "html";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success(`הקובץ ${title}.${ext} הורד בהצלחה`);
  }, [cloudContent, sugyaId]);

  useEffect(() => {
    loadGemaraText();
    // Prefetch next daf in background for instant navigation
    prefetchNextDaf();
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
    
    // 1. Check IndexedDB cache first (instant)
    const cached = getCachedGemaraText(ref);
    if (cached) {
      console.log('Using cached Gemara text for ref:', ref);
      setGemaraText(cached);
      return;
    }

    setIsLoading(true);
    try {
      // 2. Try direct DB lookup (skips edge function entirely)
      const { data: dbPage } = await supabase
        .from('gemara_pages')
        .select('sefaria_ref')
        .eq('sefaria_ref', ref)
        .maybeSingle() as { data: { sefaria_ref?: string } | null };

      if (dbPage?.sefaria_ref) {
        // Page exists in DB but we need full text from edge function
        console.log('Found page in DB, loading full text for ref:', ref);
      }

      // 3. Fallback to edge function (which calls Sefaria and caches to DB)
      console.log('Loading Gemara text from edge function for ref:', ref);
      const { data, error } = await supabase.functions.invoke('get-gemara-text', {
        body: { ref }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('Gemara text loaded successfully from:', data.source || 'sefaria');
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

  /** Prefetch the next daf in background so navigation feels instant */
  const prefetchNextDaf = async () => {
    try {
      const info = getDafInfo(dafYomi);
      let nextDaf: number, nextAmud: 'a' | 'b';
      if (info.amud === 'a') {
        nextDaf = info.daf;
        nextAmud = 'b';
      } else {
        nextDaf = info.daf + 1;
        nextAmud = 'a';
      }
      const nextRef = `${masechet}.${nextDaf}${nextAmud}`;
      // Only prefetch if not already cached
      if (!getCachedGemaraText(nextRef)) {
        // Try DB first
        const { data: dbPage } = await supabase
          .from('gemara_pages')
          .select('sefaria_ref')
          .eq('sefaria_ref', nextRef)
          .maybeSingle() as { data: { sefaria_ref?: string } | null };

        if (dbPage) {
          // Page exists, prefetch via edge function
          const { data } = await supabase.functions.invoke('get-gemara-text', {
            body: { ref: nextRef },
          });
          if (data?.success) {
            setCachedGemaraText(nextRef, data.data);
          }
        } else {
          const { data } = await supabase.functions.invoke('get-gemara-text', {
            body: { ref: nextRef },
          });
          if (data?.success) {
            setCachedGemaraText(nextRef, data.data);
          }
        }
      }
    } catch {
      // Silent fail — prefetch is best-effort
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
    
    const hebrewToNumber = HEBREW_TO_NUMBER_STR;
    
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
      
      const hebrewToNumber = HEBREW_TO_NUMBER_INT;
      
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
    const masechetId = EDAF_MASECHET_MAP[masechet] || 23;
    return `https://www.e-daf.com/index.asp?ID=${masechetId}&masession=${daf}${amud.toUpperCase()}`;
  };

  // URL ישיר לתמונת הדף מ-E-Daf
  const getEdafImageUrl = (): string => {
    const { daf, amud } = getDafInfo(dafYomi);
    // Convert Sefaria name to E-Daf folder name
    const folder = EDAF_FOLDER_MAP[masechet] || masechet.toLowerCase().replace(/_/g, '');
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
      case 'justify': return 'text-justify';
      default: return 'text-right';
    }
  };

  const getPlainText = (htmlOrArray: string | string[]): string => {
    const parser = new DOMParser();
    const extract = (html: string): string => {
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    };
    if (Array.isArray(htmlOrArray)) {
      return htmlOrArray.map(line => extract(String(line))).join('\n\n');
    }
    return extract(String(htmlOrArray || ''));
  };

  // Memoize plain text extraction (expensive DOMParser)
  const memoizedPlainText = useMemo(() => {
    if (!gemaraText) return '';
    const textToShow = showHebrew ? gemaraText.he : gemaraText.text;
    return getPlainText(textToShow);
  }, [gemaraText, showHebrew]);

  const renderGemaraText = () => {
    if (!gemaraText) return null;

    const textClasses = `${textSettings.fontFamily} ${getTextAlignClass()} ${textSettings.isBold ? 'font-bold' : ''} ${textSettings.isItalic ? 'italic' : ''} ${textSettings.isUnderline ? 'underline' : ''} ${textSettings.isStrikethrough ? 'line-through' : ''} ${textSettings.highlightColor}`;
    
    return (
      <RichTextViewer
        text={memoizedPlainText}
        sourceType="gemara"
        sourceId={sugyaId}
        className={textClasses}
        baseStyle={{
          fontSize: `${textSettings.fontSize}px`,
          lineHeight: `${textSettings.lineHeight}`,
          ...(textSettings.textColor ? { color: textSettings.textColor } : {}),
        }}
      />
    );
  };

  const handleCopyText = useCallback(() => {
    if (memoizedPlainText) {
      navigator.clipboard.writeText(memoizedPlainText);
      sonnerToast.success("הטקסט הועתק");
    }
  }, [memoizedPlainText]);

  const handlePrintText = useCallback(() => {
    const content = memoizedPlainText;
    if (!content) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>גמרא - ${dafYomi}</title><style>body{font-family:'David',serif;font-size:${textSettings.fontSize}px;line-height:${textSettings.lineHeight};padding:40px;direction:rtl;white-space:pre-wrap;}</style></head><body>${content}</body></html>`);
      win.document.close();
      win.print();
    }
  }, [memoizedPlainText, dafYomi, textSettings]);

  const handleDownloadText = useCallback((format: string) => {
    const content = memoizedPlainText;
    if (!content) { sonnerToast.error("אין תוכן להורדה"); return; }
    const title = `gemara_${sugyaId}`;
    let blob: Blob;
    let ext: string;
    if (format === "html") {
      blob = new Blob([`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:David,serif;font-size:${textSettings.fontSize}px;line-height:${textSettings.lineHeight};white-space:pre-wrap;">${content}</body></html>`], { type: "text/html;charset=utf-8" });
      ext = "html";
    } else {
      blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      ext = "txt";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success(`הקובץ ${title}.${ext} הורד בהצלחה`);
  }, [memoizedPlainText, sugyaId, textSettings]);

  const handleResetSettings = useCallback(() => {
    setTextSettings(defaultTextSettings);
    sonnerToast.success("הגדרות העיצוב אופסו");
  }, []);

  const sep = <div className="w-px h-5 bg-border" />;

  const renderTextToolbar = () => (
    <div className="space-y-0">
      {/* ═══ Main Toolbar Row ═══ */}
      <div className="flex items-center gap-0.5 flex-wrap p-2 bg-muted/50 rounded-t-lg border border-b-0">
        {/* Edit Mode Toggle */}
        <Button
          size="sm"
          variant={textEditMode ? "default" : "outline"}
          className={`h-7 text-xs gap-1 ${textEditMode ? "bg-primary text-primary-foreground" : ""}`}
          onClick={() => {
            const next = !textEditMode;
            setTextEditMode(next);
            setTimeout(() => {
              const doc = textIframeRef.current?.contentDocument;
              if (doc?.body) doc.designMode = next ? "on" : "off";
            }, 100);
          }}
        >
          <Scissors className="h-3 w-3" />
          {textEditMode ? "מצב עריכה פעיל" : "ערוך"}
        </Button>

        {sep}

        {/* Hint */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-2 ml-1">
          <MousePointer2 className="h-3 w-3" />
          <span>סמן מילים לעיצוב</span>
        </div>

        {sep}

        {/* Font Size */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTextSetting('fontSize', Math.max(10, textSettings.fontSize - 2))} title="הקטן גופן">
          <AArrowDown className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-6 text-center font-mono">{textSettings.fontSize}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTextSetting('fontSize', Math.min(36, textSettings.fontSize + 2))} title="הגדל גופן">
          <AArrowUp className="h-3.5 w-3.5" />
        </Button>

        {sep}

        {/* Font Family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="שנה גופן">
              <Type className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FONTS.map(font => (
              <DropdownMenuItem key={font.value} onClick={() => updateTextSetting('fontFamily', font.value)} className="flex items-center gap-2">
                <span className={font.value}>{font.label}</span>
                {textSettings.fontFamily === font.value && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {sep}

        {/* Text Formatting: Bold, Italic, Underline, Strikethrough */}
        <Button variant={textSettings.isBold ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('bold'); else updateTextSetting('isBold', !textSettings.isBold); }} title="הדגשה">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.isItalic ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('italic'); else updateTextSetting('isItalic', !textSettings.isItalic); }} title="נטוי">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.isUnderline ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('underline'); else updateTextSetting('isUnderline', !textSettings.isUnderline); }} title="קו תחתון">
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.isStrikethrough ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('strikeThrough'); else updateTextSetting('isStrikethrough', !textSettings.isStrikethrough); }} title="קו חוצה">
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>

        {sep}

        {/* Alignment: Right, Center, Left, Justify */}
        <Button variant={textSettings.textAlign === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('justifyRight'); updateTextSetting('textAlign', 'right'); }} title="ימין">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.textAlign === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('justifyCenter'); updateTextSetting('textAlign', 'center'); }} title="מרכז">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.textAlign === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('justifyLeft'); updateTextSetting('textAlign', 'left'); }} title="שמאל">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant={textSettings.textAlign === 'justify' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => { if (textEditMode) textIframeRef.current?.contentDocument?.execCommand('justifyFull'); updateTextSetting('textAlign', 'justify'); }} title="מלא">
          <AlignJustify className="h-3.5 w-3.5" />
        </Button>

        {sep}

        {/* Highlight Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="סימון בצבע">
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-xs font-semibold text-foreground mb-2">צבע הדגשה</p>
            <div className="flex gap-1.5">
              {HIGHLIGHT_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => {
                    if (textEditMode && color.hex !== 'transparent') {
                      textIframeRef.current?.contentDocument?.execCommand('hiliteColor', false, color.hex);
                    }
                    updateTextSetting('highlightColor', color.value);
                  }}
                  className={`w-6 h-6 rounded-full border-2 shadow-sm hover:scale-125 transition-transform ${textSettings.highlightColor === color.value ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`}
                  style={{ backgroundColor: color.hex }}
                  title={color.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="צבע טקסט">
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-xs font-semibold text-foreground mb-2">צבע טקסט</p>
            <div className="flex gap-1.5">
              {TEXT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => {
                    if (textEditMode) {
                      textIframeRef.current?.contentDocument?.execCommand('foreColor', false, c.value);
                    }
                    updateTextSetting('textColor', textSettings.textColor === c.value ? '' : c.value);
                  }}
                  className={`w-6 h-6 rounded-full border-2 shadow-sm hover:scale-125 transition-transform ${textSettings.textColor === c.value ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {sep}

        {/* Line Height / Spacing */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="מרווח שורות">
              <MoveVertical className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start" dir="rtl">
            <p className="text-xs font-semibold text-foreground mb-2">מרווח שורות</p>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">גובה שורה</span>
              <span className="text-[10px] font-mono text-primary">{textSettings.lineHeight.toFixed(1)}</span>
            </div>
            <Slider
              value={[textSettings.lineHeight]}
              onValueChange={(v) => updateTextSetting('lineHeight', v[0])}
              min={1}
              max={3.5}
              step={0.1}
              className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
            />
          </PopoverContent>
        </Popover>

        {sep}

        {/* Copy */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyText} title="העתק">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {/* Print */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrintText} title="הדפסה">
          <Printer className="h-3.5 w-3.5" />
        </Button>
        {/* Download */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="הורד">
              <FileDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1.5" align="start" dir="rtl">
            <button className="w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2" onClick={() => handleDownloadText("html")}>📄 HTML</button>
            <button className="w-full text-right text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2" onClick={() => handleDownloadText("txt")}>📝 טקסט (TXT)</button>
          </PopoverContent>
        </Popover>

        {sep}

        {/* Remove format (edit mode) */}
        {textEditMode && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => textIframeRef.current?.contentDocument?.execCommand('removeFormat')} title="הסר עיצוב">
            <RotateCcw className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}

        {/* Reset */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetSettings} title="איפוס עיצוב">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
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
          <span>דף {daf} {amud === 'a' ? 'ע״א' : 'ע״ב'} - תצוגת ספריא</span>
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
            <span>דף {daf} {amud === 'a' ? 'ע״א' : 'ע״ב'} - תמונה סרוקה</span>
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
          <span>דף {daf} {amud === 'a' ? 'ע״א' : 'ע״ב'} - אתר E-Daf</span>
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

  const renderCloudView = () => {
    if (cloudLoading && !cloudContent) {
      return (
        <div className="space-y-4 py-6">
          <Skeleton className="h-6 w-48 mx-auto" />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" style={{ width: `${80 + Math.random() * 20}%` }} />
          ))}
        </div>
      );
    }

    if (!cloudContent) {
      return (
        <div className="text-center py-12 space-y-4">
          <Database className="h-12 w-12 text-[#D4AF37] mx-auto opacity-60" />
          <p className="text-[#0B1F5B]/70 text-sm">לא נמצא תוכן עבור דף זה בענן</p>
          <p className="text-[#0B1F5B]/40 text-xs">הורד את הדף דרך ניווט הסדרים כדי לשמור אותו</p>
        </div>
      );
    }

    const cloudHtml = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
      body { font-family: 'David', 'Times New Roman', serif; font-size: 18px; line-height: ${cloudLineHeight}; color: #0B1F5B; padding: 24px; margin: 0; background: #fff; direction: rtl; }
      p, div { margin-bottom: ${cloudParagraphSpacing}px; }
      ::selection { background: #D4AF3744; }
    </style></head><body>${cloudContent}</body></html>`;

    return (
      <div className="space-y-0">
        {/* ═══ CLOUD EDITOR TOOLBAR ═══ */}
        <div className="border-2 border-b-0 border-[#D4AF37]/30 rounded-t-xl bg-white px-2 py-1.5 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-[#D4AF37] font-bold ml-2">📀 גמרא מהענן</span>
          <div className="w-px h-5 bg-[#D4AF37]/20" />

          {/* Edit Mode Toggle */}
          <Button size="sm" variant={cloudEditMode ? "default" : "outline"} className={`h-7 text-xs gap-1 ${cloudEditMode ? "bg-[#D4AF37] text-[#0B1F5B]" : "border-[#D4AF37]/40 text-[#0B1F5B]"}`} onClick={() => {
            const next = !cloudEditMode;
            setCloudEditMode(next);
            const doc = cloudIframeRef.current?.contentDocument;
            if (doc?.body) doc.designMode = next ? "on" : "off";
          }}>
            <Scissors className="h-3 w-3" />
            {cloudEditMode ? "מצב עריכה פעיל" : "ערוך"}
          </Button>

          {cloudEditMode && (
            <>
              <div className="w-px h-5 bg-[#D4AF37]/20" />
              {/* Font Size */}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("fontSize", false, "2")} title="הקטנה"><AArrowDown className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("fontSize", false, "5")} title="הגדלה"><AArrowUp className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

              <div className="w-px h-5 bg-[#D4AF37]/20" />
              {/* Text Formatting */}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("bold")} title="הדגשה"><Bold className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("italic")} title="נטוי"><Italic className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("underline")} title="קו תחתון"><Underline className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("strikeThrough")} title="קו חוצה"><Strikethrough className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

              <div className="w-px h-5 bg-[#D4AF37]/20" />
              {/* Alignment */}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("justifyRight")} title="ימין"><AlignRight className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("justifyCenter")} title="מרכז"><AlignCenter className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("justifyLeft")} title="שמאל"><AlignLeft className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("justifyFull")} title="מלא"><AlignJustify className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

              <div className="w-px h-5 bg-[#D4AF37]/20" />
              {/* Highlight Colors */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="סימון בצבע"><Highlighter className="h-3.5 w-3.5 text-[#D4AF37]" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex gap-1.5">
                    {CLOUD_HIGHLIGHT_COLORS.map(c => (
                      <button key={c.value} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: c.value }} onClick={() => {
                        cloudIframeRef.current?.contentDocument?.execCommand("hiliteColor", false, c.value);
                      }} />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {/* Font Color */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="צבע טקסט"><Palette className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex gap-1.5">
                    {["#0B1F5B", "#000000", "#b91c1c", "#15803d", "#7e22ce", "#b45309", "#D4AF37"].map(color => (
                      <button key={color} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" style={{ backgroundColor: color }} onClick={() => {
                        cloudIframeRef.current?.contentDocument?.execCommand("foreColor", false, color);
                      }} />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="w-px h-5 bg-[#D4AF37]/20" />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cloudIframeRef.current?.contentDocument?.execCommand("removeFormat")} title="הסר עיצוב"><RotateCcw className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
            </>
          )}

          <div className="w-px h-5 bg-[#D4AF37]/20" />
          {/* Copy / Print */}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCloudCopy} title="העתק"><Copy className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCloudPrint} title="הדפסה"><Printer className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>

          {/* Download */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="הורד"><FileDown className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5" align="start" dir="rtl">
              <button className="w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2" onClick={() => handleCloudDownload("html")}>📄 HTML</button>
              <button className="w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2" onClick={() => handleCloudDownload("txt")}>📝 טקסט (TXT)</button>
            </PopoverContent>
          </Popover>

          {/* Line Spacing */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="מרווח שורות"><MoveVertical className="h-3.5 w-3.5 text-[#0B1F5B]" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start" dir="rtl">
              <p className="text-xs font-semibold text-[#0B1F5B] mb-2">מרווח שורות</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#0B1F5B]/60">גובה שורה ({cloudLineHeight})</label>
                  <input type="range" min="1" max="3" step="0.1" value={cloudLineHeight} className="w-full accent-[#D4AF37]" onChange={e => {
                    const v = parseFloat(e.target.value);
                    setCloudLineHeight(v);
                    const doc = cloudIframeRef.current?.contentDocument;
                    if (doc?.body) doc.body.style.lineHeight = String(v);
                  }} />
                </div>
                <div>
                  <label className="text-[10px] text-[#0B1F5B]/60">רווח בין פסקאות ({cloudParagraphSpacing}px)</label>
                  <input type="range" min="0" max="40" step="2" value={cloudParagraphSpacing} className="w-full accent-[#D4AF37]" onChange={e => {
                    const v = parseInt(e.target.value);
                    setCloudParagraphSpacing(v);
                    const doc = cloudIframeRef.current?.contentDocument;
                    if (doc) {
                      const paras = doc.querySelectorAll('p, div');
                      paras.forEach(p => (p as HTMLElement).style.marginBottom = v + 'px');
                    }
                  }} />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Cloud Pages Selector */}
          {cloudPages.length > 0 && (
            <>
              <div className="w-px h-5 bg-[#D4AF37]/20" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#D4AF37]/40 text-[#0B1F5B]">
                    <Database className="h-3 w-3 text-[#D4AF37]" />
                    דפים ({cloudPages.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-1.5 max-h-72 overflow-y-auto" align="start" dir="rtl">
                  <p className="text-[10px] font-semibold text-[#0B1F5B]/70 px-2 py-1">דפים שהורדו</p>
                  {cloudPages.map(p => (
                    <button key={p.sugya_id} onClick={() => loadCloudContent(p.sugya_id)} className={`w-full text-right text-xs px-2 py-1.5 rounded hover:bg-[#D4AF37]/10 flex items-center gap-2 ${p.sugya_id === sugyaId ? 'bg-[#D4AF37]/15 font-semibold' : ''}`}>
                      <BookOpen className="h-3 w-3 text-[#D4AF37] shrink-0" />
                      <span className="truncate">{p.title || p.daf_yomi}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* ═══ CLOUD CONTENT AREA ═══ */}
        <div className="border-2 border-[#D4AF37]/30 rounded-b-xl bg-white overflow-hidden shadow-lg" style={{ minHeight: '500px' }}>
          <iframe
            ref={cloudIframeRef}
            srcDoc={cloudHtml}
            className="w-full border-0"
            style={{ height: '600px' }}
            title="תצוגת גמרא מהענן"
          />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading && viewMode === 'text') {
      return (
        <div className="space-y-4 py-6">
          <Skeleton className="h-6 w-48 mx-auto" />
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" style={{ width: `${85 + Math.random() * 15}%` }} />
            ))}
          </div>
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
      case 'cloud':
        return renderCloudView();
      case 'text':
      default:
        return gemaraText ? (
          <div className="space-y-0">
            {renderTextToolbar()}
            <div className="prose prose-slate max-w-none dark:prose-invert bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-b-lg border border-t-0 border-border">
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
