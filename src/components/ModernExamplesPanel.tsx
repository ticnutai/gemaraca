import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Loader2, RefreshCw, Lightbulb, Scale, BookOpen, Database, Type, AArrowUp, AArrowDown, AlignRight, AlignCenter, AlignLeft, Bold, Highlighter, Check, Settings2, MousePointer2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RichTextViewer } from "./RichTextViewer";

const FONTS = [
  { value: 'font-serif', label: 'דוד (סריף)' },
  { value: 'font-sans', label: 'אריאל (ללא סריף)' },
  { value: 'font-mono', label: 'קוריאר (מונו)' },
  { value: 'font-david', label: 'דוד' },
  { value: 'font-frank', label: 'פרנק רוהל' },
  { value: 'font-heebo', label: 'חיבו' },
  { value: 'font-rubik', label: 'רוביק' },
];

const HIGHLIGHT_COLORS = [
  { value: 'bg-transparent', label: 'ללא', color: 'transparent' },
  { value: 'bg-yellow-200/60', label: 'צהוב', color: '#fef08a' },
  { value: 'bg-green-200/60', label: 'ירוק', color: '#bbf7d0' },
  { value: 'bg-blue-200/60', label: 'כחול', color: '#bfdbfe' },
  { value: 'bg-pink-200/60', label: 'ורוד', color: '#fbcfe8' },
  { value: 'bg-orange-200/60', label: 'כתום', color: '#fed7aa' },
];

const EXAMPLES_TEXT_SETTINGS_KEY = 'examples-text-settings';

interface TextSettings {
  fontSize: number;
  fontFamily: string;
  textAlign: 'right' | 'center' | 'left';
  isBold: boolean;
  highlightColor: string;
}

const defaultTextSettings: TextSettings = {
  fontSize: 14,
  fontFamily: 'font-sans',
  textAlign: 'right',
  isBold: false,
  highlightColor: 'bg-transparent',
};

interface Example {
  title: string;
  scenario: string;
  connection: string;
  icon: string;
}

interface ModernExamplesData {
  principle: string;
  examples: Example[];
  practicalSummary: string;
  cached?: boolean;
}

interface AdditionalExamplesData {
  examples: Example[];
}

interface ModernExamplesPanelProps {
  gemaraText?: string;
  sugyaTitle: string;
  dafYomi: string;
  masechet: string;
  sugyaId?: string;
}

