import { useUploadStore } from "@/stores/uploadStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Clock, 
  Sparkles,
  Download
} from "lucide-react";

interface UploadSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UploadSummaryDialog = ({ open, onOpenChange }: UploadSummaryDialogProps) => {
  const { session, clearSession, getSummary } = useUploadStore();
  const summary = getSummary();
  
  if (!session || !summary) return null;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes} דקות ו-${remainingSeconds} שניות`;
    }
    return `${seconds} שניות`;
  };

  const handleClose = () => {
    onOpenChange(false);
    clearSession();
  };

  const exportReport = () => {
    const report = {
      sessionId: session.id,
      startedAt: new Date(session.startedAt).toISOString(),
      duration: formatDuration(summary.duration),
      metadata: session.metadata,
      summary: {
        totalUploaded: summary.totalUploaded,
        totalAnalyzed: summary.totalAnalyzed,
        totalErrors: summary.totalErrors,
        totalSkipped: summary.totalSkipped,
      },
      results: session.results,
      errors: session.errors,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <CheckCircle className="w-5 h-5 text-green-500" />
            דוח סיכום העלאה
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-500">
                {summary.totalUploaded}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <FileText className="w-3 h-3" />
                הועלו בהצלחה
              </div>
            </div>
            
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {summary.totalAnalyzed}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                נותחו עם AI
              </div>
            </div>
            
            {summary.totalErrors > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-destructive">
                  {summary.totalErrors}
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  שגיאות
                </div>
              </div>
            )}
            
            {summary.totalSkipped > 0 && (
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-accent">
                  {summary.totalSkipped}
                </div>
                <div className="text-xs text-muted-foreground">
                  דולגו (כפולים)
                </div>
              </div>
            )}
          </div>
          
          {/* Duration */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            זמן כולל: {formatDuration(summary.duration)}
          </div>
          
          {/* Results List */}
          {session.results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">פסקי דין שהועלו:</h4>
              <ScrollArea className="h-40 border rounded-lg p-2">
                <div className="space-y-1">
                  {session.results.map((result, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 text-sm py-1"
                    >
                      {result.success ? (
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">{result.title}</span>
                      {result.analyzed && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="w-3 h-3 ml-1" />
                          נותח
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Errors */}
          {session.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">שגיאות:</h4>
              <ScrollArea className="h-24 border border-destructive/30 rounded-lg p-2 bg-destructive/5">
                <div className="space-y-1">
                  {session.errors.map((error, idx) => (
                    <div key={idx} className="text-xs text-destructive">
                      {error}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={exportReport} className="gap-2">
            <Download className="w-4 h-4" />
            ייצא דוח
          </Button>
          <Button onClick={handleClose}>סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSummaryDialog;
