import { useCallback, useEffect, useRef } from 'react';
import { useIndexingStore, IndexingStatus } from '@/stores/indexingStore';
import { runIndexingEngine } from '@/lib/indexingEngine';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Zap, Pause, Play, Square, RotateCcw, AlertTriangle,
  CheckCircle2, Clock, Cpu, Layers, SkipForward, Hash,
  Settings2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

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

function StatusBadge({ status }: { status: IndexingStatus }) {
  const config: Record<IndexingStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    idle: { label: 'ממתין', variant: 'secondary' },
    running: { label: 'פועל', variant: 'default' },
    paused: { label: 'מושהה', variant: 'outline' },
    completed: { label: 'הושלם', variant: 'secondary' },
    error: { label: 'שגיאה', variant: 'destructive' },
  };
  const c = config[status];
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

export default function IndexingControlPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const status = useIndexingStore(s => s.status);
  const stats = useIndexingStore(s => s.stats);
  const errors = useIndexingStore(s => s.errors);
  const concurrency = useIndexingStore(s => s.concurrency);
  const batchSize = useIndexingStore(s => s.batchSize);
  const skipIndexed = useIndexingStore(s => s.skipIndexed);
  const useAI = useIndexingStore(s => s.useAI);

  const setConcurrency = useIndexingStore(s => s.setConcurrency);
  const setBatchSize = useIndexingStore(s => s.setBatchSize);
  const setSkipIndexed = useIndexingStore(s => s.setSkipIndexed);
  const setUseAI = useIndexingStore(s => s.setUseAI);
  const start = useIndexingStore(s => s.start);
  const pause = useIndexingStore(s => s.pause);
  const resume = useIndexingStore(s => s.resume);
  const cancel = useIndexingStore(s => s.cancel);
  const reset = useIndexingStore(s => s.reset);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;
  const isDone = status === 'completed';

  // Auto-invalidate queries when done
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['talmud_references'] });
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
    start();
    // Run engine in next microtask to let store update
    setTimeout(() => {
      runIndexingEngine(user?.id ?? null).catch(console.error);
    }, 0);
  }, [start, user?.id]);

  const handleResume = useCallback(() => {
    resume();
  }, [resume]);

  const handleCancel = useCallback(() => {
    cancel();
    queryClient.invalidateQueries({ queryKey: ['talmud_references'] });
  }, [cancel, queryClient]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // Progress calculation
  const totalWork = stats.totalPsakim - stats.skipped;
  const progressPct = stats.totalPsakim > 0
    ? ((stats.processed + stats.skipped) / stats.totalPsakim) * 100
    : 0;

  const remaining = totalWork - stats.processed;
  const etaMs = stats.avgPerItem > 0 ? remaining * stats.avgPerItem : 0;
  const elapsedLive = stats.startedAt ? Date.now() - stats.startedAt : stats.elapsed;

  return (
    <Card className="border-primary/20" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            מנוע אינדוקס
            <StatusBadge status={status} />
          </CardTitle>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isActive && !isDone && (
              <Button size="sm" onClick={handleStart} className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {status === 'error' ? 'נסה שוב' : 'התחל אינדוקס'}
              </Button>
            )}
            {isRunning && (
              <Button size="sm" variant="outline" onClick={pause} className="gap-1.5">
                <Pause className="w-3.5 h-3.5" />
                השהה
              </Button>
            )}
            {isPaused && (
              <Button size="sm" onClick={handleResume} className="gap-1.5">
                <Play className="w-3.5 h-3.5" />
                המשך
              </Button>
            )}
            {isActive && (
              <Button size="sm" variant="destructive" onClick={handleCancel} className="gap-1.5">
                <Square className="w-3.5 h-3.5" />
                בטל
              </Button>
            )}
            {isDone && (
              <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                אפס
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(isActive || isDone || status === 'error') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{stats.processed + stats.skipped} / {stats.totalPsakim} פסקי דין</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />

            {/* Stats Grid */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-primary">{stats.processed}</div>
                <div className="text-[10px] text-muted-foreground">עובדו</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-green-600">{stats.refsFound}</div>
                <div className="text-[10px] text-muted-foreground">הפניות</div>
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

            {/* ETA */}
            {isRunning && etaMs > 0 && (
              <div className="text-xs text-muted-foreground text-center mt-1">
                זמן משוער: {formatDuration(etaMs)} • נשארו {remaining} פסקים
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
                {concurrency <= 3 ? 'איטי ויציב' : concurrency <= 8 ? 'מאוזן' : 'מהיר (עומס גבוה)'}
              </p>
            </div>

            {/* Batch Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  גודל באץ'
                </label>
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
                <label className="text-sm flex items-center gap-1.5">
                  <SkipForward className="w-3.5 h-3.5" />
                  דלג על כבר מאונדקסים
                </label>
                <Switch
                  checked={skipIndexed}
                  onCheckedChange={setSkipIndexed}
                  disabled={isActive}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  שימוש ב-AI (איטי יותר, מדויק יותר)
                </label>
                <Switch
                  checked={useAI}
                  onCheckedChange={setUseAI}
                  disabled={isActive}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Errors Log */}
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

        {/* Done message */}
        {isDone && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              האינדוקס הושלם! נמצאו {stats.refsFound} הפניות תלמודיות ב-{stats.processed} פסקי דין
              ({formatDuration(stats.elapsed)})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
