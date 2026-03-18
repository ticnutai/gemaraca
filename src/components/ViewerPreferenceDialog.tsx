import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Eye, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";

const VIEWER_PREF_KEY = "psak_din_viewer_preference";
const LEGACY_VIEWER_PREF_KEY = "psak-din-default-viewer";

export type ViewerMode = "dialog" | "embedpdf" | "newwindow";

export function getViewerPreference(): ViewerMode | null {
  const direct = localStorage.getItem(VIEWER_PREF_KEY) as ViewerMode | null;
  if (direct === "dialog" || direct === "embedpdf" || direct === "newwindow") {
    return direct;
  }

  const legacy = localStorage.getItem(LEGACY_VIEWER_PREF_KEY);
  if (!legacy) return null;

  if (legacy === "regular") return "dialog";
  if (legacy === "embedpdf" || legacy === "embedpdf-page" || legacy === "embedded-pdf" || legacy === "google-viewer") {
    return "embedpdf";
  }
  return null;
}

export function setViewerPreference(mode: ViewerMode) {
  localStorage.setItem(VIEWER_PREF_KEY, mode);
}

export function clearViewerPreference() {
  localStorage.removeItem(VIEWER_PREF_KEY);
  localStorage.removeItem(LEGACY_VIEWER_PREF_KEY);
}

interface ViewerPreferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: ViewerMode) => void;
}

const ViewerPreferenceDialog = ({ open, onOpenChange, onSelect }: ViewerPreferenceDialogProps) => {
  const [remember, setRemember] = useState(true);

  const handleSelect = (mode: ViewerMode) => {
    if (remember) {
      setViewerPreference(mode);
    }
    onSelect(mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-center">
            באיזו מערכת לפתוח את פסק הדין?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={() => handleSelect("dialog")}
          >
            <Eye className="h-5 w-5 text-primary" />
            <div className="text-right">
              <div className="font-semibold">תצוגה רגילה</div>
              <div className="text-xs text-muted-foreground">פתח בחלון תצוגה מובנה</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={() => handleSelect("embedpdf")}
          >
            <FileText className="h-5 w-5 text-primary" />
            <div className="text-right">
              <div className="font-semibold">EmbedPDF</div>
              <div className="text-xs text-muted-foreground">תצוגת PDF מתקדמת בדף נפרד</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 text-base"
            onClick={() => handleSelect("newwindow")}
          >
            <ExternalLink className="h-5 w-5 text-primary" />
            <div className="text-right">
              <div className="font-semibold">חלון חדש</div>
              <div className="text-xs text-muted-foreground">פתח קישור בטאב חדש</div>
            </div>
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
          />
          <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
            זכור את הבחירה שלי (ניתן לשנות בהגדרות)
          </Label>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewerPreferenceDialog;
