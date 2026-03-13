import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bug, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Database, Globe, User, Table2, FunctionSquare, Clock,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail' | 'warn';

interface DiagnosticCheck {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: CheckStatus;
  detail: string;
  durationMs: number;
}

const initialChecks: Omit<DiagnosticCheck, 'status' | 'detail' | 'durationMs'>[] = [
  { id: 'env', label: 'משתני סביבה (ENV)', icon: <Globe className="w-4 h-4" /> },
  { id: 'supabase', label: 'חיבור Supabase', icon: <Database className="w-4 h-4" /> },
  { id: 'auth', label: 'אימות משתמש', icon: <User className="w-4 h-4" /> },
  { id: 'psakei_din', label: 'טבלת psakei_din', icon: <Table2 className="w-4 h-4" /> },
  { id: 'talmud_refs', label: 'טבלת talmud_references', icon: <Table2 className="w-4 h-4" /> },
  { id: 'edge_fn', label: 'Edge Function (extract-references)', icon: <FunctionSquare className="w-4 h-4" /> },
  { id: 'sample_extract', label: 'חילוץ לדוגמה', icon: <FunctionSquare className="w-4 h-4" /> },
];

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'fail': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default: return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

function statusBadge(status: CheckStatus) {
  switch (status) {
    case 'pass': return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-[10px]">עבר</Badge>;
    case 'fail': return <Badge variant="destructive" className="text-[10px]">נכשל</Badge>;
    case 'warn': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 text-[10px]">אזהרה</Badge>;
    case 'running': return <Badge variant="secondary" className="text-[10px]">בודק...</Badge>;
    default: return null;
  }
}

