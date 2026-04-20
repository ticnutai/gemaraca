import { Sparkles, Check, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGemaraDafTheme } from "@/hooks/useGemaraDafTheme";
import { DAF_THEME_LIST } from "@/lib/gemaraDafThemes";
import { cn } from "@/lib/utils";

/**
 * Floating action button (bottom-left) opening a popover with 5 daf design themes.
 * Click any theme → instantly applies & syncs to cloud.
 */
export default function GemaraDafThemeFloat() {
  const { theme, setTheme, savedFlash } = useGemaraDafTheme();

  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-end gap-2" dir="rtl">
      {savedFlash && (
        <div className="bg-[hsl(40_72%_42%)] text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 animate-fade-in">
          <Cloud className="h-3 w-3" />
          נשמר
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl",
              "bg-gradient-to-br from-[hsl(40_72%_50%)] to-[hsl(40_72%_38%)]",
              "hover:from-[hsl(40_72%_55%)] hover:to-[hsl(40_72%_42%)]",
              "text-white border-2 border-white/40",
              "hover:scale-110 transition-all duration-200",
              "ring-2 ring-[hsl(40_72%_42%)]/30 hover:ring-4"
            )}
            title="עיצוב הדף"
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-80 p-3 mr-2"
          dir="rtl"
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Sparkles className="h-4 w-4 text-[hsl(40_72%_42%)]" />
              <h3 className="text-sm font-bold">עיצוב דף הגמרא</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              בחר ערכת עיצוב — תיושם מיידית ותישמר לכל המכשירים
            </p>
            <div className="grid grid-cols-1 gap-1.5 max-h-[420px] overflow-y-auto">
              {DAF_THEME_LIST.map((t) => {
                const isActive = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "relative flex items-center gap-3 p-2.5 rounded-lg border-2 text-right transition-all",
                      "hover:scale-[1.02] hover:shadow-md",
                      isActive
                        ? "border-[hsl(40_72%_42%)] shadow-md"
                        : "border-border hover:border-[hsl(40_72%_42%)]/40"
                    )}
                  >
                    {/* Swatch preview */}
                    <div
                      className="shrink-0 w-14 h-14 rounded-md border border-border overflow-hidden flex items-center justify-center font-serif text-lg font-bold shadow-inner"
                      style={{
                        background: t.swatchBg,
                        color: t.swatchText,
                      }}
                    >
                      א
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground">
                          {t.label}
                        </span>
                        {isActive && (
                          <Check className="h-3.5 w-3.5 text-[hsl(40_72%_42%)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}