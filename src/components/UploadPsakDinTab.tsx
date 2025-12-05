import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp, Sparkles, Brain, Play, Pause, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 5;
const PENDING_UPLOADS_KEY = "pending-uploads";
const UPLOAD_SESSION_KEY = "upload-session";

interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  successful: number;
  failed: number;
}

interface PendingUpload {
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  error?: string;
  resultId?: string;
}

interface UploadSession {
  metadata: Record<string, any>;
  results: any[];
  errors: string[];
  pendingAnalysis: string[];
  timestamp: number;
}

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pauseRef = useRef(false);
  const { toast } = useToast();
  
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");
  const [enableAIAnalysis, setEnableAIAnalysis] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  
  // Session recovery
  const [savedSession, setSavedSession] = useState<UploadSession | null>(null);

  // Load saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem(UPLOAD_SESSION_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved) as UploadSession;
        // Only restore if less than 24 hours old
        if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
          setSavedSession(session);
        } else {
          localStorage.removeItem(UPLOAD_SESSION_KEY);
        }
      } catch {}
    }
  }, []);

  const saveSession = (session: Partial<UploadSession>) => {
    const fullSession: UploadSession = {
      metadata: session.metadata || { court, year: parseInt(year), tags: tags.split(',').filter(Boolean) },
      results: session.results || results,
      errors: session.errors || errors,
      pendingAnalysis: session.pendingAnalysis || [],
      timestamp: Date.now(),
    };
    localStorage.setItem(UPLOAD_SESSION_KEY, JSON.stringify(fullSession));
    setSavedSession(fullSession);
  };

  const clearSession = () => {
    localStorage.removeItem(UPLOAD_SESSION_KEY);
    setSavedSession(null);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(ext || '');
    });
    setFiles(prev => [...prev, ...validFiles]);
    
    if (validFiles.length < selectedFiles.length) {
      toast({
        title: `${selectedFiles.length - validFiles.length} קבצים לא נתמכים הוסרו`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(ext || '');
    });
    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const uploadBatch = async (batch: File[], metadata: Record<string, any>): Promise<{ results: any[]; errors: string[] }> => {
    const formData = new FormData();
    batch.forEach(file => {
      formData.append("files", file);
    });
    formData.append("metadata", JSON.stringify(metadata));

    const { data, error } = await supabase.functions.invoke('upload-psak-din', {
      body: formData,
    });

    if (error) {
      return { results: [], errors: batch.map(f => `${f.name}: ${error.message}`) };
    }

    return {
      results: data?.results || [],
      errors: data?.errors || [],
    };
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
    
    if (pauseRef.current) {
      toast({ title: "ההעלאה הושהתה", description: "לחץ המשך כדי להמשיך" });
    } else {
      toast({ title: "ממשיך בהעלאה..." });
    }
  };

  const handleUpload = async (resumeFromSession = false) => {
    if (!resumeFromSession && files.length === 0) {
      toast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setPaused(false);
    pauseRef.current = false;
    
    let allResults: any[] = resumeFromSession && savedSession ? [...savedSession.results] : [];
    let allErrors: string[] = resumeFromSession && savedSession ? [...savedSession.errors] : [];
    
    setResults(allResults);
    setErrors(allErrors);
    
    const metadata = resumeFromSession && savedSession?.metadata ? savedSession.metadata : {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    const filesToUpload = files;
    const batches: File[][] = [];
    for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
      batches.push(filesToUpload.slice(i, i + BATCH_SIZE));
    }

    setProgress({
      total: filesToUpload.length,
      completed: 0,
      current: '',
      successful: allResults.length,
      failed: allErrors.length,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        // Check for pause
        while (pauseRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const batch = batches[i];
        const batchFileNames = batch.map(f => f.name).join(', ');
        
        setProgress(prev => prev ? {
          ...prev,
          current: batchFileNames.length > 50 ? batchFileNames.substring(0, 50) + '...' : batchFileNames,
        } : null);

        const { results: batchResults, errors: batchErrors } = await uploadBatch(batch, metadata);
        
        allResults.push(...batchResults);
        allErrors.push(...batchErrors);

        // Save session after each batch (partial save)
        saveSession({
          metadata,
          results: allResults,
          errors: allErrors,
          pendingAnalysis: enableAIAnalysis ? allResults.map(r => r.id) : [],
        });

        setProgress(prev => prev ? {
          ...prev,
          completed: Math.min((i + 1) * BATCH_SIZE, filesToUpload.length),
          successful: allResults.length,
          failed: allErrors.length,
        } : null);

        setResults([...allResults]);
        setErrors([...allErrors]);

        // Remove uploaded files from the list
        const uploadedNames = new Set(batch.map(f => f.name));
        setFiles(prev => prev.filter(f => !uploadedNames.has(f.name)));

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      toast({
        title: `הועלו ${allResults.length} פסקי דין בהצלחה`,
        description: allErrors.length > 0 ? `${allErrors.length} שגיאות` : enableAIAnalysis ? "מתחיל ניתוח AI..." : undefined,
      });

      // Run AI analysis if enabled
      if (enableAIAnalysis && allResults.length > 0) {
        await runAIAnalysis(allResults);
      }

      // Clear session on complete success
      clearSession();
      setCourt("");
      setYear(new Date().getFullYear().toString());
      setTags("");

    } catch (error) {
      console.error('Upload error:', error);
      // Save session on error for recovery
      saveSession({
        metadata,
        results: allResults,
        errors: allErrors,
        pendingAnalysis: enableAIAnalysis ? allResults.filter(r => !r.analyzed).map(r => r.id) : [],
      });
      
      toast({
        title: "שגיאה בהעלאה",
        description: "ההעלאות שהצליחו נשמרו. תוכל להמשיך מאוחר יותר.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setPaused(false);
      setProgress(null);
    }
  };

  const runAIAnalysis = async (psakimToAnalyze: any[]) => {
    setAnalyzing(true);
    setAnalysisProgress({ current: 0, total: psakimToAnalyze.length });
    
    for (let i = 0; i < psakimToAnalyze.length; i++) {
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = psakimToAnalyze[i];
      setAnalysisProgress({ current: i + 1, total: psakimToAnalyze.length });
      
      try {
        await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: result.id }
        });
        console.log(`Analyzed psak ${result.id}`);
      } catch (err) {
        console.error(`Error analyzing psak ${result.id}:`, err);
      }
      
      if (i < psakimToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setAnalyzing(false);
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${psakimToAnalyze.length} פסקי דין וקושרו למקורות`,
    });
  };

  const resumeAnalysis = async () => {
    if (!savedSession?.pendingAnalysis?.length) return;
    
    // Fetch psak data for pending analysis
    const { data: psakim } = await supabase
      .from('psakei_din')
      .select('*')
      .in('id', savedSession.pendingAnalysis);
    
    if (psakim && psakim.length > 0) {
      await runAIAnalysis(psakim);
      clearSession();
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <Archive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const progressPercent = progress ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6 text-right">
        {/* Session Recovery Card */}
        {savedSession && savedSession.results.length > 0 && (
          <Card className="border-2 border-accent/50 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-accent" />
                  <div>
                    <p className="font-medium">יש העלאה קודמת שלא הושלמה</p>
                    <p className="text-sm text-muted-foreground">
                      {savedSession.results.length} פסקים הועלו, 
                      {savedSession.pendingAnalysis?.length || 0} ממתינים לניתוח
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {savedSession.pendingAnalysis?.length > 0 && (
                    <Button size="sm" onClick={resumeAnalysis} className="gap-1">
                      <Sparkles className="w-4 h-4" />
                      המשך ניתוח
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={clearSession}>
                    התחל מחדש
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5" />
              העלאת פסקי דין
              <span className="text-sm font-normal text-muted-foreground">
                (שמירה אוטומטית בכל שלב)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Drop Zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors bg-muted/20"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf,.zip"
                onChange={handleFileSelect}
                className="hidden"
                {...{ webkitdirectory: "", directory: "" } as any}
              />
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
              <p className="text-sm text-muted-foreground mt-2">
                PDF, DOCX, DOC, TXT, RTF, ZIP
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  className="gap-2"
                >
                  <FolderUp className="w-4 h-4" />
                  בחר תיקייה
                </Button>
              </div>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">קבצים נבחרים ({files.length})</Label>
                  <Button variant="ghost" size="sm" onClick={clearAllFiles} className="text-destructive">
                    <X className="w-4 h-4 ml-1" />
                    נקה הכל
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-muted/10">
                  <div className="flex flex-wrap gap-2">
                    {files.slice(0, 100).map((file, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="flex items-center gap-1 py-1 px-2 text-xs"
                      >
                        {getFileIcon(file.name)}
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {files.length > 100 && (
                      <Badge variant="outline" className="py-1 px-2">
                        +{files.length - 100} קבצים נוספים
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Progress with Pause/Resume */}
            {progress && (
              <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span>מעלה: {progress.current}</span>
                  <div className="flex items-center gap-2">
                    <span>{progress.completed}/{progress.total}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePause}
                      className="h-7 w-7 p-0"
                    >
                      {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-green-600">הצליחו: {progress.successful}</span>
                  {progress.failed > 0 && (
                    <span className="text-destructive">נכשלו: {progress.failed}</span>
                  )}
                </div>
                {paused && (
                  <p className="text-xs text-accent text-center">ההעלאה מושהית - לחץ ▶ להמשך</p>
                )}
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="court">בית דין (לכל הקבצים)</Label>
                <Input
                  id="court"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="לדוגמה: בית הדין הרבני"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">שנה</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">תגיות (מופרדות בפסיקים)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ממונות, נזיקין"
                  className="bg-card border-border"
                />
              </div>
            </div>

            {/* AI Analysis Toggle */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="ai-analysis" className="font-medium">ניתוח AI וסיווג אוטומטי</Label>
                  <p className="text-xs text-muted-foreground">
                    זיהוי מקורות תלמודיים, חילוץ מטא-דאטה, וקישור לדפי גמרא
                  </p>
                </div>
              </div>
              <Switch
                id="ai-analysis"
                checked={enableAIAnalysis}
                onCheckedChange={setEnableAIAnalysis}
              />
            </div>

            {/* AI Analysis Progress */}
            {analyzing && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span>מנתח פסקי דין באמצעות AI...</span>
                  <span className="mr-auto">{analysisProgress.current}/{analysisProgress.total}</span>
                </div>
                <Progress 
                  value={(analysisProgress.current / analysisProgress.total) * 100} 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  מזהה מקורות תלמודיים ומסווג את פסקי הדין
                </p>
              </div>
            )}

            <Button
              onClick={() => handleUpload(false)}
              disabled={uploading || analyzing || files.length === 0}
              className="w-full gap-2"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מעלה {progress?.completed || 0}/{files.length}...
                </>
              ) : analyzing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  מנתח...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  העלה {files.length > 0 ? `${files.length} קבצים` : ''}
                  {enableAIAnalysis && files.length > 0 && ' + ניתוח AI'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                הועלו בהצלחה ({results.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="truncate">{result.title || result.fileName}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Card className="border border-destructive/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                שגיאות ({errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1 text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{error}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UploadPsakDinTab;
