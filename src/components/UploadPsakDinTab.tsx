import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp, Sparkles, Brain, Play, Pause, RefreshCw, Copy, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 5;
const UPLOAD_SESSION_KEY = "upload-session";

interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  successful: number;
  failed: number;
  skipped: number;
}

interface UploadSession {
  metadata: Record<string, any>;
  results: any[];
  errors: string[];
  pendingAnalysis: string[];
  timestamp: number;
}

interface DuplicateFile {
  name: string;
  existingTitle: string;
}

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pauseRef = useRef(false);
  const { toast } = useToast();
  
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");
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

  // Check for duplicates when files are selected
  const checkDuplicates = useCallback(async (filesToCheck: File[]) => {
    if (filesToCheck.length === 0) return;
    
    setCheckingDuplicates(true);
    
    try {
      // Get all existing titles from database
      const { data: existingPsakim } = await supabase
        .from('psakei_din')
        .select('title');
      
      const existingTitles = new Set(
        (existingPsakim || []).map(p => p.title.toLowerCase().trim())
      );
      
      const foundDuplicates: DuplicateFile[] = [];
      const uniqueFiles: File[] = [];
      
      for (const file of filesToCheck) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
        
        // Check if file name matches existing title
        const isDuplicate = existingTitles.has(baseName) || 
          Array.from(existingTitles).some(title => 
            title.includes(baseName) || baseName.includes(title)
          );
        
        if (isDuplicate) {
          foundDuplicates.push({
            name: file.name,
            existingTitle: Array.from(existingTitles).find(t => 
              t.includes(baseName) || baseName.includes(t)
            ) || baseName
          });
        } else {
          uniqueFiles.push(file);
        }
      }
      
      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        toast({
          title: `נמצאו ${foundDuplicates.length} קבצים כפולים`,
          description: "קבצים אלו כבר קיימים במערכת והוסרו מההעלאה",
          variant: "destructive",
        });
      }
      
      setFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const newUniqueFiles = uniqueFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...newUniqueFiles];
      });
      
    } catch (error) {
      console.error('Error checking duplicates:', error);
      // If check fails, add all files
      setFiles(prev => [...prev, ...filesToCheck]);
    } finally {
      setCheckingDuplicates(false);
    }
  }, [toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(ext || '');
    });
    
    if (validFiles.length < selectedFiles.length) {
      toast({
        title: `${selectedFiles.length - validFiles.length} קבצים לא נתמכים הוסרו`,
        variant: "destructive",
      });
    }
    
    await checkDuplicates(validFiles);
  }, [toast, checkDuplicates]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(ext || '');
    });
    await checkDuplicates(validFiles);
  }, [checkDuplicates]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setDuplicates([]);
  };

  const clearDuplicates = () => {
    setDuplicates([]);
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

  const handleUpload = async (withAI: boolean = false) => {
    if (files.length === 0) {
      toast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setPaused(false);
    pauseRef.current = false;
    
    let allResults: any[] = [];
    let allErrors: string[] = [];
    
    setResults(allResults);
    setErrors(allErrors);
    
    const metadata = {
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
      successful: 0,
      failed: 0,
      skipped: duplicates.length,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
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

        saveSession({
          metadata,
          results: allResults,
          errors: allErrors,
          pendingAnalysis: withAI ? allResults.map(r => r.id) : [],
        });

        setProgress(prev => prev ? {
          ...prev,
          completed: Math.min((i + 1) * BATCH_SIZE, filesToUpload.length),
          successful: allResults.length,
          failed: allErrors.length,
        } : null);

        setResults([...allResults]);
        setErrors([...allErrors]);

        const uploadedNames = new Set(batch.map(f => f.name));
        setFiles(prev => prev.filter(f => !uploadedNames.has(f.name)));

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      toast({
        title: `הועלו ${allResults.length} פסקי דין בהצלחה`,
        description: allErrors.length > 0 
          ? `${allErrors.length} שגיאות` 
          : withAI ? "מתחיל ניתוח AI..." : undefined,
      });

      if (withAI && allResults.length > 0) {
        await runAIAnalysis(allResults);
      }

      clearSession();
      setCourt("");
      setYear(new Date().getFullYear().toString());
      setTags("");
      setDuplicates([]);

    } catch (error) {
      console.error('Upload error:', error);
      saveSession({
        metadata,
        results: allResults,
        errors: allErrors,
        pendingAnalysis: withAI ? allResults.filter(r => !r.analyzed).map(r => r.id) : [],
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
              <div className="flex items-center justify-between flex-row-reverse">
                <div className="flex items-center gap-3 flex-row-reverse">
                  <RefreshCw className="w-5 h-5 text-accent" />
                  <div className="text-right">
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

        {/* Duplicates Warning */}
        {duplicates.length > 0 && (
          <Card className="border-2 border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-row-reverse text-destructive">
                <Copy className="w-4 h-4" />
                קבצים כפולים שהוסרו ({duplicates.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 mb-3">
                {duplicates.slice(0, 10).map((dup, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    {dup.name}
                  </Badge>
                ))}
                {duplicates.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{duplicates.length - 10} נוספים
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={clearDuplicates} className="text-xs">
                הסתר הודעה
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2 flex-row-reverse">
              <Upload className="w-5 h-5" />
              העלאת פסקי דין
              <span className="text-sm font-normal text-muted-foreground">
                (זיהוי כפילויות אוטומטי)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors bg-muted/20 ${
                checkingDuplicates ? 'border-accent' : 'border-border'
              }`}
              onClick={() => !checkingDuplicates && fileInputRef.current?.click()}
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
              {checkingDuplicates ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto text-accent mb-4 animate-spin" />
                  <p className="text-foreground font-medium">בודק קבצים כפולים...</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    PDF, DOCX, DOC, TXT, RTF, ZIP
                  </p>
                </>
              )}
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checkingDuplicates}
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
                <div className="flex items-center justify-between flex-row-reverse">
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
                <div className="flex justify-between items-center text-sm flex-row-reverse">
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
                <div className="flex justify-between text-xs text-muted-foreground flex-row-reverse">
                  <span className="text-green-600">הצליחו: {progress.successful}</span>
                  {progress.failed > 0 && (
                    <span className="text-destructive">נכשלו: {progress.failed}</span>
                  )}
                  {progress.skipped > 0 && (
                    <span className="text-accent">דולגו (כפולים): {progress.skipped}</span>
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
                  className="bg-card border-border text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">שנה</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-card border-border text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">תגיות (מופרדות בפסיקים)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ממונות, נזיקין"
                  className="bg-card border-border text-right"
                />
              </div>
            </div>

            {/* AI Analysis Progress */}
            {analyzing && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 text-sm flex-row-reverse">
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

            {/* Upload Buttons - Separated */}
            <div className="flex gap-3 flex-row-reverse">
              <Button
                onClick={() => handleUpload(false)}
                disabled={uploading || analyzing || files.length === 0}
                variant="outline"
                className="flex-1 gap-2"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מעלה...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    העלה בלבד
                    {files.length > 0 && ` (${files.length})`}
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleUpload(true)}
                disabled={uploading || analyzing || files.length === 0}
                className="flex-1 gap-2"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מעלה...
                  </>
                ) : analyzing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    מנתח...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    העלה + ניתוח AI
                    {files.length > 0 && ` (${files.length})`}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2 flex-row-reverse">
                <CheckCircle className="w-5 h-5 text-green-500" />
                הועלו בהצלחה ({results.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1 flex-row-reverse">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="truncate text-right">{result.title || result.fileName}</span>
                  </div>
                ))}
              </div>
              
              {/* Analyze uploaded results */}
              {results.length > 0 && !analyzing && (
                <Button
                  onClick={() => runAIAnalysis(results)}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Sparkles className="w-4 h-4" />
                  נתח {results.length} פסקים עם AI
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Card className="border border-destructive/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2 flex-row-reverse">
                <AlertCircle className="w-5 h-5" />
                שגיאות ({errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1 text-destructive flex-row-reverse">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-right">{error}</span>
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
