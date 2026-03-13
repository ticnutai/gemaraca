import { useState, useCallback } from 'react';
import { useAllReferencesGrouped, useValidateReference } from '@/hooks/useTalmudReferences';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Search, List, ChevronsUpDown, TableIcon, LayoutGrid, TreePine } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import ListView from './talmud-index/ListView';
import AccordionView from './talmud-index/AccordionView';
import IndexTableView from './talmud-index/TableView';
import CardsView from './talmud-index/CardsView';
import TreeViewIndex from './talmud-index/TreeViewIndex';
import PsakDinViewDialog from './PsakDinViewDialog';
import IndexingControlPanel from './IndexingControlPanel';
import DebugDiagnosticDialog from './DebugDiagnosticDialog';
import { TalmudRefWithPsak, TRACTATES, ValidationStatus, ViewMode } from './talmud-index/types';

export default function AdvancedIndexTab() {
  const { data: refs, isLoading } = useAllReferencesGrouped();
  const validateRef = useValidateReference();
  const [search, setSearch] = useState('');
  const [filterTractate, setFilterTractate] = useState('all');
  const [hideResolved, setHideResolved] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedRef, setSelectedRef] = useState<TalmudRefWithPsak | null>(null);

  const filtered = refs?.filter(r => {
    if (hideResolved && (r.validation_status === 'incorrect' || r.validation_status === 'ignored' || r.validation_status === 'correct')) return false;
    if (filterTractate !== 'all' && r.tractate !== filterTractate) return false;
    if (search && !r.normalized.includes(search) && !r.raw_reference.includes(search) && !r.psakei_din?.title?.includes(search)) return false;
    return true;
  }) ?? [];

  const grouped = filtered.reduce<Record<string, TalmudRefWithPsak[]>>((acc, ref) => {
    if (!acc[ref.tractate]) acc[ref.tractate] = [];
    acc[ref.tractate].push(ref);
    return acc;
  }, {});

  const uniqueTractates = [...new Set(refs?.map(r => r.tractate) ?? [])];
  const resolvedCount = refs?.filter(r => r.validation_status === 'incorrect' || r.validation_status === 'ignored' || r.validation_status === 'correct').length ?? 0;
  const pendingCount = refs?.filter(r => r.validation_status === 'pending').length ?? 0;

  const handleValidate = useCallback((id: string, status: ValidationStatus, explicitAutoDismiss?: string[]) => {
    if (explicitAutoDismiss) {
      validateRef.mutate({ id, status, autoDismissIds: explicitAutoDismiss });
      return;
    }

    let autoDismissIds: string[] = [];
    if (status === 'correct' && refs) {
      const thisRef = refs.find(r => r.id === id);
      if (thisRef) {
        autoDismissIds = refs
          .filter(r =>
            r.id !== id &&
            r.tractate === thisRef.tractate &&
            r.daf === thisRef.daf &&
            r.psak_din_id === thisRef.psak_din_id &&
            r.validation_status === 'pending' &&
            ((!r.amud && thisRef.amud) || (r.source !== thisRef.source))
          )
          .map(r => r.id);
      }
    }

    validateRef.mutate({ id, status, autoDismissIds: autoDismissIds.length > 0 ? autoDismissIds : undefined });
  }, [refs, validateRef]);

  const handleClickRef = (ref: TalmudRefWithPsak) => {
    setSelectedRef(ref);
  };

  // Load selected psak for dialog
  const [selectedPsak, setSelectedPsak] = useState<Database['public']['Tables']['psakei_din']['Row'] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openPsakDialog = async (ref: TalmudRefWithPsak) => {
    const { data } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', ref.psak_din_id)
      .maybeSingle();

    if (data) {
      setSelectedPsak(data);
      setDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <BookOpen className="w-5 h-5 animate-pulse ml-2" />
        טוען אינדקס מתקדם...
      </div>
    );
  }

  const VIEW_OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
    { value: 'tree', icon: <TreePine className="w-4 h-4" />, label: 'עץ' },
    { value: 'list', icon: <List className="w-4 h-4" />, label: 'רשימה' },
    { value: 'accordion', icon: <ChevronsUpDown className="w-4 h-4" />, label: 'אקורדיון' },
    { value: 'table', icon: <TableIcon className="w-4 h-4" />, label: 'טבלה' },
    { value: 'cards', icon: <LayoutGrid className="w-4 h-4" />, label: 'כרטיסיות' },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-right">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            אינדקס תלמודי מתקדם
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            חילוץ וניהול הפניות תלמודיות מפסקי דין • ולידציה ומעקב
          </p>
        </div>
        <DebugDiagnosticDialog />
      </div>

      {/* Indexing Engine Control Panel */}
      <IndexingControlPanel />

      {/* Summary Stats */}
      {(refs?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-primary">{refs?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">סה"כ הפניות</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">ממתינים</div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
              <div className="text-xs text-muted-foreground">טופלו</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-secondary/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{uniqueTractates.length}</div>
              <div className="text-xs text-muted-foreground">מסכתות</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-secondary/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{new Set(refs?.map(r => r.psak_din_id)).size}</div>
              <div className="text-xs text-muted-foreground">פסקי דין</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש בהפניות..."
            className="pr-9"
          />
        </div>
        <Select value={filterTractate} onValueChange={setFilterTractate}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="כל המסכתות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המסכתות ({refs?.length ?? 0})</SelectItem>
            {uniqueTractates.sort((a, b) => TRACTATES.indexOf(a) - TRACTATES.indexOf(b)).map(t => (
              <SelectItem key={t} value={t}>
                {t} ({refs?.filter(r => r.tractate === t).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox checked={hideResolved} onCheckedChange={(v) => setHideResolved(!!v)} />
          הצג רק ממתינים {pendingCount > 0 && `(${pendingCount})`}
        </label>
      </div>

      {/* View mode toggle + stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{filtered.length} הפניות</span>
          <span>•</span>
          <span>{Object.keys(grouped).length} מסכתות</span>
          {resolvedCount > 0 && (
            <>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400">{resolvedCount} טופלו</span>
            </>
          )}
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {VIEW_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={viewMode === opt.value ? 'default' : 'ghost'}
              className="h-7 px-2 gap-1 text-xs"
              onClick={() => setViewMode(opt.value)}
              title={opt.label}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Index content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          {pendingCount === 0 && resolvedCount > 0 ? (
            <>
              <p className="text-lg font-medium">🎉 כל ההפניות טופלו!</p>
              <p className="text-sm mt-1">בטל את הסינון כדי לראות את כל ההפניות</p>
            </>
          ) : (refs?.length ?? 0) === 0 ? (
            <>
              <p className="text-lg font-medium">אין הפניות עדיין</p>
              <p className="text-sm mt-1">לחץ "חלץ הפניות" כדי לסרוק פסקי דין ולבנות אינדקס</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">אין תוצאות לסינון הנוכחי</p>
              <p className="text-sm mt-1">נסה לשנות את הסינונים</p>
            </>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'tree' && <TreeViewIndex grouped={grouped} onValidate={handleValidate} onClickRef={(ref) => openPsakDialog(ref)} />}
          {viewMode === 'list' && <ListView grouped={grouped} onValidate={handleValidate} onClickRef={(ref) => openPsakDialog(ref)} />}
          {viewMode === 'accordion' && <AccordionView grouped={grouped} onValidate={handleValidate} onClickRef={(ref) => openPsakDialog(ref)} />}
          {viewMode === 'table' && <IndexTableView filtered={filtered} onValidate={handleValidate} onClickRef={(ref) => openPsakDialog(ref)} />}
          {viewMode === 'cards' && <CardsView grouped={grouped} onValidate={handleValidate} onClickRef={(ref) => openPsakDialog(ref)} />}
        </>
      )}

      {/* Psak Din Viewer Dialog */}
      {selectedPsak && (
        <PsakDinViewDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedPsak(null);
          }}
          psak={selectedPsak}
        />
      )}
    </div>
  );
}
