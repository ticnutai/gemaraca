import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, BookOpen, Clock, Flame, Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { MASECHTOT } from "@/lib/masechtotData";

const HISTORY_KEY = "learning-history";

interface HistoryEntry {
  sugyaId: string;
  masechet: string;
  dafYomi: string;
  visitedAt: number;
  durationMs?: number;
}

const COLORS = ["#0B1F5B", "#D4AF37", "#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#06b6d4", "#ec4899"];

export default function StatsDashboardTab() {
  const history: HistoryEntry[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  }, []);

  // === Stats ===
  const uniquePages = useMemo(() => new Set(history.map(h => h.sugyaId)).size, [history]);
  const uniqueMasechtot = useMemo(() => new Set(history.map(h => h.masechet).filter(Boolean)).size, [history]);
  const totalTimeMs = useMemo(() => history.reduce((sum, h) => sum + (h.durationMs || 0), 0), [history]);
  const totalDays = useMemo(() => new Set(history.map(h => new Date(h.visitedAt).toDateString())).size, [history]);

  // Streak
  const streak = useMemo(() => {
    const daySet = new Set(history.map(h => new Date(h.visitedAt).toDateString()));
    let count = 0;
    const d = new Date();
    while (daySet.has(d.toDateString())) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [history]);

  // === Charts Data ===

  // Pages per masechet (bar chart)
  const masechetData = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    history.forEach(h => {
      if (!h.masechet) return;
      if (!map[h.masechet]) map[h.masechet] = new Set();
      map[h.masechet].add(h.sugyaId);
    });
    return Object.entries(map)
      .map(([name, pages]) => ({ name, pages: pages.size }))
      .sort((a, b) => b.pages - a.pages)
      .slice(0, 10);
  }, [history]);

  // Study time by masechet (pie chart)
  const timeByMasechet = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach(h => {
      if (!h.masechet || !h.durationMs) return;
      map[h.masechet] = (map[h.masechet] || 0) + h.durationMs;
    });
    return Object.entries(map)
      .map(([name, ms]) => ({ name, minutes: Math.round(ms / 60000) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);
  }, [history]);

  // Daily activity (last 30 days) - line chart
  const dailyActivity = useMemo(() => {
    const map: Record<string, number> = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
      map[key] = 0;
    }
    history.forEach(h => {
      const d = new Date(h.visitedAt);
      if (now - h.visitedAt > 30 * 86400000) return;
      const key = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [history]);

  // Weekly learning hours (area chart)
  const weeklyHours = useMemo(() => {
    const map: Record<string, number> = {};
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now - i * 7 * 86400000);
      const key = `שבוע ${12 - i}`;
      map[key] = 0;
    }
    history.forEach(h => {
      if (!h.durationMs || now - h.visitedAt > 84 * 86400000) return;
      const weekAgo = Math.floor((now - h.visitedAt) / (7 * 86400000));
      if (weekAgo < 12) {
        const key = `שבוע ${12 - weekAgo}`;
        if (key in map) map[key] += h.durationMs / 3600000;
      }
    });
    return Object.entries(map).map(([week, hours]) => ({ week, hours: Math.round(hours * 10) / 10 }));
  }, [history]);

  // Total Shas progress
  const shasProgress = useMemo(() => {
    const total = MASECHTOT.reduce((sum, m) => sum + m.dafCount, 0);
    return { total, studied: uniquePages, pct: total > 0 ? Math.round((uniquePages / total) * 100) : 0 };
  }, [uniquePages]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    if (hours > 0) return `${hours} שעות ${mins} דקות`;
    return `${mins} דקות`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto" dir="rtl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          דשבורד סטטיסטיקות
        </h2>
        <p className="text-sm text-muted-foreground">מעקב אחר קצב הלמידה וההתקדמות שלך</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: BookOpen, label: "דפים שנלמדו", value: uniquePages, color: "text-blue-600" },
          { icon: Calendar, label: "מסכתות", value: uniqueMasechtot, color: "text-green-600" },
          { icon: Clock, label: "זמן כולל", value: formatTime(totalTimeMs), color: "text-purple-600" },
          { icon: Flame, label: "רצף ימים", value: `${streak} ימים`, color: "text-orange-600" },
          { icon: TrendingUp, label: "ש\"ס", value: `${shasProgress.pct}%`, color: "text-amber-600" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ScrollArea className="max-h-[calc(100vh-360px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Daily Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">פעילות יומית (30 יום אחרונים)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={10} interval={4} />
                  <YAxis fontSize={10} />
                  <RechartsTooltip contentStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#0B1F5B" radius={[2, 2, 0, 0]} name="דפים" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Weekly Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">שעות למידה שבועיות</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weeklyHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" fontSize={10} />
                  <YAxis fontSize={10} />
                  <RechartsTooltip contentStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Area type="monotone" dataKey="hours" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.3} name="שעות" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pages per Masechet */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">דפים לפי מסכת (טופ 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={masechetData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                  <RechartsTooltip contentStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Bar dataKey="pages" fill="#2563eb" radius={[0, 4, 4, 0]} name="דפים" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Time by Masechet Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">חלוקת זמן לפי מסכת</CardTitle>
            </CardHeader>
            <CardContent>
              {timeByMasechet.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">אין נתוני זמן עדיין</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={timeByMasechet}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="minutes"
                      nameKey="name"
                      label={({ name }) => name}
                      fontSize={10}
                    >
                      {timeByMasechet.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ direction: "rtl", fontSize: 12 }} formatter={(v: number) => `${v} דקות`} />
                    <Legend fontSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
