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
} from "lucide-react";
import { cn } from "@/lib/utils";

const GlobalDownloadProgress = () => {
  const { sessions } = useDownloadStore();
  const { pause, resume, cancel, clearSession, getProgress } = useDownloadController();

  const activeSessions = Object.values(sessions).filter((s) =>
    ["downloading", "paused", "packaging"].includes(s.status)
  );

  if (activeSessions.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:left-4 md:w-96 z-50",
        "bg-card border border-border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      dir="rtl"
    >
      {activeSessions.map((session) => {
        const progress = getProgress(session.id);
        const isDownloading = session.status === "downloading";
        const isPaused = session.status === "paused";
        const isPackaging = session.status === "packaging";

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
    </div>
  );
};

export default GlobalDownloadProgress;
