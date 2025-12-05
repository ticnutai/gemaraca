import { Settings, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, themes, Theme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const themeColors: Record<Theme, { bg: string; accent: string; text: string }> = {
  classic: { bg: "bg-amber-50", accent: "bg-amber-500", text: "text-slate-800" },
  midnight: { bg: "bg-slate-900", accent: "bg-amber-500", text: "text-amber-100" },
  royal: { bg: "bg-blue-950", accent: "bg-slate-300", text: "text-slate-100" },
};

export function SettingsButton() {
  const { theme, setTheme } = useTheme();

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
          className="w-64 p-3"
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <Palette className="h-4 w-4 text-accent" />
            <span className="font-medium">ערכות נושא</span>
          </div>
          <div className="space-y-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg transition-all",
                  "hover:bg-muted/50",
                  theme === t.id && "bg-muted ring-1 ring-accent"
                )}
              >
                {/* Theme preview circles */}
                <div className="flex gap-1">
                  <div className={cn("w-4 h-4 rounded-full border", themeColors[t.id].bg)} />
                  <div className={cn("w-4 h-4 rounded-full", themeColors[t.id].accent)} />
                  <div className={cn("w-4 h-4 rounded-full", themeColors[t.id].bg, themeColors[t.id].text, "flex items-center justify-center text-[8px] font-bold border")}>
                    א
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </div>
                {theme === t.id && (
                  <Check className="h-4 w-4 text-accent" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
