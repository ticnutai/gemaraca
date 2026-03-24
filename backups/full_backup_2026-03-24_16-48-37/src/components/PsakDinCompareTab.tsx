import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Columns2, Search, X, ArrowRight, Scale, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FileTypeBadge from "./FileTypeBadge";

interface PsakDin {
  id: string;
  title: string;
  summary: string;
  court: string;
  year: number;
  case_number?: string;
  full_text?: string;
  tags?: string[];
  source_url?: string;
}

export default function PsakDinCompareTab() {
  const [leftPsak, setLeftPsak] = useState<PsakDin | null>(null);
  const [rightPsak, setRightPsak] = useState<PsakDin | null>(null);
  const [pickerSide, setPickerSide] = useState<"left" | "right" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PsakDin[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from("psakei_din")
        .select("id, title, summary, court, year, case_number, full_text, tags, source_url")
        .or(`title.ilike.%${q}%,summary.ilike.%${q}%,court.ilike.%${q}%`)
        .order("year", { ascending: false })
        .limit(20);
      setSearchResults((data as PsakDin[]) || []);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, search]);

  const selectPsak = (p: PsakDin) => {
    if (pickerSide === "left") setLeftPsak(p);
    else setRightPsak(p);
    setPickerSide(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const commonTags = leftPsak?.tags && rightPsak?.tags
    ? (leftPsak.tags as string[]).filter((t) => (rightPsak!.tags as string[]).includes(t))
    : [];

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
        <Columns2 className="h-5 w-5 text-primary" />
        השוואת פסקי דין
      </h2>
      <p className="text-sm text-muted-foreground">בחר שני פסקי דין להשוואה זה לצד זה</p>

      {/* Side-by-side panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left */}
        <CompareSlot
          label="פסק דין א'"
          psak={leftPsak}
          onPick={() => setPickerSide("left")}
          onClear={() => setLeftPsak(null)}
        />
        {/* Right */}
        <CompareSlot
          label="פסק דין ב'"
          psak={rightPsak}
          onPick={() => setPickerSide("right")}
          onClear={() => setRightPsak(null)}
        />
      </div>

      {/* Comparison summary */}
      {leftPsak && rightPsak && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              סיכום השוואה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 text-center text-sm">
              <div>
                <div className="text-muted-foreground text-xs">שנה</div>
                <div className="font-bold">{leftPsak.year}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">הפרש</div>
                <div className="font-bold">{Math.abs(leftPsak.year - rightPsak.year)} שנים</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">שנה</div>
                <div className="font-bold">{rightPsak.year}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 text-center text-sm">
              <div>
                <div className="text-muted-foreground text-xs">ערכאה</div>
                <div className="font-medium text-xs">{leftPsak.court}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">ערכאה זהה?</div>
                <Badge variant={leftPsak.court === rightPsak.court ? "default" : "secondary"} className="text-xs">
                  {leftPsak.court === rightPsak.court ? "כן" : "לא"}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">ערכאה</div>
                <div className="font-medium text-xs">{rightPsak.court}</div>
              </div>
            </div>

            {commonTags.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">תגיות משותפות:</div>
                <div className="flex flex-wrap gap-1">
                  {commonTags.map((t) => (
                    <Badge key={t} className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Picker dialog */}
      <Dialog open={!!pickerSide} onOpenChange={() => setPickerSide(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>בחר פסק דין</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חפש לפי שם, תקציר, ערכאה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[400px]">
            {isSearching && <div className="text-center text-sm text-muted-foreground py-4">מחפש...</div>}
            <div className="space-y-2">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPsak(p)}
                  className="w-full text-right p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                >
                  <div className="font-medium text-sm flex items-center gap-1.5 justify-end"><FileTypeBadge url={p.source_url} />{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.court} • {p.year}</div>
                </button>
              ))}
            </div>
            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">לא נמצאו תוצאות</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompareSlot({
  label,
  psak,
  onPick,
  onClear,
}: {
  label: string;
  psak: PsakDin | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (!psak) {
    return (
      <Card className="border-dashed border-2 h-full">
        <CardContent className="flex flex-col items-center justify-center p-8 h-full">
          <Scale className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{label}</p>
          <Button variant="outline" size="sm" onClick={onPick}>
            <Search className="h-4 w-4 ml-1" />
            בחר פסק דין
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">{label}</Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <CardTitle className="text-sm flex items-center gap-1.5 justify-end"><FileTypeBadge url={psak.source_url} />{psak.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span>{psak.court}</span>
          <Calendar className="h-3 w-3 mr-2" />
          <span>{psak.year}</span>
        </div>
        {psak.case_number && (
          <div className="text-xs font-mono text-muted-foreground">{psak.case_number}</div>
        )}
        {psak.tags && (psak.tags as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(psak.tags as string[]).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        )}
        <ScrollArea className="max-h-[250px]">
          <p className="text-sm leading-relaxed">{psak.summary}</p>
          {psak.full_text && (
            <div className="mt-3 pt-3 border-t text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
              {psak.full_text.slice(0, 2000)}
              {psak.full_text.length > 2000 && "..."}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
