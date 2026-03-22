import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FileText, Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PsakPreviewPopoverProps {
  psakDinId: string;
  psakTitle?: string;
  mode: "summary" | "facts";
}

/**
 * Fallback: extract case facts from raw text when psak_sections is empty.
 * Based on analysis of 2,165 psakei din from psakim.org:
 * Most common fact section headers (with optional א./ב./1. prefix):
 *   רקע, העובדות, תיאור המקרה, עובדות מוסכמות, עובדות וטענות,
 *   רקע עובדתי, תמצית העובדות, מבוא, הקדמה, מצב עובדתי,
 *   פרטי המקרה, נושא הדיון/התביעה, רקע כללי, התשתית העובדתית
 * Facts section is almost always in the top 40% of the document.
 */
function extractFactsFallback(text: string): string {
  // Strip HTML (including <style> blocks) and normalize
  const plainText = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Only search top 40% of document — facts are always near the beginning
  const searchText = plainText.substring(0, Math.floor(plainText.length * 0.4));

  // Optional section numbering: א. ב) 1. 2) etc.
  const numPfx = "(?:(?:[א-ת][.):]\\ ?|\\d+[.):]\\ ?)\\s*)?";

  // All fact/background section header keywords discovered from corpus
  const factHeaders = [
    "תמצית\\s*(?:ה)?עובדות(?:\\s*(?:ה)?מוסכמות)?",
    "עובדות\\s*(?:מוסכמות(?:\\s*בקצרה)?|המקרה|התיק|הרקע|וטענות|ורקע|הצריכות(?:\\s*לענייננו)?|בקצרה)?",
    "(?:ה)?עובדות(?:\\s*(?:המוסכמות|הצריכות\\s*לענייננו))?",
    "תיאור\\s*(?:המקרה(?:\\s*והעובדות)?|העובדות|עובדתי|התביעה)",
    "רקע\\s*(?:עובדתי|מוסכם|כללי)?",
    "מצב\\s*עובדתי",
    "פרטי\\s*המקרה",
    "המקרה\\s*העובדתי",
    "התשתית\\s*העובדתית",
    "נושא\\s*(?:המקרה|התביעה|הדיון)",
  ].join("|");

  // Terminator: next section headers that end the facts section
  const terminators = [
    "טענות", "ניתוח", "דיון", "פסיקה", "החלטה",
    "סיכום", "נימוק", "הכרע", "פסק\\s*(?:ה)?דין",
    "תשובה", "הלכה", "מסקנ", "שאלה",
  ].join("|");

  // Primary: match section header → content → next section
  const primary = new RegExp(
    numPfx + "(?:" + factHeaders + ")" +
    "[:\\s.\\-–]*" +
    "((?:.|\\n)*?)" +
    "(?=" + numPfx + "(?:" + terminators + ")|$)", "i"
  );

  const match = searchText.match(primary);
  const captured = match?.[1]?.trim();
  if (captured && captured.length > 20) {
    return captured.length > 2000 ? captured.slice(0, 2000) + "..." : captured;
  }

  // Secondary: תקציר / מבוא / הקדמה as summary-like sections
  const secondary = new RegExp(
    numPfx + "(?:תקציר|מבוא|הקדמה|פתח\\s*דבר)" +
    "[:\\s.\\-–]*" +
    "((?:.|\\n)*?)" +
    "(?=" + numPfx + "(?:" + terminators + "|" + factHeaders + ")|$)", "i"
  );

  const match2 = searchText.match(secondary);
  const captured2 = match2?.[1]?.trim();
  if (captured2 && captured2.length > 20) {
    return captured2.length > 2000 ? captured2.slice(0, 2000) + "..." : captured2;
  }

  return "";
}

/** Try to extract any meaningful summary from raw text */
function extractSummaryFallback(text: string): string {
  const facts = extractFactsFallback(text);
  if (facts) return facts;

  // Fallback: first meaningful paragraphs (> 40 chars)
  const plainText = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plainText.split(/[.\n]/).filter(s => s.trim().length > 40);
  if (sentences.length > 0) {
    const result = sentences.slice(0, 5).join(". ").trim();
    return result.length > 2000 ? result.slice(0, 2000) + "..." : result;
  }
  return "";
}

export default function PsakPreviewPopover({ psakDinId, psakTitle, mode }: PsakPreviewPopoverProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadContent = useCallback(async () => {
    if (content !== null) return;
    setLoading(true);
    try {
      if (mode === "summary") {
        const { data } = await supabase
          .from("psakei_din")
          .select("case_summary, summary, full_text, title, source_url")
          .eq("id", psakDinId)
          .maybeSingle();

        if (!data) { setContent("לא נמצא מידע"); return; }

        const cs = data.case_summary;
        const s = data.summary;
        if (cs && cs.length > 10) {
          setContent(cs);
        } else if (s && s.length > 30 && !s.startsWith('פסק דין שהועלה מהקובץ') && s !== data.title) {
          setContent(s);
        } else {
          // Try full_text, if empty try fetching from source_url
          let text = data.full_text;
          if (!text && data.source_url) {
            try {
              const resp = await fetch(data.source_url);
              if (resp.ok) text = await resp.text();
            } catch { /* ignore fetch errors */ }
          }
          if (text) {
            const extracted = extractSummaryFallback(text);
            setContent(extracted || "אין תקציר זמין. הפעל את מנוע הניתוח בלשונית אינדקס מתקדם.");
          } else {
            setContent("אין תקציר זמין");
          }
        }
      } else {
        // facts mode: try psak_sections first
        const { data: sections } = await supabase
          .from("psak_sections")
          .select("section_type, section_title, section_content")
          .eq("psak_din_id", psakDinId)
          .in("section_type", ["facts", "summary"])
          .order("section_order", { ascending: true })
          .limit(2);

        if (sections && sections.length > 0) {
          const facts = sections.find(s => s.section_type === 'facts') || sections[0];
          setContent(facts.section_content);
          return;
        }

        // Fallback: extract from full_text or source_url
        const { data: psak } = await supabase
          .from("psakei_din")
          .select("full_text, source_url")
          .eq("id", psakDinId)
          .maybeSingle();

        let text = psak?.full_text;
        if (!text && psak?.source_url) {
          try {
            const resp = await fetch(psak.source_url);
            if (resp.ok) text = await resp.text();
          } catch { /* ignore fetch errors */ }
        }

        const result = text ? extractFactsFallback(text) : "";
        setContent(result || "לא נמצאו עובדות המקרה. הפעל את מנוע הניתוח בלשונית אינדקס מתקדם.");
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
        className="w-[400px] max-w-[90vw] max-h-[400px] p-0 flex flex-col"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-sm">{title}</span>
          </div>
          {psakTitle && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{psakTitle}</p>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              content
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
