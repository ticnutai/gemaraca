import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportPdfButtonProps {
  title?: string;
  htmlContent?: string;
  onBeforeExport?: () => string | undefined; // Returns HTML to export, or undefined
}

export default function ExportPdfButton({ title, htmlContent, onBeforeExport }: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      const content = onBeforeExport?.() ?? htmlContent;
      if (!content) {
        toast.error("אין תוכן לייצוא");
        return;
      }

      // Create a full HTML document for printing
      const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title || "ייצוא פסק דין"}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body { font-family: 'David', 'Noto Sans Hebrew', serif; direction: rtl; color: #0B1F5B; line-height: 1.8; }
    h1, h2, h3 { color: #0B1F5B; border-bottom: 2px solid #D4AF37; padding-bottom: 4px; }
    .header { text-align: center; border-bottom: 3px double #D4AF37; padding-bottom: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #D4AF37; padding: 8px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${content}</body>
</html>`;

      // Use window.print via an iframe for PDF generation
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Cannot access iframe document");

      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      iframe.contentWindow?.print();

      // Cleanup after a delay
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);

      toast.success("חלון הדפסה נפתח — בחר 'שמור כ-PDF'");
    } catch (err) {
      toast.error("שגיאה בייצוא");
    } finally {
      setIsExporting(false);
    }
  }, [htmlContent, title, onBeforeExport]);

  return (
    <Button variant="outline" size="sm" className="gap-1" onClick={exportToPdf} disabled={isExporting}>
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      ייצוא PDF
    </Button>
  );
}
