import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus, toHebrewDaf, groupByDafAmud } from './types';

const INITIAL_SHOW = 50;
const SHOW_MORE_INCREMENT = 50;

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

export default function ListView({ grouped, onValidate, onClickRef, highlightColor, highlightBg }: Props) {
  const [showCounts, setShowCounts] = useState<Record<string, number>>({});

  const sortedTractates = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      const ia = TRACTATES.indexOf(a);
      const ib = TRACTATES.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }),
    [grouped]
  );

  const sortedGroups = useMemo(() => {
    const result: Record<string, ReturnType<typeof groupByDafAmud>> = {};
    for (const t of sortedTractates) {
      result[t] = groupByDafAmud(grouped[t]);
    }
    return result;
  }, [grouped, sortedTractates]);

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <div className="space-y-6 text-right">
        {sortedTractates.map(tractate => {
          const dafAmudGroups = sortedGroups[tractate];
          // Flatten refs for pagination
          const allRefs = dafAmudGroups.flatMap(g => g.refs);
          const limit = showCounts[tractate] || INITIAL_SHOW;
          const remaining = allRefs.length - limit;

          // Build visible groups with ref limit
          let shown = 0;
          const visibleGroups: { daf: string; amud: string; amudLabel: string; refs: TalmudRefWithPsak[] }[] = [];
          for (const g of dafAmudGroups) {
            if (shown >= limit) break;
            const take = Math.min(g.refs.length, limit - shown);
            visibleGroups.push({ ...g, refs: g.refs.slice(0, take) });
            shown += take;
          }

          // Track which dafs have multiple amudim
          const dafAmudCount: Record<string, number> = {};
          for (const g of dafAmudGroups) {
            dafAmudCount[g.daf] = (dafAmudCount[g.daf] || 0) + 1;
          }

          let lastDaf = '';

          return (
            <div key={tractate} className="space-y-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                📚 {tractate}
                <Badge variant="secondary" className="text-xs">{allRefs.length}</Badge>
              </h3>
              <div className="mr-4 space-y-1">
                {visibleGroups.map(group => {
                  const showDafHeader = group.daf !== lastDaf;
                  lastDaf = group.daf;
                  const showAmudLabel = (dafAmudCount[group.daf] ?? 0) > 1 || (group.amud !== '_none');

                  return (
                    <div key={`${group.daf}-${group.amud}`}>
                      {showDafHeader && (
                        <h4 className="text-sm font-bold text-primary mt-3 mb-1 flex items-center gap-1.5">
                          דף {toHebrewDaf(group.daf)}
                        </h4>
                      )}
                      {showAmudLabel && (
                        <div className="text-xs font-semibold text-muted-foreground mb-1 mr-2 flex items-center gap-1">
                          {group.amudLabel || 'לא צוין'}
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{group.refs.length}</Badge>
                        </div>
                      )}
                      <div className="grid gap-2 mr-3">
                        {group.refs.map(ref => (
                          <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {remaining > 0 && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowCounts(prev => ({ ...prev, [tractate]: limit + SHOW_MORE_INCREMENT }))}
                  >
                    הצג עוד {Math.min(remaining, SHOW_MORE_INCREMENT)} מתוך {remaining} נותרים
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
