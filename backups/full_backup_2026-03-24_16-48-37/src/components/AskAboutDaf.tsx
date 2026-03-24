import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Send, Loader2, X, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AskAboutDafProps {
  masechet?: string;
  daf?: string;
  fullPageText?: string;
  selectedText?: string;
  onSelectTextRequest?: () => void;
}

interface QA {
  question: string;
  answer: string;
  selectedSnippet?: string;
}

export default function AskAboutDaf({ masechet, daf, fullPageText, selectedText, onSelectTextRequest }: AskAboutDafProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const askQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setQuestion("");

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/ask-about-daf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          question: q,
          selectedText: selectedText || undefined,
          masechet,
          daf,
          fullPageText: fullPageText?.slice(0, 4000),
        }),
      });

      if (!res.ok) throw new Error("Failed to get answer");
      const data = await res.json();

      setQaHistory(prev => [...prev, { question: q, answer: data.answer, selectedSnippet: selectedText || undefined }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    } catch {
      toast.error("שגיאה בקבלת תשובה");
    } finally {
      setIsLoading(false);
    }
  }, [question, isLoading, selectedText, masechet, daf, fullPageText]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
      >
        <HelpCircle className="h-4 w-4" />
        שאל על הדף
      </Button>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <MessageSquareText className="h-4 w-4" />
            שאל על הדף
            {masechet && daf && (
              <Badge variant="secondary" className="text-xs">{masechet} {daf}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {selectedText && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mt-1">
            <span className="font-medium">טקסט מסומן: </span>
            <span className="line-clamp-2">{selectedText}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <ScrollArea className="max-h-[300px]" ref={scrollRef}>
          <div className="space-y-3">
            {qaHistory.length === 0 && !isLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">
                שאל שאלה ספציפית על טקסט הגמרא שבדף.
                {!selectedText && " סמן טקסט כדי לשאול עליו ישירות."}
              </p>
            )}
            {qaHistory.map((qa, i) => (
              <div key={i} className="space-y-2">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-sm" dir="rtl">
                  <span className="font-medium text-blue-700 dark:text-blue-300">שאלה: </span>
                  {qa.question}
                  {qa.selectedSnippet && (
                    <div className="text-xs mt-1 text-muted-foreground border-r-2 border-blue-300 pr-2">
                      ״{qa.selectedSnippet.slice(0, 80)}...״
                    </div>
                  )}
                </div>
                <div className="bg-card rounded-lg p-2.5 text-sm border" dir="rtl">
                  {qa.answer.split("\n").map((line, j) => (
                    <p key={j} className={line.trim() === "" ? "h-2" : "mb-1 leading-relaxed"}>
                      {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs text-muted-foreground">חושב...</span>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askQuestion()}
            placeholder="שאל שאלה על הדף..."
            className="text-sm"
            dir="rtl"
          />
          <Button size="icon" onClick={askQuestion} disabled={isLoading || !question.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
