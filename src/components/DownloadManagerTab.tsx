import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadController, DownloadFormat } from "@/hooks/useDownloadController";
import { useDownloadStore } from "@/stores/downloadStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  FileCode,
  FileType,
  File,
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courtFilter, setCourt] = useState<string>("all");
  const [yearFilter, setYear] = useState<string>("all");
  const [courts, setCourts] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [downloadCount, setDownloadCount] = useState<string>("all");
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("html");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { startDownload } = useDownloadController();
  const activeSession = useDownloadStore((s) => s.getActiveSession());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setItems([]);
      setHasMore(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset on filter change
  useEffect(() => {
    setItems([]);
    setHasMore(true);
  }, [courtFilter, yearFilter]);

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

  const loadItems = useCallback(async (offset: number, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

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

      const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const newData = data || [];
      setTotalCount(count || 0);
      setHasMore(newData.length === PAGE_SIZE);

      if (isInitial) {
        setItems(newData);
      } else {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const unique = newData.filter(i => !existingIds.has(i.id));
          return [...prev, ...unique];
        });
      }
    } catch (err) {
      console.error("Error loading items:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, courtFilter, yearFilter]);

  // Initial load
  useEffect(() => {
    loadItems(0, true);
  }, [loadItems]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadItems(items.length, false);
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, items.length, loadItems]);

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

  const handleDownload = useCallback(
    async () => {
      let selected = items.filter((i) => selectedIds.has(i.id));
      if (selected.length === 0) return;

      if (downloadCount !== "all") {
        const limit = parseInt(downloadCount);
        if (!isNaN(limit) && limit > 0) {
          selected = selected.slice(0, limit);
        }
      }

      await startDownload(selected, downloadFormat);
    },
    [items, selectedIds, startDownload, downloadCount, downloadFormat]
  );

  const allLoaded = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  const effectiveDownloadCount = downloadCount === "all"
    ? selectedIds.size
    : Math.min(parseInt(downloadCount) || selectedIds.size, selectedIds.size);

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

        <Select value={courtFilter} onValueChange={(v) => { setCourt(v); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="בית דין" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל בתי הדין</SelectItem>
            {courts.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={(v) => { setYear(v); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="שנה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השנים</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
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
            onClick={allLoaded ? deselectAll : selectAll}
          >
            {allLoaded ? (
              <Square className="w-4 h-4 ml-1" />
            ) : (
              <CheckSquare className="w-4 h-4 ml-1" />
            )}
            {allLoaded ? "בטל הכל" : `בחר הכל (${items.length})`}
          </Button>
          {selectedIds.size > 0 && (
            <Badge variant="default">
              {selectedIds.size.toLocaleString()} נבחרו
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={downloadCount} onValueChange={setDownloadCount}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="כמות להורדה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל ({selectedIds.size})</SelectItem>
              <SelectItem value="10">10 פסקים</SelectItem>
              <SelectItem value="25">25 פסקים</SelectItem>
              <SelectItem value="50">50 פסקים</SelectItem>
              <SelectItem value="100">100 פסקים</SelectItem>
              <SelectItem value="200">200 פסקים</SelectItem>
              <SelectItem value="500">500 פסקים</SelectItem>
            </SelectContent>
          </Select>

          <Select value={downloadFormat} onValueChange={(v) => setDownloadFormat(v as DownloadFormat)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="פורמט" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="html">
                <span className="flex items-center gap-1"><FileCode className="w-3 h-3" /> HTML</span>
              </SelectItem>
              <SelectItem value="pdf">
                <span className="flex items-center gap-1"><FileType className="w-3 h-3" /> PDF</span>
              </SelectItem>
              <SelectItem value="docx">
                <span className="flex items-center gap-1"><File className="w-3 h-3" /> Word</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => handleDownload()}
            disabled={selectedIds.size === 0 || !!activeSession}
            className="gap-2"
          >
            {activeSession ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            הורד כ-ZIP ({effectiveDownloadCount})
          </Button>
        </div>
      </div>

      {/* Items list - infinite scroll */}
      {loading ? (
        <div className="space-y-2 py-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border-b">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-8 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="h-[500px] overflow-y-auto border rounded-lg"
        >
          <div className="divide-y divide-border">
            {items.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              const itemNumber = index + 1;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                    isSelected && "bg-primary/5 border-r-2 border-r-primary"
                  )}
                  onClick={() => toggleSelect(item.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                  />
                  <span className="text-xs font-mono text-muted-foreground w-8 text-center shrink-0">
                    {itemNumber}
                  </span>
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

            {/* Sentinel for infinite scroll */}
            {hasMore && (
              <div ref={sentinelRef} className="p-4 flex justify-center">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">טוען עוד...</span>
                  </div>
                )}
              </div>
            )}

            {items.length === 0 && (
              <div className="p-12 text-center">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">לא נמצאו פסקי דין</p>
                <p className="text-sm text-muted-foreground mt-1">נסה לשנות את הסינון או את מילות החיפוש</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loaded count */}
      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          מוצגים {items.length.toLocaleString()} מתוך {totalCount.toLocaleString()} פסקי דין
        </p>
      )}
    </div>
  );
};

export default DownloadManagerTab;
