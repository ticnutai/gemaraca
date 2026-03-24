import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreVertical, Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PsakDinActionsProps {
  psakId: string;
  onEdit: (psakId: string) => void;
  onDelete?: () => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  compact?: boolean;
}

const PsakDinActions = ({
  psakId,
  onEdit,
  onDelete,
  showCheckbox = false,
  isSelected = false,
  onSelectChange,
  compact = false,
}: PsakDinActionsProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // First delete related links
      await supabase
        .from('sugya_psak_links')
        .delete()
        .eq('psak_din_id', psakId);

      await supabase
        .from('pattern_sugya_links')
        .delete()
        .eq('psak_din_id', psakId);

      await supabase
        .from('smart_index_results')
        .delete()
        .eq('psak_din_id', psakId);

      await supabase
        .from('faq_items')
        .delete()
        .eq('psak_din_id', psakId);

      // Then delete the psak din
      const { error } = await supabase
        .from('psakei_din')
        .delete()
        .eq('id', psakId);

      if (error) throw error;

      toast({
        title: "פסק הדין נמחק בהצלחה",
      });

      onDelete?.();
    } catch (error) {
      console.error('Error deleting psak:', error);
      toast({
        title: "שגיאה במחיקת פסק הדין",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange?.(!!checked)}
          className="mr-1"
        />
      )}

      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem
              onClick={() => onEdit(psakId)}
              className="gap-2 flex-row-reverse cursor-pointer"
            >
              <Edit className="h-4 w-4" />
              עריכה
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2 flex-row-reverse text-destructive cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              מחיקה
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={() => onEdit(psakId)}
            title="עריכה"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
            title="מחיקה"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את פסק הדין?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את פסק הדין וכל הקישורים שלו לגמרא. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מוחק...
                </>
              ) : (
                'מחק'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PsakDinActions;
