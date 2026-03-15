import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus, toHebrewDaf, groupByDafAmud, DafAmudGroup } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  onCorrect?: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

type FlatRow =
  | { type: 'tractate'; tractate: string; count: number }
  | { type: 'daf'; daf: string; tractate: string }
  | { type: 'amud'; amudLabel: string; count: number }
  | { type: 'ref'; ref: TalmudRefWithPsak };

export default function ListView({ grouped, onValidate, onClickRef, onCorrect, highlightColor, highlightBg }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten all groups into a virtual list of rows
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    const sortedTractates = Object.keys(grouped).sort((a, b) => {
      const ia = TRACTATES.indexOf(a);
      const ib = TRACTATES.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    for (const tractate of sortedTractates) {
      const dafAmudGroups = groupByDafAmud(grouped[tractate]);
      rows.push({ type: 'tractate', tractate, count: grouped[tractate].length });

      const dafAmudCount: Record<string, number> = {};
      for (const g of dafAmudGroups) {
        dafAmudCount[g.daf] = (dafAmudCount[g.daf] || 0) + 1;
      }

      let lastDaf = '';
      for (const group of dafAmudGroups) {
        if (group.daf !== lastDaf) {
          rows.push({ type: 'daf', daf: group.daf, tractate });
          lastDaf = group.daf;
        }
        const showAmud = (dafAmudCount[group.daf] ?? 0) > 1 || group.amud !== '_none';
        if (showAmud) {
          rows.push({ type: 'amud', amudLabel: group.amudLabel || 'לא צוין', count: group.refs.length });
        }
        for (const ref of group.refs) {
          rows.push({ type: 'ref', ref });
        }
      }
    }
    return rows;
  }, [grouped]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = flatRows[index];
      if (row.type === 'tractate') return 40;
      if (row.type === 'daf') return 32;
      if (row.type === 'amud') return 24;
      return 120; // ref card
    },
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-320px)] overflow-auto" dir="rtl">
      <div
        className="relative w-full text-right"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const row = flatRows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              className="absolute top-0 right-0 w-full"
              style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
            >
              {row.type === 'tractate' && (
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                  📚 {row.tractate}
                  <Badge variant="secondary" className="text-xs">{row.count}</Badge>
                </h3>
              )}
              {row.type === 'daf' && (
                <h4 className="text-sm font-bold text-primary mt-1 mb-1 mr-4 flex items-center gap-1.5">
                  דף {toHebrewDaf(row.daf)}
                </h4>
              )}
              {row.type === 'amud' && (
                <div className="text-xs font-semibold text-muted-foreground mb-1 mr-6 flex items-center gap-1">
                  {row.amudLabel}
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">{row.count}</Badge>
                </div>
              )}
              {row.type === 'ref' && (
                <div className="mr-7 pl-1">
                  <RefCard data={row.ref} onValidate={onValidate} onClickRef={onClickRef} onCorrect={onCorrect} highlightColor={highlightColor} highlightBg={highlightBg} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
