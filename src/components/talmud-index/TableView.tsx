import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, EyeOff } from 'lucide-react';
import { TalmudRefWithPsak, TRACTATES, toHebrewDaf, toHebrewAmud, ValidationStatus } from './types';

interface Props {
  filtered: TalmudRefWithPsak[];
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
}

export default function IndexTableView({ filtered, onValidate, onClickRef }: Props) {
  const sorted = [...filtered].sort((a, b) => {
    const ia = TRACTATES.indexOf(a.tractate);
    const ib = TRACTATES.indexOf(b.tractate);
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return Number(a.daf) - Number(b.daf);
  });

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <Table className="text-right">
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">הפניה</TableHead>
            <TableHead className="text-right">מסכת</TableHead>
            <TableHead className="text-right">דף</TableHead>
            <TableHead className="text-right">מקור</TableHead>
            <TableHead className="text-right">פסק דין</TableHead>
            <TableHead className="text-right">ביטחון</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(ref => (
            <TableRow
              key={ref.id}
              className={`cursor-pointer ${ref.validation_status === 'incorrect' ? 'opacity-50' : ''}`}
              onClick={() => onClickRef(ref)}
            >
              <TableCell className="font-bold text-primary">{ref.normalized}</TableCell>
              <TableCell>{ref.tractate}</TableCell>
              <TableCell>{toHebrewDaf(ref.daf)}{ref.amud ? ` ${toHebrewAmud(ref.amud)}` : ''}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-[10px]">
                  {ref.source === 'regex' ? 'regex' : 'AI'}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                {ref.psakei_din?.title}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    ref.confidence === 'high' ? 'border-green-500/50 text-green-700' :
                    ref.confidence === 'medium' ? 'border-yellow-500/50 text-yellow-700' :
                    'border-red-500/50 text-red-700'
                  }`}
                >
                  {ref.confidence === 'high' ? 'גבוה' : ref.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                </Badge>
              </TableCell>
              <TableCell>
                {ref.validation_status === 'correct' && <Badge className="text-[10px] bg-green-600 text-white border-0">מאושר</Badge>}
                {ref.validation_status === 'incorrect' && <Badge variant="destructive" className="text-[10px]">שגוי</Badge>}
                {ref.validation_status === 'ignored' && <Badge variant="outline" className="text-[10px] text-muted-foreground">התעלם</Badge>}
                {ref.validation_status === 'pending' && <Badge variant="outline" className="text-[10px]">ממתין</Badge>}
              </TableCell>
              <TableCell onClick={e => e.stopPropagation()}>
                <div className="flex gap-1">
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => onValidate(ref.id, ref.validation_status === 'correct' ? 'pending' : 'correct')}
                    title="נכון"
                  >
                    <Check className="w-3 h-3 text-green-600" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => onValidate(ref.id, ref.validation_status === 'incorrect' ? 'pending' : 'incorrect')}
                    title="שגוי"
                  >
                    <X className="w-3 h-3 text-red-600" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => onValidate(ref.id, ref.validation_status === 'ignored' ? 'pending' : 'ignored')}
                    title="התעלם"
                  >
                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
