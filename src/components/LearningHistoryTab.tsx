import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, BookOpen, Trash2, Calendar, TrendingUp, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "learning-history";
const MAX_ENTRIES = 500;

export interface HistoryEntry {
  sugyaId: string;
  title: string;
  dafYomi: string;
  masechet: string;
  visitedAt: number;
  durationMs?: number;
}

/* ── Public API for other components to record visits ── */
export function recordPageVisit(entry: Omit<HistoryEntry, "visitedAt">) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ...entry, visitedAt: Date.now() });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota */ }
}

export function updateVisitDuration(sugyaId: string, durationMs: number) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list: HistoryEntry[] = JSON.parse(raw);
    const entry = list.find((e) => e.sugyaId === sugyaId && !e.durationMs);
    if (entry) {
      entry.durationMs = durationMs;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch { /* */ }
}

function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} שנ'`;
  const m = Math.floor(ms / 60_000);
  return `${m} דק'`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return `היום ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `אתמול ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return d.toLocaleDateString("he-IL");
}

export default function LearningHistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const stats = useMemo(() => {
    const uniquePages = new Set(history.map((h) => h.sugyaId)).size;
    const uniqueMasechet = new Set(history.map((h) => h.masechet)).size;
    const totalTimeMs = history.reduce((sum, h) => sum + (h.durationMs || 0), 0);
    const today = new Date().toDateString();
    const todayCount = history.filter((h) => new Date(h.visitedAt).toDateString() === today).length;

    // Streak: count consecutive days with visits
    const daySet = new Set(history.map((h) => new Date(h.visitedAt).toDateString()));
    let streak = 0;
    const d = new Date();
    while (daySet.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    return { uniquePages, uniqueMasechet, totalTimeMs, todayCount, streak };
  }, [history]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, HistoryEntry[]>();
    for (const h of history) {
      const key = new Date(h.visitedAt).toDateString();
      const arr = groups.get(key) || [];
      arr.push(h);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [history]);

  const clearHistory = () => {
    if (!confirm("למחוק את כל היסטוריית הלמידה?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  };

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          היסטוריית למידה
        </h2>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground">
            <Trash2 className="h-4 w-4 ml-1" />
            ניקוי
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.uniquePages}</div>
            <div className="text-xs text-muted-foreground">דפים נלמדו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.uniqueMasechet}</div>
            <div className="text-xs text-muted-foreground">מסכתות</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-500">{stats.todayCount}</div>
            <div className="text-xs text-muted-foreground">היום</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.streak}</div>
            <div className="text-xs text-muted-foreground">ימים רצופים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 col-span-2 md:col-span-1">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-pink-500">
              {stats.totalTimeMs > 0 ? formatDuration(stats.totalTimeMs) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">זמן למידה</div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {history.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">עדיין אין היסטוריה</p>
            <p className="text-sm">התחל ללמוד דפים כדי לראות את ההתקדמות שלך</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {grouped.map(([dateStr, entries]) => (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {new Date(dateStr).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
                </div>
                <div className="space-y-1 mr-5 border-r-2 border-border pr-3">
                  {entries.map((e, i) => (
                    <button
                      key={`${e.sugyaId}-${i}`}
                      onClick={() => navigate(`/sugya/${e.sugyaId}`)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors text-right"
                    >
                      <div>
                        <div className="text-sm font-medium">{e.title || e.dafYomi}</div>
                        <div className="text-xs text-muted-foreground">{e.dafYomi}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {e.durationMs && <span>{formatDuration(e.durationMs)}</span>}
                        <span>{formatDate(e.visitedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