export default function DebugDiagnosticDialog() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<DiagnosticCheck[]>(
    initialChecks.map(c => ({ ...c, status: 'idle', detail: '', durationMs: 0 }))
  );
  const [running, setRunning] = useState(false);
  const [totalTime, setTotalTime] = useState(0);

  const updateCheck = useCallback((id: string, patch: Partial<DiagnosticCheck>) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const start = Date.now();
    // Reset all
    setChecks(initialChecks.map(c => ({ ...c, status: 'idle', detail: '', durationMs: 0 })));

    // ─── 1. ENV ──────────────────────────
    {
      updateCheck('env', { status: 'running' });
      const t = Date.now();
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const missing: string[] = [];
      if (!url) missing.push('VITE_SUPABASE_URL');
      if (!key) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
      if (missing.length > 0) {
        updateCheck('env', { status: 'fail', detail: `חסרים: ${missing.join(', ')}`, durationMs: Date.now() - t });
      } else {
        updateCheck('env', { status: 'pass', detail: `URL: ${url}`, durationMs: Date.now() - t });
      }
    }

    // ─── 2. Supabase Connection ──────────
    {
      updateCheck('supabase', { status: 'running' });
      const t = Date.now();
      try {
        const { data, error } = await supabase.from('psakei_din').select('id', { count: 'exact', head: true });
        if (error) throw error;
        updateCheck('supabase', { status: 'pass', detail: `מחובר בהצלחה (${Date.now() - t}ms)`, durationMs: Date.now() - t });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        updateCheck('supabase', { status: 'fail', detail: `שגיאת חיבור: ${msg}`, durationMs: Date.now() - t });
      }
    }

    // ─── 3. Auth ─────────────────────────
    {
      updateCheck('auth', { status: 'running' });
      const t = Date.now();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          updateCheck('auth', {
            status: 'pass',
            detail: `מחובר: ${session.user.email} (role: ${session.user.role})`,
            durationMs: Date.now() - t,
          });
        } else {
          updateCheck('auth', {
            status: 'warn',
            detail: 'לא מחובר — חילוץ הפניות ידרוש הרשאות RLS. נסה להתחבר.',
            durationMs: Date.now() - t,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        updateCheck('auth', { status: 'fail', detail: msg, durationMs: Date.now() - t });
      }
    }

    // ─── 4. psakei_din table ─────────────
    {
      updateCheck('psakei_din', { status: 'running' });
      const t = Date.now();
      try {
        const { count, error } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true });
        if (error) throw error;
        const total = count ?? 0;
        if (total === 0) {
          updateCheck('psakei_din', { status: 'warn', detail: 'הטבלה ריקה — אין פסקי דין לאנדקס. העלה פסקי דין קודם.', durationMs: Date.now() - t });
        } else {
          // Check how many have text
          const { count: withText } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true }).not('full_text', 'is', null);
          const { count: withSummary } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true }).not('summary', 'is', null);
          updateCheck('psakei_din', {
            status: 'pass',
            detail: `${total} פסקי דין | ${withText ?? 0} עם full_text | ${withSummary ?? 0} עם summary`,
            durationMs: Date.now() - t,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        updateCheck('psakei_din', { status: 'fail', detail: `שגיאה בגישה לטבלה: ${msg}`, durationMs: Date.now() - t });
      }
    }

    // ─── 5. talmud_references table ──────
    {
      updateCheck('talmud_refs', { status: 'running' });
      const t = Date.now();
      try {
        const { count, error } = await supabase.from('talmud_references').select('*', { count: 'exact', head: true });
        if (error) throw error;
        const total = count ?? 0;
        if (total === 0) {
          updateCheck('talmud_refs', { status: 'warn', detail: 'הטבלה ריקה — עדיין לא בוצע אינדוקס. לחץ "התחל אינדוקס".', durationMs: Date.now() - t });
        } else {
          const { count: pending } = await supabase.from('talmud_references').select('*', { count: 'exact', head: true }).eq('validation_status', 'pending');
          const { data: tractates } = await supabase.from('talmud_references').select('tractate');
          const uniqueTractates = new Set(tractates?.map(r => r.tractate) ?? []);
          updateCheck('talmud_refs', {
            status: 'pass',
            detail: `${total} הפניות | ${pending ?? 0} ממתינות | ${uniqueTractates.size} מסכתות`,
            durationMs: Date.now() - t,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('relation') && msg.includes('does not exist')) {
          updateCheck('talmud_refs', { status: 'fail', detail: 'הטבלה לא קיימת! הרץ את המיגרציה: 20260313100000_talmud_references.sql', durationMs: Date.now() - t });
        } else {
          updateCheck('talmud_refs', { status: 'fail', detail: `שגיאה: ${msg}`, durationMs: Date.now() - t });
        }
      }
    }

    // ─── 6. Edge Function ping ───────────
    {
      updateCheck('edge_fn', { status: 'running' });
      const t = Date.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-references`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '', documentId: '' }),
        });
        const elapsed = Date.now() - t;

        if (res.status === 400) {
          // Expected - function exists and rejects empty input
          updateCheck('edge_fn', { status: 'pass', detail: `Edge Function מגיב (${elapsed}ms) - דחה קלט ריק כצפוי`, durationMs: elapsed });
        } else if (res.status === 401 || res.status === 403) {
          updateCheck('edge_fn', { status: 'warn', detail: `Edge Function דורש אימות (${res.status}). ודא שאתה מחובר.`, durationMs: elapsed });
        } else if (res.status === 404) {
          updateCheck('edge_fn', { status: 'fail', detail: 'Edge Function לא נמצא (404). ודא שה-function מופעל ב-Supabase Dashboard.', durationMs: elapsed });
        } else if (res.status === 500 || res.status === 502 || res.status === 503) {
          const body = await res.text().catch(() => '');
          updateCheck('edge_fn', { status: 'fail', detail: `Edge Function שגיאת שרת (${res.status}): ${body.slice(0, 200)}`, durationMs: elapsed });
        } else {
          updateCheck('edge_fn', { status: 'pass', detail: `תשובה ${res.status} (${elapsed}ms)`, durationMs: elapsed });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        updateCheck('edge_fn', { status: 'fail', detail: `לא ניתן להגיע ל-Edge Function: ${msg}`, durationMs: Date.now() - t });
      }
    }

    // ─── 7. Sample extraction ────────────
    {
      updateCheck('sample_extract', { status: 'running' });
      const t = Date.now();
      try {
        const testText = 'על פי הגמרא בבבא קמא דף ב עמוד א וכן בסנהדרין דף לז עמוד ב';
        const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-references`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: testText, documentId: 'debug-test', useAI: false }),
        });
        const elapsed = Date.now() - t;

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          updateCheck('sample_extract', { status: 'fail', detail: `שגיאה בחילוץ: ${err.error || res.status}`, durationMs: elapsed });
        } else {
          const data = await res.json();
          const refs = data.references ?? [];
          if (refs.length >= 2) {
            const names = refs.map((r: Record<string, string>) => r.normalized).join(', ');
            updateCheck('sample_extract', { status: 'pass', detail: `נמצאו ${refs.length} הפניות: ${names} (${elapsed}ms)`, durationMs: elapsed });
          } else if (refs.length > 0) {
            updateCheck('sample_extract', { status: 'warn', detail: `נמצאה רק ${refs.length} הפניה מתוך 2 צפויות (${elapsed}ms)`, durationMs: elapsed });
          } else {
            updateCheck('sample_extract', { status: 'fail', detail: `לא נמצאו הפניות — הפונקציה לא מזהה טקסט תלמודי (${elapsed}ms)`, durationMs: elapsed });
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        updateCheck('sample_extract', { status: 'fail', detail: `שגיאה: ${msg}`, durationMs: Date.now() - t });
      }
    }

    setTotalTime(Date.now() - start);
    setRunning(false);
  }, [updateCheck]);

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const allDone = checks.every(c => c.status !== 'idle' && c.status !== 'running');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="דיבאג ואבחון מערכת"
        >
          <Bug className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            אבחון מערכת אינדוקס
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Run / Summary */}
          <div className="flex items-center justify-between">
            <Button
              onClick={runDiagnostics}
              disabled={running}
              size="sm"
              className="gap-1.5"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {running ? 'בודק...' : 'הרץ אבחון'}
            </Button>
            {allDone && (
              <div className="flex items-center gap-2 text-sm">
                {failCount > 0 ? (
                  <span className="text-red-500 font-medium">{failCount} נכשלו</span>
                ) : null}
                {warnCount > 0 ? (
                  <span className="text-yellow-600 font-medium">{warnCount} אזהרות</span>
                ) : null}
                <span className="text-green-600 font-medium">{passCount} עברו</span>
                <span className="text-muted-foreground text-xs">
                  <Clock className="w-3 h-3 inline ml-0.5" />
                  {(totalTime / 1000).toFixed(1)}s
                </span>
              </div>
            )}
          </div>

          {/* Overall Status */}
          {allDone && (
            <div className={`p-3 rounded text-sm flex items-center gap-2 ${
              failCount > 0
                ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                : warnCount > 0
                  ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                  : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
            }`}>
              {failCount > 0 ? (
                <><XCircle className="w-4 h-4" /> יש בעיות שמונעות מהמערכת לעבוד. ראה פירוט למטה.</>
              ) : warnCount > 0 ? (
                <><AlertTriangle className="w-4 h-4" /> המערכת יכולה לעבוד אבל יש דברים שכדאי לתקן.</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> 🎉 הכל תקין! המערכת מוכנה לאינדוקס.</>
              )}
            </div>
          )}

          {/* Checks List */}
          <ScrollArea className="h-[350px]">
            <div className="space-y-2 pr-2">
              {checks.map(check => (
                <div
                  key={check.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    check.status === 'fail' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' :
                    check.status === 'warn' ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20' :
                    check.status === 'pass' ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' :
                    'border-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon status={check.status} />
                    <span className="text-sm font-medium flex-1">{check.label}</span>
                    {check.icon}
                    {statusBadge(check.status)}
                  </div>
                  {check.detail && (
                    <p className={`text-xs mt-1.5 mr-6 leading-relaxed ${
                      check.status === 'fail' ? 'text-red-600 dark:text-red-400' :
                      check.status === 'warn' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-muted-foreground'
                    }`}>
                      {check.detail}
                    </p>
                  )}
                  {check.durationMs > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 mr-6">
                      {check.durationMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
