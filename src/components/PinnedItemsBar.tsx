import { memo } from 'react';
import { Pin, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinnedItems, PinnedItem } from '@/hooks/usePinnedItems';
import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default memo(function PinnedItemsBar() {
  const { pinned, favorites, togglePin, toggleFavorite } = usePinnedItems();
  const { setActiveTab } = useAppContext();

  const allItems = [
    ...pinned.map(p => ({ ...p, source: 'pin' as const })),
    ...favorites.filter(f => !pinned.some(p => p.id === f.id && p.type === f.type)).map(f => ({ ...f, source: 'fav' as const })),
  ].sort((a, b) => b.pinnedAt - a.pinnedAt);

  if (allItems.length === 0) return null;

  const handleClick = (item: PinnedItem & { source: string }) => {
    setActiveTab('advanced-index');
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 p-3 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-2">
        <Pin className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold text-foreground">מוצמדים ומועדפים</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{allItems.length}</Badge>
      </div>
      <ScrollArea className="w-full" dir="rtl">
        <div className="flex gap-2 pb-1">
          {allItems.map((item) => (
            <Tooltip key={`${item.type}-${item.id}`}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleClick(item)}
                  className={cn(
                    'group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium whitespace-nowrap',
                    'hover:shadow-md hover:scale-[1.02] active:scale-95',
                    item.source === 'pin'
                      ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                      : 'border-amber-400/40 bg-amber-50/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 hover:bg-amber-100/50'
                  )}
                  style={item.color ? { borderColor: `${item.color}50`, backgroundColor: `${item.color}08` } : undefined}
                >
                  {item.source === 'pin' ? (
                    <Pin className="h-3 w-3 fill-current" />
                  ) : (
                    <Star className="h-3 w-3 fill-current" />
                  )}
                  <span>{item.label}</span>
                  {item.refCount !== undefined && item.refCount > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0">{item.refCount}</Badge>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.source === 'pin') togglePin(item);
                      else toggleFavorite(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs" dir="rtl">
                {item.source === 'pin' ? 'מוצמד' : 'מועדף'} · לחץ לניווט לאינדקס
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
});
