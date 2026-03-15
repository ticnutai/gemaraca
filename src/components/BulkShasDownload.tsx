import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT } from "@/lib/masechtotData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  StopCircle,
  Database,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MasechetStatus {
  sefariaName: string;
  hebrewName: string;
  maxDaf: number;
  totalPages: number; // maxDaf * 2 amudim (approx)
  withText: number;
  seder: string;
}

type DownloadState = "idle" | "downloading" | "paused" | "done" | "error";

const BulkShasDownload = () => {
  const [masechtotStatus, setMasechtotStatus] = useState<MasechetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [currentMasechet, setCurrentMasechet] = useState<string>("");
  const [currentDaf, setCurrentDaf] = useState(0);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("bulk-load-shas", {
        body: { mode: "status" },
      });

      if (error) throw error;

      const statusMap: Record<string, { total: number; withText: number }> = data.status || {};

      const statuses: MasechetStatus[] = MASECHTOT.map((m) => {
        const s = statusMap[m.sefariaName] || { total: 0, withText: 0 };
        return {
          sefariaName: m.sefariaName,
          hebrewName: m.hebrewName,
          maxDaf: m.maxDaf,
          totalPages: (m.maxDaf - 1) * 2, // daf 2 to maxDaf, amud a+b
          withText: s.withText,
          seder: m.seder,
        };
      });

      setMasechtotStatus(statuses);
    } catch (e) {
      console.error("Failed to fetch status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const downloadMasechet = async (
    sefariaName: string,
    hebrewName: string,
    maxDaf: number
  ): Promise<{ loaded: number; skipped: number; errors: string[] }> => {
    let startDaf = 2;
    let totalLoaded = 0;
    let totalSkipped = 0;
    let allErrors: string[] = [];

    while (startDaf <= maxDaf) {
      if (abortRef.current) break;

      // Wait while paused
      while (pauseRef.current && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      setCurrentDaf(startDaf);

      const { data, error } = await supabase.functions.invoke("bulk-load-shas", {
        body: { masechet: sefariaName, startDaf },
      });

      if (error) {
        allErrors.push(`${hebrewName} דף ${startDaf}: ${error.message}`);
        break;
      }

      totalLoaded += data.loaded || 0;
      totalSkipped += data.skipped || 0;
      if (data.errors?.length) {
        allErrors.push(...data.errors);
      }

      if (!data.hasMore) break;
      startDaf = data.nextDaf;
    }

    return { loaded: totalLoaded, skipped: totalSkipped, errors: allErrors };
  };

  const startFullDownload = async () => {
    abortRef.current = false;
    pauseRef.current = false;
    setDownloadState("downloading");
    setTotalLoaded(0);
    setTotalSkipped(0);
    setErrors([]);

    let grandLoaded = 0;
    let grandSkipped = 0;
    let allErrors: string[] = [];

    for (const m of MASECHTOT) {
      if (abortRef.current) break;

      // Skip fully downloaded masechtot
      const status = masechtotStatus.find((s) => s.sefariaName === m.sefariaName);
      if (status && status.withText >= status.totalPages) {
        grandSkipped += status.totalPages;
        setTotalSkipped((prev) => prev + status.totalPages);
        continue;
      }

      setCurrentMasechet(m.hebrewName);

      const result = await downloadMasechet(m.sefariaName, m.hebrewName, m.maxDaf);
      grandLoaded += result.loaded;
      grandSkipped += result.skipped;
      allErrors.push(...result.errors);

      setTotalLoaded((prev) => prev + result.loaded);
      setTotalSkipped((prev) => prev + result.skipped);
      setErrors((prev) => [...prev, ...result.errors]);
    }

    if (abortRef.current) {
      setDownloadState("idle");
      toast("ההורדה בוטלה");
    } else {
      setDownloadState("done");
      toast.success(`הורדת הש"ס הושלמה! ${grandLoaded} דפים חדשים נטענו`);
    }

    fetchStatus();
  };

  const downloadSingleMasechet = async (m: MasechetStatus) => {
    abortRef.current = false;
    pauseRef.current = false;
    setDownloadState("downloading");
    setCurrentMasechet(m.hebrewName);
    setTotalLoaded(0);
    setTotalSkipped(0);
    setErrors([]);

    const result = await downloadMasechet(m.sefariaName, m.hebrewName, m.maxDaf);

    setTotalLoaded(result.loaded);
    setTotalSkipped(result.skipped);
    setErrors(result.errors);

    if (abortRef.current) {
      setDownloadState("idle");
      toast("ההורדה בוטלה");
    } else {
      setDownloadState("done");
      toast.success(`${m.hebrewName} הושלמה! ${result.loaded} דפים נטענו`);
    }

    fetchStatus();
  };

  const totalPagesInShas = MASECHTOT.reduce((sum, m) => sum + (m.maxDaf - 1) * 2, 0);
  const totalWithText = masechtotStatus.reduce((sum, m) => sum + m.withText, 0);
  const overallProgress = totalPagesInShas > 0 ? (totalWithText / totalPagesInShas) * 100 : 0;

  // Group by seder
  const sedarim = [...new Set(MASECHTOT.map((m) => m.seder))];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            הורדת הש"ס לענן
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalWithText.toLocaleString()} / {totalPagesInShas.toLocaleString()} עמודים
            </span>
            <span className="font-medium">{overallProgress.toFixed(1)}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />

          <div className="flex gap-2 flex-wrap">
            {downloadState === "idle" || downloadState === "done" || downloadState === "error" ? (
              <Button onClick={startFullDownload} className="gap-2">
                <Download className="h-4 w-4" />
                הורד את כל הש"ס
              </Button>
            ) : (
              <>
                {downloadState === "downloading" ? (
                  <Button
                    variant="secondary"
                    onClick={() => (pauseRef.current = true, setDownloadState("paused"))}
                    className="gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    השהה
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => (pauseRef.current = false, setDownloadState("downloading"))}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    המשך
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => (abortRef.current = true)}
                  className="gap-2"
                >
                  <StopCircle className="h-4 w-4" />
                  עצור
                </Button>
              </>
            )}
          </div>

          {downloadState !== "idle" && (
            <div className="text-sm text-muted-foreground space-y-1">
              {currentMasechet && (
                <p className="flex items-center gap-2">
                  <Loader2 className={cn("h-3 w-3", downloadState === "downloading" && "animate-spin")} />
                  {currentMasechet} — דף {currentDaf}
                </p>
              )}
              <p>נטענו: {totalLoaded} | דולגו: {totalSkipped} | שגיאות: {errors.length}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Masechtot List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            sedarim.map((seder) => (
              <div key={seder}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">סדר {seder}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {masechtotStatus
                    .filter((m) => m.seder === seder)
                    .map((m) => {
                      const pct = m.totalPages > 0 ? (m.withText / m.totalPages) * 100 : 0;
                      const isDone = pct >= 99;
                      const isActive = downloadState === "downloading" && currentMasechet === m.hebrewName;

                      return (
                        <Card
                          key={m.sefariaName}
                          className={cn(
                            "p-3 transition-colors",
                            isActive && "border-primary bg-primary/5",
                            isDone && "border-green-500/30 bg-green-500/5"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{m.hebrewName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : isActive ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  disabled={downloadState === "downloading"}
                                  onClick={() => downloadSingleMasechet(m)}
                                >
                                  <Download className="h-3 w-3 ml-1" />
                                  הורד
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-muted-foreground min-w-[3rem] text-left">
                              {m.withText}/{m.totalPages}
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              שגיאות ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <ul className="text-xs space-y-1 text-muted-foreground">
                {errors.slice(-20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkShasDownload;
