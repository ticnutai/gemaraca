import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Brain, Loader2, ChevronDown, ChevronUp, ExternalLink, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PsakDinViewDialog from "./PsakDinViewDialog";

interface LinkedPsakimSectionProps {
  sugyaId: string;
  masechet: string;
  dafNumber: number;
}

interface LinkedPsak {
  id: string;
  title: string;
  summary: string;
  court: string;
  year: number;
  source_text?: string;
  confidence?: string;
  connection_explanation?: string;
}

const LinkedPsakimSection = ({ sugyaId, masechet, dafNumber }: LinkedPsakimSectionProps) => {
  const [psakim, setPsakim] = useState<LinkedPsak[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedPsak, setSelectedPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLinkedPsakim();
  }, [sugyaId, masechet, dafNumber]);

  const loadLinkedPsakim = async () => {
    setLoading(true);
    try {
      // Get pattern-based links
      const { data: patternLinks } = await supabase
        .from('pattern_sugya_links')
        .select(`
          source_text,
          confidence,
          psakei_din:psak_din_id (id, title, summary, court, year)
        `)
        .eq('masechet', masechet)
        .eq('daf', dafNumber.toString());

      // Get AI-based links (sugya_psak_links)
      const { data: aiLinks } = await supabase
        .from('sugya_psak_links')
        .select(`
          connection_explanation,
          relevance_score,
          psakei_din:psak_din_id (id, title, summary, court, year)
        `)
        .eq('sugya_id', sugyaId);

      // Combine and deduplicate
      const combined: LinkedPsak[] = [];
      const seenIds = new Set<string>();

      patternLinks?.forEach((link: any) => {
        if (link.psakei_din && !seenIds.has(link.psakei_din.id)) {
          seenIds.add(link.psakei_din.id);
          combined.push({
            ...link.psakei_din,
            source_text: link.source_text,
            confidence: link.confidence
          });
        }
      });

      aiLinks?.forEach((link: any) => {
        if (link.psakei_din && !seenIds.has(link.psakei_din.id)) {
          seenIds.add(link.psakei_din.id);
          combined.push({
            ...link.psakei_din,
            connection_explanation: link.connection_explanation
          });
        }
      });

      setPsakim(combined);
    } catch (error) {
      console.error('Error loading linked psakim:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async (psakId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzingId(psakId);
    
    try {
      const { error } = await supabase.functions.invoke('analyze-psak-din', {
        body: { psakId }
      });

      if (error) throw error;

      toast({
        title: "ניתוח AI הושלם",
        description: "פסק הדין נותח והקישורים עודכנו",
      });

      // Reload to get updated links
      await loadLinkedPsakim();
    } catch (error) {
      console.error('Error analyzing psak:', error);
      toast({
        title: "שגיאה בניתוח",
        variant: "destructive",
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handlePsakClick = async (psakId: string) => {
    const { data } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', psakId)
      .maybeSingle();
    
    if (data) {
      setSelectedPsak(data);
      setDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <Card className="border-accent/30">
        <CardContent className="p-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (psakim.length === 0) {
    return null;
  }

  const displayedPsakim = expanded ? psakim : psakim.slice(0, 3);

  return (
    <>
      <Card className="border-accent/30 bg-accent/5" dir="rtl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-row-reverse">
            <h3 className="font-semibold text-foreground flex items-center gap-2 flex-row-reverse">
              <FileText className="w-5 h-5 text-accent" />
              פסקי דין מקושרים
              <Badge variant="secondary" className="text-xs">
                {psakim.length}
              </Badge>
            </h3>
            {psakim.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="gap-1 flex-row-reverse"
              >
                {expanded ? (
                  <>
                    הסתר
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    הצג הכל ({psakim.length})
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>

          <ScrollArea className={expanded ? "h-[300px]" : ""}>
            <div className="space-y-2">
              {displayedPsakim.map((psak) => (
                <div
                  key={psak.id}
                  className="p-3 rounded-lg bg-card border border-border hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handlePsakClick(psak.id)}
                >
                  <div className="flex items-start gap-3 flex-row-reverse">
                    {/* Right side: AI analyze button and badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {psak.confidence && (
                        <Badge 
                          variant={psak.confidence === 'high' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {psak.confidence === 'high' ? 'גבוה' : psak.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                        </Badge>
                      )}
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-accent hover:bg-accent/20"
                        onClick={(e) => handleAIAnalysis(psak.id, e)}
                        disabled={analyzingId === psak.id}
                        title="נתח עם AI"
                      >
                        {analyzingId === psak.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    {/* Left side: Content */}
                    <div className="flex-1 text-right">
                      <div className="font-medium line-clamp-1 group-hover:text-primary transition-colors text-right">
                        {psak.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 text-right">
                        {psak.court} • {psak.year}
                      </div>
                      {psak.source_text && (
                        <div className="text-xs text-accent mt-1 line-clamp-1 text-right">
                          מקור: {psak.source_text}
                        </div>
                      )}
                      {psak.connection_explanation && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1 text-right">
                          {psak.connection_explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <PsakDinViewDialog
        psak={selectedPsak}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default LinkedPsakimSection;
