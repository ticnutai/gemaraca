import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Scale, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SugyaCardProps {
  id: string;
  title: string;
  dafYomi: string;
  summary: string;
  casesCount: number;
  tags: string[];
}

const SugyaCard = ({ id, title, dafYomi, summary, casesCount, tags }: SugyaCardProps) => {
  const navigate = useNavigate();
  const [realCasesCount, setRealCasesCount] = useState<number>(0);
  
  useEffect(() => {
    fetchRealCasesCount();
  }, [id]);

  const fetchRealCasesCount = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('sugya_psak_links')
        .select('*, psakei_din:psak_din_id(source_url)', { count: 'exact' })
        .eq('sugya_id', id);

      if (!error && data) {
        // Count only cases with real source URLs
        const realCases = data.filter(
          (link: any) => link.psakei_din?.source_url && 
          link.psakei_din.source_url.startsWith('http')
        );
        setRealCasesCount(realCases.length);
      }
    } catch (error) {
      console.error('Error fetching real cases count:', error);
    }
  };
  
  return (
    <Card 
      onClick={() => navigate(`/sugya/${id}`)}
      className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg border-border bg-gradient-to-br from-card to-card/80 hover:scale-[1.02]"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary relative">
                <FileText className="w-4 h-4" />
                {realCasesCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-lg">
                    {realCasesCount}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-muted-foreground">{dafYomi}</span>
            </div>
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
        </div>
        
        <p className="text-muted-foreground leading-relaxed line-clamp-2">
          {summary}
        </p>
        
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Scale className="w-4 h-4 text-accent" />
            <span className="font-medium">{casesCount} מקרים מודרניים מקושרים</span>
          </div>
          {realCasesCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-accent font-semibold">
              <ExternalLink className="w-4 h-4" />
              <span>{realCasesCount} פסקי דין אמיתיים עם קישור</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SugyaCard;
