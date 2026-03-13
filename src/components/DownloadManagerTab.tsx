import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadController } from "@/hooks/useDownloadController";
import { useDownloadStore } from "@/stores/downloadStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  CheckSquare,
  Square,
  FileText,
  Loader2,
  Package,
  Filter,
  ArrowDownToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PsakDinItem {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
}

const PAGE_SIZE = 50;

const DownloadManagerTab = () => {
  const [items, setItems] = useState<PsakDinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courtFilter, setCourt] = useState<string>("all");
  const [yearFilter, setYear] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [courts, setCourts] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const { startDownload } = useDownloadController();
  const activeSession = useDownloadStore((s) => s.getActiveSession());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load filter options once
  useEffect(() => {
    (async () => {
      const { data: courtData } = await supabase
        .from('psakei_din')
        .select('court')
        .order('court');
      if (courtData) {
        setCourts([...new Set(courtData.map(r => r.court).filter(Boolean))].sort());
      }
      const { data: yearData } = await supabase
        .from('psakei_din')
        .select('year')
        .order('year', { ascending: false });
      if (yearData) {
        setYears([...new Set(yearData.map(r => r.year).filter(Boolean))].sort((a, b) => b - a));
      }
    })();
  }, []);

  // Server-side filtered + paginated load
  useEffect(() => {
    loadPage();
  }, [page, debouncedSearch, courtFilter, yearFilter]);

  const loadPage = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("psakei_din")
        .select("id, title, court, year, summary", { count: "exact" })
        .order("year", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,court.ilike.%${debouncedSearch}%,summary.ilike.%${debouncedSearch}%`);
      }
      if (courtFilter !== "all") query = query.eq("court", courtFilter);
      if (yearFilter !== "all") query = query.eq("year", parseInt(yearFilter));

      const from = page * PAGE_SIZE;
      const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      setItems(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error loading items:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      return next;
    });
  }, [items]);

  const handleDownload = useCallback(
    async (format: "zip" | "html") => {
      const selected = items.filter((i) => selectedIds.has(i.id));
      if (selected.length === 0) return;
      await startDownload(selected, format);
    },
    [items, selectedIds, startDownload]
  );

  const allPageSelected =
    items.length > 0 && items.every((i) => selectedIds.has(i.id));

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">הורדת פסקי דין</h2>
          <Badge variant="secondary">{totalCount.toLocaleString()} פסקים</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי כותרת, בית דין..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>

        <Select value={courtFilter} onValueChange={(v) => { setCourt(v); setPage(0); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="בית דין" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל בתי הדין</SelectItem>
            {courts.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={(v) => { setYear(v); setPage(0); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="שנה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השנים</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selection controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-muted/30 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={allPageSelected ? deselectAll : selectAll}
          >
            {allPageSelected ? (
              <Square className="w-4 h-4 ml-1" />
            ) : (
              <CheckSquare className="w-4 h-4 ml-1" />
            )}
            {allPageSelected ? "בטל הכל" : `בחר עמוד (${items.length})`}
          </Button>
          {selectedIds.size > 0 && (
            <Badge variant="default">
              {selectedIds.size.toLocaleString()} נבחרו
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleDownload("zip")}
            disabled={selectedIds.size === 0 || !!activeSession}
            className="gap-2"
          >
            {activeSession ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            הורד כ-ZIP ({selectedIds.size})
          </Button>
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="space-y-2 py-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border-b">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="divide-y divide-border">
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.court} • {item.year}
                      </p>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="p-12 text-center">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">לא נמצאו פסקי דין</p>
                  <p className="text-sm text-muted-foreground mt-1">נסה לשנות את הסינון או את מילות החיפוש</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                הקודם
              </Button>
              <span className="text-sm text-muted-foreground">
                עמוד {page + 1} מתוך {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                הבא
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DownloadManagerTab;
