import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, X, Play, Square, Zap, GripVertical, Timer, MousePointerClick } from "lucide-react";
import { useFloatingPanel, ResizeHandles } from "@/hooks/useFloatingPanel";

/* ── Types ── */
interface PerfMetric {
  name: string;
  value: number;
  unit: string;
  rating: "good" | "needs-improvement" | "poor";
}

interface TabTiming {
  tabId: string;
  tabLabel: string;
  enterTime: number;
  renderMs: number | null;
  clickCount: number;
  totalTimeMs: number | null;
}

/* ── Constants ── */
const TAB_LABELS: Record<string, string> = {
  gemara: "גמרא",
  "psak-din": "פסקי דין",
  "smart-index": "אינדקס חכם",
  "advanced-index": "אינדקס מתקדם",
  search: "חיפוש",
  upload: "העלאה",
  download: "הורדות",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} מ"ש`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} שנ'`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} דק' ${s} שנ'`;
}

function ratingColor(avg: number): string {
  if (avg < 300) return "text-green-400";
  if (avg < 1000) return "text-yellow-400";
  return "text-red-400";
}

/* ── Component ── */
export default function DevPerformanceMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const [fps, setFps] = useState(0);
  const [activeView, setActiveView] = useState<"benchmark" | "tabs">("benchmark");

  /* ── Tab Timing state ── */
  const [tabTimings, setTabTimings] = useState<TabTiming[]>([]);
  const currentTabRef = useRef<{ tabId: string; enterTime: number; clicks: number } | null>(null);
  const clickCounterRef = useRef(0);

  /* ── FAB drag (separate from panel) ── */
  const [fabPos, setFabPos] = useState({ x: 16, y: typeof window !== "undefined" ? window.innerHeight - 210 : 400 });
  const [isFabDragging, setIsFabDragging] = useState(false);
  const fabDragOffset = useRef({ x: 0, y: 0 });
  const fabRef = useRef<HTMLButtonElement>(null);

  /* ── Panel drag + resize ── */
  const { geo, onDragStart: onPanelDragStart, onResizeStart } = useFloatingPanel("perf", {
    x: typeof window !== "undefined" ? window.innerWidth - 660 : 200,
    y: typeof window !== "undefined" ? window.innerHeight - 480 : 200,
    width: 640,
    height: 440,
  });

  /* ── FPS counter ── */
  const frameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animRef = useRef<number>();

  const measureFps = useCallback(() => {
    frameRef.current++;
    const now = performance.now();
    if (now - lastTimeRef.current >= 1000) {
      setFps(frameRef.current);
      frameRef.current = 0;
      lastTimeRef.current = now;
    }
    animRef.current = requestAnimationFrame(measureFps);
  }, []);

  useEffect(() => {
    if (isOpen) {
      animRef.current = requestAnimationFrame(measureFps);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isOpen, measureFps]);

  /* ── Benchmark ── */
  const runBenchmark = useCallback(() => {
    setIsRunning(true);
    const results: PerfMetric[] = [];

    // DOM complexity
    const domNodes = document.querySelectorAll("*").length;
    results.push({
      name: "צמתי DOM",
      value: domNodes,
      unit: "צמתים",
      rating: domNodes < 1000 ? "good" : domNodes < 2500 ? "needs-improvement" : "poor",
    });

    // Memory
    if ((performance as any).memory) {
      const mem = (performance as any).memory;
      const mb = Math.round(mem.usedJSHeapSize / 1048576);
      results.push({
        name: "זיכרון JS",
        value: mb,
        unit: "MB",
        rating: mb < 50 ? "good" : mb < 150 ? "needs-improvement" : "poor",
      });
    }

    // Navigation timing
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      const load = Math.round(nav.loadEventEnd - nav.startTime);
      results.push({
        name: "טעינת דף",
        value: load,
        unit: "ms",
        rating: load < 2000 ? "good" : load < 4000 ? "needs-improvement" : "poor",
      });
      const ttfb = Math.round(nav.responseStart - nav.requestStart);
      results.push({
        name: "TTFB",
        value: ttfb,
        unit: "ms",
        rating: ttfb < 200 ? "good" : ttfb < 500 ? "needs-improvement" : "poor",
      });
    }

    // Layout thrashing test
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      document.body.offsetHeight;
    }
    const layoutTime = Math.round((performance.now() - start) * 100) / 100;
    results.push({
      name: "עלות Layout",
      value: layoutTime,
      unit: "ms",
      rating: layoutTime < 5 ? "good" : layoutTime < 15 ? "needs-improvement" : "poor",
    });

    // Event listeners estimate
    const scripts = document.querySelectorAll("script").length;
    results.push({
      name: "סקריפטים",
      value: scripts,
      unit: "קבצים",
      rating: scripts < 10 ? "good" : scripts < 25 ? "needs-improvement" : "poor",
    });

    // FPS
    results.push({
      name: "FPS נוכחי",
      value: fps,
      unit: "fps",
      rating: fps >= 55 ? "good" : fps >= 30 ? "needs-improvement" : "poor",
    });

    setMetrics(results);
    setIsRunning(false);
  }, [fps]);

  /* ── Tab timing tracker ── */
  useEffect(() => {
    if (!isOpen) return;

    const flushCurrent = () => {
      const cur = currentTabRef.current;
      if (!cur) return;
      const now = Date.now();
      setTabTimings((prev) => [
        {
          tabId: cur.tabId,
          tabLabel: TAB_LABELS[cur.tabId] || cur.tabId,
          enterTime: cur.enterTime,
          renderMs: null,
          clickCount: cur.clicks,
          totalTimeMs: now - cur.enterTime,
        },
        ...prev,
      ].slice(0, 200));
      currentTabRef.current = null;
    };

    const handleTabChange = (tabId: string) => {
      flushCurrent();
      clickCounterRef.current = 0;
      currentTabRef.current = { tabId, enterTime: Date.now(), clicks: 0 };
    };

    // Observe data-active-tab attribute on any element
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-active-tab") {
          const el = m.target as HTMLElement;
          const newTab = el.getAttribute("data-active-tab");
          if (newTab && newTab !== currentTabRef.current?.tabId) {
            handleTabChange(newTab);
          }
        }
      }
    });

    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-active-tab"] });

    // Track clicks inside the app
    const clickHandler = () => {
      if (currentTabRef.current) currentTabRef.current.clicks++;
    };
    document.addEventListener("click", clickHandler, true);

    // Initialize with current tab
    const existing = document.querySelector("[data-active-tab]");
    if (existing) {
      const tab = existing.getAttribute("data-active-tab");
      if (tab) handleTabChange(tab);
    }

    return () => {
      observer.disconnect();
      document.removeEventListener("click", clickHandler, true);
      flushCurrent();
    };
  }, [isOpen]);

  /* ── Tab aggregates ── */
  const tabAggregates = useMemo(() => {
    const map = new Map<string, { label: string; visits: number; totalMs: number; totalClicks: number; maxMs: number }>();
    for (const t of tabTimings) {
      const ms = t.totalTimeMs ?? 0;
      const existing = map.get(t.tabId);
      if (existing) {
        existing.visits++;
        existing.totalMs += ms;
        existing.totalClicks += t.clickCount;
        if (ms > existing.maxMs) existing.maxMs = ms;
      } else {
        map.set(t.tabId, { label: t.tabLabel, visits: 1, totalMs: ms, totalClicks: t.clickCount, maxMs: ms });
      }
    }
    return Array.from(map.entries()).map(([id, d]) => ({
      tabId: id,
      ...d,
      avgMs: d.visits ? d.totalMs / d.visits : 0,
    })).sort((a, b) => b.totalMs - a.totalMs);
  }, [tabTimings]);

  /* ── FAB Drag handlers ── */
  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsFabDragging(true);
    fabDragOffset.current = { x: e.clientX - fabPos.x, y: e.clientY - fabPos.y };
  }, [fabPos]);

  useEffect(() => {
    if (!isFabDragging) return;
    const onMove = (e: MouseEvent) => {
      setFabPos({ x: e.clientX - fabDragOffset.current.x, y: e.clientY - fabDragOffset.current.y });
    };
    const onUp = () => setIsFabDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isFabDragging]);

  /* ── Rating helpers ── */
  const getRatingEmoji = (r: string) => r === "good" ? "🟢" : r === "needs-improvement" ? "🟡" : "🔴";
  const getRatingBg = (r: string) => r === "good" ? "bg-green-900/30 border-green-700" : r === "needs-improvement" ? "bg-yellow-900/30 border-yellow-700" : "bg-red-900/30 border-red-700";

  /* ── Render ── */
  return (
    <>
      {/* FAB */}
      <Button
        ref={fabRef}
        variant="outline"
        size="icon"
        className="fixed z-[9999] h-10 w-10 rounded-full bg-purple-900/90 border-purple-500 text-purple-300 hover:bg-purple-800 shadow-lg select-none"
        style={{ left: fabPos.x, top: fabPos.y, cursor: isFabDragging ? "grabbing" : "grab" }}
        onMouseDown={handleFabMouseDown}
        onClick={() => { if (!isFabDragging) setIsOpen((v) => !v); }}
        title="מוניטור ביצועים"
      >
        <Activity className="h-4 w-4" />
      </Button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed z-[9998] flex flex-col rounded-lg border border-purple-700 bg-gray-950/95 text-white shadow-2xl backdrop-blur-sm select-none"
          style={{ left: geo.x, top: geo.y, width: geo.width, height: geo.height }}
        >
          <ResizeHandles onResizeStart={onResizeStart} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-purple-800 bg-purple-900/40 rounded-t-lg cursor-grab shrink-0"
            onMouseDown={onPanelDragStart}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-purple-400" />
              <Activity className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-bold text-purple-200">מוניטור ביצועים</span>
              <Badge variant="outline" className="text-xs border-purple-600 text-purple-300">
                {fps} FPS
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-400 hover:text-white" onClick={() => setIsOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* View Tabs */}
          <div className="flex border-b border-purple-800 shrink-0">
            <button
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${activeView === "benchmark" ? "bg-purple-800/40 text-purple-200 border-b-2 border-purple-400" : "text-purple-400 hover:text-purple-200"}`}
              onClick={() => setActiveView("benchmark")}
            >
              <Zap className="inline h-3 w-3 ml-1" />
              ביצועים
            </button>
            <button
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${activeView === "tabs" ? "bg-purple-800/40 text-purple-200 border-b-2 border-purple-400" : "text-purple-400 hover:text-purple-200"}`}
              onClick={() => setActiveView("tabs")}
            >
              <Timer className="inline h-3 w-3 ml-1" />
              תזמון טאבים
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3" dir="rtl">
            {activeView === "benchmark" && (
              <div className="space-y-3">
                <Button
                  size="sm"
                  onClick={runBenchmark}
                  disabled={isRunning}
                  className="w-full bg-purple-700 hover:bg-purple-600 text-white"
                >
                  {isRunning ? (
                    <><Square className="h-3 w-3 ml-1" /> מריץ...</>
                  ) : (
                    <><Play className="h-3 w-3 ml-1" /> הרץ בדיקת ביצועים</>
                  )}
                </Button>

                {metrics.length > 0 && (
                  <div className="space-y-2">
                    {metrics.map((m, i) => (
                      <div key={i} className={`p-2 rounded border ${getRatingBg(m.rating)}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">{m.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-white">{m.value.toLocaleString()}</span>
                            <span className="text-xs text-gray-400">{m.unit}</span>
                            <span className="text-xs">{getRatingEmoji(m.rating)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="p-2 rounded border border-purple-700 bg-purple-900/20">
                      <div className="text-xs text-purple-300 mb-1">ציון כללי</div>
                      <div className="flex gap-1">
                        {["good", "needs-improvement", "poor"].map((r) => {
                          const count = metrics.filter((m) => m.rating === r).length;
                          return (
                            <Badge key={r} variant="outline" className="text-xs border-purple-600">
                              {getRatingEmoji(r)} {count}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeView === "tabs" && (
              <div className="space-y-3">
                {/* Aggregates */}
                {tabAggregates.length > 0 ? (
                  <>
                    <div className="text-xs text-purple-300 font-semibold">סיכום לפי טאב</div>
                    <div className="space-y-2">
                      {tabAggregates.map((a) => (
                        <div key={a.tabId} className="p-2 rounded border border-purple-700 bg-purple-900/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-purple-200">{a.label}</span>
                            <Badge variant="outline" className="text-xs border-purple-600 text-purple-300">
                              {a.visits} ביקורים
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400">
                            <span>ממוצע: <span className={`font-bold ${ratingColor(a.avgMs)}`}>{formatMs(a.avgMs)}</span></span>
                            <span>מקסימום: <span className="text-white">{formatMs(a.maxMs)}</span></span>
                            <span>סה"כ: <span className="text-white">{formatMs(a.totalMs)}</span></span>
                            <span className="flex items-center gap-0.5">
                              <MousePointerClick className="h-3 w-3" /> {a.totalClicks}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recent visits */}
                    <div className="text-xs text-purple-300 font-semibold mt-3">היסטוריית כניסות אחרונות</div>
                    <div className="space-y-1">
                      {tabTimings.slice(0, 30).map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-900/50 border border-gray-800">
                          <span className="text-purple-300 font-medium">{t.tabLabel}</span>
                          <div className="flex gap-2 text-gray-400">
                            <span>{t.totalTimeMs != null ? formatMs(t.totalTimeMs) : "—"}</span>
                            <span className="flex items-center gap-0.5"><MousePointerClick className="h-2.5 w-2.5" />{t.clickCount}</span>
                            <span className="text-gray-600">{new Date(t.enterTime).toLocaleTimeString("he-IL")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-purple-400 text-sm py-8">
                    <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>עבור בין טאבים כדי לראות נתוני תזמון</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
