import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
}

export default function CardsView({ grouped, onValidate, onClickRef }: Props) {
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
      {sortedTractates.map(tractate => (
        <TabsContent key={tractate} value={tractate}>
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[tractate]
                .sort((a, b) => Number(a.daf) - Number(b.daf) || (a.amud ?? '').localeCompare(b.amud ?? ''))
                .map(ref => (
                  <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}
