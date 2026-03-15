import { useState, useMemo, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Check, X, EyeOff, ChevronRight, ChevronLeft } from 'lucide-react';
import { TalmudRefWithPsak, TRACTATES, toHebrewDaf, toHebrewAmud, highlightRawInContext, extractContextLines, escapeHtml, ValidationStatus } from './types';

const PAGE_SIZE = 100;

interface Props {
  filtered: TalmudRefWithPsak[];
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

const TableRowItem = memo(function TableRowItem({ data, onValidate, onClickRef, highlightColor, highlightBg }: {
  data: TalmudRefWithPsak;
  onValidate: Props['onValidate'];
  onClickRef: Props['onClickRef'];
  highlightColor?: string;
  highlightBg?: string;
}) {
  const ctx = extractContextLines(data.context_snippet, data.raw_reference, 3);

  return (
    <TableRow
      className={`cursor-pointer ${data.validation_status === 'incorrect' ? 'opacity-50' : ''}`}
      onClick={() => onClickRef(data)}
    >
      <TableCell className="font-bold text-primary">{data.normalized}</TableCell>
      <TableCell>{data.tractate}</TableCell>
      <TableCell>{toHebrewDaf(data.daf)}{data.amud ? ` ${toHebrewAmud(data.amud)}` : ''}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-[10px]">
          {data.source === 'regex' ? 'regex' : 'AI'}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
        {data.psakei_din?.title}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            data.confidence === 'high' ? 'border-green-500/50 text-green-700' :
            data.confidence === 'medium' ? 'border-yellow-500/50 text-yellow-700' :
            'border-red-500/50 text-red-700'
          }`}
        >
          {data.confidence === 'high' ? 'גבוה' : data.confidence === 'medium' ? 'בינוני' : 'נמוך'}
        </Badge>
      </TableCell>
      <TableCell>
        {data.validation_status === 'correct' && <Badge className="text-[10px] bg-green-600 text-white border-0">מאושר</Badge>}
        {data.validation_status === 'incorrect' && <Badge variant="destructive" className="text-[10px]">שגוי</Badge>}
        {data.validation_status === 'ignored' && <Badge variant="outline" className="text-[10px] text-muted-foreground">התעלם</Badge>}
        {data.validation_status === 'pending' && <Badge variant="outline" className="text-[10px]">ממתין</Badge>}
      </TableCell>
      <TableCell onClick={e => e.stopPropagation()}>
        <div className="flex gap-1">
          <Button
            size="sm" variant="ghost" className="h-6 w-6 p-0"
            onClick={() => onValidate(data.id, data.validation_status === 'correct' ? 'pending' : 'correct')}
            title="נכון"
          >
            <Check className="w-3 h-3 text-green-600" />
          </Button>
          <Button
            size="sm" variant="ghost" className="h-6 w-6 p-0"
            onClick={() => onValidate(data.id, data.validation_status === 'incorrect' ? 'pending' : 'incorrect')}
            title="שגוי"
          >
            <X className="w-3 h-3 text-red-600" />
          </Button>
          <Button
            size="sm" variant="ghost" className="h-6 w-6 p-0"
            onClick={() => onValidate(data.id, data.validation_status === 'ignored' ? 'pending' : 'ignored')}
            title="התעלם"
          >
            <EyeOff className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="max-w-[200px]">
        {!ctx ? <span className="text-xs text-muted-foreground">—</span> : (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <span
                className="text-xs text-muted-foreground truncate block cursor-default max-w-[200px]"
                dangerouslySetInnerHTML={{
                  __html: highlightRawInContext(ctx.matchLine, data.raw_reference, highlightColor, highlightBg)
                }}
              />
            </HoverCardTrigger>
            {ctx.surroundLines.length > 1 && (
              <HoverCardContent side="top" align="start" className="w-[400px] max-w-[90vw] p-3 text-right" dir="rtl">
                <div className="text-xs text-muted-foreground mb-1.5 font-semibold">הקשר מורחב (±3 שורות)</div>
                <div className="text-sm leading-relaxed space-y-1 whitespace-pre-wrap">
                  {ctx.surroundLines.map((line, i) => {
                    const isMatch = line === ctx.matchLine;
                    return (
                      <div
                        key={i}
                        className={isMatch ? 'rounded px-1.5 py-0.5' : 'text-muted-foreground'}
                        style={isMatch ? { background: highlightBg || 'hsl(var(--primary) / 0.1)' } : undefined}
                        dangerouslySetInnerHTML={{
                          __html: isMatch
                            ? highlightRawInContext(line, data.raw_reference, highlightColor, highlightBg)
                            : escapeHtml(line)
                        }}
                      />
                    );
                  })}
                </div>
              </HoverCardContent>
            )}
          </HoverCard>
        )}
      </TableCell>
    </TableRow>
  );
});

export default function IndexTableView({ filtered, onValidate, onClickRef, highlightColor, highlightBg }: Props) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const ia = TRACTATES.indexOf(a.tractate);
    const ib = TRACTATES.indexOf(b.tractate);
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    const dafDiff = Number(a.daf) - Number(b.daf);
    if (dafDiff !== 0) return dafDiff;
    return (a.amud ?? '').localeCompare(b.amud ?? '');
  }), [filtered]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-2">
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            מציג {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, sorted.length)} מתוך {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={currentPage === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs font-medium">
              עמוד {currentPage + 1} / {totalPages}
            </span>
            <Button
              size="sm" variant="outline" className="h-7 w-7 p-0"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-380px)]" dir="rtl">
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
              <TableHead className="text-right">שורת הקשר</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map(item => (
              <TableRowItem
                key={item.id}
                data={item}
                onValidate={onValidate}
                onClickRef={onClickRef}
                highlightColor={highlightColor}
                highlightBg={highlightBg}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
