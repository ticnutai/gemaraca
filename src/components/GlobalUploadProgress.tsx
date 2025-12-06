import { useUploadStore, UploadSession } from "@/stores/uploadStore";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Sparkles, 
  Pause, 
  Play, 
  X, 
  CheckCircle,
  AlertCircle,
  FileText,
  WifiOff,
  RefreshCw,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isOnline } from "@/lib/uploadUtils";
import { useState, useEffect } from "react";
import { useUploadController } from "@/hooks/useUploadController";

const GlobalUploadProgress = () => {
  const { sessions } = useUploadStore();
  const { pause, resume, clearSession, getTotalProgress } = useUploadController();
  
  const [online, setOnline] = useState(isOnline());
  
  // Track online status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Get active sessions
  const activeSessions = Object.values(sessions).filter(
    (s) => ['uploading', 'paused', 'analyzing'].includes(s.status)
  );
  
  if (activeSessions.length === 0) {
    return null;
  }

  const totalProgress = getTotalProgress();

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50",
        "bg-card border border-border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!online && (
            <WifiOff className="w-4 h-4 text-destructive" />
          )}
          <Upload className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">
            {activeSessions.length > 1 
              ? `${activeSessions.length} העלאות פעילות` 
              : activeSessions[0]?.name || 'מעלה קבצים...'}
          </span>
          {activeSessions.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
      
      {/* Sessions List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activeSessions.map((session) => (
          <SessionProgressItem 
            key={session.id}
            session={session}
            online={online}
            onPause={() => pause(session.id)}
            onResume={() => resume(session.id)}
            onClear={() => clearSession(session.id)}
          />
        ))}
      </div>
      
      {/* Total Progress (when multiple sessions) */}
      {activeSessions.length > 1 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>סה"כ</span>
            <span>{totalProgress.completed}/{totalProgress.total}</span>
          </div>
          <Progress 
            value={totalProgress.total > 0 ? (totalProgress.completed / totalProgress.total) * 100 : 0} 
            className="h-1.5" 
          />
        </div>
      )}
      
      {!online && (
        <p className="text-xs text-destructive text-center mt-2 flex items-center justify-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          ממתין לחיבור אינטרנט...
        </p>
      )}
    </div>
  );
};

interface SessionProgressItemProps {
  session: UploadSession;
  online: boolean;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
}

const SessionProgressItem = ({ session, online, onPause, onResume, onClear }: SessionProgressItemProps) => {
  const isUploading = session.status === 'uploading';
  const isPaused = session.status === 'paused';
  const isAnalyzing = session.status === 'analyzing';
  const isError = session.status === 'error';
  
  const uploadProgress = session.uploadProgress;
  const analysisProgress = session.analysisProgress;
  
  const uploadPercent = uploadProgress 
    ? (uploadProgress.completed / uploadProgress.total) * 100 
    : 0;
  const analysisPercent = analysisProgress 
    ? (analysisProgress.current / analysisProgress.total) * 100 
    : 0;

  const togglePause = () => {
    if (isPaused) {
      onResume();
    } else {
      onPause();
    }
  };

  return (
    <div className={cn(
      "bg-muted/30 rounded-lg p-3 space-y-2",
      isError && "bg-destructive/10 border border-destructive/30"
    )}>
      {/* Session Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isError ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : isAnalyzing ? (
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          ) : (
            <Upload className="w-4 h-4 text-primary" />
          )}
          <span className="text-sm font-medium truncate max-w-[150px]">
            {session.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={togglePause}
              title={isPaused ? "המשך" : "השהה"}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onClear}
            title="סגור"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* Upload Progress */}
      {(isUploading || isPaused || isError) && uploadProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[150px]">{uploadProgress.current}</span>
            <span>{uploadProgress.completed}/{uploadProgress.total}</span>
          </div>
          <Progress value={uploadPercent} className={cn("h-1.5", isError && "bg-destructive/20")} />
          <div className="flex gap-2 text-xs">
            <span className="text-green-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {uploadProgress.successful}
            </span>
            {uploadProgress.failed > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {uploadProgress.failed}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Analysis Progress */}
      {isAnalyzing && analysisProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[150px]">
              {analysisProgress.currentTitle || 'מעבד...'}
            </span>
            <span>{analysisProgress.current}/{analysisProgress.total}</span>
          </div>
          <Progress value={analysisPercent} className="h-1.5" />
        </div>
      )}
      
      {isPaused && (
        <p className="text-xs text-accent text-center">מושהה - לחץ ▶ להמשך</p>
      )}
    </div>
  );
};

export default GlobalUploadProgress;
