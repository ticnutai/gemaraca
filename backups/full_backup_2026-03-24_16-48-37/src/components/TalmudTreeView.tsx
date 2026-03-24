import { useState, useCallback } from "react";
import { BookOpen, Scale, ChevronDown, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEDARIM, getMasechtotBySeder, Masechet } from "@/lib/masechtotData";
import { toDafFormat, toHebrewNumeral } from "@/lib/hebrewNumbers";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MASECHTOT } from "@/lib/masechtotData";

// Seder color palette
const SEDER_COLORS: Record<string, { bg: string; border: string; line: string; text: string; badge: string }> = {
  "זרעים": { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-300 dark:border-emerald-700", line: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  "מועד":  { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-700", line: "bg-blue-400", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  "נשים":  { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-300 dark:border-pink-700", line: "bg-pink-400", text: "text-pink-700 dark:text-pink-300", badge: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  "נזיקין": { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-300 dark:border-amber-700", line: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  "קדשים": { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-300 dark:border-purple-700", line: "bg-purple-400", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  "טהרות": { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-300 dark:border-cyan-700", line: "bg-cyan-400", text: "text-cyan-700 dark:text-cyan-300", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
};

const DEFAULT_COLORS = SEDER_COLORS["זרעים"];

interface TalmudTreeViewProps {
  psakCounts: Record<string, number>;
  loadedPages: Record<string, number[]>;
}

const TalmudTreeView = ({ psakCounts, loadedPages }: TalmudTreeViewProps) => {
  const navigate = useNavigate();
  const { setSelectedMasechet, setActiveTab } = useAppContext();
  const [expandedSeder, setExpandedSeder] = useState<string | null>(null);
  const [expandedMasechet, setExpandedMasechet] = useState<string | null>(null);

  const getColors = (seder: string) => SEDER_COLORS[seder] || DEFAULT_COLORS;

  const getLoadStatus = (masechet: Masechet) => {
    const pages = loadedPages[masechet.hebrewName] || [];
    const total = (masechet.maxDaf - 1) * 2;
    return { loaded: pages.length, total, percent: total > 0 ? Math.round((pages.length / total) * 100) : 0 };
  };

  const getSederPsakCount = (seder: string) => {
    return getMasechtotBySeder(seder).reduce((sum, m) => sum + (psakCounts[m.sefariaName] || 0), 0);
  };

  const handleMasechetClick = useCallback((masechet: Masechet) => {
    setSelectedMasechet(masechet.hebrewName);
    setActiveTab("gemara");
    navigate(`/sugya/${masechet.sefariaName.toLowerCase()}_2a`);
  }, [navigate, setSelectedMasechet, setActiveTab]);

  const toggleSeder = (seder: string) => {
    setExpandedSeder(prev => prev === seder ? null : seder);
    setExpandedMasechet(null);
  };

  const toggleMasechet = (name: string) => {
    setExpandedMasechet(prev => prev === name ? null : name);
  };

  return (
    <div className="relative overflow-x-auto pb-8">
      {/* Root: תלמוד בבלי */}
      <div className="flex flex-col items-center">
        <div className="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl px-6 py-3 shadow-lg border-2 border-primary/50">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <span className="font-bold text-base">תלמוד בבלי</span>
          </div>
          <div className="text-xs opacity-80 text-center mt-0.5">
            {MASECHTOT.length} מסכתות · 6 סדרים
          </div>
        </div>

        {/* Vertical line from root */}
        <div className="w-0.5 h-6 bg-primary/40" />

        {/* Horizontal connector rail */}
        <div className="relative w-full">
          <div className="absolute top-0 left-[8.33%] right-[8.33%] h-0.5 bg-primary/30" />
        </div>

        {/* 6 Sedarim as branches */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-2 gap-y-1 w-full mt-0">
          {SEDARIM.map((seder) => {
            const colors = getColors(seder);
            const masechtot = getMasechtotBySeder(seder);
            const totalPsakim = getSederPsakCount(seder);
            const isOpen = expandedSeder === seder;

            return (
              <div key={seder} className="flex flex-col items-center">
                {/* Vertical line from rail to seder node */}
                <div className={cn("w-0.5 h-5", colors.line)} />

                {/* Seder Node */}
                <button
                  onClick={() => toggleSeder(seder)}
                  className={cn(
                    "relative w-full rounded-xl border-2 px-2 py-2.5 transition-all duration-300",
                    "hover:shadow-md active:scale-95",
                    colors.bg, colors.border,
                    isOpen && "shadow-lg ring-2 ring-offset-1 ring-primary/20"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn("font-bold text-xs sm:text-sm", colors.text)}>{seder}</span>
                    <span className="text-[10px] text-muted-foreground">{masechtot.length} מסכתות</span>
                  </div>
                  {totalPsakim > 0 && (
                    <div className="absolute -top-2 -left-2">
                      <span className={cn("text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1", colors.badge)}>
                        <Scale className="h-2.5 w-2.5 mr-0.5" />{totalPsakim}
                      </span>
                    </div>
                  )}
                  <ChevronDown className={cn(
                    "h-3 w-3 mx-auto mt-1 transition-transform text-muted-foreground",
                    isOpen && "rotate-180"
                  )} />
                </button>

                {/* Masechtot branch under this seder */}
                {isOpen && (
                  <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className={cn("w-0.5 h-4", colors.line)} />
                    <div className="w-full space-y-0">
                      {masechtot.map((masechet, idx) => {
                        const pCount = psakCounts[masechet.sefariaName] || 0;
                        const status = getLoadStatus(masechet);
                        const isMasOpen = expandedMasechet === masechet.englishName;

                        return (
                          <div key={masechet.englishName} className="flex flex-col items-center">
                            {idx > 0 && <div className={cn("w-0.5 h-1.5", colors.line, "opacity-40")} />}

                            {/* Masechet node */}
                            <div
                              className={cn(
                                "relative w-full rounded-lg border px-2 py-1.5 transition-all cursor-pointer",
                                "hover:shadow-sm",
                                colors.border, "border-opacity-50",
                                isMasOpen ? cn(colors.bg, "shadow") : "bg-card hover:bg-muted/30"
                              )}
                              onClick={() => toggleMasechet(masechet.englishName)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  {pCount > 0 && (
                                    <div className="relative">
                                      <Scale className="h-3 w-3 text-primary/70" />
                                      <span className="absolute -top-1.5 -left-1.5 bg-primary text-primary-foreground text-[7px] font-bold rounded-full min-w-[12px] h-3 flex items-center justify-center px-0.5">
                                        {pCount}
                                      </span>
                                    </div>
                                  )}
                                  {status.loaded > 0 && (
                                    <span className={cn(
                                      "text-[8px] rounded px-1 py-0.5",
                                      status.percent === 100 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"
                                    )}>
                                      {status.percent === 100 ? "✓" : `${status.percent}%`}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-medium text-[11px] sm:text-xs">{masechet.hebrewName}</span>
                                  <span className="text-[9px] text-muted-foreground mr-1">({masechet.maxDaf - 1})</span>
                                </div>
                              </div>
                            </div>

                            {/* Expanded: show daf groups as mini tree */}
                            {isMasOpen && (
                              <div className="flex flex-col items-center w-full animate-in fade-in duration-200">
                                <div className={cn("w-0.5 h-2", colors.line, "opacity-40")} />
                                <div className="w-full grid grid-cols-5 gap-0.5 px-1 pb-1">
                                  {Array.from({ length: masechet.maxDaf - 1 }, (_, i) => i + 2).map(daf => {
                                    const dafPsak = pCount > 0; // simplified indicator
                                    return (
                                      <button
                                        key={daf}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMasechetClick(masechet);
                                        }}
                                        className={cn(
                                          "text-[8px] rounded py-0.5 transition-colors",
                                          "hover:bg-primary/20",
                                          (loadedPages[masechet.hebrewName] || []).includes(daf)
                                            ? cn(colors.bg, colors.text, "font-medium")
                                            : "bg-muted/30 text-muted-foreground"
                                        )}
                                        title={`דף ${toHebrewNumeral(daf)}`}
                                      >
                                        {toHebrewNumeral(daf)}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Quick navigate button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMasechetClick(masechet);
                                  }}
                                  className={cn(
                                    "text-[10px] font-medium px-3 py-1 rounded-full transition-colors mb-1",
                                    colors.badge, "hover:opacity-80"
                                  )}
                                >
                                  פתח מסכת →
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-6 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400" /> הורד
        </div>
        <div className="flex items-center gap-1">
          <Scale className="h-2.5 w-2.5 text-primary" /> פסקי דין מקושרים
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted" /> לא הורד
        </div>
      </div>
    </div>
  );
};

export default TalmudTreeView;
