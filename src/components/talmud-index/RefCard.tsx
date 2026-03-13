import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, FileText, EyeOff } from 'lucide-react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { TalmudRefWithPsak, highlightRawInContext, extractContextLines, escapeHtml, ValidationStatus } from './types';

interface Props {
  data: TalmudRefWithPsak;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

export default function RefCard({ data, onValidate, onClickRef, highlightColor, highlightBg }: Props) {
  const isApproved = data.validation_status === 'correct';
  const isRejected = data.validation_status === 'incorrect';
  const isIgnored = data.validation_status === 'ignored';

  const matchContext = extractContextLines(data.context_snippet, data.raw_reference, 0);
  const hoverContext = extractContextLines(data.context_snippet, data.raw_reference, 3);

  return (
    <div
      className={`px-4 py-3 rounded-md border transition-all text-right cursor-pointer ${
        isApproved ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' :
        isRejected ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20 opacity-60' :
        isIgnored ? 'border-muted bg-muted/30 opacity-40' :
        'border-border/50 hover:bg-muted/50'
      }`}
      onClick={() => onClickRef(data)}
    >
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lg font-bold text-primary">{data.normalized}</span>
        <div className="flex items-center gap-2 mr-auto">
          <Badge
            variant="outline"
            className={`text-[10px] ${
              data.confidence === 'high' ? 'border-green-500/50 text-green-700 dark:text-green-400' :
              data.confidence === 'medium' ? 'border-yellow-500/50 text-yellow-700 dark:text-yellow-400' :
              'border-red-500/50 text-red-700 dark:text-red-400'
            }`}
          >
            {data.confidence === 'high' ? 'גבוה' : data.confidence === 'medium' ? 'בינוני' : 'נמוך'}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {data.source === 'regex' ? 'ביטוי רגולרי' : 'בינה מלאכותית'}
          </Badge>
          {data.psakei_din && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground max-w-[150px] truncate" title={data.psakei_din.title}>
              <FileText className="w-3 h-3 shrink-0" />
              {data.psakei_din.title}
            </span>
          )}
          {isApproved && (
            <Badge className="text-[10px] bg-green-600 text-white border-0">✓ מאושר</Badge>
          )}
          {isIgnored && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">התעלם</Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-1.5">
        זוהה: "<span className="font-semibold text-foreground">{data.raw_reference}</span>"
      </p>

      {matchContext && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div
              className="text-sm text-muted-foreground bg-muted/40 rounded px-3 py-2 leading-relaxed cursor-default truncate"
              dangerouslySetInnerHTML={{
                __html: highlightRawInContext(matchContext.matchLine, data.raw_reference, highlightColor, highlightBg)
              }}
            />
          </HoverCardTrigger>
          {hoverContext && hoverContext.surroundLines.length > 1 && (
            <HoverCardContent
              side="top"
              align="start"
              className="w-[420px] max-w-[90vw] p-3 text-right"
              dir="rtl"
            >
              <div className="text-xs text-muted-foreground mb-1.5 font-semibold">הקשר מורחב (±3 שורות)</div>
              <div className="text-sm leading-relaxed space-y-1 whitespace-pre-wrap">
                {hoverContext.surroundLines.map((line, i) => {
                  const isMatch = line === matchContext.matchLine;
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

      {!matchContext && data.context_snippet && (
        <div
          className="text-sm text-muted-foreground bg-muted/40 rounded px-3 py-2 leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: highlightRawInContext(data.context_snippet, data.raw_reference, highlightColor, highlightBg)
          }}
        />
      )}

      <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
        <Button
          size="sm"
          variant={isApproved ? 'default' : 'outline'}
          className="h-6 px-2 text-[11px] gap-1"
          onClick={() => onValidate(data.id, isApproved ? 'pending' : 'correct')}
        >
          <Check className="w-3 h-3" /> נכון
        </Button>
        <Button
          size="sm"
          variant={isRejected ? 'destructive' : 'outline'}
          className="h-6 px-2 text-[11px] gap-1"
          onClick={() => onValidate(data.id, isRejected ? 'pending' : 'incorrect')}
        >
          <X className="w-3 h-3" /> שגוי
        </Button>
        <Button
          size="sm"
          variant={isIgnored ? 'secondary' : 'outline'}
          className="h-6 px-2 text-[11px] gap-1"
          onClick={() => onValidate(data.id, isIgnored ? 'pending' : 'ignored')}
        >
          <EyeOff className="w-3 h-3" /> התעלם
        </Button>
        {data.validation_status !== 'pending' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground"
            onClick={() => onValidate(data.id, 'pending')}
          >
            <RotateCcw className="w-3 h-3" /> איפוס
          </Button>
        )}
      </div>
    </div>
  );
}
