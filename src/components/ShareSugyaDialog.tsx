import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Copy, Link2, Check, MessageSquare, X } from "lucide-react";
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
}

export default function ShareSugyaDialog({ sugyaId, masechet, daf, title, selectedText, notes }: ShareSugyaDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [personalNote, setPersonalNote] = useState(notes || "");
  const [copied, setCopied] = useState(false);

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Share2 className="h-4 w-4" />
          שתף
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
            <Button variant="outline" className="gap-2 text-sm" onClick={copyFull}>
              <Copy className="h-4 w-4" />
              העתק טקסט
            </Button>
            <Button variant="outline" className="gap-2 text-sm" onClick={shareNative}>
              <Share2 className="h-4 w-4" />
              שתף...
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
