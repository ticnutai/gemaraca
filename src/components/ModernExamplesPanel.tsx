import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, Lightbulb, Scale, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

interface ModernExamplesPanelProps {
  gemaraText?: string;
  sugyaTitle: string;
  dafYomi: string;
  masechet: string;
}

export const ModernExamplesPanel = ({
  gemaraText,
  sugyaTitle,
  dafYomi,
  masechet,
}: ModernExamplesPanelProps) => {
  const [data, setData] = useState<ModernExamplesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateExamples = async () => {
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
          },
        }
      );

      if (fnError) throw fnError;
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      toast.success("ההמחשות נוצרו בהצלחה");
    } catch (err) {
      console.error("Error generating examples:", err);
      setError(err instanceof Error ? err.message : "שגיאה ביצירת ההמחשות");
      toast.error("שגיאה ביצירת ההמחשות");
    } finally {
      setIsLoading(false);
    }
  };

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
            onClick={generateExamples} 
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
          <Button onClick={generateExamples} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Principle Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            היסוד ההלכתי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground font-medium">{data?.principle}</p>
        </CardContent>
      </Card>

      {/* Modern Examples */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              דוגמאות מודרניות
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateExamples}
              disabled={isLoading}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.examples.map((example, index) => (
            <div 
              key={index} 
              className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl">{example.icon}</span>
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">{example.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {example.scenario}
                  </p>
                </div>
              </div>
              <div className="pr-10 pt-2 border-t border-border/30">
                <p className="text-xs text-primary font-medium">
                  🔗 קשר לגמרא: {example.connection}
                </p>
              </div>
            </div>
          ))}
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
          <p className="text-foreground">{data?.practicalSummary}</p>
        </CardContent>
      </Card>
    </div>
  );
};
