import { useCallback, useEffect, useRef, useState } from 'react';
import { useAnalysisStore, AnalysisStatus } from '@/stores/analysisStore';
import { runAnalysisEngine } from '@/lib/analysisEngine';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Pause, Play, Square, RotateCcw, AlertTriangle,
  CheckCircle2, Clock, SkipForward, Save,
  Settings2, ChevronDown, ChevronUp, Cpu,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} שניות`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}:${String(sec).padStart(2, '0')} דקות`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatRate(avgMs: number): string {
  if (avgMs <= 0) return '—';
  const perMin = Math.round(60000 / avgMs);
  return `${perMin}/דקה`;
}

function StatusBadge({ status }: { status: AnalysisStatus }) {
  const config: Record<AnalysisStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    idle: { label: 'ממתין', variant: 'secondary' },
    running: { label: 'מנתח', variant: 'default' },
    paused: { label: 'מושהה', variant: 'outline' },
    completed: { label: 'הושלם', variant: 'secondary' },
    error: { label: 'שגיאה', variant: 'destructive' },
  };
  const c = config[status];
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

export default function AnalysisControlPanel() {
  const queryClient = useQueryClient();
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const status = useAnalysisStore(s => s.status);
  const stats = useAnalysisStore(s => s.stats);
  const errors = useAnalysisStore(s => s.errors);
  const batchSize = useAnalysisStore(s => s.batchSize);
  const concurrency = useAnalysisStore(s => s.concurrency);
  const skipAnalyzed = useAnalysisStore(s => s.skipAnalyzed);
  const useAI = useAnalysisStore(s => s.useAI);
  const savedProgress = useAnalysisStore(s => s.savedProgress);

  const setBatchSize = useAnalysisStore(s => s.setBatchSize);
  const setConcurrency = useAnalysisStore(s => s.setConcurrency);
  const setSkipAnalyzed = useAnalysisStore(s => s.setSkipAnalyzed);
  const setUseAI = useAnalysisStore(s => s.setUseAI);
  const start = useAnalysisStore(s => s.start);
  const pause = useAnalysisStore(s => s.pause);
  const resume = useAnalysisStore(s => s.resume);
  const cancel = useAnalysisStore(s => s.cancel);
  const reset = useAnalysisStore(s => s.reset);
  const saveProgress = useAnalysisStore(s => s.saveProgress);
  const clearSavedProgress = useAnalysisStore(s => s.clearSavedProgress);
  const startFromSaved = useAnalysisStore(s => s.startFromSaved);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;
  const isDone = status === 'completed';

  // Auto-invalidate queries when done
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['psakei_din'] });
      queryClient.invalidateQueries({ queryKey: ['psak_sections'] });
    }
    prevStatusRef.current = status;
  }, [status, queryClient]);

  // Elapsed time ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [isRunning]);

  const handleStart = useCallback(() => {
    if (savedProgress) {
      setResumeDialogOpen(true);
      return;
    }
    start();
    setTimeout(() => {
      runAnalysisEngine().catch(console.error);
    }, 0);
  }, [start, savedProgress]);

  const handleStartFresh = useCallback(() => {
    setResumeDialogOpen(false);
    clearSavedProgress();
    start();
    setTimeout(() => {
      runAnalysisEngine().catch(console.error);
    }, 0);
  }, [clearSavedProgress, start]);

  const handleStartFromSaved = useCallback(() => {
    setResumeDialogOpen(false);
    startFromSaved();
    setTimeout(() => {
      runAnalysisEngine().catch(console.error);
    }, 0);
  }, [startFromSaved]);

  const handleSave = useCallback(() => {
    saveProgress();
    toast.success('ההתקדמות נשמרה בהצלחה');
  }, [saveProgress]);

  const handleCancel = useCallback(() => {
    cancel();
    queryClient.invalidateQueries({ queryKey: ['psakei_din'] });
    queryClient.invalidateQueries({ queryKey: ['psak_sections'] });
  }, [cancel, queryClient]);

  // Progress calculation
  const progressPct = stats.totalPsakim > 0
    ? ((stats.processed + stats.skipped) / stats.totalPsakim) * 100
    : 0;
  const remaining = stats.totalPsakim - stats.processed - stats.skipped;
  const etaMs = stats.avgPerItem > 0 ? remaining * stats.avgPerItem : 0;
  const elapsedLive = stats.startedAt ? Date.now() - stats.startedAt : stats.elapsed;

  return (
    <Card className="border-orange-500/20" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            ניתוח סעיפי מסמך
            <StatusBadge status={status} />
            {isActive && useAI && (
              <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-600">
                AI + Regex
              </Badge>
            )}
            {isActive && !useAI && (
              <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-600">
                Regex בלבד
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            {!isActive && !isDone && (
              <Button size="sm" onClick={handleStart} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
                {status === 'error' ? 'נסה שוב' : 'התחל ניתוח'}
              </Button>
            )}
            {isRunning && (
              <Button size="sm" variant="outline" onClick={pause} className="gap-1.5">
                <Pause className="w-3.5 h-3.5" />
                השהה
              </Button>
            )}
            {isPaused && (
              <Button size="sm" onClick={resume} className="gap-1.5">
                <Play className="w-3.5 h-3.5" />
                המשך
              </Button>
            )}
            {isActive && (
              <Button size="sm" variant="outline" onClick={handleSave} className="gap-1.5 border-amber-600/50 text-amber-700 hover:bg-amber-50">
                <Save className="w-3.5 h-3.5" />
                שמור
              </Button>
            )}
            {isActive && (
              <Button size="sm" variant="destructive" onClick={handleCancel} className="gap-1.5">
                <Square className="w-3.5 h-3.5" />
                בטל
              </Button>
            )}
            {isDone && (
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                אפס
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          מחלץ עובדות מקרה, טענות צדדים, פסיקה וסעיפים נוספים מתוך פסקי הדין
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        {(isActive || isDone || status === 'error') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{stats.processed + stats.skipped} / {stats.totalPsakim} פסקי דין</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />

            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-primary">{stats.processed}</div>
                <div className="text-[10px] text-muted-foreground">נותחו</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-orange-600">{stats.sectionsFound}</div>
                <div className="text-[10px] text-muted-foreground">סעיפים</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-muted-foreground">{stats.skipped}</div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                  <SkipForward className="w-3 h-3" /> דילוג
                </div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-red-500">{stats.errors}</div>
                <div className="text-[10px] text-muted-foreground">שגיאות</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold">
                  <Clock className="w-4 h-4 inline ml-1" />
                  {formatDuration(isRunning ? elapsedLive : stats.elapsed)}
                </div>
                <div className="text-[10px] text-muted-foreground">זמן</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold">{formatRate(stats.avgPerItem)}</div>
                <div className="text-[10px] text-muted-foreground">קצב</div>
              </div>
            </div>

            {isRunning && etaMs > 0 && (
              <div className="text-xs text-muted-foreground text-center mt-1">
                זמן משוער: {formatDuration(etaMs)} — נשארו {remaining} פסקים
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground">
              <Settings2 className="w-3.5 h-3.5" />
              הגדרות מנוע
              {settingsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            {/* Concurrency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  עובדים מקבילים
                </label>
                <Badge variant="outline">{concurrency}</Badge>
              </div>
              <Slider
                value={[concurrency]}
                onValueChange={([v]) => setConcurrency(v)}
                min={1}
                max={15}
                step={1}
                disabled={isActive}
              />
              <p className="text-[10px] text-muted-foreground">
                {concurrency <= 2 ? 'איטי ויציב' : concurrency <= 6 ? 'מאוזן' : 'מהיר (עומס גבוה)'}
              </p>
            </div>

            {/* Batch Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label>גודל באצ'</label>
                <Badge variant="outline">{batchSize}</Badge>
              </div>
              <Slider
                value={[batchSize]}
                onValueChange={([v]) => setBatchSize(v)}
                min={10}
                max={200}
                step={10}
                disabled={isActive}
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">דלג על כבר מנותחים</label>
                <Switch
                  checked={skipAnalyzed}
                  onCheckedChange={setSkipAnalyzed}
                  disabled={isActive}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">שימוש ב-AI (איטי יותר, מדויק יותר)</label>
                <Switch
                  checked={useAI}
                  onCheckedChange={setUseAI}
                  disabled={isActive}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              {errors.length} שגיאות
            </div>
            <ScrollArea className="h-24 rounded border p-2">
              {errors.map((err, i) => (
                <div key={i} className="text-xs py-0.5 border-b last:border-0 text-muted-foreground">
                  <span className="text-foreground">{err.title || err.psakId.slice(0, 8)}</span>
                  {' — '}
                  {err.message}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* Done */}
        {isDone && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              הניתוח הושלם. נמצאו {stats.sectionsFound} סעיפים ב-{stats.processed} פסקי דין
              ({formatDuration(stats.elapsed)})
            </span>
          </div>
        )}

        {/* Saved progress banner */}
        {!isActive && !isDone && savedProgress && (
          <div className="flex items-center justify-between text-sm bg-orange-50 dark:bg-orange-950/30 p-3 rounded border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Save className="w-4 h-4" />
              <span>
                נשמר ניתוח: {savedProgress.stats.processed}/{savedProgress.stats.totalPsakim} פסקים
                {' • '}
                לפני {formatDuration(Date.now() - savedProgress.savedAt)}
              </span>
            </div>
            <Button size="sm" variant="ghost" className="text-xs text-red-500 h-6 px-2" onClick={clearSavedProgress}>
              מחק
            </Button>
          </div>
        )}
      </CardContent>

      {/* Resume Dialog */}
      <AlertDialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>נמצא ניתוח שמור</AlertDialogTitle>
            <AlertDialogDescription>
              נשמר התקדמות של {savedProgress?.stats.processed}/{savedProgress?.stats.totalPsakim} פסקים
              ({savedProgress ? Math.round((savedProgress.stats.processed / savedProgress.stats.totalPsakim) * 100) : 0}%).
              <br />
              האם להמשיך מהמקום שעצרת או להתחיל מחדש?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
            <AlertDialogAction onClick={handleStartFromSaved}>
              המשך מהמקום שעצרתי
            </AlertDialogAction>
            <AlertDialogAction onClick={handleStartFresh} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              התחל מחדש
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
