import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState, memo } from 'react';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, toHebrewDaf, toHebrewAmud, ValidationStatus } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  onCorrect?: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

/** Group refs by amud: a, b, unknown */
function groupByAmud(refs: TalmudRefWithPsak[]) {
  const groups: Record<string, TalmudRefWithPsak[]> = {};
  for (const r of refs) {
    const key = r.amud || '_none';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  // Sort: a first, then b, then unknown
  const order = ['a', 'b', '_none'];
  return order.filter(k => groups[k]).map(k => ({ amud: k, refs: groups[k] }));
}

export default memo(function TreeViewIndex({ grouped, onValidate, onClickRef, onCorrect, highlightColor, highlightBg }: Props) {
  const [openTractates, setOpenTractates] = useState<Record<string, boolean>>({});
  const [openDafs, setOpenDafs] = useState<Record<string, boolean>>({});
  const [openAmuds, setOpenAmuds] = useState<Record<string, boolean>>({});

  const sortedTractates = Object.keys(grouped).sort((a, b) => {
    const ia = TRACTATES.indexOf(a);
    const ib = TRACTATES.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <div className="space-y-1 text-right">
        {sortedTractates.map(tractate => {
          const refs = grouped[tractate];
          const isOpen = openTractates[tractate] ?? false;

          const byDaf: Record<string, TalmudRefWithPsak[]> = {};
          for (const r of refs) {
            const key = r.daf;
            if (!byDaf[key]) byDaf[key] = [];
            byDaf[key].push(r);
          }
          const sortedDafs = Object.keys(byDaf).sort((a, b) => Number(a) - Number(b));

          return (
            <Collapsible
              key={tractate}
              open={isOpen}
              onOpenChange={(v) => setOpenTractates(prev => ({ ...prev, [tractate]: v }))}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-right">
                <span className="text-base font-bold">📚 {tractate}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? '' : 'rotate-90'}`} />
                <Badge variant="secondary" className="text-xs ml-auto">{refs.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mr-6 space-y-1 border-r-2 border-border/50 pr-3">
                  {sortedDafs.map(daf => {
                    const dafRefs = byDaf[daf];
                    const dafKey = `${tractate}-${daf}`;
                    const isDafOpen = openDafs[dafKey] ?? false;
                    const amudGroups = groupByAmud(dafRefs);
                    // Always build a/b groups
                    const amudMap: Record<string, TalmudRefWithPsak[]> = { a: [], b: [] };
                    let hasNone = false;
                    for (const g of amudGroups) {
                      if (g.amud === '_none') { hasNone = true; }
                      if (!amudMap[g.amud]) amudMap[g.amud] = [];
                      amudMap[g.amud].push(...g.refs);
                    }
                    const allAmudKeys = ['a', 'b', ...(hasNone ? ['_none'] : [])];

                    return (
                      <Collapsible
                        key={dafKey}
                        open={isDafOpen}
                        onOpenChange={(v) => setOpenDafs(prev => ({ ...prev, [dafKey]: v }))}
                      >
                        <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted/30 transition-colors text-right text-sm">
                          <span className="font-semibold text-primary">דף {toHebrewDaf(daf)}</span>
                          <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isDafOpen ? '' : 'rotate-90'}`} />
                          <Badge variant="outline" className="text-[10px] ml-auto">{dafRefs.length}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mr-5 space-y-1 py-1 border-r border-border/30 pr-3">
                            {allAmudKeys.map(amud => {
                              const amudKey = `${dafKey}-${amud}`;
                              const isAmudOpen = openAmuds[amudKey] ?? false;
                              const amudLabel = amud === 'a' ? 'עמוד א׳' : amud === 'b' ? 'עמוד ב׳' : 'כללי';
                              const amudRefs = amudMap[amud] || [];

                              return (
                                <Collapsible
                                  key={amudKey}
                                  open={isAmudOpen}
                                  onOpenChange={(v) => setOpenAmuds(prev => ({ ...prev, [amudKey]: v }))}
                                >
                                  <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted/20 transition-colors text-right text-sm">
                                    <span className="font-medium text-accent-foreground">{amudLabel}</span>
                                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isAmudOpen ? '' : 'rotate-90'}`} />
                                    <Badge variant="outline" className="text-[9px] ml-auto">{amudRefs.length}</Badge>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mr-4 space-y-2 py-1 border-r border-border/20 pr-3">
                                      {amudRefs.length > 0 ? amudRefs.map(ref => (
                                        <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} onCorrect={onCorrect} highlightColor={highlightColor} highlightBg={highlightBg} />
                                      )) : (
                                        <div className="text-xs text-muted-foreground py-2 text-center">אין פסקי דין לעמוד זה</div>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </ScrollArea>
  );
});
