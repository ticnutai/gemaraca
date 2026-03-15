import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus, toHebrewDaf, groupByDafAmud } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

export default function CardsView({ grouped, onValidate, onClickRef, highlightColor, highlightBg }: Props) {
  const sortedTractates = Object.keys(grouped).sort((a, b) => {
    const ia = TRACTATES.indexOf(a);
    const ib = TRACTATES.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  if (sortedTractates.length === 0) return null;

  return (
    <Tabs defaultValue={sortedTractates[0]} dir="rtl">
      <ScrollArea className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {sortedTractates.map(t => (
            <TabsTrigger key={t} value={t} className="text-xs gap-1">
              {t} <Badge variant="secondary" className="text-[9px] h-4 px-1">{grouped[t].length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </ScrollArea>
      {sortedTractates.map(tractate => {
        const dafAmudGroups = groupByDafAmud(grouped[tractate]);
        const dafMap: Record<string, typeof dafAmudGroups> = {};
        for (const g of dafAmudGroups) {
          if (!dafMap[g.daf]) dafMap[g.daf] = [];
          dafMap[g.daf].push(g);
        }

        return (
          <TabsContent key={tractate} value={tractate}>
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-4">
                {Object.entries(dafMap).map(([daf, amudGroups]) => {
                  const hasAmudim = amudGroups.length > 1 || (amudGroups.length === 1 && amudGroups[0].amud !== '_none');

                  return (
                    <div key={daf}>
                      <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
                        דף {toHebrewDaf(daf)}
                        <Badge variant="outline" className="text-[10px]">
                          {amudGroups.reduce((s, g) => s + g.refs.length, 0)}
                        </Badge>
                      </h4>
                      {hasAmudim ? (
                        <div className="space-y-3 mr-2">
                          {amudGroups.map(group => (
                            <div key={group.amud}>
                              <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                                {group.amudLabel || 'לא צוין'}
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">{group.refs.length}</Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {group.refs.map(ref => (
                                  <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {amudGroups[0].refs.map(ref => (
                            <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
