import { useEffect, useCallback } from "react";
import { useShasDownloadStore } from "@/stores/shasDownloadStore";
import { MASECHTOT } from "@/lib/masechtotData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BulkShasDownload = () => {
  const store = useShasDownloadStore();
  const {
    isRunning,
    isPaused,
    concurrency,
    masechtot,
    activeDownloads,
    startFullDownload,
    startMissingOnly,
    startSingleMasechet,
    pause,
    resume,
    stop,
    setConcurrency,
    _refreshFromServer,
  } = store;

  // Refresh from server on mount
  useEffect(() => {
    _refreshFromServer();
  }, []);

  // Auto-resume if store says we were running
  useEffect(() => {
    if (isRunning && !isPaused && activeDownloads.length === 0 && masechtot.some(m => m.status === 'pending' || m.status === 'downloading')) {
      // We were running but page was reloaded — resume
      const timer = setTimeout(() => {
        store._processQueue();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Periodic refresh while downloading
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => _refreshFromServer(), 15000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const totalPagesInShas = MASECHTOT.reduce((sum, m) => sum + (m.maxDaf - 1) * 2, 0);
  const totalLoaded = masechtot.reduce((sum, m) => sum + m.loadedPages, 0);
  const totalCompleted = masechtot.filter((m) => m.status === 'completed').length;
  const overallProgress = totalPagesInShas > 0 ? (totalLoaded / totalPagesInShas) * 100 : 0;
  const totalErrors = masechtot.reduce((sum, m) => sum + m.errors.length, 0);
  const totalMissing = masechtot.reduce((sum, m) => Math.max(0, m.totalPages - m.loadedPages), 0);

  const sedarim = [...new Set(MASECHTOT.map((m) => m.seder))];

  const handleStart = () => {
    startFullDownload();
    toast("הורדת הש\"ס התחילה ברקע");
  };

  const handleCompleteMissing = () => {
    startMissingOnly();
    toast(`משלים ${totalMissing} עמודים חסרים...`);
  };

  return (
    <div className="space-y-4 p-3 md:p-6" dir="rtl">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            הורדת הש"ס לענן
            {isRunning && (
              <Badge variant="secondary" className="mr-auto animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
                {isPaused ? 'מושהה' : `מוריד (${activeDownloads.length} במקביל)`}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {totalLoaded.toLocaleString()} / {totalPagesInShas.toLocaleString()} עמודים
                ({totalCompleted}/{MASECHTOT.length} מסכתות)
              </span>
              <span className="font-semibold">{overallProgress.toFixed(1)}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>

          {/* Concurrency slider */}
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground min-w-[80px]">מקביליות: {concurrency}</span>
            <Slider
              value={[concurrency]}
              onValueChange={([v]) => setConcurrency(v)}
              min={1}
              max={6}
              step={1}
              className="flex-1 max-w-[200px]"
              disabled={isRunning}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {!isRunning ? (
              <>
                <Button onClick={handleStart} className="gap-2">
                  <Download className="h-4 w-4" />
                  {masechtot.some(m => m.status === 'paused' || m.status === 'pending')
                    ? 'המשך הורדה'
                    : 'הורד את כל הש"ס'}
                </Button>
                <Button variant="outline" onClick={_refreshFromServer} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  רענן סטטוס
                </Button>
              </>
            ) : (
              <>
                {!isPaused ? (
                  <Button variant="secondary" onClick={pause} className="gap-2">
                    <Pause className="h-4 w-4" />
                    השהה
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={resume} className="gap-2">
                    <Play className="h-4 w-4" />
                    המשך
                  </Button>
                )}
                <Button variant="destructive" onClick={stop} className="gap-2">
                  <StopCircle className="h-4 w-4" />
                  עצור
                </Button>
              </>
            )}
          </div>

          {/* Active downloads indicator */}
          {isRunning && activeDownloads.length > 0 && (
            <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
              {masechtot
                .filter((m) => m.status === 'downloading')
                .map((m) => (
                  <Badge key={m.masechet} variant="outline" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {m.hebrewName} — דף {m.currentDaf}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Masechtot Grid */}
      <ScrollArea className="h-[450px]">
        <div className="space-y-4">
          {sedarim.map((seder) => (
            <div key={seder}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">סדר {seder}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {masechtot
                  .filter((m) => {
                    const info = MASECHTOT.find((x) => x.sefariaName === m.masechet);
                    return info?.seder === seder;
                  })
                  .map((m) => {
                    const pct = m.totalPages > 0 ? (m.loadedPages / m.totalPages) * 100 : 0;
                    const isDone = m.status === 'completed' || pct >= 99;
                    const isActive = m.status === 'downloading';
                    const hasError = m.status === 'error';

                    return (
                      <Card
                        key={m.masechet}
                        className={cn(
                          "p-3 transition-all",
                          isActive && "border-primary/50 bg-primary/5",
                          isDone && "border-green-500/30 bg-green-500/5",
                          hasError && "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-sm">{m.hebrewName}</span>
                          </div>
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : isActive ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : hasError ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isRunning}
                              onClick={() => startSingleMasechet(m.masechet)}
                            >
                              <Download className="h-3 w-3 ml-1" />
                              הורד
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground min-w-[3rem] text-left">
                            {m.loadedPages}/{m.totalPages}
                          </span>
                        </div>
                        {isActive && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            דף {m.currentDaf} מתוך {m.maxDaf}
                          </p>
                        )}
                      </Card>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Errors summary */}
      {totalErrors > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              שגיאות ({totalErrors})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-24">
              <ul className="text-xs space-y-1 text-muted-foreground">
                {masechtot
                  .flatMap((m) => m.errors.map((e) => `${m.hebrewName}: ${e}`))
                  .slice(-30)
                  .map((e, i) => (
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
