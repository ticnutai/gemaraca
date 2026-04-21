import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Copy, Check, MessageSquare, Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ShareSugyaDialogProps {
  sugyaId: string;
  masechet?: string;
  daf?: string;
  title?: string;
  selectedText?: string;
  notes?: string;
  /** Optional full body text used for "copy text" and "print" actions */
  bodyText?: string;
  /** Optional HTML content used for PDF export */
  htmlContent?: string;
}

export default function ShareSugyaDialog({ sugyaId, masechet, daf, title, selectedText, notes, bodyText, htmlContent }: ShareSugyaDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [personalNote, setPersonalNote] = useState(notes || "");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const shareUrl = useMemo(() => {
    const base = window.location.origin;
    const params = new URLSearchParams();
    if (selectedText) params.set("highlight", selectedText.slice(0, 200));
    if (personalNote) params.set("note", personalNote.slice(0, 500));
    const qs = params.toString();
    return `${base}/sugya/${sugyaId}${qs ? "?" + qs : ""}`;
  }, [sugyaId, selectedText, personalNote]);

  const shareText = useMemo(() => {
    const lines = [];
    lines.push(`📖 ${masechet || ""} ${daf || ""} ${title ? `- ${title}` : ""}`);
    if (selectedText) lines.push(`\n"${selectedText.slice(0, 300)}"`);
    if (personalNote) lines.push(`\n💭 ${personalNote}`);
    lines.push(`\n🔗 ${shareUrl}`);
    return lines.join("");
  }, [masechet, daf, title, selectedText, personalNote, shareUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("הקישור הועתק!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyFull = () => {
    navigator.clipboard.writeText(shareText);
    toast.success("הטקסט המלא הועתק!");
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const shareMail = () => {
    const subject = `${masechet || "סוגיה"} ${daf || ""} - שיתוף מגמרא`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`, "_blank");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${masechet} ${daf}`, text: shareText, url: shareUrl });
      } catch {}
    } else {
      copyFull();
    }
  };

  const copyBody = () => {
    const content = bodyText || shareText;
    navigator.clipboard.writeText(content);
    toast.success("הטקסט הועתק!");
  };

  const printPage = () => {
    const content = htmlContent || (bodyText ? `<pre style="white-space:pre-wrap;font-family:serif">${bodyText}</pre>` : "");
    if (!content) {
      toast.error("אין תוכן להדפסה");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title || ""}</title>
<style>body{font-family:'David','Noto Sans Hebrew',serif;max-width:780px;margin:2rem auto;line-height:1.8;padding:0 1rem;color:#0B1F5B}
h1{text-align:center;border-bottom:2px solid #D4AF37;padding-bottom:.5rem}</style></head>
<body><h1>${title || ""}</h1>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const exportPdf = async () => {
    const content = htmlContent || (bodyText ? `<pre style="white-space:pre-wrap;font-family:serif">${bodyText}</pre>` : "");
    if (!content) {
      toast.error("אין תוכן לייצוא");
      return;
    }
    setIsExporting(true);
    try {
      const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>${title || "ייצוא"}</title>
<style>@page{margin:2cm;size:A4}body{font-family:'David','Noto Sans Hebrew',serif;direction:rtl;color:#0B1F5B;line-height:1.8}
h1,h2,h3{color:#0B1F5B;border-bottom:2px solid #D4AF37;padding-bottom:4px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body>${content}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;width:210mm;height:297mm";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error();
      doc.open(); doc.write(fullHtml); doc.close();
      await new Promise(r => setTimeout(r, 500));
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
      toast.success("חלון הדפסה נפתח — בחר 'שמור כ-PDF'");
    } catch {
      toast.error("שגיאה בייצוא");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Share2 className="h-4 w-4" />
          שיתוף
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            שיתוף סוגיה
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-secondary/30 rounded-lg p-3 text-sm">
            <div className="font-medium">{masechet} {daf}</div>
            {title && <div className="text-muted-foreground text-xs">{title}</div>}
            {selectedText && (
              <div className="mt-2 text-xs border-r-2 border-primary pr-2 text-muted-foreground line-clamp-3">
                ״{selectedText}״
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">הוסף הערה אישית</label>
            <Textarea
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder="הערה שתצורף לשיתוף..."
              className="text-sm min-h-[60px]"
            />
          </div>

          {/* Link */}
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs font-mono" dir="ltr" />
            <Button variant="outline" size="icon" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2 text-sm" onClick={shareWhatsApp}>
              <MessageSquare className="h-4 w-4 text-green-600" />
              WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={shareMail}>
              ✉️ מייל
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={copyBody}>
              <Copy className="h-4 w-4" />
              העתק טקסט
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={shareNative}>
              <Share2 className="h-4 w-4" />
              שיתוף מערכת מהיר
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={printPage}>
              <Printer className="h-4 w-4" />
              הדפסה
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={exportPdf} disabled={isExporting}>
              <FileDown className="h-4 w-4" />
              ייצוא PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
