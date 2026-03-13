import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus } from './types';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
}

export default function ListView({ grouped, onValidate, onClickRef }: Props) {
  const sortedTractates = Object.keys(grouped).sort((a, b) => {
    const ia = TRACTATES.indexOf(a);
    const ib = TRACTATES.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <div className="space-y-6 text-right">
        {sortedTractates.map(tractate => (
          <div key={tractate} className="space-y-2">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
              📚 {tractate}
              <Badge variant="secondary" className="text-xs">{grouped[tractate].length}</Badge>
            </h3>
            <div className="grid gap-2 mr-4">
              {grouped[tractate]
                .sort((a, b) => Number(a.daf) - Number(b.daf) || (a.amud ?? '').localeCompare(b.amud ?? ''))
                .map(ref => (
                  <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
