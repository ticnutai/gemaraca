import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Copy, Printer, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ShareExportButtonProps {
  title: string;
  text: string;
  url?: string;
}

export default function ShareExportButton({ title, text, url }: ShareExportButtonProps) {
  const currentUrl = url || window.location.href;

  const copyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הועתק ללוח" });
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  }, [text]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast({ title: "הקישור הועתק" });
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  }, [currentUrl]);

  const share = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text.slice(0, 200), url: currentUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }, [title, text, currentUrl, copyLink]);

  const print = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:serif;max-width:700px;margin:2rem auto;line-height:1.8;padding:0 1rem}
h1{text-align:center;border-bottom:2px solid #333;padding-bottom:.5rem}
.meta{text-align:center;color:#666;font-size:.9rem}</style></head>
<body><h1>${title}</h1><div style="white-space:pre-line">${text}</div></body></html>`);
    win.document.close();
    win.print();
  }, [title, text]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          שיתוף
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" dir="rtl">
        <DropdownMenuItem onClick={copyText}>
          <Copy className="h-4 w-4 ml-2" />
          העתק טקסט
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Link2 className="h-4 w-4 ml-2" />
          העתק קישור
        </DropdownMenuItem>
        <DropdownMenuItem onClick={share}>
          <Share2 className="h-4 w-4 ml-2" />
          שתף
        </DropdownMenuItem>
        <DropdownMenuItem onClick={print}>
          <Printer className="h-4 w-4 ml-2" />
          הדפסה
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
