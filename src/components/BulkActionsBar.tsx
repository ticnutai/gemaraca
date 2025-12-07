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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedIds: string[];
  onDeleted?: () => void;
}

const BulkActionsBar = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  selectedIds,
  onDeleted,
}: BulkActionsBarProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  if (selectedCount === 0) return null;

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      let successCount = 0;

      for (const id of selectedIds) {
        // Delete related links first
        await supabase.from('sugya_psak_links').delete().eq('psak_din_id', id);
        await supabase.from('pattern_sugya_links').delete().eq('psak_din_id', id);
        await supabase.from('smart_index_results').delete().eq('psak_din_id', id);
        await supabase.from('faq_items').delete().eq('psak_din_id', id);

        // Delete the psak din
        const { error } = await supabase.from('psakei_din').delete().eq('id', id);
        if (!error) successCount++;
      }

      toast({
        title: `נמחקו ${successCount} פסקי דין בהצלחה`,
      });

      onClearSelection();
      onDeleted?.();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast({
        title: "שגיאה במחיקה מרובה",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg mb-4" dir="rtl">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedCount === totalCount}
            onCheckedChange={() => {
              if (selectedCount === totalCount) {
                onClearSelection();
              } else {
                onSelectAll();
              }
            }}
          />
          <span className="text-sm font-medium">
            {selectedCount} נבחרו מתוך {totalCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            מחק נבחרים
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
            <AlertDialogTitle>מחיקת {selectedCount} פסקי דין</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק {selectedCount} פסקי דין? פעולה זו תמחק גם את כל הקישורים שלהם. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מוחק...
                </>
              ) : (
                `מחק ${selectedCount} פסקים`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsBar;
