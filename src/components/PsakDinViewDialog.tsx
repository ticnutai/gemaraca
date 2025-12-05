import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Building2, FileText, ExternalLink, Download, Eye, FileIcon, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PsakDinViewDialogProps {
  psak: {
    id?: string;
    title: string;
    court?: string;
    year?: number;
    case_number?: string;
    caseNumber?: string;
    summary: string;
    full_text?: string;
    fullText?: string;
    source_url?: string;
    sourceUrl?: string;
    tags?: string[];
    source?: string;
    connection?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PsakDinViewDialog = ({ psak, open, onOpenChange }: PsakDinViewDialogProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  if (!psak) return null;

  const fullText = psak.full_text || psak.fullText;
  const sourceUrl = psak.source_url || psak.sourceUrl;
  const caseNumber = psak.case_number || psak.caseNumber;

  // Determine file type from URL
  const getFileType = (url: string | undefined): string => {
    if (!url) return 'unknown';
    const lower = url.toLowerCase();
    if (lower.includes('.pdf')) return 'pdf';
    if (lower.includes('.doc') || lower.includes('.docx')) return 'doc';
    if (lower.includes('.txt')) return 'txt';
    if (lower.includes('.rtf')) return 'rtf';
    return 'unknown';
  };

  const fileType = getFileType(sourceUrl);
  const canPreview = sourceUrl && (fileType === 'pdf' || fileType === 'txt');

  // For Google Docs Viewer for Word files
  const getPreviewUrl = (url: string, type: string): string => {
    if (type === 'pdf') {
      return url;
    }
    if (type === 'doc') {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }
    return url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`flex flex-col bg-card border-border ${
          isFullscreen 
            ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]' 
            : 'max-w-4xl max-h-[90vh]'
        }`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl font-bold text-foreground text-right flex-1">
              {psak.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="mr-2"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
            {psak.court && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-primary" />
                </div>
                {psak.court}
              </div>
            )}
            {psak.year && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-primary" />
                </div>
                {psak.year}
              </div>
            )}
            {caseNumber && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-primary" />
                </div>
                {caseNumber}
              </div>
            )}
            {psak.source && (
              <Badge variant="outline" className="text-xs">
                {psak.source}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="info" className="gap-2">
              <FileText className="w-4 h-4" />
              מידע
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2" disabled={!sourceUrl}>
              <Eye className="w-4 h-4" />
              צפייה בקובץ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full border border-border rounded-lg">
              <div className="p-4 space-y-4 text-right" dir="rtl">
                {/* Summary */}
                <div>
                  <h3 className="font-semibold text-foreground mb-2">תקציר</h3>
                  <p className="text-foreground leading-relaxed">{psak.summary}</p>
                </div>

                {/* Connection explanation if exists */}
                {psak.connection && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <h3 className="font-semibold text-foreground mb-2">קשר לסוגיה</h3>
                    <p className="text-muted-foreground italic">{psak.connection}</p>
                  </div>
                )}

                {/* Full text if exists */}
                {fullText && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">טקסט מלא</h3>
                    <div className="bg-muted/30 p-4 rounded-lg whitespace-pre-wrap text-foreground leading-relaxed font-serif">
                      {fullText}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {psak.tags && psak.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">תגיות</h3>
                    <div className="flex flex-wrap gap-2">
                      {psak.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
            {sourceUrl ? (
              <div className="h-full border border-border rounded-lg overflow-hidden bg-muted/20">
                {fileType === 'pdf' ? (
                  <iframe
                    src={`${sourceUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full min-h-[500px]"
                    title="צפייה בפסק דין"
                  />
                ) : fileType === 'doc' ? (
                  <iframe
                    src={getPreviewUrl(sourceUrl, fileType)}
                    className="w-full h-full min-h-[500px]"
                    title="צפייה בפסק דין"
                  />
                ) : fileType === 'txt' ? (
                  <TxtViewer url={sourceUrl} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-foreground font-medium mb-2">
                      לא ניתן להציג תצוגה מקדימה של קובץ זה
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      ניתן להוריד את הקובץ לצפייה
                    </p>
                    <Button asChild className="gap-2">
                      <a href={sourceUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                        הורד קובץ
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">אין קובץ מצורף</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex-shrink-0 pt-4 border-t border-border flex gap-2 justify-end">
          {sourceUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  פתח בחלון חדש
                </a>
              </Button>
              <Button
                variant="default"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={sourceUrl} download>
                  <Download className="w-4 h-4" />
                  הורד קובץ
                </a>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Component for viewing TXT files
const TxtViewer = ({ url }: { url: string }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-destructive mb-2">שגיאה בטעינת הקובץ</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-4 text-foreground whitespace-pre-wrap font-serif text-right" dir="rtl">
        {content}
      </pre>
    </ScrollArea>
  );
};

export default PsakDinViewDialog;
