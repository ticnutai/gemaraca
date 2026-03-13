import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus } from './types';

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
        {sortedTractates.map(tractate => (
          <AccordionItem key={tractate} value={tractate} className="border rounded-lg px-3">
            <AccordionTrigger className="text-base font-bold hover:no-underline py-3">
              <div className="flex items-center gap-2">
                📚 {tractate}
                <Badge variant="secondary" className="text-xs">{grouped[tractate].length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-2 pb-2">
                {grouped[tractate]
                  .sort((a, b) => Number(a.daf) - Number(b.daf) || (a.amud ?? '').localeCompare(b.amud ?? ''))
                  .map(ref => (
                    <RefCard key={ref.id} data={ref} onValidate={onValidate} onClickRef={onClickRef} highlightColor={highlightColor} highlightBg={highlightBg} />
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
}
