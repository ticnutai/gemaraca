import { useGemaraDownloadStore } from '@/stores/gemaraDownloadStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  ArrowDownToLine,
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const GemaraDownloadFloat = () => {
  const { jobs, queue, pauseJob, resumeJob, removeJob } = useGemaraDownloadStore();
  const getJobProgress = useGemaraDownloadStore((s) => s.getJobProgress);
  const [expanded, setExpanded] = useState(true);

  // Show active or recently-completed jobs (last 30s)
  const visibleJobs = Object.values(jobs).filter((j) => {
    if (j.status === 'downloading' || j.status === 'queued' || j.status === 'paused') return true;
    if (j.status === 'error') return true;
    if (j.status === 'completed') {
      // Auto-hide completed after 15s
      const age = Date.now() - j.createdAt;
      return age < 60_000;
    }
    return false;
  });

  if (visibleJobs.length === 0) return null;

  const activeJob = visibleJobs.find((j) => j.status === 'downloading');
  const queuedCount = visibleJobs.filter((j) => j.status === 'queued').length;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80',
        'bg-card border border-border rounded-xl shadow-xl',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-border cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">הורדות גמרא</span>
          {queuedCount > 0 && (
            <span className="text-xs text-muted-foreground">+{queuedCount} בתור</span>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </div>

      {expanded && (
        <div className="max-h-64 overflow-y-auto scrollbar-hide divide-y divide-border">
          {visibleJobs.map((job) => (
            <JobRow key={job.id} job={job} progress={getJobProgress(job.id)} onPause={pauseJob} onResume={resumeJob} onRemove={removeJob} />
          ))}
        </div>
      )}
    </div>
  );
};

function JobRow({
  job,
  progress,
  onPause,
  onResume,
  onRemove,
}: {
  job: ReturnType<typeof useGemaraDownloadStore.getState>['jobs'][string];
  progress: { completed: number; total: number; percent: number; failed: number };
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isDownloading = job.status === 'downloading';
  const isPaused = job.status === 'paused';
  const isQueued = job.status === 'queued';
  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm truncate max-w-[180px]">{job.label}</span>
        <div className="flex items-center gap-1">
          {(isDownloading || isPaused) && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => (isPaused ? onResume(job.id) : onPause(job.id))}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>
          )}
          {isError && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onResume(job.id)}>
              <Play className="w-3 h-3 text-primary" />
            </Button>
          )}
          {!isDownloading && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(job.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <Progress value={progress.percent} className="h-1.5" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-2">
          {isCompleted && (
            <span className="text-green-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> הושלם
            </span>
          )}
          {isError && (
            <span className="text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> שגיאה
            </span>
          )}
          {isQueued && <span>ממתין בתור...</span>}
          {isDownloading && job.currentMasechet && (
            <span>{job.currentMasechet} דף {job.currentDaf}</span>
          )}
          {isPaused && <span className="text-amber-500">מושהה</span>}
        </div>
        <span>
          {progress.completed}/{progress.total} ({progress.percent}%)
        </span>
      </div>

      {progress.failed > 0 && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {progress.failed} דפים נכשלו
        </div>
      )}
    </div>
  );
}

export default GemaraDownloadFloat;
