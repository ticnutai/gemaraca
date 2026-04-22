import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Clock,
  Star,
  BookOpen,
  Library,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
import { MASECHTOT, type Masechet } from "@/lib/masechtotData";
import { toHebrewNumeral } from "@/lib/hebrewNumbers";
import { cn } from "@/lib/utils";

const SEDARIM = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"] as const;

const RECENT_KEY = "daf_picker_recent";
const FAV_KEY = "daf_picker_favorites";

interface RecentItem {
  sugyaId: string;
  masechetHe: string;
  daf: number;
  amud: "a" | "b";
  ts: number;
}

interface DafPickerDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

const loadRecents = (): RecentItem[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
};
const loadFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
};

export const trackDafVisit = (sugyaId: string) => {
  try {
    const m = MASECHTOT.find((x) =>
      sugyaId.startsWith(x.sefariaName.toLowerCase() + "_")
    );
    if (!m) return;
    const rest = sugyaId.slice(m.sefariaName.length + 1);
    const match = rest.match(/^(\d+)([ab])$/);
    if (!match) return;
    const item: RecentItem = {
      sugyaId,
      masechetHe: m.hebrewName,
      daf: parseInt(match[1]),
      amud: match[2] as "a" | "b",
      ts: Date.now(),
    };
    const existing = loadRecents().filter((r) => r.sugyaId !== sugyaId);
    const updated = [item, ...existing].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
};

const DafPickerDialog = ({ trigger, open: controlledOpen, onOpenChange }: DafPickerDialogProps) => {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [search, setSearch] = useState("");
  const [activeSeder, setActiveSeder] = useState<string>("all");
  const [selectedMasechet, setSelectedMasechet] = useState<Masechet | null>(null);
  const [viewStyle, setViewStyle] = useState<ViewStyle>(() => {
    return (localStorage.getItem(STYLE_KEY) as ViewStyle) || "cards";
  });
  const [favs, setFavs] = useState<string[]>(loadFavs());
  const [recents, setRecents] = useState<RecentItem[]>(loadRecents());

  useEffect(() => {
    if (open) {
      setRecents(loadRecents());
      setFavs(loadFavs());
    }
  }, [open]);

  useEffect(() => {
    localStorage.setItem(STYLE_KEY, viewStyle);
  }, [viewStyle]);

  const toggleFav = (heName: string) => {
    const next = favs.includes(heName) ? favs.filter((f) => f !== heName) : [...favs, heName];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const filteredMasechtot = useMemo(() => {
    let list = MASECHTOT;
    if (activeSeder !== "all") list = list.filter((m) => m.seder === activeSeder);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.hebrewName.includes(search.trim()) ||
          m.englishName.toLowerCase().includes(q) ||
          m.sefariaName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSeder, search]);

  const goTo = (m: Masechet, daf: number, amud: "a" | "b") => {
    const sugyaId = `${m.sefariaName.toLowerCase()}_${daf}${amud}`;
    trackDafVisit(sugyaId);
    setOpen(false);
    setSelectedMasechet(null);
    setSearch("");
    navigate(`/sugya/${sugyaId}`);
  };

  const renderMasechetItem = (m: Masechet) => {
    const isFav = favs.includes(m.hebrewName);
    const baseProps = {
      key: m.sefariaName,
      onClick: () => setSelectedMasechet(m),
    };

    if (viewStyle === "cards") {
      return (
        <div
          {...baseProps}
          className="group relative cursor-pointer rounded-xl border border-border bg-card p-3 transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFav(m.hebrewName);
            }}
            className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Star className={cn("w-3.5 h-3.5", isFav && "fill-accent text-accent opacity-100")} />
          </button>
          {isFav && (
            <Star className="absolute top-1.5 left-1.5 w-3.5 h-3.5 fill-accent text-accent" />
          )}
          <div className="flex flex-col items-center text-center gap-1">
            <BookOpen className="w-5 h-5 text-primary opacity-70" />
            <div className="font-bold text-sm text-foreground">{m.hebrewName}</div>
            <div className="text-[10px] text-muted-foreground">{m.maxDaf} דפים</div>
          </div>
        </div>
      );
    }

    if (viewStyle === "list") {
      return (
        <div
          {...baseProps}
          className="group flex items-center justify-between cursor-pointer rounded-lg border border-border bg-card px-3 py-2 hover:border-primary hover:bg-accent/5 transition-all"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">{m.hebrewName}</span>
            <Badge variant="outline" className="text-[10px]">{m.seder}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{m.maxDaf} דפים</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFav(m.hebrewName);
              }}
            >
              <Star className={cn("w-3.5 h-3.5", isFav ? "fill-accent text-accent" : "opacity-40")} />
            </button>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (viewStyle === "compact") {
      return (
        <button
          {...baseProps}
          className={cn(
            "px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
            "border-border bg-card hover:border-primary hover:bg-primary/10",
            isFav && "border-accent bg-accent/10"
          )}
        >
          {m.hebrewName}
        </button>
      );
    }

    // grid (large hero buttons)
    return (
      <div
        {...baseProps}
        className="group cursor-pointer rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 border-2 border-border hover:border-accent transition-all p-4 flex flex-col items-center justify-center min-h-[100px] hover:shadow-lg hover:scale-[1.02]"
      >
        <BookOpen className="w-6 h-6 text-primary mb-1.5 opacity-80 group-hover:opacity-100" />
        <div className="font-bold text-base text-foreground">{m.hebrewName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{m.seder} • {m.maxDaf}</div>
      </div>
    );
  };

  const renderDafGrid = () => {
    if (!selectedMasechet) return null;
    const dafs = Array.from({ length: selectedMasechet.maxDaf - 1 }, (_, i) => i + 2);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMasechet(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4 rotate-180" />
            חזרה למסכתות
          </Button>
          <div className="font-bold text-primary">{selectedMasechet.hebrewName}</div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
          {dafs.map((d) => (
            <div key={d} className="contents">
              <button
                onClick={() => goTo(selectedMasechet, d, "a")}
                className="px-2 py-2 rounded-lg bg-gradient-to-br from-accent to-accent/80 hover:from-accent hover:to-accent text-accent-foreground font-bold text-xs hover:shadow-md transition-all"
              >
                {toHebrewNumeral(d)} ע״א
              </button>
              <button
                onClick={() => goTo(selectedMasechet, d, "b")}
                className="px-2 py-2 rounded-lg bg-gradient-to-br from-primary to-primary/80 hover:from-primary hover:to-primary text-primary-foreground font-bold text-xs hover:shadow-md transition-all"
              >
                {toHebrewNumeral(d)} ע״ב
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const favoritesMasechtot = MASECHTOT.filter((m) => favs.includes(m.hebrewName));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="w-5 h-5 text-primary" />
            בחר מסכת ודף
          </DialogTitle>
        </DialogHeader>

        {!selectedMasechet ? (
          <>
            {/* Search bar + style switcher */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="חפש מסכת... (ברכות, שבת, Bava...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/30">
                {([
                  { id: "cards", icon: LayoutGrid, label: "כרטיסיות" },
                  { id: "list", icon: List, label: "רשימה" },
                  { id: "compact", icon: Hash, label: "תגיות" },
                  { id: "grid", icon: Rows3, label: "גריד" },
                ] as const).map((s) => (
                  <Button
                    key={s.id}
                    variant={viewStyle === s.id ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    title={s.label}
                    onClick={() => setViewStyle(s.id)}
                  >
                    <s.icon className="w-4 h-4" />
                  </Button>
                ))}
              </div>
            </div>

            {/* Quick access: recents + favorites */}
            {(recents.length > 0 || favoritesMasechtot.length > 0) && !search && (
              <div className="space-y-3">
                {recents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      נצפו לאחרונה
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recents.slice(0, 8).map((r) => {
                        const m = MASECHTOT.find((x) => x.hebrewName === r.masechetHe);
                        if (!m) return null;
                        return (
                          <button
                            key={r.sugyaId}
                            onClick={() => goTo(m, r.daf, r.amud)}
                            className="px-2.5 py-1 text-xs rounded-full border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            {r.masechetHe} {toHebrewNumeral(r.daf)} {r.amud === "a" ? "ע״א" : "ע״ב"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {favoritesMasechtot.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                      מועדפים
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {favoritesMasechtot.map((m) => (
                        <button
                          key={m.sefariaName}
                          onClick={() => setSelectedMasechet(m)}
                          className="px-2.5 py-1 text-xs rounded-full border border-accent/40 bg-accent/5 hover:bg-accent/15 transition-all font-medium"
                        >
                          {m.hebrewName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Seder filter tabs */}
            <Tabs value={activeSeder} onValueChange={setActiveSeder} dir="rtl">
              <TabsList className="grid grid-cols-7 w-full">
                <TabsTrigger value="all" className="text-xs">הכל</TabsTrigger>
                {SEDARIM.map((s) => (
                  <TabsTrigger key={s} value={s} className="text-xs">
                    {s}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Masechet list/grid */}
            <ScrollArea className="flex-1 -mx-1 px-1">
              {filteredMasechtot.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  לא נמצאו מסכתות תואמות
                </div>
              ) : viewStyle === "compact" ? (
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {filteredMasechtot.map(renderMasechetItem)}
                </div>
              ) : viewStyle === "list" ? (
                <div className="space-y-1.5 pb-2">{filteredMasechtot.map(renderMasechetItem)}</div>
              ) : viewStyle === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pb-2">
                  {filteredMasechtot.map(renderMasechetItem)}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pb-2">
                  {filteredMasechtot.map(renderMasechetItem)}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <ScrollArea className="flex-1 -mx-1 px-1">{renderDafGrid()}</ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DafPickerDialog;