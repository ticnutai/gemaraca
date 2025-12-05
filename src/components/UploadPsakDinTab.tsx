import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle, FolderUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 5; // Upload 5 files at a time for optimal performance

interface UploadProgress {
  total: number;
  completed: number;
  current: string;
  successful: number;
  failed: number;
}

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Metadata fields
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [tags, setTags] = useState("");

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

  // Upload files in batches for better performance
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

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "אנא בחר קבצים להעלאה",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setResults([]);
    setErrors([]);
    
    const allResults: any[] = [];
    const allErrors: string[] = [];
    
    const metadata = {
      court: court || undefined,
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    // Split files into batches
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      batches.push(files.slice(i, i + BATCH_SIZE));
    }

    setProgress({
      total: files.length,
      completed: 0,
      current: '',
      successful: 0,
      failed: 0,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchFileNames = batch.map(f => f.name).join(', ');
        
        setProgress(prev => prev ? {
          ...prev,
          current: batchFileNames.length > 50 ? batchFileNames.substring(0, 50) + '...' : batchFileNames,
        } : null);

        const { results: batchResults, errors: batchErrors } = await uploadBatch(batch, metadata);
        
        allResults.push(...batchResults);
        allErrors.push(...batchErrors);

        setProgress(prev => prev ? {
          ...prev,
          completed: Math.min((i + 1) * BATCH_SIZE, files.length),
          successful: allResults.length,
          failed: allErrors.length,
        } : null);

        // Update results in real-time
        setResults([...allResults]);
        setErrors([...allErrors]);

        // Small delay between batches to prevent overwhelming the server
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      toast({
        title: `הועלו ${allResults.length} פסקי דין בהצלחה`,
        description: allErrors.length > 0 ? `${allErrors.length} שגיאות` : undefined,
      });

      // Clear files after successful upload
      setFiles([]);
      setCourt("");
      setYear(new Date().getFullYear().toString());
      setTags("");

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "שגיאה בהעלאה",
        description: error instanceof Error ? error.message : "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <Archive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const progressPercent = progress ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5" />
              העלאת פסקי דין
              <span className="text-sm font-normal text-muted-foreground">
                (תומך באלפי קבצים)
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

            {/* Progress */}
            {progress && (
              <div className="space-y-2 p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>מעלה: {progress.current}</span>
                  <span>{progress.completed}/{progress.total}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-green-600">הצליחו: {progress.successful}</span>
                  {progress.failed > 0 && (
                    <span className="text-destructive">נכשלו: {progress.failed}</span>
                  )}
                </div>
              </div>
            )}

            {/* Metadata Fields - Simplified for bulk upload */}
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

            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="w-full gap-2"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מעלה {progress?.completed || 0}/{files.length}...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  העלה {files.length > 0 ? `${files.length} קבצים` : ''}
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
                    <span className="truncate">{result.title}</span>
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
                  <div key={index} className="flex items-center gap-2 text-sm text-destructive py-1">
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
