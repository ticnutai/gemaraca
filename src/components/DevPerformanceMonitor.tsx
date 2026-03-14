import { useState, useEffect, useRef, useCallback } from "react";
import { X, Copy, Trash2, Zap, TrendingUp, TrendingDown, Minus, Play, BarChart3, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Types ---
interface PerfMetric {
  name: string;
  value: number;
  unit: string;
  rating: "good" | "needs-improvement" | "poor";
  description: string;
}

interface PerfSnapshot {
  id: number;
  timestamp: number;
  metrics: PerfMetric[];
  issues: string[];
  recommendations: string[];
  pageUrl: string;
  memoryMB?: number;
  networkRequests: number;
  domNodes: number;
  jsHeapMB?: number;
}

interface DevPerformanceMonitorProps {
  enabled: boolean;
}

const STORAGE_KEY = "dev-perf-snapshots";
let snapCounter = 0;

function persistSnapshots(snaps: PerfSnapshot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snaps.slice(-20)));
  } catch { /* ignore */ }
}

function loadSnapshots(): PerfSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function rateMetric(name: string, value: number): PerfMetric["rating"] {
  const thresholds: Record<string, [number, number]> = {
    FCP: [1800, 3000],
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    TTFB: [800, 1800],
    TBT: [200, 600],
    DOMContentLoaded: [1500, 3000],
    Load: [3000, 6000],
    "DOM Nodes": [800, 1500],
    "JS Heap (MB)": [50, 150],
    "Network Requests": [30, 80],
  };
  const t = thresholds[name];
  if (!t) return "good";
  return value <= t[0] ? "good" : value <= t[1] ? "needs-improvement" : "poor";
}

function getRecommendations(metrics: PerfMetric[], issues: string[]): string[] {
  const recs: string[] = [];
  const poor = metrics.filter(m => m.rating === "poor");
  const needsWork = metrics.filter(m => m.rating === "needs-improvement");

  for (const m of poor) {
    if (m.name === "LCP") recs.push("🔴 LCP גבוה — בדוק תמונות גדולות, font render-blocking, או קריאות API איטיות");
    if (m.name === "FCP") recs.push("🔴 FCP גבוה — בדוק CSS render-blocking, JavaScript חוסם, או זמני TTFB");
    if (m.name === "CLS") recs.push("🔴 CLS גבוה — תמונות ללא dimensions, fonts שמשנים layout, dynamic content injection");
    if (m.name === "TBT") recs.push("🔴 TBT גבוה — JavaScript כבד על ה-main thread, פצל קוד עם code splitting");
    if (m.name === "TTFB") recs.push("🔴 TTFB גבוה — בדוק שרת, CDN, או Edge Functions שאיטיים");
    if (m.name === "DOM Nodes") recs.push("🔴 יותר מדי DOM nodes — השתמש ב-virtualization או הסר אלמנטים מיותרים");
    if (m.name === "JS Heap (MB)") recs.push("🔴 שימוש יתר בזיכרון — בדוק memory leaks, listeners לא מנותקים");
  }
  for (const m of needsWork) {
    if (m.name === "LCP") recs.push("🟡 LCP בינוני — שקול lazy loading, preload לתמונות קריטיות");
    if (m.name === "FCP") recs.push("🟡 FCP בינוני — אופטימיזציה של critical rendering path");
    if (m.name === "Network Requests") recs.push("🟡 הרבה network requests — שקול bundle, cache, או deferred loading");
  }
  if (poor.length === 0 && needsWork.length === 0) {
    recs.push("✅ הביצועים נראים תקינים!");
  }
  return recs;
}

