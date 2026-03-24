import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Loader2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useDeleteController } from "@/hooks/useDeleteController";
import { useDeleteStore } from "@/stores/deleteStore";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedIds: string[];
  onDeleted?: () => void;
  selectingAll?: boolean;
}

const BulkActionsBar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  selectedIds,
  onDeleted,
  selectingAll,
}: BulkActionsBarProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { startBulkDelete } = useDeleteController();
  const activeSession = useDeleteStore((s) => s.getActiveSession());

  if (selectedCount === 0) return null;

  const handleBulkDelete = async () => {
    setDeleteDialogOpen(false);
    onClearSelection();
    await startBulkDelete(selectedIds);
    onDeleted?.();
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-4" dir="rtl">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedCount === totalCount && totalCount > 0}
            onCheckedChange={() => {
              if (selectedCount === totalCount) {
                onClearSelection();
              } else {
                onSelectAll();
              }
            }}
            disabled={selectingAll}
          />
          <span className="text-sm font-medium">
            {selectingAll ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                טוען את כל הפסקים...
              </span>
            ) : (
              `${selectedCount.toLocaleString()} נבחרו מתוך ${totalCount.toLocaleString()}`
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!!activeSession || selectingAll}
            className="gap-2"
          >
            {activeSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            מחק {selectedCount.toLocaleString()} נבחרים
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            בטל בחירה
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת {selectedCount.toLocaleString()} פסקי דין</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק {selectedCount.toLocaleString()} פסקי דין?
              {'\n'}פעולה זו תמחק גם את כל הקישורים וקבצי האחסון שלהם.
              {'\n'}המחיקה תתבצע ברקע עם {'\u200F'}8 תהליכים מקבילים.
              {'\n'}לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק {selectedCount.toLocaleString()} פסקים
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsBar;
