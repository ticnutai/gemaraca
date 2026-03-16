import { useState } from "react";
import { Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTypography } from "@/hooks/usePageTypography";
import { cn } from "@/lib/utils";

const FONTS = [
  { value: "Arial", label: "אריאל" },
  { value: "David", label: "דוד" },
  { value: "'Frank Ruhl Libre', serif", label: "פרנק רוהל" },
  { value: "'Heebo', sans-serif", label: "חיבו" },
  { value: "'Rubik', sans-serif", label: "רוביק" },
  { value: "'Noto Serif Hebrew', serif", label: "נוטו סריף" },
  { value: "Georgia, serif", label: "ג'ורג'יה" },
  { value: "'Times New Roman', serif", label: "טיימס" },
];

const FloatingTypography = () => {
  const { settings, updateSettings } = usePageTypography();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "fixed bottom-24 left-4 z-50 h-10 w-10 rounded-full",
            "bg-card border border-border shadow-lg",
            "flex items-center justify-center",
            "hover:border-accent hover:shadow-elegant transition-all",
            "text-foreground hover:text-accent"
          )}
          title="הגדרות טיפוגרפיה"
        >
          <Type className="h-4.5 w-4.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 p-4 space-y-5"
        dir="rtl"
      >
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Type className="h-4 w-4 text-accent" />
          הגדרות טקסט — עמוד זה
        </h4>

        {/* Font family */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">גופן</label>
          <Select
            value={settings.fontFamily}
            onValueChange={(v) => updateSettings({ fontFamily: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font size slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">גודל גופן</label>
            <span className="text-xs font-semibold text-foreground">{settings.fontSize}px</span>
          </div>
          <Slider
            value={[settings.fontSize]}
            onValueChange={([v]) => updateSettings({ fontSize: v })}
            min={12}
            max={28}
            step={1}
          />
        </div>

        {/* Line height slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">מרווח שורות</label>
            <span className="text-xs font-semibold text-foreground">{settings.lineHeight.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.lineHeight * 10]}
            onValueChange={([v]) => updateSettings({ lineHeight: v / 10 })}
            min={10}
            max={30}
            step={1}
          />
        </div>

        {/* Preview */}
        <div
          className="p-3 rounded-md border border-border bg-muted/30 text-foreground"
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
          }}
        >
          דוגמא לטקסט בהגדרות הנבחרות
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FloatingTypography;
