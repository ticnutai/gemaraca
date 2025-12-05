import { useUploadStore } from "@/stores/uploadStore";
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
  StopCircle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isOnline } from "@/lib/uploadUtils";
import { useState, useEffect } from "react";

const GlobalUploadProgress = () => {
  const { 
    session, 
    pauseSession, 
    resumeSession, 
    clearSession 
  } = useUploadStore();
  
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
  
  if (!session || session.status === 'idle' || session.status === 'completed') {
    return null;
  }

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
      resumeSession();
    } else {
      pauseSession();
    }
  };

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50",
        "bg-card border border-border rounded-lg shadow-lg p-4",
        "animate-in slide-in-from-bottom-4 duration-300",
        isError && "border-destructive/50"
      )}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!online && (
            <WifiOff className="w-4 h-4 text-destructive" />
          )}
          {isError ? (
            <AlertCircle className="w-5 h-5 text-destructive" />
          ) : isAnalyzing ? (
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <Upload className="w-5 h-5 text-primary" />
          )}
          <span className="font-medium text-sm">
            {isError ? 'העלאה נכשלה' : 
              !online ? 'ממתין לחיבור...' :
              isAnalyzing ? 'מנתח פסקי דין...' : 
              isPaused ? 'מושהה' : 'מעלה קבצים...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={togglePause}
              title={isPaused ? "המשך" : "השהה"}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={clearSession}
            title="סגור"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Upload Progress */}
      {(isUploading || isPaused || isError) && uploadProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">{uploadProgress.current}</span>
            <span>{uploadProgress.completed}/{uploadProgress.total}</span>
          </div>
          <Progress value={uploadPercent} className={cn("h-2", isError && "bg-destructive/20")} />
          <div className="flex gap-3 text-xs">
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
            {uploadProgress.skipped > 0 && (
              <span className="text-accent flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {uploadProgress.skipped} כפולים
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Analysis Progress */}
      {isAnalyzing && analysisProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">
              {analysisProgress.currentTitle || 'מעבד...'}
            </span>
            <span>{analysisProgress.current}/{analysisProgress.total}</span>
          </div>
          <Progress value={analysisPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            מזהה מקורות תלמודיים ומסווג
          </p>
        </div>
      )}
      
      {/* Status Messages */}
      {isPaused && (
        <p className="text-xs text-accent text-center mt-2">
          לחץ ▶ להמשך
        </p>
      )}
      
      {!online && (
        <p className="text-xs text-destructive text-center mt-2 flex items-center justify-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          ממתין לחיבור אינטרנט...
        </p>
      )}
      
      {isError && (
        <p className="text-xs text-destructive text-center mt-2">
          הקבצים שהועלו נשמרו. תוכל להמשיך מאוחר יותר.
        </p>
      )}
    </div>
  );
};

export default GlobalUploadProgress;
