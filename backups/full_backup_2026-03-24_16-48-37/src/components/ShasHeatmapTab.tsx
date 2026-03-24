import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Map, BookOpen } from "lucide-react";
import { MASECHTOT, SEDARIM } from "@/lib/masechtotData";

const HISTORY_KEY = "learning-history";

interface HistoryEntry {
  sugyaId: string;
  masechet: string;
  dafYomi: string;
  visitedAt: number;
  durationMs?: number;
}

function extractDafNum(dafYomi: string): number | null {
  const match = dafYomi.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default function ShasHeatmapTab() {
  const history: HistoryEntry[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch { return []; }
  }, []);

  // Build visit map: masechet -> Set of daf numbers visited
  const visitMap = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    history.forEach(h => {
      const num = extractDafNum(h.dafYomi);
      if (num !== null && h.masechet) {
        if (!map[h.masechet]) map[h.masechet] = new Set();
        map[h.masechet].add(num);
      }
    });
    return map;
  }, [history]);

  // Duration map for deeper "heat"
  const durationMap = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    history.forEach(h => {
      const num = extractDafNum(h.dafYomi);
      if (num !== null && h.masechet && h.durationMs) {
        if (!map[h.masechet]) map[h.masechet] = {};
        map[h.masechet][num] = (map[h.masechet][num] || 0) + h.durationMs;
      }
    });
    return map;
  }, [history]);

  const totalStudied = useMemo(() => {
    let count = 0;
    Object.values(visitMap).forEach(set => count += set.size);
    return count;
  }, [visitMap]);

  const totalDafs = useMemo(() => MASECHTOT.reduce((sum, m) => sum + (m.maxDaf - 1), 0), []);

  const groupedMasechtot = useMemo(() => SEDARIM.map(seder => ({
    seder,
    masechtot: MASECHTOT.filter(m => m.seder === seder)
  })), []);

  const getColor = (masechet: string, dafNum: number): string => {
    const visited = visitMap[masechet]?.has(dafNum);
    if (!visited) return "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    const duration = durationMap[masechet]?.[dafNum] || 0;
    if (duration > 600000) return "bg-green-500 border-green-600 text-white"; // >10min
    if (duration > 120000) return "bg-green-400 border-green-500 text-white"; // >2min
    return "bg-yellow-300 border-yellow-400 dark:bg-yellow-600 dark:border-yellow-500"; // visited briefly
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Map className="h-5 w-5 text-green-600" />
            מפת חום הש"ס
          </h2>
          <p className="text-sm text-muted-foreground">ויזואליזציה של כל הדפים שלמדת</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {totalStudied}/{totalDafs}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {totalDafs > 0 ? Math.round((totalStudied / totalDafs) * 100) : 0}%
          </Badge>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200" />
          <span>לא למדת</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-300 dark:bg-yellow-600 border border-yellow-400" />
          <span>ביקור קצר</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-400 border border-green-500" />
          <span>למדת (2+ דקות)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500 border border-green-600" />
          <span>למידה עמוקה (10+ דקות)</span>
        </div>
      </div>

      <ScrollArea className="max-h-[calc(100vh-260px)]">
        <div className="space-y-4">
          {groupedMasechtot.map(({ seder, masechtot }) => (
            <Card key={seder}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">סדר {seder}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {masechtot.map(m => {
                  const dafCount = m.maxDaf - 1;
                  const visited = visitMap[m.hebrewName]?.size || 0;
                  const pct = dafCount > 0 ? Math.round((visited / dafCount) * 100) : 0;

                  return (
                    <div key={m.hebrewName} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{m.hebrewName}</span>
                          <span className="text-xs text-muted-foreground">({dafCount} דפים)</span>
                        </div>
                        <Badge variant={pct === 100 ? "default" : "secondary"} className="text-xs">
                          {visited}/{dafCount} ({pct}%)
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {Array.from({ length: dafCount }, (_, i) => i + 2).map(dafNum => (
                          <Tooltip key={dafNum}>
                            <TooltipTrigger asChild>
                              <div className={`w-4 h-4 rounded-sm border text-[7px] flex items-center justify-center cursor-default transition-all hover:scale-150 hover:z-10 ${getColor(m.hebrewName, dafNum)}`}>
                                {dafNum}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              <div>{m.hebrewName} דף {dafNum}</div>
                              {visitMap[m.hebrewName]?.has(dafNum) && (
                                <div className="text-green-400">
                                  ✓ נלמד
                                  {durationMap[m.hebrewName]?.[dafNum] && (
                                    <span> ({Math.round((durationMap[m.hebrewName][dafNum] || 0) / 60000)} דק')</span>
                                  )}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
