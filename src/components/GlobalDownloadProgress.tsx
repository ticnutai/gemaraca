import { useDownloadStore } from "@/stores/downloadStore";
import { useDownloadController } from "@/hooks/useDownloadController";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  Pause,
  Play,
  X,
  Package,
  CheckCircle,
  AlertCircle,
  Zap,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const GlobalDownloadProgress = () => {
  const { sessions } = useDownloadStore();
  const { pause, resume, cancel, clearSession, getProgress, getSpeed } = useDownloadController();
  const [speed, setSpeed] = useState(0);

  const activeSessions = Object.values(sessions).filter((s) =>
    ["downloading", "paused", "packaging"].includes(s.status)
  );

  const resumableSessions = Object.values(sessions).filter((s) =>
    ["paused", "error"].includes(s.status) && s.completedIds.length > 0 &&
    !activeSessions.some(a => a.id === s.id && a.status === "downloading")
  );

  // Update speed every second
  useEffect(() => {
    if (activeSessions.length === 0) return;
    const interval = setInterval(() => setSpeed(getSpeed()), 1000);
    return () => clearInterval(interval);
  }, [activeSessions.length, getSpeed]);

  if (activeSessions.length === 0 && resumableSessions.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 md:right-auto md:left-4 md:w-96 z-50",
        "bg-card border border-border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      dir="rtl"
    >
      {activeSessions.map((session) => {
        const progress = getProgress(session.id);
        const isPaused = session.status === "paused";
        const isPackaging = session.status === "packaging";
        const formatLabel = session.format === 'pdf' ? 'PDF' : session.format === 'docx' ? 'Word' : 'HTML';

        return (
          <div key={session.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPackaging ? (
                  <Package className="w-5 h-5 text-primary animate-pulse" />
                ) : (
                  <ArrowDownToLine className="w-5 h-5 text-primary" />
                )}
                <span className="font-medium text-sm">
                  {isPackaging ? "אורז קובץ ZIP..." : session.name}
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {formatLabel}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!isPackaging && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() =>
                      isPaused ? resume(session.id) : pause(session.id)
                    }
                  >
                    {isPaused ? (
                      <Play className="w-3 h-3" />
                    ) : (
                      <Pause className="w-3 h-3" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    cancel(session.id);
                    clearSession(session.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <Progress value={progress.percent} className="h-1.5" />

            <div className="flex justify-between text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {progress.completed}
                </span>
                {progress.failed > 0 && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {progress.failed}
                  </span>
                )}
                {speed > 0 && !isPaused && !isPackaging && (
                  <span className="flex items-center gap-1 text-primary">
                    <Zap className="w-3 h-3" />
                    {speed}/שנ
                  </span>
                )}
              </div>
              <span>
                {progress.completed}/{progress.total} ({progress.percent}%)
              </span>
            </div>

            {isPaused && (
              <p className="text-xs text-accent text-center">
                מושהה - לחץ ▶ להמשך
              </p>
            )}
          </div>
        );
      })}

      {/* Resumable sessions (stopped/failed) */}
      {resumableSessions.filter(s => !activeSessions.some(a => a.id === s.id)).map((session) => {
        const progress = getProgress(session.id);
        const isError = session.status === "error";
        const formatLabel = session.format === 'pdf' ? 'PDF' : session.format === 'docx' ? 'Word' : 'HTML';

        return (
          <div key={`resume-${session.id}`} className="space-y-2 border-t border-border/50 pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={cn("w-4 h-4", isError ? "text-destructive" : "text-muted-foreground")} />
                <span className="text-sm font-medium truncate max-w-[180px]">{session.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{formatLabel}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => clearSession(session.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <Progress value={progress.percent} className="h-1.5" />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {progress.completed}/{progress.total} הושלמו ({progress.percent}%)
                {progress.failed > 0 && ` • ${progress.failed} שגיאות`}
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  // Resume by restarting with remaining items
                  const remainingItems = session.items
                    .filter(i => i.status !== 'done')
                    .map(i => ({ id: i.id, title: i.title, court: i.court, year: i.year }));
                  if (remainingItems.length > 0) {
                    resume(session.id);
                  }
                }}
              >
                <RotateCcw className="w-3 h-3" />
                המשך הורדה
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GlobalDownloadProgress;
