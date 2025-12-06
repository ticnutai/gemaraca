import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp, Sparkles, Brain, Play, Pause, RefreshCw, Copy, Ban, Hash, StopCircle, WifiOff } from "lucide-react";
import { useToast, toast } from "@/hooks/use-toast";
import { useUploadStore } from "@/stores/uploadStore";
import { useUploadController } from "@/hooks/useUploadController";
import { calculateFileHashes } from "@/lib/fileHash";
import { isOnline } from "@/lib/uploadUtils";
import UploadSummaryDialog from "./UploadSummaryDialog";
import PsakDinStats from "./PsakDinStats";
import JSZip from "jszip";

interface DuplicateFile {
  name: string;
  reason: 'title' | 'hash';
  existingTitle?: string;
}

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]); // Files queued while uploading
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [hashProgress, setHashProgress] = useState<{ current: number; total: number } | null>(null);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number; zipName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast: showToast } = useToast();
  
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Use the upload controller hook
  const {
    session,
    isUploading,
    isPaused,
    isAnalyzing,
    isActive,
    uploadFiles,
    analyzeExisting,
    pause,
    resume,
    cancel,
    clearSession,
  } = useUploadController({
    onComplete: () => {
      setShowSummary(true);
      // Check if there are queued files to upload
      if (queuedFiles.length > 0) {
        const filesToUpload = [...queuedFiles];
        setQueuedFiles([]);
        setFiles(filesToUpload);
        toast({
          title: `יש ${filesToUpload.length} קבצים בתור`,
          description: "לחץ על העלה כדי להתחיל את ההעלאה הבאה",
        });
      }
    },
  });
  
  // Zustand store for hash functions
  const {
    addFileHash,
    hasFileHash,
    getFileByHash,
  } = useUploadStore();

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
      
      // If upload is active, add to queue instead of main list
      if (isActive) {
        setQueuedFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const newUniqueFiles = uniqueFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...newUniqueFiles];
        });
        if (uniqueFiles.length > 0) {
          toast({
            title: `${uniqueFiles.length} קבצים נוספו לתור`,
            description: "יועלו לאחר סיום ההעלאה הנוכחית",
          });
        }
      } else {
        setFiles(prev => {
          const existingNames = new Set(prev.map(f => f.name));
          const newUniqueFiles = uniqueFiles.filter(f => !existingNames.has(f.name));
          return [...prev, ...newUniqueFiles];
        });
      }
      
    } catch (error) {
      console.error('Error checking duplicates:', error);
      if (isActive) {
        setQueuedFiles(prev => [...prev, ...filesToCheck]);
      } else {
        setFiles(prev => [...prev, ...filesToCheck]);
      }
    } finally {
      setCheckingDuplicates(false);
    }
  }, [hasFileHash, getFileByHash, addFileHash, isActive]);

  // Debug logging helper
  const addDebug = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    setDebugLog(prev => [...prev.slice(-50), logMsg]); // Keep last 50 logs
  }, []);

  // Extract files from ZIP with progress tracking
  const extractZipFiles = useCallback(async (zipFile: File): Promise<File[]> => {
    const extractedFiles: File[] = [];
    addDebug(`📦 מתחיל לחלץ ZIP: ${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    try {
      addDebug(`⏳ טוען ZIP לזכרון...`);
      const zip = await JSZip.loadAsync(zipFile);
      const validExts = ['pdf', 'docx', 'doc', 'txt', 'rtf'];
      
      const entries = Object.entries(zip.files).filter(([_, entry]) => !entry.dir);
      addDebug(`📁 נמצאו ${entries.length} קבצים בתוך ה-ZIP`);
      
      setExtractProgress({ current: 0, total: entries.length, zipName: zipFile.name });
      
      let validCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < entries.length; i++) {
        const [path, zipEntry] = entries[i];
        const fileName = path.split('/').pop() || path;
        const ext = fileName.split('.').pop()?.toLowerCase();
        
        // Update progress every 10 files or at the end
        if (i % 10 === 0 || i === entries.length - 1) {
          setExtractProgress({ current: i + 1, total: entries.length, zipName: zipFile.name });
        }
        
        if (validExts.includes(ext || '')) {
          try {
            const blob = await zipEntry.async('blob');
            const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
            extractedFiles.push(file);
            validCount++;
          } catch (fileErr) {
            addDebug(`⚠️ שגיאה בחילוץ קובץ: ${fileName}`);
            console.error(`Error extracting ${fileName}:`, fileErr);
          }
        } else {
          skippedCount++;
        }
      }
      
      addDebug(`✅ חילוץ הושלם: ${validCount} קבצים תקינים, ${skippedCount} דולגו (סיומת לא נתמכת)`);
      
    } catch (err) {
      addDebug(`❌ שגיאה בחילוץ ZIP: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
      console.error('Error extracting ZIP:', err);
      toast({
        title: `שגיאה בחילוץ ${zipFile.name}`,
        description: err instanceof Error ? err.message : 'לא ניתן לפתוח את קובץ ה-ZIP',
        variant: 'destructive',
      });
    } finally {
      setExtractProgress(null);
    }
    
    return extractedFiles;
  }, [addDebug]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addDebug(`📥 נבחרו ${selectedFiles.length} קבצים`);
    
    const validExts = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'];
    
    const validFiles: File[] = [];
    const zipFiles: File[] = [];
    
    // Separate ZIP files from regular files
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'zip') {
        zipFiles.push(file);
        addDebug(`🗜️ זוהה ZIP: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } else if (validExts.includes(ext || '')) {
        validFiles.push(file);
      }
    }
    
    addDebug(`📊 סיכום: ${zipFiles.length} קבצי ZIP, ${validFiles.length} קבצים רגילים`);
    
    // Extract files from ZIPs
    if (zipFiles.length > 0) {
      toast({
        title: `מחלץ ${zipFiles.length} קבצי ZIP...`,
        description: 'אנא המתן - פעולה זו עלולה לקחת זמן',
      });
      
      for (const zipFile of zipFiles) {
        addDebug(`🔄 מעבד ZIP: ${zipFile.name}`);
        const extracted = await extractZipFiles(zipFile);
        validFiles.push(...extracted);
        addDebug(`➕ נוספו ${extracted.length} קבצים מ-${zipFile.name}`);
      }
      
      addDebug(`✅ סה"כ חולצו ${validFiles.length} קבצים מכל ה-ZIPs`);
      
      toast({
        title: `חולצו ${validFiles.length} קבצים מ-ZIP`,
        description: 'בודק כפילויות...',
      });
    }
    
    if (validFiles.length < selectedFiles.length - zipFiles.length) {
      showToast({
        title: `${selectedFiles.length - validFiles.length - zipFiles.length} קבצים לא נתמכים הוסרו`,
        variant: "destructive",
      });
    }
    
    addDebug(`🔍 בודק כפילויות עבור ${validFiles.length} קבצים...`);
    await checkDuplicates(validFiles);
    addDebug(`✅ בדיקת כפילויות הושלמה`);
    
    // Reset input to allow re-selecting same files
    e.target.value = '';
  }, [showToast, checkDuplicates, extractZipFiles, addDebug]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    addDebug(`📥 נגררו ${droppedFiles.length} קבצים`);
    
    const validExts = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'];
    
    const validFiles: File[] = [];
    const zipFiles: File[] = [];
    
    // Separate ZIP files from regular files
    for (const file of droppedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'zip') {
        zipFiles.push(file);
        addDebug(`🗜️ זוהה ZIP: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } else if (validExts.includes(ext || '')) {
        validFiles.push(file);
      }
    }
    
    addDebug(`📊 סיכום: ${zipFiles.length} קבצי ZIP, ${validFiles.length} קבצים רגילים`);
    
    // Extract files from ZIPs
    if (zipFiles.length > 0) {
      toast({
        title: `מחלץ ${zipFiles.length} קבצי ZIP...`,
        description: 'אנא המתן - פעולה זו עלולה לקחת זמן',
      });
      
      for (const zipFile of zipFiles) {
        addDebug(`🔄 מעבד ZIP: ${zipFile.name}`);
        const extracted = await extractZipFiles(zipFile);
        validFiles.push(...extracted);
        addDebug(`➕ נוספו ${extracted.length} קבצים מ-${zipFile.name}`);
      }
      
      addDebug(`✅ סה"כ חולצו ${validFiles.length} קבצים מכל ה-ZIPs`);
      
      toast({
        title: `חולצו ${validFiles.length} קבצים מ-ZIP`,
        description: 'בודק כפילויות...',
      });
    }
    
    addDebug(`🔍 בודק כפילויות עבור ${validFiles.length} קבצים...`);
    await checkDuplicates(validFiles);
    addDebug(`✅ בדיקת כפילויות הושלמה`);
  }, [checkDuplicates, extractZipFiles, addDebug]);

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

  const handleUpload = async (withAI: boolean = false) => {
    if (files.length === 0) {
      showToast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }
    
    const metadata = {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    const result = await uploadFiles(files, metadata, withAI);
    
    if (result) {
      // Remove uploaded files from the list
      const uploadedSet = new Set(result.uploadedFileNames);
      setFiles(prev => prev.filter(f => !uploadedSet.has(f.name)));
      
      // Reset form on success
      if (result.results.length > 0) {
        setCourt("");
        setYear(new Date().getFullYear().toString());
        setTags("");
        setDuplicates([]);
      }
    }
  };

  const handleResumeAnalysis = async () => {
    if (!session?.pendingAnalysis?.length) return;
    await analyzeExisting(session.pendingAnalysis);
  };

  const togglePause = () => {
    if (isPaused) {
      resume();
    } else {
      pause();
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
        {/* Database Statistics */}
        <PsakDinStats />
        
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
                    <Button size="sm" onClick={handleResumeAnalysis} className="gap-1">
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
            {/* File Drop Zone - ALWAYS ENABLED even during upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors ${
                checkingDuplicates ? 'border-accent bg-accent/5' : 
                isActive ? 'border-primary/50 bg-primary/5' : 
                'border-border bg-muted/20'
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
              {extractProgress ? (
                <>
                  <Archive className="w-12 h-12 mx-auto text-primary mb-4 animate-pulse" />
                  <p className="text-foreground font-medium">
                    מחלץ קבצים מ-ZIP...
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {extractProgress.zipName}
                  </p>
                  <Progress 
                    value={(extractProgress.current / extractProgress.total) * 100} 
                    className="h-2 mt-3 max-w-xs mx-auto" 
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {extractProgress.current}/{extractProgress.total} קבצים
                  </p>
                </>
              ) : checkingDuplicates ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto text-accent mb-4 animate-spin" />
                  <p className="text-foreground font-medium">
                    {hashProgress 
                      ? `מחשב hash לקבצים... (${hashProgress.current}/${hashProgress.total})`
                      : 'בודק קבצים כפולים...'
                    }
                  </p>
                </>
              ) : isActive ? (
                <>
                  <Upload className="w-12 h-12 mx-auto text-primary mb-4" />
                  <p className="text-foreground font-medium">העלאה בתהליך - ניתן להוסיף קבצים נוספים לתור</p>
                  <p className="text-sm text-primary mt-2">
                    קבצים חדשים יתווספו לתור ויועלו אחרי סיום ההעלאה הנוכחית
                  </p>
                  {queuedFiles.length > 0 && (
                    <Badge variant="secondary" className="mt-2">
                      {queuedFiles.length} קבצים בתור
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    PDF, DOCX, DOC, TXT, RTF, ZIP (נתמכים קבצי ZIP עם עד 5000 קבצים)
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
                  {isActive ? 'הוסף תיקייה לתור' : 'בחר תיקייה'}
                </Button>
              </div>
            </div>

            {/* Queued Files - shown during upload */}
            {isActive && queuedFiles.length > 0 && (
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <div className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-primary" />
                      <span className="font-medium">קבצים בתור ({queuedFiles.length})</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setQueuedFiles([])}
                      className="text-destructive"
                    >
                      <X className="w-4 h-4 ml-1" />
                      נקה תור
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 text-right">
                    קבצים אלו יועלו אוטומטית לאחר סיום ההעלאה הנוכחית
                  </p>
                </CardContent>
              </Card>
            )}

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
                  <div className="flex items-center gap-2">
                    {!isOnline() && (
                      <span className="flex items-center gap-1 text-destructive">
                        <WifiOff className="w-4 h-4" />
                        אין חיבור
                      </span>
                    )}
                    <span>מעלה: {localProgress.current}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{localProgress.completed}/{localProgress.total}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePause}
                      className="h-7 w-7 p-0"
                      title={isPaused ? "המשך" : "השהה"}
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancel}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="בטל העלאה"
                    >
                      <StopCircle className="w-4 h-4" />
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
                  onClick={() => analyzeExisting(session.results.filter(r => r.success && !r.analyzed).map(r => r.id))}
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

        {/* Debug Log */}
        {debugLog.length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between flex-row-reverse">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  לוג פעילות ({debugLog.length})
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDebugLog([])}
                  className="text-xs"
                >
                  נקה לוג
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-2 font-mono text-xs">
                {debugLog.map((log, index) => (
                  <div key={index} className="py-0.5 text-right border-b border-border/30 last:border-0">
                    {log}
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
