import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Compass, RefreshCw, ArrowLeft, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const HISTORY_KEY = "learning-history";

interface LearningRecommendationsProps {
  currentMasechet?: string;
}

export default function LearningRecommendations({ currentMasechet }: LearningRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const recentTopics = [...new Set(history.slice(0, 20).map((h: any) => h.masechet))].join(", ");

      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/learning-recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          learningHistory: history.slice(0, 30),
          currentMasechet,
          recentTopics,
        }),
      });

      if (!res.ok) throw new Error("Failed to get recommendations");
      const data = await res.json();
      setRecommendations(data.recommendations);
    } catch {
      toast.error("שגיאה בקבלת המלצות");
    } finally {
      setIsLoading(false);
    }
  }, [currentMasechet]);

  return (
    <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300">
            <Compass className="h-4 w-4" />
            מה ללמוד הלאה?
          </CardTitle>
          {recommendations && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchRecommendations}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!recommendations && !isLoading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Compass className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground text-center">
              קבל המלצות מותאמות אישית על סמך היסטוריית הלמידה שלך
            </p>
            <Button onClick={fetchRecommendations} variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
              <Compass className="h-4 w-4" />
              קבל המלצות
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-green-500" />
            <span className="text-sm text-muted-foreground">מנתח את היסטוריית הלמידה...</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[350px]">
            <div className="space-y-1 text-sm" dir="rtl">
              {recommendations.split("\n").map((line, i) => {
                if (line.startsWith("**") || line.includes("**")) {
                  return (
                    <h4 key={i} className="text-green-700 dark:text-green-300 mt-3 mb-1 font-bold text-sm">
                      {line.replace(/\*\*/g, "")}
                    </h4>
                  );
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="leading-relaxed mb-0.5">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
