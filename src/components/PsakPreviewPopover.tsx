import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PsakPreviewPopoverProps {
  psakDinId: string;
  psakTitle?: string;
  mode: "summary" | "facts";
}

/** Extract case facts from full_text or beautified HTML */
function extractFacts(text: string): string {
  // Try to find "עובדות המקרה" section in HTML or plain text
  const patterns = [
    /עובדות\s*המקרה[:\s]*\n?([\s\S]*?)(?=<h[23]|<\/section|טענות|ניתוח|פסיקה|החלטה|סיכום|$)/i,
    /עובדות[:\s]*\n?([\s\S]*?)(?=טענות|ניתוח|פסיקה|החלטה|סיכום|$)/i,
  ];

  // Strip HTML tags for extraction
  const plainText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  for (const pattern of patterns) {
    const match = plainText.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  // If we found numbered items that look like facts
  const numberedMatch = plainText.match(/1\.\s+.+(?:\n|$)(?:2\.\s+.+(?:\n|$))+/);
  if (numberedMatch) {
    return numberedMatch[0].trim();
  }

  return "";
}

export default function PsakPreviewPopover({ psakDinId, psakTitle, mode }: PsakPreviewPopoverProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadContent = useCallback(async () => {
    if (content !== null) return; // Already loaded
    setLoading(true);
    try {
      const { data } = await supabase
        .from("psakei_din")
        .select("summary, full_text")
        .eq("id", psakDinId)
        .maybeSingle();

      if (!data) {
        setContent("לא נמצא מידע");
        return;
      }

      if (mode === "summary") {
        setContent(data.summary || "אין תקציר זמין");
      } else {
        const facts = data.full_text ? extractFacts(data.full_text) : "";
        setContent(facts || "לא נמצאו עובדות המקרה במסמך זה");
      }
    } catch {
      setContent("שגיאה בטעינת המידע");
    } finally {
      setLoading(false);
    }
  }, [psakDinId, mode, content]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) loadContent();
  };

  const icon = mode === "summary" ? (
    <FileText className="w-3.5 h-3.5" />
  ) : (
    <Scale className="w-3.5 h-3.5" />
  );

  const title = mode === "summary" ? "תקציר" : "עובדות המקרה";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-primary hover:bg-primary/10"
          title={title}
          onClick={(e) => e.stopPropagation()}
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[400px] max-w-[90vw] p-0"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-sm">{title}</span>
          </div>
          {psakTitle && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{psakTitle}</p>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              content
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
