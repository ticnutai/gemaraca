import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Download,
  Upload,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  FileCode,
  Search,
  Loader2,
  Eye,
  Undo2,
  Trash2,
  Copy,
  Database,
  Activity,
} from "lucide-react";
import { lazy, Suspense } from "react";

const MonitoringTab = lazy(() => import("@/components/MonitoringTab"));
import { cn } from "@/lib/utils";

interface Migration {
  id: string;
  name: string;
  description: string | null;
  sql_content: string;
  source: string;
  source_url: string | null;
  status: string;
  error_message: string | null;
  rows_affected: number;
  execution_time_ms: number;
  created_at: string;
  executed_at: string | null;
}

interface SqlAnalysis {
  statements: number;
  operations: string[];
  tables: string[];
  risks: string[];
  isDestructive: boolean;
}

export default function DevMigrationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("editor");
  const [sqlContent, setSqlContent] = useState("");
  const [migrationName, setMigrationName] = useState("");
  const [description, setDescription] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SqlAnalysis | null>(null);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [viewMigration, setViewMigration] = useState<Migration | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const invoke = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke('run-migration', { body });
    if (error) throw error;
    return data;
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!sqlContent.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await invoke({ action: 'analyze', sql: sqlContent });
      setAnalysis(result);
    } catch (err: any) {
      toast({ title: "שגיאה בניתוח", description: err.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [sqlContent, invoke]);

  const handleExecute = useCallback(async () => {
    if (!sqlContent.trim() || !migrationName.trim()) {
      toast({ title: "שם ו-SQL נדרשים", variant: "destructive" });
      return;
    }
    
    if (analysis?.isDestructive) {
      if (!confirm("⚠️ המיגרציה מכילה פעולות הרסניות! להמשיך?")) return;
    }

    setIsExecuting(true);
    setLastResult(null);
    try {
      const result = await invoke({
        action: 'execute',
        sql: sqlContent,
        name: migrationName,
        description,
        source: urlInput ? 'url' : 'manual',
        sourceUrl: urlInput || undefined,
      });

      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "✅ מיגרציה הצליחה",
          description: `${result.rowsAffected || 0} שורות הושפעו (${result.executionTime}ms)`,
        });
        setSqlContent("");
        setMigrationName("");
        setDescription("");
        setUrlInput("");
        setAnalysis(null);
      } else {
        toast({
          title: "❌ מיגרציה נכשלה",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  }, [sqlContent, migrationName, description, urlInput, analysis, invoke]);

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    try {
      const result = await invoke({ action: 'fetch_url', url: urlInput });
      if (result.error) {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" });
        return;
      }
      setSqlContent(result.sql);
      if (result.name) setMigrationName(result.name);
      if (result.description) setDescription(result.description);
      toast({
        title: "SQL נשלף בהצלחה",
        description: `פורמט: ${result.format}`,
      });
      // Auto-analyze
      setIsAnalyzing(true);
      const analysis = await invoke({ action: 'analyze', sql: result.sql });
      setAnalysis(analysis);
      setIsAnalyzing(false);
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [urlInput, invoke]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const result = await invoke({ action: 'list' });
      setMigrations(result.migrations || []);
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [invoke]);

  const handleRollback = useCallback(async (id: string) => {
    if (!confirm("לסמן מיגרציה כמבוטלת?")) return;
    try {
      await invoke({ action: 'rollback', migrationId: id });
      toast({ title: "סומנה כמבוטלת" });
      loadHistory();
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
  }, [invoke, loadHistory]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      setSqlContent(content);
      setMigrationName(file.name.replace(/\.[^.]+$/, ''));
      toast({ title: "קובץ נטען" });
      // Auto-analyze
      try {
        const result = await invoke({ action: 'analyze', sql: content });
        setAnalysis(result);
      } catch {}
    };
    reader.readAsText(file);
  }, [invoke]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running': return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'rolled_back': return <Undo2 className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'success': return 'הצליחה';
      case 'failed': return 'נכשלה';
      case 'running': return 'רצה';
      case 'rolled_back': return 'בוטלה';
      default: return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            מערכת מיגרציות - פיתוח
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'history') loadHistory(); }} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="editor" className="gap-1">
              <FileCode className="h-4 w-4" />
              עורך SQL
            </TabsTrigger>
            <TabsTrigger value="http" className="gap-1">
              <Globe className="h-4 w-4" />
              ייבוא HTTP
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-1">
              <Activity className="h-4 w-4" />
              מוניטורינג
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-4 w-4" />
              היסטוריה
            </TabsTrigger>
          </TabsList>

          {/* SQL Editor Tab */}
          <TabsContent value="editor" className="flex-1 overflow-auto space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="שם המיגרציה *"
                value={migrationName}
                onChange={e => setMigrationName(e.target.value)}
                className="bg-input border-border"
              />
              <Input
                placeholder="תיאור (אופציונלי)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="relative">
              <Textarea
                placeholder={`-- כתוב SQL כאן...\n-- CREATE TABLE, ALTER TABLE, INSERT, UPDATE...\n-- תומך בפקודות מתקדמות: functions, triggers, policies`}
                value={sqlContent}
                onChange={e => { setSqlContent(e.target.value); setAnalysis(null); }}
                className="font-mono text-sm min-h-[200px] bg-input border-border resize-y"
                dir="ltr"
              />
              <div className="absolute top-2 left-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(sqlContent); toast({ title: "הועתק" }); }}
                  disabled={!sqlContent}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <label className="cursor-pointer">
                <input type="file" accept=".sql,.txt,.json" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="h-4 w-4 ml-1" />העלאת קובץ</span>
                </Button>
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={!sqlContent || isAnalyzing}
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Search className="h-4 w-4 ml-1" />}
                ניתוח
              </Button>

              <div className="flex-1" />

              <Button
                onClick={handleExecute}
                disabled={isExecuting || !sqlContent || !migrationName}
                className={cn(
                  analysis?.isDestructive && "bg-destructive hover:bg-destructive/90"
                )}
              >
                {isExecuting ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Play className="h-4 w-4 ml-1" />}
                הרצה
              </Button>
            </div>

            {/* Analysis Result */}
            {analysis && (
              <Card className={cn(
                "border",
                analysis.isDestructive ? "border-destructive bg-destructive/5" : "border-border"
              )}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {analysis.isDestructive ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <span className="font-medium text-sm">
                      {analysis.statements} פקודות
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {analysis.operations.map(op => (
                      <Badge key={op} variant={
                        ['DROP TABLE', 'TRUNCATE', 'DELETE'].includes(op) ? 'destructive' : 'secondary'
                      } className="text-xs">{op}</Badge>
                    ))}
                  </div>

                  {analysis.tables.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      טבלאות: {analysis.tables.join(', ')}
                    </div>
                  )}

                  {analysis.risks.length > 0 && (
                    <div className="space-y-1">
                      {analysis.risks.map((risk, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {risk}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Last Result */}
            {lastResult && (
              <Card className={cn("border", lastResult.success ? "border-green-500/30" : "border-destructive/30")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    {lastResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-medium">
                      {lastResult.success ? 'הצליחה' : 'נכשלה'}
                    </span>
                    <span className="text-muted-foreground">
                      ({lastResult.executionTime}ms)
                    </span>
                  </div>
                  {lastResult.error && (
                    <pre className="mt-2 text-xs text-destructive bg-destructive/5 p-2 rounded overflow-x-auto" dir="ltr">
                      {lastResult.error}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HTTP Import Tab */}
          <TabsContent value="http" className="flex-1 overflow-auto space-y-3 mt-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  ייבוא מיגרציה מ-URL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  תומך בקבצי SQL, JSON עם שדה sql, ודפי HTML (מחלץ קוד מתגיות pre/code).
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/migration.sql"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    className="flex-1 font-mono text-sm bg-input border-border"
                    dir="ltr"
                  />
                  <Button onClick={handleFetchUrl} disabled={isFetching || !urlInput}>
                    {isFetching ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
                    שלוף
                  </Button>
                </div>

                {sqlContent && urlInput && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">תוכן שנשלף:</div>
                    <pre className="text-xs bg-muted/50 p-2 rounded max-h-[200px] overflow-auto font-mono" dir="ltr">
                      {sqlContent.substring(0, 2000)}
                      {sqlContent.length > 2000 && '...'}
                    </pre>
                    <div className="flex gap-2">
                      <Input
                        placeholder="שם המיגרציה"
                        value={migrationName}
                        onChange={e => setMigrationName(e.target.value)}
                        className="flex-1 bg-input border-border"
                      />
                      <Button
                        onClick={handleExecute}
                        disabled={isExecuting || !migrationName}
                      >
                        {isExecuting ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Play className="h-4 w-4 ml-1" />}
                        הרצה
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  פורמטים נתמכים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded">
                    <strong>.sql</strong> - קובץ SQL ישיר
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <strong>.json</strong> - {`{ "sql": "...", "name": "..." }`}
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <strong>HTML</strong> - חילוץ מ-pre/code
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <strong>JSON Array</strong> - מערך פקודות SQL
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-[400px]">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : migrations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  אין היסטוריית מיגרציות
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {migrations.map(m => (
                    <Card key={m.id} className="border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          {statusIcon(m.status)}
                          <span className="font-medium text-sm flex-1">{m.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {statusLabel(m.status)}
                          </Badge>
                        </div>
                        
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{new Date(m.created_at).toLocaleString('he-IL')}</span>
                          {m.execution_time_ms > 0 && <span>{m.execution_time_ms}ms</span>}
                          {m.rows_affected > 0 && <span>{m.rows_affected} שורות</span>}
                          <Badge variant="outline" className="text-xs">{m.source}</Badge>
                        </div>

                        {m.error_message && (
                          <pre className="text-xs text-destructive mt-2 bg-destructive/5 p-2 rounded overflow-x-auto" dir="ltr">
                            {m.error_message}
                          </pre>
                        )}

                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMigration(m)}
                          >
                            <Eye className="h-3 w-3 ml-1" />
                            צפייה
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSqlContent(m.sql_content);
                              setMigrationName(`${m.name} (חוזר)`);
                              setActiveTab("editor");
                            }}
                          >
                            <Copy className="h-3 w-3 ml-1" />
                            שכפול
                          </Button>
                          {m.status === 'success' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRollback(m.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Undo2 className="h-3 w-3 ml-1" />
                              ביטול
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* View migration dialog */}
        {viewMigration && (
          <Dialog open={!!viewMigration} onOpenChange={() => setViewMigration(null)}>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>{viewMigration.name}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                <pre className="font-mono text-xs bg-muted/50 p-3 rounded whitespace-pre-wrap" dir="ltr">
                  {viewMigration.sql_content}
                </pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
