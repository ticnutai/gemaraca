import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  RefreshCw,
  Activity,
  AlertTriangle,
  Zap,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunctionLog {
  id: string;
  function_name: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  request_body: Record<string, unknown>;
  response_summary: string | null;
  error_message: string | null;
  user_id: string | null;
  created_at: string;
}

interface FunctionStats {
  name: string;
  total: number;
  success: number;
  errors: number;
  avgDuration: number;
  lastCall: string | null;
  errorRate: number;
}

export default function MonitoringTab() {
  const [logs, setLogs] = useState<FunctionLog[]>([]);
  const [stats, setStats] = useState<FunctionStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [view, setView] = useState<"dashboard" | "logs">("dashboard");

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("function_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const logsData = (data || []) as FunctionLog[];
      setLogs(logsData);

      // Calculate stats
      const statsMap = new Map<string, FunctionStats>();
      for (const log of logsData) {
        if (!statsMap.has(log.function_name)) {
          statsMap.set(log.function_name, {
            name: log.function_name,
            total: 0,
            success: 0,
            errors: 0,
            avgDuration: 0,
            lastCall: null,
            errorRate: 0,
          });
        }
        const s = statsMap.get(log.function_name)!;
        s.total++;
        if (log.status === "success") s.success++;
        else s.errors++;
        if (log.duration_ms) s.avgDuration += log.duration_ms;
        if (!s.lastCall) s.lastCall = log.created_at;
      }

      const statsArr = Array.from(statsMap.values()).map((s) => ({
        ...s,
        avgDuration: s.total > 0 ? Math.round(s.avgDuration / s.total) : 0,
        errorRate: s.total > 0 ? Math.round((s.errors / s.total) * 100) : 0,
      }));
      statsArr.sort((a, b) => b.total - a.total);
      setStats(statsArr);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "שגיאה בטעינת לוגים", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    loadLogs();

    const channel = supabase
      .channel("function-logs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "function_logs" },
        (payload) => {
          const newLog = payload.new as FunctionLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 200));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  const clearLogs = async () => {
    if (!confirm("למחוק את כל הלוגים?")) return;
    try {
      const { error } = await supabase.from("function_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setLogs([]);
      setStats([]);
      toast({ title: "הלוגים נמחקו" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "שגיאה", description: message, variant: "destructive" });
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (searchFilter && !log.function_name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const totalCalls = stats.reduce((sum, s) => sum + s.total, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
  const avgDuration = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.avgDuration * s.total, 0) / Math.max(totalCalls, 1))
    : 0;

  return (
    <div className="space-y-3 overflow-auto">
      {/* Top Bar */}
      <div className="flex items-center gap-2">
        <Button
          variant={view === "dashboard" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("dashboard")}
        >
          <Activity className="h-4 w-4 ml-1" />
          דשבורד
        </Button>
        <Button
          variant={view === "logs" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("logs")}
        >
          <Clock className="h-4 w-4 ml-1" />
          לוגים
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={loadLogs} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
        <Button variant="ghost" size="sm" onClick={clearLogs} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {view === "dashboard" ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{totalCalls}</div>
                <div className="text-xs text-muted-foreground">קריאות</div>
              </CardContent>
            </Card>
            <Card className={cn("border-border", totalErrors > 0 && "border-destructive/50")}>
              <CardContent className="p-3 text-center">
                <AlertTriangle className={cn("h-5 w-5 mx-auto mb-1", totalErrors > 0 ? "text-destructive" : "text-muted-foreground")} />
                <div className="text-2xl font-bold">{totalErrors}</div>
                <div className="text-xs text-muted-foreground">שגיאות</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{avgDuration}<span className="text-sm">ms</span></div>
                <div className="text-xs text-muted-foreground">ממוצע</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-function stats */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                אין לוגים עדיין. קריאות לפונקציות יירשמו כאן אוטומטית.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.map((s) => (
                  <Card key={s.name} className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => { setSearchFilter(s.name); setView("logs"); }}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          s.errorRate > 50 ? "bg-destructive" : s.errorRate > 10 ? "bg-yellow-500" : "bg-green-500"
                        )} />
                        <span className="font-mono text-sm flex-1">{s.name}</span>
                        <Badge variant="outline" className="text-xs">{s.total} קריאות</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="text-green-600">✓ {s.success}</span>
                        {s.errors > 0 && <span className="text-destructive">✗ {s.errors}</span>}
                        <span>⌀ {s.avgDuration}ms</span>
                        {s.errorRate > 0 && (
                          <Badge variant={s.errorRate > 50 ? "destructive" : "secondary"} className="text-xs">
                            {s.errorRate}% שגיאות
                          </Badge>
                        )}
                        {s.lastCall && (
                          <span className="mr-auto">{new Date(s.lastCall).toLocaleTimeString("he-IL")}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם פונקציה..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pr-8 bg-input border-border text-sm"
              />
            </div>
            <div className="flex gap-1">
              {["all", "success", "error"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="text-xs"
                >
                  {s === "all" ? "הכל" : s === "success" ? "הצלחה" : "שגיאות"}
                </Button>
              ))}
            </div>
          </div>

          {/* Logs List */}
          <ScrollArea className="h-[340px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                אין לוגים תואמים
              </div>
            ) : (
              <div className="space-y-1 p-1">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "border rounded-lg p-2 cursor-pointer hover:bg-muted/30 transition-colors",
                      log.status === "error" ? "border-destructive/30" : "border-border",
                      expandedLog === log.id && "bg-muted/20"
                    )}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-2">
                      {log.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-mono text-xs flex-1 truncate">{log.function_name}</span>
                      {log.duration_ms !== null && (
                        <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString("he-IL")}
                      </span>
                    </div>

                    {expandedLog === log.id && (
                      <div className="mt-2 space-y-2 text-xs">
                        {log.error_message && (
                          <pre className="text-destructive bg-destructive/5 p-2 rounded overflow-x-auto whitespace-pre-wrap" dir="ltr">
                            {log.error_message}
                          </pre>
                        )}
                        {log.request_body && Object.keys(log.request_body).length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Request:</span>
                            <pre className="bg-muted/50 p-2 rounded overflow-x-auto mt-1 whitespace-pre-wrap" dir="ltr">
                              {JSON.stringify(log.request_body, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.response_summary && (
                          <div>
                            <span className="text-muted-foreground">Response:</span>
                            <pre className="bg-muted/50 p-2 rounded overflow-x-auto mt-1 whitespace-pre-wrap" dir="ltr">
                              {log.response_summary}
                            </pre>
                          </div>
                        )}
                        {log.status_code && (
                          <Badge variant="outline" className="text-xs">HTTP {log.status_code}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
