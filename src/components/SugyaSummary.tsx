import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, BookOpen, RefreshCw, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SugyaSummaryProps {
  sugyaId: string;
  masechet?: string;
  daf?: string;
  title?: string;
  textHe?: string;
  textEn?: string;
}

export default function SugyaSummary({ sugyaId, masechet, daf, title, textHe, textEn }: SugyaSummaryProps) {
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const generateSummary = useCallback(async () => {
    if (!textHe && !textEn) {
      toast.error("אין טקסט לסיכום. טען את הדף קודם.");
      return;
    }
    setIsLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/summarize-sugya`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ title, masechet, daf, textHe, textEn }),
      });

      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setSummary(data.summary);
      toast.success("הסיכום נוצר בהצלחה!");
    } catch (err) {
      toast.error("שגיאה ביצירת סיכום");
    } finally {
      setIsLoading(false);
    }
  }, [textHe, textEn, masechet, daf, title]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    toast.success("הסיכום הועתק!");
  };

  if (!summary && !isLoading) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="p-4 flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground text-center">
            סיכום AI אוטומטי של הסוגיה עם נקודות מפתח, מחלוקות ומסקנות
          </p>
          <Button onClick={generateSummary} disabled={isLoading} className="gap-2">
            <Sparkles className="h-4 w-4" />
            סכם סוגיה
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <BookOpen className="h-4 w-4" />
            סיכום הסוגיה
          </CardTitle>
          <div className="flex items-center gap-1">
            {summary && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); generateSummary(); }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center gap-2 justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-sm text-muted-foreground">מסכם את הסוגיה...</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-right" dir="rtl">
                {summary.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return <h4 key={i} className="text-amber-700 dark:text-amber-300 mt-3 mb-1 font-bold">{line.replace(/\*\*/g, "")}</h4>;
                  }
                  if (line.startsWith("- ") || line.startsWith("• ")) {
                    return <li key={i} className="mr-4 text-sm">{line.slice(2)}</li>;
                  }
                  if (line.match(/^\d+\./)) {
                    return <li key={i} className="mr-4 text-sm list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-sm leading-relaxed mb-1">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
}
