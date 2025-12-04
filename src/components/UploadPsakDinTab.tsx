import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Archive, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UploadPsakDinTab = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Metadata fields
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [caseNumber, setCaseNumber] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });

      // Add metadata
      const metadata = {
        title: title || undefined,
        court: court || undefined,
        year: parseInt(year) || new Date().getFullYear(),
        caseNumber: caseNumber || undefined,
        summary: summary || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      formData.append("metadata", JSON.stringify(metadata));

      const { data, error } = await supabase.functions.invoke('upload-psak-din', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results || []);
        setErrors(data.errors || []);
        
        toast({
          title: `הועלו ${data.uploaded} פסקי דין בהצלחה`,
          description: data.errors?.length > 0 ? `${data.errors.length} שגיאות` : undefined,
        });

        // Clear form
        setFiles([]);
        setTitle("");
        setCourt("");
        setYear(new Date().getFullYear().toString());
        setCaseNumber("");
        setSummary("");
        setTags("");
      } else {
        throw new Error(data.error || "שגיאה בהעלאה");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "שגיאה בהעלאה",
        description: error instanceof Error ? error.message : "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'zip') return <Archive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5" />
              העלאת פסקי דין
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Drop Zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.rtf,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
              <p className="text-sm text-muted-foreground mt-2">
                פורמטים נתמכים: PDF, DOCX, DOC, TXT, RTF, ZIP
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ניתן להעלות קובץ ZIP עם מספר קבצים
              </p>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground">קבצים נבחרים ({files.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="flex items-center gap-2 py-1 px-3"
                    >
                      {getFileIcon(file.name)}
                      <span className="max-w-[200px] truncate">{file.name}</span>
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
                </div>
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">כותרת (אופציונלי)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="כותרת פסק הדין"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="court">בית דין</Label>
                <Input
                  id="court"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="לדוגמה: בית הדין הרבני הגדול"
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
                <Label htmlFor="caseNumber">מספר תיק</Label>
                <Input
                  id="caseNumber"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="מספר תיק (אם יש)"
                  className="bg-card border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">תקציר</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="תקציר קצר של פסק הדין"
                className="bg-card border-border min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">תגיות (מופרדות בפסיקים)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="לדוגמה: ממונות, שכנים, נזיקין"
                className="bg-card border-border"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מעלה...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  העלה {files.length > 0 ? `(${files.length} קבצים)` : ''}
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
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{result.title}</span>
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
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
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