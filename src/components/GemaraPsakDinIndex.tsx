import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT, SEDARIM, Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Search, BookOpen, Scale, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PsakDinViewDialog from "./PsakDinViewDialog";

interface PsakLink {
  id: string;
  psak_din_id: string;
  sugya_id: string;
  connection_explanation: string;
  relevance_score: number;
  psakei_din?: {
    id: string;
    title: string;
    court: string;
    year: number;
    summary: string;
    tags: string[];
    source_url?: string;
  };
}

interface IndexEntry {
  masechet: Masechet;
  dafim: {
    dafNumber: number;
    sugya_id: string;
    psakimCount: number;
  }[];
}

const GemaraPsakDinIndex = () => {
  const [indexData, setIndexData] = useState<IndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeder, setSelectedSeder] = useState<string>("all");
  const [expandedMasechet, setExpandedMasechet] = useState<string | null>(null);
  const [selectedDafPsakim, setSelectedDafPsakim] = useState<PsakLink[]>([]);
  const [selectedDafInfo, setSelectedDafInfo] = useState<{ masechet: string; daf: number } | null>(null);
  const [dialogPsak, setDialogPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadIndexData();
  }, []);

  const loadIndexData = async () => {
    try {
      // קבלת כל הקישורים עם מידע על פסקי הדין
      const { data: links, error } = await supabase
        .from('sugya_psak_links')
        .select(`
          id,
          psak_din_id,
          sugya_id,
          connection_explanation,
          relevance_score,
          psakei_din (
            id,
            title,
            court,
            year,
            summary,
            tags,
            source_url
          )
        `);

      if (error) throw error;

      // מיפוי הקישורים לפי מסכת ודף
      const indexMap = new Map<string, Map<number, { sugya_id: string; count: number }>>();

      links?.forEach((link: any) => {
        const sugyaId = link.sugya_id;
        // ניתוח sugya_id לזיהוי מסכת ודף
        const match = sugyaId.match(/^([a-z_]+)_(\d+)[ab]?$/i);
        if (match) {
          const masechetName = match[1].replace(/_/g, ' ');
          const dafNumber = parseInt(match[2]);
          
          if (!indexMap.has(masechetName)) {
            indexMap.set(masechetName, new Map());
          }
          const masechetDafim = indexMap.get(masechetName)!;
          
          if (!masechetDafim.has(dafNumber)) {
            masechetDafim.set(dafNumber, { sugya_id: sugyaId, count: 0 });
          }
          masechetDafim.get(dafNumber)!.count++;
        }
      });

      // בניית מבנה האינדקס
      const index: IndexEntry[] = [];
      
      MASECHTOT.forEach(masechet => {
        const sefariaLower = masechet.sefariaName.toLowerCase().replace(/_/g, ' ');
        const masechetData = indexMap.get(sefariaLower);
        
        if (masechetData && masechetData.size > 0) {
          const dafim = Array.from(masechetData.entries())
            .map(([dafNumber, data]) => ({
              dafNumber,
              sugya_id: data.sugya_id,
              psakimCount: data.count
            }))
            .sort((a, b) => a.dafNumber - b.dafNumber);
          
          index.push({ masechet, dafim });
        }
      });

      setIndexData(index);
    } catch (error) {
      console.error('Error loading index:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDafPsakim = async (sugyaId: string, masechet: string, daf: number) => {
    try {
      const { data, error } = await supabase
        .from('sugya_psak_links')
        .select(`
          id,
          psak_din_id,
          sugya_id,
          connection_explanation,
          relevance_score,
          psakei_din (
            id,
            title,
            court,
            year,
            summary,
            tags,
            source_url
          )
        `)
        .eq('sugya_id', sugyaId);

      if (error) throw error;

      setSelectedDafPsakim(data || []);
      setSelectedDafInfo({ masechet, daf });
    } catch (error) {
      console.error('Error loading daf psakim:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    setDialogPsak(psak);
    setDialogOpen(true);
  };

  const filteredIndex = indexData.filter(entry => {
    const matchesSearch = searchQuery === "" || 
      entry.masechet.hebrewName.includes(searchQuery);
    const matchesSeder = selectedSeder === "all" || 
      entry.masechet.seder === selectedSeder;
    return matchesSearch && matchesSeder;
  });

  const totalPsakim = indexData.reduce(
    (sum, entry) => sum + entry.dafim.reduce((s, d) => s + d.psakimCount, 0), 
    0
  );

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        טוען אינדקס...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת וסטטיסטיקות */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">אינדקס פסקי דין לפי מסכתות</h2>
          <p className="text-muted-foreground">
            {totalPsakim} פסקי דין מקושרים ל-{indexData.length} מסכתות
          </p>
        </div>
      </div>

      {/* סינון וחיפוש */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חפש מסכת..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={selectedSeder} onValueChange={setSelectedSeder}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="כל הסדרים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסדרים</SelectItem>
            {SEDARIM.map(seder => (
              <SelectItem key={seder} value={seder}>סדר {seder}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* עץ המסכתות */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              מסכתות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filteredIndex.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  אין פסקי דין מקושרים
                </div>
              ) : (
                <Accordion 
                  type="single" 
                  collapsible
                  value={expandedMasechet || undefined}
                  onValueChange={setExpandedMasechet}
                >
                  {filteredIndex.map((entry) => (
                    <AccordionItem key={entry.masechet.englishName} value={entry.masechet.englishName}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pl-4">
                          <span className="font-medium">{entry.masechet.hebrewName}</span>
                          <Badge variant="secondary" className="ml-2">
                            {entry.dafim.reduce((s, d) => s + d.psakimCount, 0)} פסקים
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-5 gap-2 p-2">
                          {entry.dafim.map((daf) => (
                            <Button
                              key={daf.dafNumber}
                              variant={
                                selectedDafInfo?.masechet === entry.masechet.hebrewName && 
                                selectedDafInfo?.daf === daf.dafNumber 
                                  ? "default" 
                                  : "outline"
                              }
                              size="sm"
                              className="relative"
                              onClick={() => loadDafPsakim(daf.sugya_id, entry.masechet.hebrewName, daf.dafNumber)}
                            >
                              {toHebrewNumeral(daf.dafNumber)}
                              {daf.psakimCount > 1 && (
                                <span className="absolute -top-1 -left-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                                  {daf.psakimCount}
                                </span>
                              )}
                            </Button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* רשימת פסקי דין לדף נבחר */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="w-5 h-5" />
              {selectedDafInfo 
                ? `פסקי דין - ${selectedDafInfo.masechet} דף ${toHebrewNumeral(selectedDafInfo.daf)}`
                : 'בחר דף לצפייה בפסקי דין'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {!selectedDafInfo ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>לחץ על דף באחת המסכתות כדי לראות את פסקי הדין המקושרים</p>
                </div>
              ) : selectedDafPsakim.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  אין פסקי דין לדף זה
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDafPsakim.map((link) => (
                    <Card 
                      key={link.id} 
                      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handlePsakClick(link.psakei_din)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground line-clamp-1">
                            {link.psakei_din?.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {link.psakei_din?.court} • {link.psakei_din?.year}
                          </p>
                          <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                            {link.connection_explanation}
                          </p>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                      </div>
                      {link.psakei_din?.tags && link.psakei_din.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {link.psakei_din.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <PsakDinViewDialog
        psak={dialogPsak}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default GemaraPsakDinIndex;