export const ModernExamplesPanel = ({
  gemaraText,
  sugyaTitle,
  dafYomi,
  masechet,
  sugyaId,
}: ModernExamplesPanelProps) => {
  const [data, setData] = useState<ModernExamplesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [textSettings, setTextSettings] = useState<TextSettings>(() => {
    const saved = localStorage.getItem(EXAMPLES_TEXT_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : defaultTextSettings;
  });

  const effectiveSugyaId = sugyaId || `${masechet}-${dafYomi}`.replace(/\s+/g, '-');

  useEffect(() => {
    localStorage.setItem(EXAMPLES_TEXT_SETTINGS_KEY, JSON.stringify(textSettings));
  }, [textSettings]);

  const updateTextSetting = <K extends keyof TextSettings>(key: K, value: TextSettings[K]) => {
    setTextSettings(prev => ({ ...prev, [key]: value }));
  };

  // Check for cached data on mount
  useEffect(() => {
    checkCachedExamples();
  }, [effectiveSugyaId]);

  const checkCachedExamples = async () => {
    try {
      const { data: cached, error } = await supabase
        .from('modern_examples')
        .select('*')
        .eq('sugya_id', effectiveSugyaId)
        .maybeSingle();

      if (cached && !error) {
        setData({
          principle: cached.principle,
          examples: cached.examples as unknown as Example[],
          practicalSummary: cached.practical_summary,
          cached: true
        });
        setIsCached(true);
      }
    } catch (err) {
      console.error("Error checking cached examples:", err);
    }
  };

  const generateExamples = async (forceRegenerate = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "generate-modern-examples",
        {
          body: {
            gemaraText,
            sugyaTitle,
            dafYomi,
            masechet,
            sugyaId: effectiveSugyaId,
            forceRegenerate,
          },
        }
      );

      if (fnError) throw fnError;
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      setIsCached(result.cached || false);
      
      if (result.cached) {
        toast.success("נטען מהמטמון");
      } else {
        toast.success("ההמחשות נוצרו ונשמרו");
      }
    } catch (err) {
      console.error("Error generating examples:", err);
      setError(err instanceof Error ? err.message : "שגיאה ביצירת ההמחשות");
      toast.error("שגיאה ביצירת ההמחשות");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreExamples = async () => {
    if (!data) return;
    setIsLoadingMore(true);
    
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "generate-modern-examples",
        {
          body: {
            gemaraText,
            sugyaTitle,
            dafYomi,
            masechet,
            sugyaId: effectiveSugyaId,
            loadMore: true,
            existingCount: data.examples.length,
          },
        }
      );

      if (fnError) throw fnError;
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Append new examples to existing ones
      const newExamples = result.examples || [];
      const updatedData = {
        ...data,
        examples: [...data.examples, ...newExamples]
      };
      
      setData(updatedData);
      
      // Update in database
      await supabase
        .from('modern_examples')
        .update({ examples: updatedData.examples })
        .eq('sugya_id', effectiveSugyaId);
      
      toast.success(`נוספו ${newExamples.length} דוגמאות חדשות`);
    } catch (err) {
      console.error("Error loading more examples:", err);
      toast.error("שגיאה בטעינת דוגמאות נוספות");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getTextAlignClass = () => {
    switch (textSettings.textAlign) {
      case 'center': return 'text-center';
      case 'left': return 'text-left';
      default: return 'text-right';
    }
  };

  const textClasses = `${textSettings.fontFamily} ${getTextAlignClass()} ${textSettings.isBold ? 'font-bold' : ''} ${textSettings.highlightColor}`;

  const renderTextToolbar = () => (
    <div className="flex items-center gap-1 flex-wrap p-2 bg-muted/50 rounded-lg border mb-4">
      {/* Font Size Controls */}
      <div className="flex items-center gap-1 border-l pl-2 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('fontSize', Math.max(10, textSettings.fontSize - 1))}
          title="הקטן גופן"
        >
          <AArrowDown className="h-3 w-3" />
        </Button>
        <span className="text-xs text-muted-foreground w-6 text-center">{textSettings.fontSize}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('fontSize', Math.min(24, textSettings.fontSize + 1))}
          title="הגדל גופן"
        >
          <AArrowUp className="h-3 w-3" />
        </Button>
      </div>

      {/* Font Family */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="שנה גופן">
            <Type className="h-3 w-3" />
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
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'right')}
          title="יישור לימין"
        >
          <AlignRight className="h-3 w-3" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'center' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'center')}
          title="יישור למרכז"
        >
          <AlignCenter className="h-3 w-3" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'left' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'left')}
          title="יישור לשמאל"
        >
          <AlignLeft className="h-3 w-3" />
        </Button>
      </div>

      {/* Bold */}
      <Button
        variant={textSettings.isBold ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={() => updateTextSetting('isBold', !textSettings.isBold)}
        title="הדגשה"
      >
        <Bold className="h-3 w-3" />
      </Button>

      {/* Highlight Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="סימון בצבע">
            <Highlighter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="grid grid-cols-3 gap-1">
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => updateTextSetting('highlightColor', color.value)}
                className={`h-7 rounded border ${textSettings.highlightColor === color.value ? 'ring-2 ring-primary' : ''}`}
                style={{ backgroundColor: color.color }}
                title={color.label}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  if (!data && !isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-2" />
            <h3 className="text-lg font-bold text-foreground">המחשות מודרניות</h3>
            <p className="text-sm text-muted-foreground mt-1">
              קבל דוגמאות עכשוויות שממחישות את היסודות ההלכתיים מהסוגיה
            </p>
          </div>
          <Button 
            onClick={() => generateExamples(false)} 
            className="gap-2"
            disabled={isLoading}
          >
            <Sparkles className="h-4 w-4" />
            צור המחשות מודרניות
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">יוצר המחשות מודרניות...</p>
          <p className="text-xs text-muted-foreground mt-1">זה עשוי לקחת מספר שניות</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-3">{error}</p>
          <Button onClick={() => generateExamples(false)} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar Toggle & Cached indicator */}
      <div className="flex items-center justify-between">
        {isCached && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3 w-3" />
            <span>נטען מהמטמון</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowToolbar(!showToolbar)}
          className="gap-1 text-xs mr-auto"
        >
          <Settings2 className="h-3 w-3" />
          עיצוב טקסט
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MousePointer2 className="h-3 w-3" />
          <span>סמן מילים לעיצוב</span>
        </div>
      </div>

      {showToolbar && renderTextToolbar()}

      {/* Principle Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            היסוד ההלכתי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextViewer
            text={data?.principle || ''}
            sourceType="modern_examples"
            sourceId={`${effectiveSugyaId}-principle`}
            className={`text-foreground font-medium ${textClasses}`}
            baseStyle={{ fontSize: `${textSettings.fontSize}px` }}
          />
        </CardContent>
      </Card>

      {/* Modern Examples */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              דוגמאות מודרניות ({data?.examples.length || 0})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => generateExamples(true)}
              disabled={isLoading}
              className="gap-1 text-xs"
              title="צור המחשות חדשות"
            >
              <RefreshCw className="h-3 w-3" />
              חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
          {data?.examples.map((example, index) => (
            <div 
              key={index} 
              className={`p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2 ${textSettings.highlightColor}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl">{example.icon}</span>
                <div className="flex-1">
                  <h4 
                    className={`font-bold text-foreground ${textSettings.fontFamily} ${getTextAlignClass()}`}
                    style={{ fontSize: `${textSettings.fontSize + 2}px` }}
                  >
                    <RichTextViewer
                      text={example.title}
                      sourceType="modern_examples"
                      sourceId={`${effectiveSugyaId}-example-${index}-title`}
                      className={`font-bold text-foreground ${textSettings.fontFamily} ${getTextAlignClass()}`}
                      baseStyle={{ fontSize: `${textSettings.fontSize + 2}px` }}
                    />
                  </h4>
                  <div className="mt-1">
                    <RichTextViewer
                      text={example.scenario}
                      sourceType="modern_examples"
                      sourceId={`${effectiveSugyaId}-example-${index}-scenario`}
                      className={`text-muted-foreground ${textClasses}`}
                      baseStyle={{ fontSize: `${textSettings.fontSize}px` }}
                    />
                  </div>
                </div>
              </div>
              <div className="pr-10 pt-2 border-t border-border/30">
                <div className="flex items-start gap-1">
                  <span>🔗</span>
                  <RichTextViewer
                    text={`קשר לגמרא: ${example.connection}`}
                    sourceType="modern_examples"
                    sourceId={`${effectiveSugyaId}-example-${index}-connection`}
                    className={`text-primary ${textClasses}`}
                    baseStyle={{ fontSize: `${textSettings.fontSize - 1}px` }}
                  />
                </div>
              </div>
            </div>
          ))}
          
          {/* Load More Button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreExamples}
              disabled={isLoadingMore}
              className="gap-2"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  דוגמאות נוספות
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Practical Summary */}
      <Card className="border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            הלכה למעשה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextViewer
            text={data?.practicalSummary || ''}
            sourceType="modern_examples"
            sourceId={`${effectiveSugyaId}-summary`}
            className={`text-foreground ${textClasses}`}
            baseStyle={{ fontSize: `${textSettings.fontSize}px` }}
          />
        </CardContent>
      </Card>
    </div>
  );
};