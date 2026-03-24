import { useState, useEffect, useRef, useCallback } from "react";
import { X, Copy, Trash2, AlertTriangle, AlertCircle, Info, Bug, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFloatingPanel, ResizeHandles } from "@/hooks/useFloatingPanel";

export interface ConsoleEntry {
  id: number;
  type: "error" | "warn" | "info" | "unhandled" | "render";
  message: string;
  stack?: string;
  timestamp: number;
  source?: string;
  count: number;
}

interface DevConsoleMonitorProps {
  enabled?: boolean;
}

// Persistent storage key
const STORAGE_KEY = "dev-console-logs";
let entryCounter = 0;

// Save to localStorage — survives page refresh
function persistLogs(logs: ConsoleEntry[]) {
  try {
    const trimmed = logs.slice(-500); // Keep last 500
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* storage full — ignore */ }
}

function loadPersistedLogs(): ConsoleEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const DevConsoleMonitor = ({ enabled }: DevConsoleMonitorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ConsoleEntry[]>(loadPersistedLogs);
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "info">("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<ConsoleEntry[]>(logs);

  // FAB dragging state
  const [fabPos, setFabPos] = useState({ x: 16, y: window.innerHeight - 80 });
  const isFabDragging = useRef(false);
  const fabDragOffset = useRef({ x: 0, y: 0 });

  // Floating panel
  const { geo, onDragStart: onPanelDragStart, onResizeStart } = useFloatingPanel("console", {
    x: 16, y: Math.max(100, window.innerHeight - 450), width: 600, height: 400,
  });

  // Keep ref in sync
  useEffect(() => { logsRef.current = logs; }, [logs]);

  const addEntry = useCallback((entry: Omit<ConsoleEntry, "id" | "count">) => {
    setLogs(prev => {
      // Deduplicate same message within last 2s
      const lastSimilar = [...prev].reverse().find(e => e.message === entry.message && (entry.timestamp - e.timestamp) < 2000);
      let updated: ConsoleEntry[];
      if (lastSimilar) {
        updated = prev.map(e => e === lastSimilar ? { ...e, count: e.count + 1, timestamp: entry.timestamp } : e);
      } else {
        updated = [...prev, { ...entry, id: ++entryCounter, count: 1 }];
      }
      persistLogs(updated);
      return updated;
    });
  }, []);

  // Intercept console + global errors
  useEffect(() => {
    if (!enabled) return;

    const origError = console.error;
    const origWarn = console.warn;

    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ");
      addEntry({ type: "error", message: msg, timestamp: Date.now(), source: "console.error" });
    };

    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" ");
      addEntry({ type: "warn", message: msg, timestamp: Date.now(), source: "console.warn" });
    };

    const handleError = (ev: ErrorEvent) => {
      addEntry({
        type: "unhandled",
        message: ev.message || "Unknown error",
        stack: ev.error?.stack,
        timestamp: Date.now(),
        source: `${ev.filename || "unknown"}:${ev.lineno}:${ev.colno}`,
      });
    };

    const handleUnhandledRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      addEntry({
        type: "unhandled",
        message: `Unhandled Promise: ${msg}`,
        stack,
        timestamp: Date.now(),
        source: "Promise rejection",
      });
    };

    // Detect long tasks (rendering issues, frozen UI)
    let perfObserver: PerformanceObserver | null = null;
    try {
      perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 100) {
            addEntry({
              type: "render",
              message: `Long Task detected: ${Math.round(entry.duration)}ms (> 100ms threshold)`,
              timestamp: Date.now(),
              source: "PerformanceObserver",
            });
          }
        }
      });
      perfObserver.observe({ entryTypes: ["longtask"] });
    } catch { /* not supported */ }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Add startup entry
    addEntry({ type: "info", message: "🔍 Console Monitor הופעל", timestamp: Date.now(), source: "DevConsoleMonitor" });

    return () => {
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      perfObserver?.disconnect();
    };
  }, [enabled, addEntry]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // FAB drag handlers
  const handleFabDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isFabDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    fabDragOffset.current = { x: clientX - fabPos.x, y: clientY - fabPos.y };
    e.preventDefault();
  }, [fabPos]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isFabDragging.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setFabPos({
        x: Math.max(0, Math.min(window.innerWidth - 56, clientX - fabDragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 56, clientY - fabDragOffset.current.y)),
      });
    };
    const handleUp = () => { isFabDragging.current = false; };

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

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const copyLogs = async () => {
    const text = filteredLogs.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString("he-IL");
      return `[${time}] [${e.type.toUpperCase()}]${e.count > 1 ? ` (x${e.count})` : ""} ${e.message}${e.stack ? `\n${e.stack}` : ""}`;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* clipboard not available */ }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!enabled) return null;

  const errorCount = logs.filter(l => l.type === "error" || l.type === "unhandled").length;
  const warnCount = logs.filter(l => l.type === "warn").length;

  const filteredLogs = filter === "all" ? logs : logs.filter(l => {
    if (filter === "error") return l.type === "error" || l.type === "unhandled" || l.type === "render";
    if (filter === "warn") return l.type === "warn";
    return l.type === "info";
  });

  const typeIcon = (type: ConsoleEntry["type"]) => {
    switch (type) {
      case "error": return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "unhandled": return <Bug className="h-3.5 w-3.5 text-red-600 shrink-0" />;
      case "warn": return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
      case "render": return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  const typeBg = (type: ConsoleEntry["type"]) => {
    switch (type) {
      case "error": case "unhandled": return "bg-red-500/10 border-red-500/20";
      case "warn": return "bg-yellow-500/10 border-yellow-500/20";
      case "render": return "bg-orange-500/10 border-orange-500/20";
      default: return "bg-blue-500/10 border-blue-500/20";
    }
  };

  return (
    <>
      {/* Floating draggable FAB button */}
      <div
        className="fixed z-[9999] select-none"
        style={{ left: fabPos.x, top: fabPos.y }}
      >
        <div
          onMouseDown={handleFabDragStart}
          onTouchStart={handleFabDragStart}
          onClick={() => { if (!isFabDragging.current) setIsOpen(prev => !prev); }}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-colors",
            errorCount > 0 ? "bg-red-600 text-white animate-pulse" : "bg-slate-700 text-slate-200"
          )}
          title="Console Monitor"
        >
          <Bug className="h-5 w-5" />
          {(errorCount + warnCount) > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {errorCount + warnCount}
            </span>
          )}
        </div>
      </div>

      {/* Floating resizable panel */}
      {isOpen && (
        <div
          className="fixed z-[9998] bg-slate-900 text-slate-100 border border-slate-700 rounded-lg shadow-2xl flex flex-col select-none"
          style={{ left: geo.x, top: geo.y, width: geo.width, height: geo.height }}
          dir="rtl"
        >
          <ResizeHandles onResizeStart={onResizeStart} />

            {/* Drag header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0 cursor-grab active:cursor-grabbing rounded-t-lg"
              onMouseDown={onPanelDragStart}
              onTouchStart={onPanelDragStart}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-slate-500" />
                <Bug className="h-4 w-4 text-red-400" />
                <span className="font-bold text-sm">Console Monitor</span>
                <span className="text-xs text-slate-400">({logs.length} רשומות)</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={copyLogs} title="העתק הכל">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={clearLogs} title="נקה">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-700" onClick={() => setIsOpen(false)} title="סגור (Esc)">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-700 bg-slate-800/50 shrink-0">
              {(["all", "error", "warn", "info"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    filter === f ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                  )}
                >
                  {f === "all" ? `הכל (${logs.length})` :
                   f === "error" ? `שגיאות (${errorCount})` :
                   f === "warn" ? `אזהרות (${warnCount})` :
                   `מידע (${logs.filter(l => l.type === "info").length})`}
                </button>
              ))}
            </div>

            {/* Logs list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-2 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">
                  {logs.length === 0 ? "אין רשומות עדיין — השגיאות יישמרו כאן" : "אין תוצאות עם הסינון הנוכחי"}
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn("rounded border px-2.5 py-1.5 text-xs font-mono", typeBg(entry.type))}
                  >
                    <div className="flex items-start gap-2 cursor-pointer" onClick={() => entry.stack && toggleExpanded(entry.id)}>
                      {typeIcon(entry.type)}
                      <span className="text-slate-400 shrink-0 text-[10px]">
                        {new Date(entry.timestamp).toLocaleTimeString("he-IL")}
                      </span>
                      <span className="flex-1 break-all whitespace-pre-wrap leading-relaxed">
                        {entry.message}
                      </span>
                      {entry.count > 1 && (
                        <span className="bg-slate-600 text-slate-200 px-1.5 rounded-full text-[10px] shrink-0">
                          x{entry.count}
                        </span>
                      )}
                      {entry.stack && (
                        expandedIds.has(entry.id) ? <ChevronUp className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                      )}
                    </div>
                    {entry.stack && expandedIds.has(entry.id) && (
                      <pre className="mt-1.5 p-2 bg-slate-950/50 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                        {entry.stack}
                      </pre>
                    )}
                    {entry.source && (
                      <div className="text-[10px] text-slate-500 mt-0.5">{entry.source}</div>
                    )}
                  </div>
                ))
              )}
            </div>
        </div>
      )}
    </>
  );
};

export default DevConsoleMonitor;
