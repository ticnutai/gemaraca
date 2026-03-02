import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadController } from "@/hooks/useDownloadController";
import { useDownloadStore } from "@/stores/downloadStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
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

const PAGE_SIZE = 100;

const DownloadManagerTab = () => {
  const [items, setItems] = useState<PsakDinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [courtFilter, setCourt] = useState<string>("all");
  const [yearFilter, setYear] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { startDownload } = useDownloadController();
  const activeSession = useDownloadStore((s) => s.getActiveSession());

  // Load all items with pagination
  useEffect(() => {
    loadAllItems();
  }, []);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      let allItems: PsakDinItem[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("psakei_din")
          .select("id, title, court, year, summary")
          .order("year", { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allItems = [...allItems, ...data];
        if (data.length < batchSize) break;
        from += batchSize;
      }

      setItems(allItems);
      setTotalCount(allItems.length);
    } catch (err) {
      console.error("Error loading items:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique courts and years for filters
  const courts = useMemo(
    () => [...new Set(items.map((i) => i.court))].sort(),
    [items]
  );
  const years = useMemo(
    () => [...new Set(items.map((i) => i.year))].sort((a, b) => b - a),
    [items]
  );

  // Filtered items
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !item.title.toLowerCase().includes(q) &&
          !item.court.toLowerCase().includes(q) &&
          !item.summary?.toLowerCase().includes(q)
        )
          return false;
      }
      if (courtFilter !== "all" && item.court !== courtFilter) return false;
      if (yearFilter !== "all" && item.year !== parseInt(yearFilter)) return false;
      return true;
    });
  }, [items, searchQuery, courtFilter, yearFilter]);

  // Paginated view
  const paginatedItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((i) => i.id)));
  }, [filtered]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedItems.forEach((i) => next.add(i.id));
      return next;
    });
  }, [paginatedItems]);

  const handleDownload = useCallback(
    async (format: "zip" | "html") => {
      const selected = items.filter((i) => selectedIds.has(i.id));
      if (selected.length === 0) return;
      await startDownload(selected, format);
    },
    [items, selectedIds, startDownload]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="pr-9"
          />
        </div>

        <Select value={courtFilter} onValueChange={(v) => { setCourt(v); setPage(0); }}>
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

        <Select value={yearFilter} onValueChange={(v) => { setYear(v); setPage(0); }}>
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
            onClick={allFilteredSelected ? deselectAll : selectAll}
          >
            {allFilteredSelected ? (
              <Square className="w-4 h-4 ml-1" />
            ) : (
              <CheckSquare className="w-4 h-4 ml-1" />
            )}
            {allFilteredSelected ? "בטל הכל" : `בחר הכל (${filtered.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={selectVisible}>
            בחר עמוד נוכחי
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">טוען פסקי דין...</span>
        </div>
      ) : (
        <>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="divide-y divide-border">
              {paginatedItems.map((item) => {
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
              {paginatedItems.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  לא נמצאו פסקי דין
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
