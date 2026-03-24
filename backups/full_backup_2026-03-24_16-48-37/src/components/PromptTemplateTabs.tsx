import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PromptTemplate {
  id: string;
  label: string;
  prompt_text: string;
  order_index: number;
}

interface PromptTemplateTabsProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[], combinedPrompt: string) => void;
}

export const PromptTemplateTabs = ({ selectedIds, onSelectionChange }: PromptTemplateTabsProps) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; template?: PromptTemplate }>({ open: false });
  const [editLabel, setEditLabel] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('user_prompt_templates')
      .select('*')
      .order('order_index');

    if (!error && data) {
      setTemplates(data as PromptTemplate[]);
      // Restore selection from saved templates
      if (selectedIds.length > 0) {
        const validIds = selectedIds.filter(id => data.some(t => t.id === id));
        if (validIds.length !== selectedIds.length) {
          const combined = data.filter(t => validIds.includes(t.id)).map(t => t.prompt_text).join('\n');
          onSelectionChange(validIds, combined);
        }
      }
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter(s => s !== id)
      : [...selectedIds, id];

    const combined = templates
      .filter(t => newSelected.includes(t.id))
      .map(t => t.prompt_text)
      .join('\n');

    onSelectionChange(newSelected, combined);
    // Save selection to localStorage for persistence
    localStorage.setItem('selected-prompt-templates', JSON.stringify(newSelected));
  };

  const openAddDialog = () => {
    setEditLabel("");
    setEditPrompt("");
    setEditDialog({ open: true });
  };

  const openEditDialog = (template: PromptTemplate) => {
    setEditLabel(template.label);
    setEditPrompt(template.prompt_text);
    setEditDialog({ open: true, template });
  };

  const saveTemplate = async () => {
    if (!user || !editLabel.trim() || !editPrompt.trim()) return;
    setSaving(true);

    try {
      if (editDialog.template) {
        // Update
        const { error } = await supabase
          .from('user_prompt_templates')
          .update({ label: editLabel.trim(), prompt_text: editPrompt.trim() })
          .eq('id', editDialog.template.id);
        if (error) throw error;
        toast.success("התבנית עודכנה");
      } else {
        // Insert
        const { error } = await supabase
          .from('user_prompt_templates')
          .insert({
            user_id: user.id,
            label: editLabel.trim(),
            prompt_text: editPrompt.trim(),
            order_index: templates.length,
          });
        if (error) throw error;
        toast.success("תבנית חדשה נוספה");
      }
      await loadTemplates();
      setEditDialog({ open: false });
    } catch (err) {
      toast.error("שגיאה בשמירת התבנית");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_prompt_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Remove from selection
      if (selectedIds.includes(id)) {
        const newSelected = selectedIds.filter(s => s !== id);
        const combined = templates.filter(t => newSelected.includes(t.id) && t.id !== id).map(t => t.prompt_text).join('\n');
        onSelectionChange(newSelected, combined);
      }
      await loadTemplates();
      toast.success("התבנית נמחקה");
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap" dir="rtl">
        <TooltipProvider delayDuration={300}>
          {templates.map((t) => {
            const isSelected = selectedIds.includes(t.id);
            const isHovered = hoveredId === t.id;

            return (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <div
                    className="relative group"
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`text-xs gap-1 transition-all pr-2 ${isSelected ? '' : 'hover:border-primary/50'}`}
                      onClick={() => toggleSelect(t.id)}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {t.label}
                    </Button>

                    {/* Edit/Delete icons on hover */}
                    {isHovered && (
                      <div className="absolute -top-2 -left-1 flex gap-0.5 z-10 animate-in fade-in duration-150">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditDialog(t); }}
                          className="h-5 w-5 rounded-full bg-muted border shadow-sm flex items-center justify-center hover:bg-accent"
                        >
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                          className="h-5 w-5 rounded-full bg-muted border shadow-sm flex items-center justify-center hover:bg-destructive/20"
                        >
                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-right" dir="rtl">
                  <p className="text-xs">{t.prompt_text}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Add new template button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 border border-dashed border-muted-foreground/30 hover:border-primary"
                onClick={openAddDialog}
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">הוסף תבנית פרומפט</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open })}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editDialog.template ? "ערוך תבנית" : "תבנית פרומפט חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">שם התבנית</label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder='למשל: "דוגמאות עסקיות"'
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">תוכן הפרומפט</label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="למשל: התמקד בדוגמאות מעולם העסקים והמסחר המודרני..."
                className="min-h-[100px]"
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditDialog({ open: false })}>
              <X className="h-4 w-4 ml-1" /> ביטול
            </Button>
            <Button onClick={saveTemplate} disabled={saving || !editLabel.trim() || !editPrompt.trim()}>
              <Check className="h-4 w-4 ml-1" /> {editDialog.template ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
