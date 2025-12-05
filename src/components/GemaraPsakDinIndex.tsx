import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT, SEDARIM, Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { 
  Search, BookOpen, Scale, ChevronLeft, TrendingUp, 
  Database, Tag, Filter, BarChart3, Sparkles, Building2, Calendar
} from "lucide-react";
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
  totalPsakim: number;
}

interface Statistics {
  totalPsakim: number;
  totalLinks: number;
  masechtotWithLinks: number;
  topTags: { tag: string; count: number }[];
  topCourts: { court: string; count: number }[];
  yearRange: { min: number; max: number };
}

const GemaraPsakDinIndex = () => {
  const [indexData, setIndexData] = useState<IndexEntry[]>([]);
  const [allLinks, setAllLinks] = useState<PsakLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeder, setSelectedSeder] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [expandedMasechet, setExpandedMasechet] = useState<string | null>(null);
  const [selectedDafPsakim, setSelectedDafPsakim] = useState<PsakLink[]>([]);
  const [selectedDafInfo, setSelectedDafInfo] = useState<{ masechet: string; daf: number } | null>(null);
  const [dialogPsak, setDialogPsak] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "stats">("tree");

  const statistics = useMemo<Statistics>(() => {
    const tagCounts = new Map<string, number>();
    const courtCounts = new Map<string, number>();
    const years: number[] = [];
    const uniquePsakim = new Set<string>();

    allLinks.forEach(link => {
      if (link.psakei_din) {
        uniquePsakim.add(link.psak_din_id);
        
        link.psakei_din.tags?.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
        
        const court = link.psakei_din.court;
        courtCounts.set(court, (courtCounts.get(court) || 0) + 1);
        
        if (link.psakei_din.year) {
          years.push(link.psakei_din.year);
        }
      }
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCourts = Array.from(courtCounts.entries())
      .map(([court, count]) => ({ court, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPsakim: uniquePsakim.size,
      totalLinks: allLinks.length,
      masechtotWithLinks: indexData.length,
      topTags,
      topCourts,
      yearRange: {
        min: years.length > 0 ? Math.min(...years) : 0,
        max: years.length > 0 ? Math.max(...years) : 0,
      }
    };
  }, [allLinks, indexData]);

  const allTags = useMemo(() => {
    return statistics.topTags.map(t => t.tag);
  }, [statistics]);

  useEffect(() => {
    loadIndexData();
  }, []);

  const loadIndexData = async () => {
    try {
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

      setAllLinks(links || []);

      const indexMap = new Map<string, Map<number, { sugya_id: string; count: number }>>();

      links?.forEach((link: any) => {
        const sugyaId = link.sugya_id;
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
          
          const totalPsakim = dafim.reduce((sum, d) => sum + d.psakimCount, 0);
          index.push({ masechet, dafim, totalPsakim });
        }
      });

      // מיון לפי כמות פסקים
      index.sort((a, b) => b.totalPsakim - a.totalPsakim);
      setIndexData(index);
    } catch (error) {
      console.error('Error loading index:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDafPsakim = async (sugyaId: string, masechet: string, daf: number) => {
    try {
      let query = supabase
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

      const { data, error } = await query;

      if (error) throw error;

      // סינון לפי תגית אם נבחרה
      let filteredData = data || [];
      if (selectedTag !== "all") {
        filteredData = filteredData.filter((link: any) => 
          link.psakei_din?.tags?.includes(selectedTag)
        );
      }

      setSelectedDafPsakim(filteredData);
      setSelectedDafInfo({ masechet, daf });
    } catch (error) {
      console.error('Error loading daf psakim:', error);
    }
  };

  const handlePsakClick = (psak: any) => {
    setDialogPsak(psak);
    setDialogOpen(true);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? "all" : tag);
  };

  const filteredIndex = indexData.filter(entry => {
    const matchesSearch = searchQuery === "" || 
      entry.masechet.hebrewName.includes(searchQuery);
    const matchesSeder = selectedSeder === "all" || 
      entry.masechet.seder === selectedSeder;
    return matchesSearch && matchesSeder;
  });

  // חישוב אחוז כיסוי לכל מסכת
  const getCoveragePercent = (entry: IndexEntry) => {
    return Math.round((entry.dafim.length / entry.masechet.maxDaf) * 100);
  };

  // צבע לפי כמות פסקים
  const getHeatColor = (count: number) => {
    if (count >= 5) return "bg-primary text-primary-foreground";
    if (count >= 3) return "bg-primary/80 text-primary-foreground";
    if (count >= 2) return "bg-primary/60 text-primary-foreground";
    return "bg-primary/40 text-primary-foreground";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Sparkles className="w-8 h-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">טוען אינדקס חכם...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת וסטטיסטיקות ראשיות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.totalPsakim}</p>
                <p className="text-xs text-muted-foreground">פסקי דין</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.totalLinks}</p>
                <p className="text-xs text-muted-foreground">קישורים</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statistics.masechtotWithLinks}</p>
                <p className="text-xs text-muted-foreground">מסכתות</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {statistics.yearRange.min > 0 ? `${statistics.yearRange.min}-${statistics.yearRange.max}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">טווח שנים</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* תגיות פופולריות */}
      {statistics.topTags.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4" />
              תגיות פופולריות (לחץ לסינון)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statistics.topTags.map(({ tag, count }) => (
                <Badge 
                  key={tag} 
                  variant={selectedTag === tag ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                  <span className="mr-1 text-xs opacity-70">({count})</span>
                </Badge>
              ))}
              {selectedTag !== "all" && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => setSelectedTag("all")}
                >
                  נקה סינון ×
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="flex gap-1">
          <Button 
            variant={viewMode === "tree" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("tree")}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button 
            variant={viewMode === "stats" ? "default" : "outline"} 
            size="icon"
            onClick={() => setViewMode("stats")}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === "stats" ? (
        /* תצוגת סטטיסטיקות */
        <div className="grid md:grid-cols-2 gap-6">
          {/* מסכתות מובילות */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                מסכתות מובילות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredIndex.slice(0, 8).map((entry, idx) => (
                  <div key={entry.masechet.englishName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{entry.masechet.hebrewName}</span>
                      <span className="text-muted-foreground">{entry.totalPsakim} פסקים</span>
                    </div>
                    <Progress 
                      value={(entry.totalPsakim / (filteredIndex[0]?.totalPsakim || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* בתי דין מובילים */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                בתי דין מובילים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statistics.topCourts.map((court, idx) => (
                  <div key={court.court} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[200px]">{court.court}</span>
                      <span className="text-muted-foreground">{court.count}</span>
                    </div>
                    <Progress 
                      value={(court.count / (statistics.topCourts[0]?.count || 1)) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* תצוגת עץ */
        <div className="grid md:grid-cols-2 gap-6">
          {/* עץ המסכתות */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                מסכתות ({filteredIndex.length})
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.masechet.hebrewName}</span>
                              <span className="text-xs text-muted-foreground">
                                ({getCoveragePercent(entry)}% כיסוי)
                              </span>
                            </div>
                            <Badge variant="secondary" className="ml-2">
                              {entry.totalPsakim} פסקים
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-6 gap-2 p-2">
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
                                className={`relative ${
                                  selectedDafInfo?.masechet !== entry.masechet.hebrewName || 
                                  selectedDafInfo?.daf !== daf.dafNumber 
                                    ? getHeatColor(daf.psakimCount) 
                                    : ''
                                }`}
                                onClick={() => loadDafPsakim(daf.sugya_id, entry.masechet.hebrewName, daf.dafNumber)}
                              >
                                {toHebrewNumeral(daf.dafNumber)}
                                {daf.psakimCount > 1 && (
                                  <span className="absolute -top-1 -left-1 bg-background text-foreground border rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
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
                {selectedTag !== "all" && (
                  <Badge variant="outline" className="mr-2">
                    <Filter className="w-3 h-3 ml-1" />
                    {selectedTag}
                  </Badge>
                )}
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
                    {selectedTag !== "all" 
                      ? `אין פסקי דין עם התגית "${selectedTag}" לדף זה`
                      : 'אין פסקי דין לדף זה'
                    }
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDafPsakim.map((link) => (
                      <Card 
                        key={link.id} 
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border-r-4 border-r-primary/50"
                        onClick={() => handlePsakClick(link.psakei_din)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground line-clamp-1">
                              {link.psakei_din?.title}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {link.psakei_din?.court}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {link.psakei_din?.year}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                              {link.connection_explanation}
                            </p>
                          </div>
                          <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                        </div>
                        {link.psakei_din?.tags && link.psakei_din.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {link.psakei_din.tags.slice(0, 4).map((tag, idx) => (
                              <Badge 
                                key={idx} 
                                variant={tag === selectedTag ? "default" : "outline"} 
                                className="text-xs"
                              >
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
      )}

      <PsakDinViewDialog
        psak={dialogPsak}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default GemaraPsakDinIndex;
