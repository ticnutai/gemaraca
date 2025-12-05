import { useState } from "react";
import { Settings, Check, Palette, ChevronRight, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme, themes, Theme, CustomColors } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const themeColors: Record<Exclude<Theme, "custom">, { bg: string; accent: string; text: string }> = {
  classic: { bg: "bg-amber-50", accent: "bg-amber-500", text: "text-slate-800" },
  midnight: { bg: "bg-slate-900", accent: "bg-amber-500", text: "text-amber-100" },
  royal: { bg: "bg-blue-950", accent: "bg-slate-300", text: "text-slate-100" },
};

const presetColors = [
  "#f5f5f0", "#faf7f2", "#f0f4f8", "#1a1a2e", "#0f172a", "#1e293b",
  "#1e3a5f", "#0d47a1", "#4a148c", "#1b5e20", "#b71c1c", "#e65100",
  "#d4a853", "#ffc107", "#8bc34a", "#00bcd4", "#e91e63", "#9c27b0",
];

export function SettingsButton() {
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [localColors, setLocalColors] = useState<CustomColors>(customColors);

  const handleColorChange = (key: keyof CustomColors, value: string) => {
    setLocalColors(prev => ({ ...prev, [key]: value }));
  };

  const applyCustomColors = () => {
    setCustomColors(localColors);
    setTheme("custom");
  };

  const colorLabels: Record<keyof CustomColors, string> = {
    background: "רקע",
    primary: "ראשי",
    accent: "הדגשה",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="end" 
          className="w-72 p-3 bg-card border-border"
        >
          {!showCustomizer ? (
            <>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Palette className="h-4 w-4 text-accent" />
                <span className="font-medium">ערכות נושא</span>
              </div>
              <div className="space-y-2">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "custom") {
                        setShowCustomizer(true);
                      } else {
                        setTheme(t.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-all",
                      "hover:bg-muted/50",
                      theme === t.id && "bg-muted ring-1 ring-accent"
                    )}
                  >
                    {/* Theme preview circles */}
                    {t.id !== "custom" ? (
                      <div className="flex gap-1">
                        <div className={cn("w-4 h-4 rounded-full border border-border", themeColors[t.id as Exclude<Theme, "custom">].bg)} />
                        <div className={cn("w-4 h-4 rounded-full", themeColors[t.id as Exclude<Theme, "custom">].accent)} />
                        <div className={cn("w-4 h-4 rounded-full", themeColors[t.id as Exclude<Theme, "custom">].bg, themeColors[t.id as Exclude<Theme, "custom">].text, "flex items-center justify-center text-[8px] font-bold border border-border")}>
                          א
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${customColors.background} 50%, ${customColors.primary} 50%)` }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: customColors.accent }} />
                        <Pipette className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-right">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    {t.id === "custom" ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground rotate-180" />
                    ) : theme === t.id ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <button 
                  onClick={() => setShowCustomizer(false)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <Pipette className="h-4 w-4 text-accent" />
                <span className="font-medium">התאמה אישית</span>
              </div>
              
              <div className="space-y-4">
                {(Object.keys(colorLabels) as Array<keyof CustomColors>).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-sm">{colorLabels[key]}</Label>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Input
                          type="color"
                          value={localColors[key]}
                          onChange={(e) => handleColorChange(key, e.target.value)}
                          className="w-10 h-10 p-1 cursor-pointer border-border"
                        />
                      </div>
                      <Input
                        type="text"
                        value={localColors[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        placeholder="#000000"
                        className="flex-1 font-mono text-sm bg-input border-border"
                        dir="ltr"
                      />
                    </div>
                    {/* Preset colors */}
                    <div className="flex flex-wrap gap-1">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(key, color)}
                          className={cn(
                            "w-5 h-5 rounded border border-border hover:scale-110 transition-transform",
                            localColors[key] === color && "ring-2 ring-accent ring-offset-1"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Preview */}
                <div className="p-3 rounded-lg border border-border" style={{ backgroundColor: localColors.background }}>
                  <div className="text-sm font-medium mb-1" style={{ color: localColors.primary }}>
                    תצוגה מקדימה
                  </div>
                  <div className="flex gap-2">
                    <div 
                      className="px-3 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: localColors.primary }}
                    >
                      כפתור ראשי
                    </div>
                    <div 
                      className="px-3 py-1 rounded text-xs"
                      style={{ backgroundColor: localColors.accent, color: localColors.primary }}
                    >
                      הדגשה
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={applyCustomColors}
                  className="w-full"
                >
                  <Check className="h-4 w-4 ml-2" />
                  החל ערכת נושא
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
