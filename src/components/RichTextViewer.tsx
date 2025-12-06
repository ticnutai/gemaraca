import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bold, Italic, Type, Highlighter, Trash2, X } from "lucide-react";

interface TextAnnotation {
  id: string;
  start_offset: number;
  end_offset: number;
  original_text: string;
  styles: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    isBold?: boolean;
    isItalic?: boolean;
  };
}

interface RichTextViewerProps {
  text: string;
  sourceType: 'gemara' | 'modern_examples' | 'commentary';
  sourceId: string;
  className?: string;
  baseStyle?: React.CSSProperties;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32];
const FONTS = [
  { value: 'inherit', label: 'ברירת מחדל' },
  { value: '"David Libre", "David", serif', label: 'דוד' },
  { value: '"Frank Ruhl Libre", "Frank Ruehl", serif', label: 'פרנק רוהל' },
  { value: '"Heebo", sans-serif', label: 'חיבו' },
  { value: '"Assistant", sans-serif', label: 'אסיסטנט' },
  { value: '"Secular One", sans-serif', label: 'סקולר' },
  { value: '"Rubik", sans-serif', label: 'רוביק' },
  { value: '"Noto Serif Hebrew", serif', label: 'נוטו סריף' },
  { value: '"Arial", sans-serif', label: 'אריאל' },
  { value: '"Times New Roman", serif', label: 'טיימס' },
  { value: 'monospace', label: 'קוריאר' },
];
const COLORS = [
  { value: 'inherit', label: 'ברירת מחדל' },
  { value: '#1e40af', label: 'כחול' },
  { value: '#dc2626', label: 'אדום' },
  { value: '#16a34a', label: 'ירוק' },
  { value: '#9333ea', label: 'סגול' },
  { value: '#ea580c', label: 'כתום' },
];
const BG_COLORS = [
  { value: 'transparent', label: 'ללא', color: 'transparent' },
  { value: '#fef08a', label: 'צהוב', color: '#fef08a' },
  { value: '#bbf7d0', label: 'ירוק', color: '#bbf7d0' },
  { value: '#bfdbfe', label: 'כחול', color: '#bfdbfe' },
  { value: '#fbcfe8', label: 'ורוד', color: '#fbcfe8' },
  { value: '#fed7aa', label: 'כתום', color: '#fed7aa' },
];

