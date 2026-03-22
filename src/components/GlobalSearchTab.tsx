import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, BookOpen, Scale, FileText, Loader2, X, SlidersHorizontal, Clock, Sparkles, StickyNote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  type: "gemara" | "psak" | "modern" | "notes";
  title: string;
  snippet: string;
  meta: string;
  relevance?: number;
}

interface UserNoteSearchItem {
  id: string;
  sugyaId: string;
  dafYomi: string;
  content: string;
  updatedAt: number;
}

const HISTORY_KEY = "global-search-history";

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addToHistory(query: string) {
  try {
    const list = getSearchHistory().filter((q) => q !== query);
    list.unshift(query);
    if (list.length > 20) list.length = 20;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {}
}

function getAllPersonalNotes(): UserNoteSearchItem[] {
  try {
    const raw = localStorage.getItem("user-notes");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function GlobalSearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeType, setActiveType] = useState("all");
  const [history, setHistory] = useState<string[]>(getSearchHistory);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced autocomplete
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    const historyMatches = getSearchHistory().filter((h) => h.includes(q)).slice(0, 3);
    try {
      // Use FTS for psak suggestions when possible 
      const ftsQ = q.split(/\s+/).filter(Boolean).join(' & ');
      const { data: titles } = await supabase
        .from("psakei_din")
        .select("title")
        .or(`search_vector.fts.${ftsQ},title.ilike.%${q}%`)
        .limit(4);
      const { data: masechets } = await supabase
        .from("gemara_pages")
        .select("title")
        .ilike("title", `%${q}%`)
        .limit(4);
      const dbSuggestions = [
        ...(titles?.map((t) => t.title) || []),
        ...(masechets?.map((m) => m.title) || []),
      ];
      const combined = [...new Set([...historyMatches, ...dbSuggestions])].slice(0, 8);
      setSuggestions(combined);
      setShowSuggestions(combined.length > 0);
    } catch {
      setSuggestions(historyMatches);
      setShowSuggestions(historyMatches.length > 0);
    }
  }, []);

  const onQueryChange = useCallback((val: string) => {
    setQuery(val);
    clearTimeout(suggestTimer.current);
    if (val.length >= 2) {
      suggestTimer.current = setTimeout(() => fetchSuggestions(val), 250);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [fetchSuggestions]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }

    setIsSearching(true);
    addToHistory(q);
    setHistory(getSearchHistory());

    const allResults: SearchResult[] = [];

    try {
      // Search gemara pages
      const { data: gemaraPages } = await supabase
        .from("gemara_pages")
        .select("sugya_id, title, daf_yomi, masechet")
        .or(`title.ilike.%${q}%,daf_yomi.ilike.%${q}%`)
        .limit(15);

      if (gemaraPages) {
        for (const p of gemaraPages as any[]) {
          allResults.push({
            id: p.sugya_id,
            type: "gemara",
            title: p.title || p.daf_yomi,
            snippet: p.daf_yomi,
            meta: `${p.masechet} • ${p.daf_yomi}`,
          });
        }
      }

      // Search psakei din - use full-text search for speed
      const ftsQuery = q.split(/\s+/).filter(Boolean).join(' & ');
      const { data: psakim } = await supabase
        .from("psakei_din")
        .select("id, title, summary, court, year")
        .or(`search_vector.fts.${ftsQuery},title.ilike.%${q}%`)
        .order("year", { ascending: false })
        .limit(15);

      if (psakim) {
        for (const p of psakim) {
          allResults.push({
            id: p.id,
            type: "psak",
            title: p.title,
            snippet: p.summary?.slice(0, 120) + (p.summary?.length > 120 ? "..." : ""),
            meta: `${p.court}${p.year ? ` • ${p.year}` : ''}`,
          });
        }
      }

      // Search modern examples
      const { data: examples } = await supabase
        .from("modern_examples")
        .select("id, sugya_id, masechet, daf_yomi, principle, practical_summary")
        .or(`principle.ilike.%${q}%,practical_summary.ilike.%${q}%,masechet.ilike.%${q}%`)
        .limit(10);

      if (examples) {
        for (const e of examples) {
          allResults.push({
            id: e.sugya_id || e.id,
            type: "modern",
            title: `המחשה: ${e.masechet} ${e.daf_yomi}`,
            snippet: e.principle?.slice(0, 120) || e.practical_summary?.slice(0, 120) || "",
            meta: `${e.masechet} • ${e.daf_yomi}`,
          });
        }
      }

      // Search personal notes (localStorage)
      const notes = getAllPersonalNotes();
      const qLower = q.toLowerCase();
      const matchedNotes = notes
        .filter((n) =>
          (n.content || "").toLowerCase().includes(qLower) ||
          (n.dafYomi || "").toLowerCase().includes(qLower)
        )
        .slice(0, 20);

      for (const n of matchedNotes) {
        allResults.push({
          id: n.sugyaId,
          type: "notes",
          title: `הערה אישית • ${n.dafYomi || "ללא דף"}`,
          snippet: (n.content || "").slice(0, 140) + ((n.content || "").length > 140 ? "..." : ""),
          meta: `עודכן: ${new Date(n.updatedAt || Date.now()).toLocaleDateString("he-IL")}`,
        });
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setResults(allResults);
      setIsSearching(false);
    }
  }, []);

  const filteredResults = useMemo(() => {
    if (activeType === "all") return results;
    return results.filter((r) => r.type === activeType);
  }, [results, activeType]);

  const counts = useMemo(() => ({
    all: results.length,
    gemara: results.filter((r) => r.type === "gemara").length,
    psak: results.filter((r) => r.type === "psak").length,
    modern: results.filter((r) => r.type === "modern").length,
    notes: results.filter((r) => r.type === "notes").length,
  }), [results]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const handleResultClick = (r: SearchResult) => {
    if (r.type === "gemara" || r.type === "modern" || r.type === "notes") {
      navigate(`/sugya/${r.id}`);
    }
    // For psak - could open dialog, for now stay on page
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "gemara": return <BookOpen className="h-3.5 w-3.5 text-blue-500" />;
      case "psak": return <Scale className="h-3.5 w-3.5 text-green-500" />;
      case "modern": return <FileText className="h-3.5 w-3.5 text-purple-500" />;
      case "notes": return <StickyNote className="h-3.5 w-3.5 text-amber-500" />;
      default: return null;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "gemara": return "גמרא";
      case "psak": return "פסק דין";
      case "modern": return "המחשה";
      case "notes": return "הערה אישית";
      default: return type;
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" />
        חיפוש גלובלי
      </h2>
      <p className="text-sm text-muted-foreground">חפש בגמרא, פסקי דין, המחשות מודרניות והערות אישיות במקום אחד</p>

      {/* Search bar */}
      <form onSubmit={handleSubmit}>
        <div className="relative flex gap-2">
          <div className="relative flex-1" ref={inputWrapperRef}>
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="הקלד מילת חיפוש..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              className="pr-9"
              autoComplete="off"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-1 top-0.5 h-8 w-8"
                onClick={() => { setQuery(""); setResults([]); setSuggestions([]); setShowSuggestions(false); }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQuery(s); setShowSuggestions(false); search(s); }}
                  >
                    {getSearchHistory().includes(s)
                      ? <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      : <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />}
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" disabled={isSearching || query.length < 2}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "חפש"}
          </Button>
        </div>
      </form>

      {/* Search history */}
      {query.length === 0 && history.length > 0 && results.length === 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">חיפושים אחרונים:</div>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 10).map((h) => (
              <Button key={h} variant="outline" size="sm" className="text-xs h-7" onClick={() => { setQuery(h); search(h); }}>
                {h}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Type filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "gemara", "psak", "modern", "notes"] as const).map((type) => (
              <Button
                key={type}
                variant={activeType === type ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setActiveType(type)}
              >
                {type === "all" ? "הכל" : typeLabel(type)}
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {counts[type]}
                </Badge>
              </Button>
            ))}
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {filteredResults.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleResultClick(r)}
                  className="w-full text-right p-3 rounded-lg border hover:bg-accent/30 transition-colors block"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {typeIcon(r.type)}
                    <span className="font-medium text-sm">{r.title}</span>
                    <Badge variant="outline" className="text-[10px]">{typeLabel(r.type)}</Badge>
                  </div>
                  {r.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</p>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">{r.meta}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      {query.length >= 2 && !isSearching && results.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">לא נמצאו תוצאות עבור "{query}"</p>
            <p className="text-xs mt-1">נסה מילות חיפוש אחרות</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
