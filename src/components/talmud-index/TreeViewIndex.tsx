import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, toHebrewDaf, ValidationStatus } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
}

export default function TreeViewIndex({ grouped, onValidate, onClickRef }: Props) {
  const [openTractates, setOpenTractates] = useState<Record<string, boolean>>({});
  const [openDafs, setOpenDafs] = useState<Record<string, boolean>>({});

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
                          <div className="mr-5 space-y-2 py-1 border-r border-border/30 pr-3">
                            {dafRefs
                              .sort((a, b) => (a.amud ?? '').localeCompare(b.amud ?? ''))
                              .map(ref => (
                                <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} />
                              ))}
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
}
