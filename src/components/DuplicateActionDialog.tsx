import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ban, Hash, SkipForward, RefreshCw, Copy } from "lucide-react";

export type DuplicateAction = 'skip' | 'overwrite' | 'duplicate';

export interface DuplicateItem {
  file: File;
  name: string;
  reason: 'title' | 'hash';
  existingTitle?: string;
  action?: DuplicateAction;
}

interface DuplicateActionDialogProps {
  open: boolean;
  duplicates: DuplicateItem[];
  onResolve: (resolved: DuplicateItem[]) => void;
  onCancel: () => void;
}

const DuplicateActionDialog = ({
  open,
  duplicates,
  onResolve,
  onCancel,
}: DuplicateActionDialogProps) => {
  const [items, setItems] = useState<DuplicateItem[]>(() =>
    duplicates.map((d) => ({ ...d, action: 'skip' }))
  );

  const setAction = (index: number, action: DuplicateAction) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, action } : item))
    );
  };

  const applyToAll = (action: DuplicateAction) => {
    setItems((prev) => prev.map((item) => ({ ...item, action })));
  };

  const handleConfirm = () => {
    onResolve(items);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-row-reverse">
            <Copy className="w-5 h-5 text-destructive" />
            נמצאו {duplicates.length} קבצים כפולים
          </DialogTitle>
          <DialogDescription className="text-right">
            בחר פעולה לכל קובץ כפול: דלג, דרוס את הקיים, או שכפל עם מספר
          </DialogDescription>
        </DialogHeader>

        {/* Apply to all buttons */}
        <div className="flex items-center gap-2 border-b pb-3">
          <span className="text-sm text-muted-foreground ml-2">החל על הכל:</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyToAll('skip')}
            className="gap-1 text-xs"
          >
            <SkipForward className="w-3 h-3" />
            דלג
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyToAll('overwrite')}
            className="gap-1 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            דרוס
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyToAll('duplicate')}
            className="gap-1 text-xs"
          >
            <Copy className="w-3 h-3" />
            שכפל
          </Button>
        </div>

        {/* Duplicate items list */}
        <ScrollArea className="max-h-[45vh]">
          <div className="space-y-3 pl-2">
            {items.map((item, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 space-y-2 bg-muted/20"
              >
                <div className="flex items-center gap-2 flex-row-reverse">
                  {item.reason === 'hash' ? (
                    <Hash className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <Ban className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="font-medium text-sm truncate flex-1 text-right">
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {item.reason === 'hash' ? 'תוכן זהה' : 'שם זהה'}
                  </Badge>
                </div>
                {item.existingTitle && (
                  <p className="text-xs text-muted-foreground text-right pr-6">
                    קיים: {item.existingTitle}
                  </p>
                )}
                <div className="flex gap-2 pr-6">
                  <Button
                    size="sm"
                    variant={item.action === 'skip' ? 'default' : 'outline'}
                    onClick={() => setAction(index, 'skip')}
                    className="gap-1 text-xs h-7"
                  >
                    <SkipForward className="w-3 h-3" />
                    דלג
                  </Button>
                  <Button
                    size="sm"
                    variant={item.action === 'overwrite' ? 'default' : 'outline'}
                    onClick={() => setAction(index, 'overwrite')}
                    className="gap-1 text-xs h-7"
                  >
                    <RefreshCw className="w-3 h-3" />
                    דרוס
                  </Button>
                  <Button
                    size="sm"
                    variant={item.action === 'duplicate' ? 'default' : 'outline'}
                    onClick={() => setAction(index, 'duplicate')}
                    className="gap-1 text-xs h-7"
                  >
                    <Copy className="w-3 h-3" />
                    שכפל
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel}>
            ביטול
          </Button>
          <Button onClick={handleConfirm}>
            אישור ({items.filter((i) => i.action !== 'skip').length} להעלאה)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateActionDialog;