const DevPerformanceMonitor = ({ enabled }: DevPerformanceMonitorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<PerfSnapshot[]>(loadSnapshots);
  const [isRunning, setIsRunning] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [expandedSnap, setExpandedSnap] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dragging
  const [position, setPosition] = useState({ x: 72, y: typeof window !== "undefined" ? window.innerHeight - 80 : 600 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // FPS tracking
  const [currentFPS, setCurrentFPS] = useState<number | null>(null);
  const fpsFrames = useRef<number[]>([]);
  const fpsRaf = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let running = true;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (!running) return;
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0) {
        fpsFrames.current.push(1000 / delta);
        if (fpsFrames.current.length > 60) fpsFrames.current.shift();
        const avg = fpsFrames.current.reduce((a, b) => a + b, 0) / fpsFrames.current.length;
        setCurrentFPS(Math.round(avg));
      }
      fpsRaf.current = requestAnimationFrame(tick);
    };
    fpsRaf.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(fpsRaf.current); };
  }, [enabled]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 56, clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 56, clientY - dragOffset.current.y)),
      });
    };
    const handleUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);

  const runBenchmark = async () => {
    setIsRunning(true);
    // Give browser a moment to settle rendering
    await new Promise(r => setTimeout(r, 500));

    const metrics: PerfMetric[] = [];
    const issues: string[] = [];

    // Navigation timing
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = nav.responseStart - nav.requestStart;
      metrics.push({ name: "TTFB", value: Math.round(ttfb), unit: "ms", rating: rateMetric("TTFB", ttfb), description: "Time to First Byte" });

      const dcl = nav.domContentLoadedEventEnd - nav.startTime;
      metrics.push({ name: "DOMContentLoaded", value: Math.round(dcl), unit: "ms", rating: rateMetric("DOMContentLoaded", dcl), description: "DOM Content Loaded" });

      const loadTime = nav.loadEventEnd - nav.startTime;
      if (loadTime > 0) {
        metrics.push({ name: "Load", value: Math.round(loadTime), unit: "ms", rating: rateMetric("Load", loadTime), description: "Page Load Complete" });
      }
    }

    // Paint timing
    const paintEntries = performance.getEntriesByType("paint");
    const fcp = paintEntries.find(e => e.name === "first-contentful-paint");
    if (fcp) {
      metrics.push({ name: "FCP", value: Math.round(fcp.startTime), unit: "ms", rating: rateMetric("FCP", fcp.startTime), description: "First Contentful Paint" });
    }

    // LCP via PerformanceObserver (already captured)
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as any[];
    if (lcpEntries.length > 0) {
      const lcp = lcpEntries[lcpEntries.length - 1];
      metrics.push({ name: "LCP", value: Math.round(lcp.startTime), unit: "ms", rating: rateMetric("LCP", lcp.startTime), description: "Largest Contentful Paint" });
    }

    // Long tasks = TBT approximation
    const longTasks = performance.getEntriesByType("longtask") as PerformanceEntry[];
    const tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
    metrics.push({ name: "TBT", value: Math.round(tbt), unit: "ms", rating: rateMetric("TBT", tbt), description: "Total Blocking Time (approx)" });

    // Layout Shift (CLS)
    const lsEntries = performance.getEntriesByType("layout-shift") as any[];
    const cls = lsEntries
      .filter(e => !e.hadRecentInput)
      .reduce((sum, e) => sum + e.value, 0);
    metrics.push({ name: "CLS", value: Math.round(cls * 1000) / 1000, unit: "", rating: rateMetric("CLS", cls), description: "Cumulative Layout Shift" });

    // DOM nodes
    const domNodes = document.querySelectorAll("*").length;
    metrics.push({ name: "DOM Nodes", value: domNodes, unit: "", rating: rateMetric("DOM Nodes", domNodes), description: "Total DOM elements" });

    // Memory
    const mem = (performance as any).memory;
    if (mem) {
      const heapMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
      metrics.push({ name: "JS Heap (MB)", value: heapMB, unit: "MB", rating: rateMetric("JS Heap (MB)", heapMB), description: "JavaScript Heap Usage" });
    }

    // Network requests count
    const resourceEntries = performance.getEntriesByType("resource");
    metrics.push({ name: "Network Requests", value: resourceEntries.length, unit: "", rating: rateMetric("Network Requests", resourceEntries.length), description: "Total resource requests" });

    // FPS
    if (currentFPS !== null) {
      metrics.push({
        name: "FPS",
        value: currentFPS,
        unit: "fps",
        rating: currentFPS >= 55 ? "good" : currentFPS >= 30 ? "needs-improvement" : "poor",
        description: "Current frame rate",
      });
      if (currentFPS < 30) issues.push("🔴 FPS נמוך מ-30 — ייתכן שיש אנימציות כבדות או rendering loop");
    }

    // Detect slow resources
    const slowResources = resourceEntries.filter((r: any) => r.duration > 2000);
    if (slowResources.length > 0) {
      issues.push(`⏱️ ${slowResources.length} משאבים שנטענו יותר מ-2 שניות`);
      slowResources.slice(0, 3).forEach((r: any) => {
        const name = r.name.split("/").pop()?.substring(0, 40) || r.name;
        issues.push(`  → ${name}: ${Math.round(r.duration)}ms`);
      });
    }

    // Check for blocking spinner indicators
    const spinners = document.querySelectorAll('[class*="spin"], [class*="loading"], [class*="skeleton"]');
    if (spinners.length > 3) {
      issues.push(`⏳ ${spinners.length} אלמנטי טעינה/spinner פעילים — ייתכן שהדף עדיין בטעינה`);
    }

    const recommendations = getRecommendations(metrics, issues);

    const snapshot: PerfSnapshot = {
      id: ++snapCounter,
      timestamp: Date.now(),
      metrics,
      issues,
      recommendations,
      pageUrl: window.location.pathname,
      memoryMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : undefined,
      networkRequests: resourceEntries.length,
      domNodes,
      jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : undefined,
    };

    setSnapshots(prev => {
      const updated = [...prev, snapshot];
      persistSnapshots(updated);
      return updated;
    });
    setExpandedSnap(snapshot.id);
    setIsRunning(false);
  };

  const clearSnapshots = () => {
    setSnapshots([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const copyReport = async () => {
    if (snapshots.length === 0) return;
    const latest = snapshots[snapshots.length - 1];
    let text = `=== Performance Report — ${new Date(latest.timestamp).toLocaleString("he-IL")} ===\n`;
    text += `URL: ${latest.pageUrl}\n\n`;
    text += "📊 Metrics:\n";
    latest.metrics.forEach(m => {
      const icon = m.rating === "good" ? "✅" : m.rating === "needs-improvement" ? "🟡" : "🔴";
      text += `${icon} ${m.name}: ${m.value}${m.unit} (${m.description})\n`;
    });
    if (latest.issues.length > 0) {
      text += "\n⚠️ Issues:\n" + latest.issues.join("\n") + "\n";
    }
    text += "\n💡 Recommendations:\n" + latest.recommendations.join("\n") + "\n";

    if (snapshots.length >= 2) {
      const prev = snapshots[snapshots.length - 2];
      text += `\n📈 Comparison with previous (${new Date(prev.timestamp).toLocaleString("he-IL")}):\n`;
      latest.metrics.forEach(m => {
        const prevM = prev.metrics.find(p => p.name === m.name);
        if (prevM) {
          const diff = m.value - prevM.value;
          const icon = diff < 0 ? "⬇️" : diff > 0 ? "⬆️" : "➡️";
          text += `${icon} ${m.name}: ${prevM.value} → ${m.value} (${diff > 0 ? "+" : ""}${diff}${m.unit})\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch { /* clipboard not available */ }
  };

  if (!enabled) return null;

  const ratingColor = (r: PerfMetric["rating"]) =>
    r === "good" ? "text-green-400" : r === "needs-improvement" ? "text-yellow-400" : "text-red-400";

  const ratingBg = (r: PerfMetric["rating"]) =>
    r === "good" ? "bg-green-500/10" : r === "needs-improvement" ? "bg-yellow-500/10" : "bg-red-500/10";

  // Compare last two snapshots
  const getComparison = () => {
    if (snapshots.length < 2) return null;
    const latest = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2];
    return latest.metrics.map(m => {
      const prevM = prev.metrics.find(p => p.name === m.name);
      if (!prevM) return null;
      const diff = m.value - prevM.value;
      // For most metrics, lower is better (except FPS)
      const improved = m.name === "FPS" ? diff > 0 : diff < 0;
      return { name: m.name, prev: prevM.value, current: m.value, diff, improved, unit: m.unit };
    }).filter(Boolean);
  };

  return (
    <>
      {/* Floating draggable button */}
      <div
        className="fixed z-[9999] select-none"
        style={{ left: position.x, top: position.y }}
      >
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={() => { if (!isDragging.current) setIsOpen(prev => !prev); }}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-colors",
            "bg-emerald-700 text-white"
          )}
          title="Performance Monitor"
        >
          <Zap className="h-5 w-5" />
          {currentFPS !== null && (
            <span className={cn(
              "absolute -top-1 -right-1 text-[10px] font-bold rounded-full min-w-[24px] h-[18px] flex items-center justify-center px-1",
              currentFPS >= 55 ? "bg-green-500 text-white" : currentFPS >= 30 ? "bg-yellow-500 text-black" : "bg-red-500 text-white"
            )}>
              {currentFPS}
            </span>
          )}
        </div>
      </div>

      {/* Dialog panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[9998] pointer-events-none">
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[75vh] bg-slate-900 text-slate-100 border-t border-slate-700 shadow-2xl pointer-events-auto flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-sm">Performance Monitor</span>
                {currentFPS !== null && (
                  <span className={cn("text-xs font-mono", currentFPS >= 55 ? "text-green-400" : currentFPS >= 30 ? "text-yellow-400" : "text-red-400")}>
                    {currentFPS} FPS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-300 hover:text-white hover:bg-slate-700 gap-1"
                  onClick={runBenchmark}
                  disabled={isRunning}
                >
                  {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  {isRunning ? "בודק..." : "הרץ בדיקה"}
                </Button>
                {snapshots.length >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 text-xs gap-1", compareMode ? "bg-slate-600 text-white" : "text-slate-300 hover:text-white hover:bg-slate-700")}
                    onClick={() => setCompareMode(!compareMode)}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    השוואה
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={copyReport} title="העתק דוח">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={clearSnapshots} title="נקה">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={() => setIsOpen(false)} title="סגור (Esc)">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
              {/* Compare mode */}
              {compareMode && snapshots.length >= 2 && (
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-400" />
                    השוואה: בדיקה אחרונה vs קודמת
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getComparison()?.map((c: any) => (
                      <div key={c.name} className={cn("rounded p-2 text-xs", c.improved ? "bg-green-500/10" : c.diff === 0 ? "bg-slate-700/50" : "bg-red-500/10")}>
                        <div className="text-slate-400 text-[10px]">{c.name}</div>
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-slate-500">{c.prev}</span>
                          <span className="text-slate-500">→</span>
                          <span className={c.improved ? "text-green-400" : c.diff === 0 ? "text-slate-300" : "text-red-400"}>
                            {c.current}{c.unit}
                          </span>
                          {c.improved ? <TrendingDown className="h-3 w-3 text-green-400" /> : c.diff === 0 ? <Minus className="h-3 w-3 text-slate-400" /> : <TrendingUp className="h-3 w-3 text-red-400" />}
                        </div>
                        <div className={cn("text-[10px]", c.improved ? "text-green-400" : c.diff === 0 ? "text-slate-400" : "text-red-400")}>
                          {c.diff > 0 ? "+" : ""}{c.diff}{c.unit} {c.improved ? "(שיפור)" : c.diff === 0 ? "(ללא שינוי)" : "(הרעה)"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Snapshots */}
              {snapshots.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">
                  לחץ "הרץ בדיקה" לביצוע בדיקת ביצועים מקיפה
                </div>
              ) : (
                [...snapshots].reverse().map((snap) => (
                  <div key={snap.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    {/* Snap header */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 transition-colors"
                      onClick={() => setExpandedSnap(expandedSnap === snap.id ? null : snap.id)}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-medium">{new Date(snap.timestamp).toLocaleTimeString("he-IL")}</span>
                        <span className="text-xs text-slate-400">{snap.pageUrl}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick summary pills */}
                        {snap.metrics.slice(0, 3).map(m => (
                          <span key={m.name} className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", ratingBg(m.rating), ratingColor(m.rating))}>
                            {m.name}: {m.value}{m.unit}
                          </span>
                        ))}
                        {expandedSnap === snap.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expandedSnap === snap.id && (
                      <div className="px-3 pb-3 space-y-3 border-t border-slate-700">
                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                          {snap.metrics.map(m => (
                            <div key={m.name} className={cn("rounded p-2 text-xs border border-slate-700", ratingBg(m.rating))}>
                              <div className="text-slate-400 text-[10px]">{m.name}</div>
                              <div className={cn("text-lg font-bold font-mono", ratingColor(m.rating))}>
                                {m.value}<span className="text-[10px] text-slate-400 mr-0.5">{m.unit}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">{m.description}</div>
                            </div>
                          ))}
                        </div>

                        {/* Issues */}
                        {snap.issues.length > 0 && (
                          <div className="bg-red-500/5 rounded p-2 border border-red-500/20">
                            <div className="text-xs font-bold text-red-400 mb-1">⚠️ בעיות שזוהו:</div>
                            {snap.issues.map((issue, i) => (
                              <div key={i} className="text-[11px] text-slate-300 py-0.5">{issue}</div>
                            ))}
                          </div>
                        )}

                        {/* Recommendations */}
                        <div className="bg-emerald-500/5 rounded p-2 border border-emerald-500/20">
                          <div className="text-xs font-bold text-emerald-400 mb-1">💡 המלצות:</div>
                          {snap.recommendations.map((rec, i) => (
                            <div key={i} className="text-[11px] text-slate-300 py-0.5">{rec}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DevPerformanceMonitor;
