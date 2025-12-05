import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Building2, FileText, ExternalLink, Download } from "lucide-react";
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
  if (!psak) return null;

  const fullText = psak.full_text || psak.fullText;
  const sourceUrl = psak.source_url || psak.sourceUrl;
  const caseNumber = psak.case_number || psak.caseNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card border-border">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-foreground text-right">
            {psak.title}
          </DialogTitle>
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

        <ScrollArea className="flex-1 mt-4 border border-border rounded-lg">
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
                <div className="bg-muted/30 p-4 rounded-lg whitespace-pre-wrap text-foreground leading-relaxed">
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

        {/* Actions */}
        {sourceUrl && (
          <div className="flex-shrink-0 pt-4 border-t border-border flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                פתח במקור
              </a>
            </Button>
            {sourceUrl.includes('psakei-din-files') && (
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
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PsakDinViewDialog;