export const RichTextViewer = ({
  text,
  sourceType,
  sourceId,
  className = "",
  baseStyle = {},
}: RichTextViewerProps) => {
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selection, setSelection] = useState<{
    text: string;
    start: number;
    end: number;
    rect: DOMRect | null;
  } | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [currentStyles, setCurrentStyles] = useState<TextAnnotation['styles']>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Load annotations from database
  useEffect(() => {
    loadAnnotations();
  }, [sourceType, sourceId]);

  const loadAnnotations = async () => {
    try {
      const { data, error } = await supabase
        .from('text_annotations')
        .select('*')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId);

      if (error) throw error;
      
      setAnnotations((data || []).map(a => ({
        id: a.id,
        start_offset: a.start_offset,
        end_offset: a.end_offset,
        original_text: a.original_text,
        styles: a.styles as TextAnnotation['styles']
      })));
    } catch (err) {
      console.error("Error loading annotations:", err);
    }
  };

  const handleTextSelection = useCallback(() => {
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.isCollapsed || !containerRef.current) {
      return;
    }

    const selectedText = selectionObj.toString().trim();
    if (!selectedText) return;

    // Get selection range relative to container
    const range = selectionObj.getRangeAt(0);
    const containerText = containerRef.current.textContent || '';
    
    // Calculate offsets
    const preSelectionRange = document.createRange();
    preSelectionRange.selectNodeContents(containerRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preSelectionRange.toString().length;
    const endOffset = startOffset + selectedText.length;

    // Check if selection is within our text
    if (startOffset >= 0 && endOffset <= containerText.length) {
      const rect = range.getBoundingClientRect();
      setSelection({
        text: selectedText,
        start: startOffset,
        end: endOffset,
        rect
      });
      
      // Check if there's an existing annotation for this range
      const existingAnnotation = annotations.find(
        a => a.start_offset === startOffset && a.end_offset === endOffset
      );
      if (existingAnnotation) {
        setCurrentStyles(existingAnnotation.styles);
      } else {
        setCurrentStyles({});
      }
      
      setToolbarOpen(true);
    }
  }, [annotations]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleTextSelection);
    return () => {
      container.removeEventListener('mouseup', handleTextSelection);
    };
  }, [handleTextSelection]);

  const saveAnnotation = async (styles: TextAnnotation['styles']) => {
    if (!selection) return;

    try {
      const { data, error } = await supabase
        .from('text_annotations')
        .upsert({
          source_type: sourceType,
          source_id: sourceId,
          start_offset: selection.start,
          end_offset: selection.end,
          original_text: selection.text,
          styles
        }, { onConflict: 'source_type,source_id,start_offset,end_offset' })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAnnotations(prev => {
        const existing = prev.findIndex(
          a => a.start_offset === selection.start && a.end_offset === selection.end
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            styles
          };
          return updated;
        }
        return [...prev, {
          id: data.id,
          start_offset: selection.start,
          end_offset: selection.end,
          original_text: selection.text,
          styles
        }];
      });

      setCurrentStyles(styles);
      toast.success("העיצוב נשמר");
    } catch (err) {
      console.error("Error saving annotation:", err);
      toast.error("שגיאה בשמירת העיצוב");
    }
  };

  const deleteAnnotation = async () => {
    if (!selection) return;

    try {
      const { error } = await supabase
        .from('text_annotations')
        .delete()
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .eq('start_offset', selection.start)
        .eq('end_offset', selection.end);

      if (error) throw error;

      setAnnotations(prev => prev.filter(
        a => !(a.start_offset === selection.start && a.end_offset === selection.end)
      ));
      
      setCurrentStyles({});
      setToolbarOpen(false);
      toast.success("העיצוב הוסר");
    } catch (err) {
      console.error("Error deleting annotation:", err);
      toast.error("שגיאה בהסרת העיצוב");
    }
  };

  const updateStyle = (key: keyof TextAnnotation['styles'], value: any) => {
    const newStyles = { ...currentStyles, [key]: value };
    setCurrentStyles(newStyles);
    saveAnnotation(newStyles);
  };

  // Render text with annotations
  const renderAnnotatedText = () => {
    if (!text || annotations.length === 0) {
      return <span>{text}</span>;
    }

    // Sort annotations by start offset
    const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset);
    
    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((annotation, index) => {
      // Add text before this annotation
      if (annotation.start_offset > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>
            {text.slice(lastEnd, annotation.start_offset)}
          </span>
        );
      }

      // Add annotated text
      const style: React.CSSProperties = {};
      if (annotation.styles.fontSize) style.fontSize = `${annotation.styles.fontSize}px`;
      if (annotation.styles.fontFamily) style.fontFamily = annotation.styles.fontFamily;
      if (annotation.styles.color) style.color = annotation.styles.color;
      if (annotation.styles.backgroundColor) style.backgroundColor = annotation.styles.backgroundColor;
      if (annotation.styles.isBold) style.fontWeight = 'bold';
      if (annotation.styles.isItalic) style.fontStyle = 'italic';

      parts.push(
        <span
          key={`annotation-${index}`}
          style={style}
          className="transition-all"
          title="לחץ לעריכה"
        >
          {text.slice(annotation.start_offset, annotation.end_offset)}
        </span>
      );

      lastEnd = annotation.end_offset;
    });

    // Add remaining text
    if (lastEnd < text.length) {
      parts.push(
        <span key="text-end">{text.slice(lastEnd)}</span>
      );
    }

    return <>{parts}</>;
  };

  const toolbarPosition = selection?.rect ? {
    top: selection.rect.bottom + window.scrollY + 8,
    left: Math.max(8, Math.min(selection.rect.left + window.scrollX, window.innerWidth - 320))
  } : { top: 0, left: 0 };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`select-text cursor-text ${className}`}
        style={baseStyle}
        dir="rtl"
      >
        {renderAnnotatedText()}
      </div>

      {/* Floating Toolbar */}
      {toolbarOpen && selection && (
        <div
          className="fixed z-50 bg-background border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 max-w-xs"
          style={{
            top: toolbarPosition.top,
            left: toolbarPosition.left
          }}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 absolute -top-2 -right-2"
            onClick={() => setToolbarOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>

          {/* Selected text preview */}
          <div className="w-full text-xs text-muted-foreground mb-1 truncate pr-4">
            "{selection.text.slice(0, 30)}{selection.text.length > 30 ? '...' : ''}"
          </div>

          {/* Bold */}
          <Button
            variant={currentStyles.isBold ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateStyle('isBold', !currentStyles.isBold)}
            title="הדגשה"
          >
            <Bold className="h-4 w-4" />
          </Button>

          {/* Italic */}
          <Button
            variant={currentStyles.isItalic ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => updateStyle('isItalic', !currentStyles.isItalic)}
            title="נטוי"
          >
            <Italic className="h-4 w-4" />
          </Button>

          {/* Font Size */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="גודל גופן">
                <Type className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="start">
              <div className="grid grid-cols-3 gap-1">
                {FONT_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => updateStyle('fontSize', size)}
                    className={`p-1 text-xs rounded hover:bg-muted ${currentStyles.fontSize === size ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Font Family */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="סוג גופן">
                גופן
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="start">
              {FONTS.map(font => (
                <button
                  key={font.value}
                  onClick={() => updateStyle('fontFamily', font.value)}
                  className={`w-full p-1 text-xs text-right rounded hover:bg-muted ${currentStyles.fontFamily === font.value ? 'bg-primary text-primary-foreground' : ''}`}
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Text Color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="צבע טקסט">
                <span style={{ color: currentStyles.color || 'inherit' }}>A</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="start">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => updateStyle('color', color.value)}
                  className={`w-full p-1 text-xs text-right rounded hover:bg-muted flex items-center gap-2 ${currentStyles.color === color.value ? 'bg-muted' : ''}`}
                >
                  <span
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: color.value === 'inherit' ? 'currentColor' : color.value }}
                  />
                  {color.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Background Color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="צבע רקע">
                <Highlighter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-2" align="start">
              <div className="grid grid-cols-3 gap-1">
                {BG_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => updateStyle('backgroundColor', color.value)}
                    className={`h-7 rounded border ${currentStyles.backgroundColor === color.value ? 'ring-2 ring-primary' : ''}`}
                    style={{ backgroundColor: color.color }}
                    title={color.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Delete annotation */}
          {annotations.some(a => a.start_offset === selection.start && a.end_offset === selection.end) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={deleteAnnotation}
              title="הסר עיצוב"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};