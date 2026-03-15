import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus, toHebrewDaf, groupByDafAmud } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

export default function AccordionView({ grouped, onValidate, onClickRef, highlightColor, highlightBg }: Props) {
  const sortedTractates = Object.keys(grouped).sort((a, b) => {
    const ia = TRACTATES.indexOf(a);
    const ib = TRACTATES.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <Accordion type="multiple" className="space-y-1 text-right">
        {sortedTractates.map(tractate => {
          const dafGroups = groupByDafAmud(grouped[tractate]);
          // Collect unique dafs with their groups
          const dafMap: Record<string, typeof dafGroups> = {};
          for (const g of dafGroups) {
            if (!dafMap[g.daf]) dafMap[g.daf] = [];
            dafMap[g.daf].push(g);
          }

          return (
            <AccordionItem key={tractate} value={tractate} className="border rounded-lg px-3">
              <AccordionTrigger className="text-base font-bold hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  📚 {tractate}
                  <Badge variant="secondary" className="text-xs">{grouped[tractate].length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Accordion type="multiple" className="space-y-1">
                  {Object.entries(dafMap).map(([daf, amudGroups]) => {
                    const totalRefs = amudGroups.reduce((s, g) => s + g.refs.length, 0);
                    const hasAmudim = amudGroups.length > 1 || (amudGroups.length === 1 && amudGroups[0].amud !== '_none');

                    return (
                      <AccordionItem key={`${tractate}-${daf}`} value={`${tractate}-${daf}`} className="border rounded px-2">
                        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                          <div className="flex items-center gap-2">
                            דף {toHebrewDaf(daf)}
                            <Badge variant="outline" className="text-[10px]">{totalRefs}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {hasAmudim ? (
                            <div className="space-y-3 pb-2">
                              {amudGroups.map(group => (
                                <div key={group.amud}>
                                  <div className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                    {group.amudLabel || 'לא צוין'}
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0">{group.refs.length}</Badge>
                                  </div>
                                  <div className="grid gap-2 mr-3">
                                    {group.refs.map(ref => (
                                      <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid gap-2 pb-2">
                              {amudGroups[0].refs.map(ref => (
                                <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ScrollArea>
  );
}
