import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus } from './types';

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
    const result: Record<string, TalmudRefWithPsak[]> = {};
    for (const t of sortedTractates) {
      result[t] = [...grouped[t]].sort((a, b) => Number(a.daf) - Number(b.daf) || (a.amud ?? '').localeCompare(b.amud ?? ''));
    }
    return result;
  }, [grouped, sortedTractates]);

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <div className="space-y-6 text-right">
        {sortedTractates.map(tractate => {
          const items = sortedGroups[tractate];
          const limit = showCounts[tractate] || INITIAL_SHOW;
          const visible = items.slice(0, limit);
          const remaining = items.length - limit;

          return (
            <div key={tractate} className="space-y-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                📚 {tractate}
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </h3>
              <div className="grid gap-2 mr-4">
                {visible.map(ref => (
                  <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                ))}
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
