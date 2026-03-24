import { useDeleteStore } from "@/stores/deleteStore";
import { useDeleteController } from "@/hooks/useDeleteController";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2, Pause, Play, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const GlobalDeleteProgress = () => {
  const { sessions } = useDeleteStore();
  const { pause, resume, cancel, getProgress, getSpeed } = useDeleteController();

  const activeSessions = Object.values(sessions).filter((s) =>
    ["deleting", "paused"].includes(s.status)
  );

  if (activeSessions.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 md:w-96 z-50",
        "bg-card border border-border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      dir="rtl"
    >
      {activeSessions.map((session) => {
        const progress = getProgress(session.id);
        const speed = getSpeed();
        const isPaused = session.status === "paused";
        const remaining =
          speed > 0
            ? Math.ceil((progress.total - progress.completed) / speed)
            : null;

        return (
          <div key={session.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {session.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isPaused ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => resume(session.id)}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => pause(session.id)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => cancel(session.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Progress value={progress.percent} className="h-2" />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {progress.completed.toLocaleString()}/{progress.total.toLocaleString()}
                {progress.failed > 0 && (
                  <span className="text-destructive mr-1">
                    ({progress.failed} שגיאות)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {speed > 0 && <span>{speed}/שנ</span>}
                {remaining !== null && remaining > 0 && (
                  <span>~{remaining}שנ נותרו</span>
                )}
                {isPaused && (
                  <span className="text-amber-600 font-medium">מושהה</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GlobalDeleteProgress;
