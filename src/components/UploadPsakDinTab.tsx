import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp, Sparkles, Brain, Play, Pause, RefreshCw, Copy, Ban, Hash } from "lucide-react";
import { useToast, toast } from "@/hooks/use-toast";
import { useUploadStore } from "@/stores/uploadStore";
import { calculateFileHashes } from "@/lib/fileHash";
import UploadSummaryDialog from "./UploadSummaryDialog";

const BATCH_SIZE = 5;

interface DuplicateFile {
  name: string;
  reason: 'title' | 'hash';
  existingTitle?: string;
}

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [hashProgress, setHashProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pauseRef = useRef(false);
  const { toast: showToast } = useToast();
  
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  
  // Zustand store
  const {
    session,
    startSession,
    updateProgress,
    addResult,
    addError,
    setStatus,
    pauseSession,
    resumeSession,
    startAnalysis,
    updateAnalysisProgress,
    markAnalyzed,
    completeSession,
    clearSession,
    addFileHash,
    hasFileHash,
    getFileByHash,
  } = useUploadStore();

  const isUploading = session?.status === 'uploading';
  const isPaused = session?.status === 'paused';
  const isAnalyzing = session?.status === 'analyzing';
  const isActive = isUploading || isPaused || isAnalyzing;

  // Check for duplicates - both by title and content hash
  const checkDuplicates = useCallback(async (filesToCheck: File[]) => {
    if (filesToCheck.length === 0) return;
    
    setCheckingDuplicates(true);
    
    try {
      // Step 1: Calculate file hashes
      setHashProgress({ current: 0, total: filesToCheck.length });
      const fileHashes = await calculateFileHashes(filesToCheck, (completed, total) => {
        setHashProgress({ current: completed, total });
      });
      setHashProgress(null);
      
      // Step 2: Get existing titles from database
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
        const hash = fileHashes.get(file.name);
        
        // Check content hash first (more accurate)
        if (hash && hasFileHash(hash)) {
          foundDuplicates.push({
            name: file.name,
            reason: 'hash',
            existingTitle: getFileByHash(hash),
          });
          continue;
        }
        
        // Check title match
        const titleMatch = existingTitles.has(baseName) || 
          Array.from(existingTitles).some(title => 
            title.includes(baseName) || baseName.includes(title)
          );
        
        if (titleMatch) {
          foundDuplicates.push({
            name: file.name,
            reason: 'title',
            existingTitle: Array.from(existingTitles).find(t => 
              t.includes(baseName) || baseName.includes(t)
            ) || baseName
          });
        } else {
          uniqueFiles.push(file);
          // Save hash for future duplicate detection
          if (hash) {
            addFileHash(hash, baseName);
          }
        }
      }
      
      if (foundDuplicates.length > 0) {
        setDuplicates(prev => [...prev, ...foundDuplicates]);
        
        // Show toast notification
        toast({
          title: `נמצאו ${foundDuplicates.length} קבצים כפולים`,
          description: "קבצים אלו הוסרו מההעלאה",
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
      setFiles(prev => [...prev, ...filesToCheck]);
    } finally {
      setCheckingDuplicates(false);
    }
  }, [hasFileHash, getFileByHash, addFileHash]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(ext || '');
    });
    
    if (validFiles.length < selectedFiles.length) {
      showToast({
        title: `${selectedFiles.length - validFiles.length} קבצים לא נתמכים הוסרו`,
        variant: "destructive",
      });
    }
    
    await checkDuplicates(validFiles);
  }, [showToast, checkDuplicates]);

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
    
    if (pauseRef.current) {
      pauseSession();
      toast({ title: "ההעלאה הושהתה", description: "לחץ המשך כדי להמשיך" });
    } else {
      resumeSession();
      toast({ title: "ממשיך בהעלאה..." });
    }
  };

  const handleUpload = async (withAI: boolean = false) => {
    if (files.length === 0) {
      showToast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }

    pauseRef.current = false;
    
    const metadata = {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    // Start session in store
    startSession(metadata);
    
    const filesToUpload = files;
    const batches: File[][] = [];
    for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
      batches.push(filesToUpload.slice(i, i + BATCH_SIZE));
    }

    updateProgress({
      total: filesToUpload.length,
      completed: 0,
      current: '',
      successful: 0,
      failed: 0,
      skipped: duplicates.length,
    });

    const allResults: any[] = [];
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        // Wait while paused
        while (pauseRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const batch = batches[i];
        const batchFileNames = batch.map(f => f.name).join(', ');
        
        updateProgress({
          current: batchFileNames.length > 50 ? batchFileNames.substring(0, 50) + '...' : batchFileNames,
        });

        const { results: batchResults, errors: batchErrors } = await uploadBatch(batch, metadata);
        
        // Add results to store
        batchResults.forEach(result => {
          allResults.push(result);
          addResult({
            id: result.id,
            title: result.title || result.fileName,
            fileName: result.fileName,
            success: true,
          });
        });
        
        // Add errors to store
        batchErrors.forEach(error => {
          allErrors.push(error);
          addError(error);
        });

        updateProgress({
          completed: Math.min((i + 1) * BATCH_SIZE, filesToUpload.length),
          successful: allResults.length,
          failed: allErrors.length,
        });

        // Remove uploaded files from the list
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
      } else {
        completeSession();
        setShowSummary(true);
      }

      // Reset form
      setCourt("");
      setYear(new Date().getFullYear().toString());
      setTags("");
      setDuplicates([]);

    } catch (error) {
      console.error('Upload error:', error);
      setStatus('error');
      
      showToast({
        title: "שגיאה בהעלאה",
        description: "ההעלאות שהצליחו נשמרו. תוכל להמשיך מאוחר יותר.",
        variant: "destructive",
      });
    }
  };

  const runAIAnalysis = async (psakimToAnalyze: any[]) => {
    startAnalysis(psakimToAnalyze.map(p => p.id));
    
    for (let i = 0; i < psakimToAnalyze.length; i++) {
      // Wait while paused
      while (pauseRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = psakimToAnalyze[i];
      updateAnalysisProgress({ 
        current: i + 1, 
        total: psakimToAnalyze.length,
        currentTitle: result.title || result.fileName,
      });
      
      try {
        await supabase.functions.invoke('analyze-psak-din', {
          body: { psakId: result.id }
        });
        markAnalyzed(result.id);
        console.log(`Analyzed psak ${result.id}`);
      } catch (err) {
        console.error(`Error analyzing psak ${result.id}:`, err);
      }
      
      if (i < psakimToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    completeSession();
    setShowSummary(true);
    
    toast({
      title: "ניתוח AI הושלם",
      description: `נותחו ${psakimToAnalyze.length} פסקי דין וקושרו למקורות`,
    });
  };

  const resumeAnalysis = async () => {
    if (!session?.pendingAnalysis?.length) return;
    
    const { data: psakim } = await supabase
      .from('psakei_din')
      .select('*')
      .in('id', session.pendingAnalysis);
    
    if (psakim && psakim.length > 0) {
      await runAIAnalysis(psakim);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <Archive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const localProgress = session?.uploadProgress;
  const progressPercent = localProgress ? (localProgress.completed / localProgress.total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6 text-right">
        {/* Session Recovery Card */}
        {session && session.status === 'paused' && session.results.length > 0 && (
          <Card className="border-2 border-accent/50 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-row-reverse">
                <div className="flex items-center gap-3 flex-row-reverse">
                  <RefreshCw className="w-5 h-5 text-accent" />
                  <div className="text-right">
                    <p className="font-medium">יש העלאה שהושהתה</p>
                    <p className="text-sm text-muted-foreground">
                      {session.results.length} פסקים הועלו, 
                      {session.pendingAnalysis?.length || 0} ממתינים לניתוח
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {session.pendingAnalysis?.length > 0 && (
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
                    <span title={dup.reason === 'hash' ? "זוהה לפי תוכן" : "זוהה לפי שם"}>
                      {dup.reason === 'hash' ? (
                        <Hash className="w-3 h-3" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                    </span>
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
                (זיהוי כפילויות לפי תוכן ושם)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors bg-muted/20 ${
                checkingDuplicates ? 'border-accent' : 'border-border'
              }`}
              onClick={() => !checkingDuplicates && !isActive && fileInputRef.current?.click()}
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
                  <p className="text-foreground font-medium">
                    {hashProgress 
                      ? `מחשב hash לקבצים... (${hashProgress.current}/${hashProgress.total})`
                      : 'בודק קבצים כפולים...'
                    }
                  </p>
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
                  disabled={checkingDuplicates || isActive}
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

            {/* Progress in Tab (minimal, since we have global progress) */}
            {isActive && localProgress && (
              <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between items-center text-sm flex-row-reverse">
                  <span>מעלה: {localProgress.current}</span>
                  <div className="flex items-center gap-2">
                    <span>{localProgress.completed}/{localProgress.total}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePause}
                      className="h-7 w-7 p-0"
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground flex-row-reverse">
                  <span className="text-green-600">הצליחו: {localProgress.successful}</span>
                  {localProgress.failed > 0 && (
                    <span className="text-destructive">נכשלו: {localProgress.failed}</span>
                  )}
                  {localProgress.skipped > 0 && (
                    <span className="text-accent">דולגו (כפולים): {localProgress.skipped}</span>
                  )}
                </div>
                {isPaused && (
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
                  disabled={isActive}
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
                  disabled={isActive}
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
                  disabled={isActive}
                />
              </div>
            </div>

            {/* AI Analysis Progress */}
            {isAnalyzing && session?.analysisProgress && (
              <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 text-sm flex-row-reverse">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span>מנתח פסקי דין באמצעות AI...</span>
                  <span className="mr-auto">{session.analysisProgress.current}/{session.analysisProgress.total}</span>
                </div>
                <Progress 
                  value={(session.analysisProgress.current / session.analysisProgress.total) * 100} 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  {session.analysisProgress.currentTitle || 'מזהה מקורות תלמודיים ומסווג את פסקי הדין'}
                </p>
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex gap-3 flex-row-reverse">
              <Button
                onClick={() => handleUpload(false)}
                disabled={isActive || files.length === 0}
                variant="outline"
                className="flex-1 gap-2"
                size="lg"
              >
                {isUploading ? (
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
                disabled={isActive || files.length === 0}
                className="flex-1 gap-2"
                size="lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מעלה...
                  </>
                ) : isAnalyzing ? (
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

        {/* Results - shown from store */}
        {session && session.results.length > 0 && session.status !== 'uploading' && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2 flex-row-reverse">
                <CheckCircle className="w-5 h-5 text-green-500" />
                הועלו בהצלחה ({session.results.filter(r => r.success).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {session.results.filter(r => r.success).map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1 flex-row-reverse">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="truncate text-right flex-1">{result.title}</span>
                    {result.analyzed && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 ml-1" />
                        נותח
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Analyze uploaded results */}
              {!isAnalyzing && session.results.some(r => !r.analyzed) && (
                <Button
                  onClick={() => runAIAnalysis(session.results.filter(r => r.success && !r.analyzed))}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Sparkles className="w-4 h-4" />
                  נתח {session.results.filter(r => !r.analyzed).length} פסקים עם AI
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {session && session.errors.length > 0 && (
          <Card className="border border-destructive/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2 flex-row-reverse">
                <AlertCircle className="w-5 h-5" />
                שגיאות ({session.errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {session.errors.map((error, index) => (
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
      
      {/* Summary Dialog */}
      <UploadSummaryDialog open={showSummary} onOpenChange={setShowSummary} />
    </div>
  );
};

export default UploadPsakDinTab;
