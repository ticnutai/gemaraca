import { useState, useMemo, memo } from 'react';
import { Pin, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import RefCard from './RefCard';
import { TalmudRefWithPsak, TRACTATES, toHebrewDaf, ValidationStatus } from './types';
import { usePinnedItems } from '@/hooks/usePinnedItems';

interface Props {
  grouped: Record<string, TalmudRefWithPsak[]>;
  onValidate: (id: string, status: ValidationStatus, autoDismissIds?: string[]) => void;
  onClickRef: (ref: TalmudRefWithPsak) => void;
  onCorrect?: (ref: TalmudRefWithPsak) => void;
  highlightColor?: string;
  highlightBg?: string;
}

// Color palette per tractate index
const BRANCH_COLORS = [
  'hsl(142, 60%, 45%)', // emerald
  'hsl(217, 70%, 55%)', // blue
  'hsl(330, 55%, 55%)', // pink
  'hsl(38, 80%, 50%)',  // amber
  'hsl(270, 55%, 55%)', // purple
  'hsl(185, 60%, 45%)', // cyan
  'hsl(0, 65%, 55%)',   // red
  'hsl(95, 50%, 45%)',  // lime
];

function getBranchColor(index: number) {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

/** Vertical connector line */
function VLine({ height = 28, color = 'hsl(var(--border))' }: { height?: number; color?: string }) {
  return (
    <div className="flex justify-center">
      <div style={{ width: 2, height, backgroundColor: color }} />
    </div>
  );
}

/** Horizontal connector with optional arrow */
function HLine({ width = 40, color = 'hsl(var(--border))' }: { width?: number; color?: string }) {
  return <div style={{ width, height: 2, backgroundColor: color, flexShrink: 0 }} />;
}

/** A tree node box */
function TreeNode({
  children,
  color,
  isRoot,
  isLeaf,
  className,
  onClick,
}: {
  children: React.ReactNode;
  color?: string;
  isRoot?: boolean;
  isLeaf?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative border-2 rounded-xl px-4 py-2 text-center transition-all',
        isRoot && 'shadow-lg',
        isLeaf && 'rounded-lg px-3 py-1.5',
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
        className
      )}
      style={{
        borderColor: color || 'hsl(var(--border))',
        backgroundColor: color ? `${color}10` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** Branch connector: a horizontal line connecting children under a parent */
function BranchConnector({ count, color }: { count: number; color: string }) {
  if (count <= 1) return <VLine height={24} color={color} />;
  return (
    <div className="relative flex justify-center" style={{ height: 24 }}>
      {/* Vertical from parent */}
      <div style={{ position: 'absolute', top: 0, width: 2, height: 12, backgroundColor: color, left: '50%', transform: 'translateX(-50%)' }} />
      {/* Horizontal rail */}
      <div style={{ position: 'absolute', top: 12, height: 2, backgroundColor: color, left: `${100 / (count * 2)}%`, right: `${100 / (count * 2)}%` }} />
    </div>
  );
}

export default memo(function GenealogyTreeView({ grouped, onValidate, onClickRef, onCorrect, highlightColor, highlightBg }: Props) {
  const [expandedTractate, setExpandedTractate] = useState<string | null>(null);
  const [expandedDaf, setExpandedDaf] = useState<string | null>(null);
  const [expandedAmud, setExpandedAmud] = useState<string | null>(null);
  const { togglePin, toggleFavorite, isPinned, isFavorite } = usePinnedItems();

  const sortedTractates = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      const ia = TRACTATES.indexOf(a);
      const ib = TRACTATES.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }), [grouped]);

  const totalRefs = useMemo(() =>
    Object.values(grouped).reduce((s, arr) => s + arr.length, 0), [grouped]);

  return (
    <ScrollArea className="h-[calc(100vh-320px)]" dir="rtl">
      <div className="flex flex-col items-center py-6 px-2 min-w-[300px]">

        {/* ROOT NODE */}
        <TreeNode isRoot color="hsl(var(--primary))" className="bg-primary/10 border-primary shadow-primary/20">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-lg font-bold text-primary">📜 אינדקס תלמודי</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {sortedTractates.length} מסכתות · {totalRefs} הפניות
          </div>
        </TreeNode>

        {/* Connector from root to tractates */}
        <BranchConnector count={sortedTractates.length} color="hsl(var(--primary) / 0.4)" />

        {/* TRACTATE LEVEL - horizontal spread */}
        <div className="flex flex-wrap justify-center gap-3 max-w-full">
          {sortedTractates.map((tractate, tIdx) => {
            const refs = grouped[tractate];
            const color = getBranchColor(tIdx);
            const isExpanded = expandedTractate === tractate;

            // Group by daf
            const byDaf: Record<string, TalmudRefWithPsak[]> = {};
            for (const r of refs) {
              if (!byDaf[r.daf]) byDaf[r.daf] = [];
              byDaf[r.daf].push(r);
            }
            const sortedDafs = Object.keys(byDaf).sort((a, b) => Number(a) - Number(b));

            return (
              <div key={tractate} className="flex flex-col items-center">
                {/* Vertical drop from rail */}
                <VLine height={16} color={color} />

                {/* Tractate node */}
                <TreeNode
                  color={color}
                  onClick={() => {
                    setExpandedTractate(isExpanded ? null : tractate);
                    setExpandedDaf(null);
                    setExpandedAmud(null);
                  }}
                  className={cn(
                    'min-w-[90px]',
                    isExpanded && 'ring-2 ring-offset-2 shadow-lg'
                  )}
                >
                  <span className="font-bold text-sm" style={{ color }}>{tractate}</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: color, color }}>
                      {refs.length}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{sortedDafs.length} דפים</span>
                  </div>
                  {/* Pin & Favorite buttons */}
                  <div className="flex items-center justify-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => togglePin({ type: 'tractate', id: tractate, label: tractate, tractate, refCount: refs.length, color })}
                          className={cn(
                            'p-0.5 rounded transition-all',
                            isPinned(tractate, 'tractate')
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-primary/70'
                          )}
                        >
                          <Pin className={cn('h-3 w-3', isPinned(tractate, 'tractate') && 'fill-current')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-[10px]">
                        {isPinned(tractate, 'tractate') ? 'הסר הצמדה' : 'הצמד לדף הבית'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleFavorite({ type: 'tractate', id: tractate, label: tractate, tractate, refCount: refs.length, color })}
                          className={cn(
                            'p-0.5 rounded transition-all',
                            isFavorite(tractate, 'tractate')
                              ? 'text-amber-500'
                              : 'text-muted-foreground/40 hover:text-amber-400'
                          )}
                        >
                          <Star className={cn('h-3 w-3', isFavorite(tractate, 'tractate') && 'fill-current')} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-[10px]">
                        {isFavorite(tractate, 'tractate') ? 'הסר מועדף' : 'הוסף למועדפים'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className={cn(
                    'text-[10px] mt-0.5 transition-transform',
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  )}>
                    ▼
                  </div>
                </TreeNode>

                {/* Expanded: DAF level branches */}
                {isExpanded && (
                  <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                    <VLine height={20} color={color} />

                    {/* Daf grid - full width, responsive columns */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 w-full max-w-[900px] mx-auto">
                      {sortedDafs.map((daf) => {
                        const dafRefs = byDaf[daf];
                        const dafKey = `${tractate}-${daf}`;
                        const isDafExpanded = expandedDaf === dafKey;

                        // Build amud data for expanded daf
                        const byAmud: Record<string, TalmudRefWithPsak[]> = isDafExpanded ? { a: [], b: [] } : {};
                        if (isDafExpanded) {
                          for (const r of dafRefs) {
                            const aKey = r.amud || '_none';
                            if (!byAmud[aKey]) byAmud[aKey] = [];
                            byAmud[aKey].push(r);
                          }
                        }
                        const amudOrder = isDafExpanded
                          ? (['a', 'b', ...('_none' in byAmud && byAmud._none.length > 0 ? ['_none'] : [])] as string[])
                          : [];

                        return (
                          <div key={dafKey} className={cn(isDafExpanded && 'col-span-full')}>
                            <TreeNode
                              isLeaf={!isDafExpanded}
                              color={color}
                              onClick={() => {
                                setExpandedDaf(isDafExpanded ? null : dafKey);
                                setExpandedAmud(null);
                              }}
                              className={cn(
                                'min-w-0',
                                isDafExpanded && 'ring-2 ring-offset-1 shadow-md'
                              )}
                            >
                              <span className="font-semibold text-xs" style={{ color }}>
                                דף {toHebrewDaf(daf)}
                              </span>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5 block mx-auto w-fit">
                                {dafRefs.length}
                              </Badge>
                            </TreeNode>

                            {/* Expanded: amud cards + psakei din directly below this daf */}
                            {isDafExpanded && (
                              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200 w-full max-w-[900px] mx-auto">
                                <VLine height={16} color={color} />

                                {/* Amud cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-[500px] mx-auto">
                                  {amudOrder.map(amudKey => {
                                    const amudRefs = byAmud[amudKey] || [];
                                    const amudNodeKey = `${dafKey}-${amudKey}`;
                                    const isAmudExpanded = expandedAmud === amudNodeKey;
                                    const amudLabel = amudKey === 'a' ? 'עמוד א׳' : amudKey === 'b' ? 'עמוד ב׳' : 'כללי';

                                    return (
                                      <TreeNode
                                        key={amudNodeKey}
                                        isLeaf={!isAmudExpanded}
                                        color={color}
                                        onClick={() => setExpandedAmud(isAmudExpanded ? null : amudNodeKey)}
                                        className={cn(
                                          'min-w-0',
                                          isAmudExpanded && 'ring-2 ring-offset-1 shadow-md col-span-full'
                                        )}
                                      >
                                        <span className="font-semibold text-xs" style={{ color }}>{amudLabel}</span>
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5 block mx-auto w-fit">
                                          {amudRefs.length}
                                        </Badge>
                                      </TreeNode>
                                    );
                                  })}
                                </div>

                                {/* Expanded amud: show psakei din */}
                                {expandedAmud && expandedAmud.startsWith(dafKey + '-') && (() => {
                                  const amudKey = expandedAmud.split('-').pop()!;
                                  const amudRefs = byAmud[amudKey] || [];
                                  const amudLabel = amudKey === 'a' ? 'עמוד א׳' : amudKey === 'b' ? 'עמוד ב׳' : 'כללי';

                                  return (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200 w-full">
                                      <VLine height={12} color={color} />
                                      {amudRefs.length > 0 ? (
                                        <div
                                          className="border-r-2 pr-3 mr-1 space-y-2 w-full"
                                          style={{ borderColor: color }}
                                        >
                                          <div className="text-xs font-bold text-center mb-2" style={{ color }}>
                                            דף {toHebrewDaf(daf)} {amudLabel} — {amudRefs.length} פסקי דין
                                          </div>
                                          {amudRefs.map(ref => (
                                            <div key={ref.id} className="relative">
                                              <div
                                                className="absolute top-4 -right-3 w-3"
                                                style={{ height: 2, backgroundColor: color }}
                                              />
                                              <RefCard
                                                data={ref}
                                                onValidate={onValidate}
                                                onClickRef={onClickRef}
                                                onCorrect={onCorrect}
                                                highlightColor={highlightColor}
                                                highlightBg={highlightBg}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center text-xs text-muted-foreground py-3">
                                          אין פסקי דין לעמוד זה
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
});
