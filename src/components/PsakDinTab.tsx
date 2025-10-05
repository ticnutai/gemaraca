import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, FileText } from "lucide-react";

const PsakDinTab = () => {
  const [psakim, setPsakim] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPsakim();
  }, []);

  const loadPsakim = async () => {
    try {
      const { data, error } = await supabase
        .from('psakei_din')
        .select('*')
        .order('year', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPsakim(data || []);
    } catch (error) {
      console.error('Error loading psakim:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">טוען...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-foreground mb-6">פסקי דין אחרונים</h2>
        
        {psakim.map((psak) => (
          <Card key={psak.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                {psak.title}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {psak.court}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {psak.year}
                </div>
                {psak.case_number && (
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {psak.case_number}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground mb-3">{psak.summary}</p>
              {psak.tags && psak.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {psak.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PsakDinTab;
