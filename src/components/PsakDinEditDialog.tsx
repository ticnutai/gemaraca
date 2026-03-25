import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Loader2, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PsakDinData {
  id: string;
  title: string;
  court: string;
  year: number;
  case_number?: string | null;
  summary: string;
  full_text?: string | null;
  tags?: string[] | null;
  source_url?: string | null;
  category?: string | null;
}

interface PsakDinEditDialogProps {
  psak: PsakDinData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  isNew?: boolean;
}

const PsakDinEditDialog = ({ psak, open, onOpenChange, onSaved, isNew = false }: PsakDinEditDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<PsakDinData>>({
    title: '',
    court: '',
    year: new Date().getFullYear(),
    case_number: '',
    summary: '',
    full_text: '',
    tags: [],
    category: '',
  });
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (psak && open) {
      setFormData({
        title: psak.title || '',
        court: psak.court || '',
        year: psak.year || new Date().getFullYear(),
        case_number: psak.case_number || '',
        summary: psak.summary || '',
        full_text: psak.full_text || '',
        tags: psak.tags || [],
        category: psak.category || '',
      });
    } else if (isNew && open) {
      setFormData({
        title: '',
        court: '',
        year: new Date().getFullYear(),
        case_number: '',
        summary: '',
        full_text: '',
        tags: [],
        category: '',
      });
    }
  }, [psak, open, isNew]);

  // Load existing categories for dropdown
  useEffect(() => {
    if (open) {
      (async () => {
        const { data } = await supabase.from('psakei_din').select('category').not('category', 'is', null);
        if (data) setExistingCategories([...new Set(data.map(r => r.category).filter(Boolean) as string[])].sort());
      })();
    }
  }, [open]);

  const handleChange = (field: keyof PsakDinData, value: string | number | string[] | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.court || !formData.year || !formData.summary) {
      toast({
        title: "נא למלא את כל השדות החובה",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase
          .from('psakei_din')
          .insert({
            title: formData.title,
            court: formData.court,
            year: formData.year,
            case_number: formData.case_number || null,
            summary: formData.summary,
            full_text: formData.full_text || null,
            tags: formData.tags || [],
            category: formData.category || null,
          });

        if (error) throw error;

        toast({
          title: "פסק הדין נוסף בהצלחה",
        });
      } else if (psak?.id) {
        const { error } = await supabase
          .from('psakei_din')
          .update({
            title: formData.title,
            court: formData.court,
            year: formData.year,
            case_number: formData.case_number || null,
            summary: formData.summary,
            full_text: formData.full_text || null,
            tags: formData.tags || [],
            category: formData.category || null,
          })
          .eq('id', psak.id);

        if (error) throw error;

        toast({
          title: "פסק הדין עודכן בהצלחה",
        });
      }

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving psak:', error);
      toast({
        title: "שגיאה בשמירת פסק הדין",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isNew ? 'הוספת פסק דין חדש' : 'עריכת פסק דין'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-1">
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">כותרת *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="כותרת פסק הדין"
                className="text-right"
              />
            </div>

            {/* Court and Year Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="court">בית דין *</Label>
                <Input
                  id="court"
                  value={formData.court}
                  onChange={(e) => handleChange('court', e.target.value)}
                  placeholder="בית הדין הרבני..."
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">שנה *</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleChange('year', parseInt(e.target.value) || new Date().getFullYear())}
                  min={1900}
                  max={2100}
                />
              </div>
            </div>

            {/* Case Number */}
            <div className="space-y-2">
              <Label htmlFor="case_number">מספר תיק</Label>
              <Input
                id="case_number"
                value={formData.case_number}
                onChange={(e) => handleChange('case_number', e.target.value)}
                placeholder="מספר תיק (אופציונלי)"
                className="text-right"
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary">תקציר *</Label>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) => handleChange('summary', e.target.value)}
                placeholder="תקציר קצר של פסק הדין"
                rows={3}
                className="text-right"
              />
            </div>

            {/* Full Text */}
            <div className="space-y-2">
              <Label htmlFor="full_text">טקסט מלא</Label>
              <Textarea
                id="full_text"
                value={formData.full_text}
                onChange={(e) => handleChange('full_text', e.target.value)}
                placeholder="הטקסט המלא של פסק הדין (אופציונלי)"
                rows={8}
                className="text-right font-serif"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>תיקייה (קטגוריה)</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.category || '__none__'}
                  onValueChange={(v) => handleChange('category', v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="בחר תיקייה..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא תיקייה</SelectItem>
                    {existingCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="או הוסף תיקייה חדשה..."
                  className="text-right"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newCategory.trim()) {
                        handleChange('category', newCategory.trim());
                        setNewCategory('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (newCategory.trim()) {
                      handleChange('category', newCategory.trim());
                      setNewCategory('');
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.category && (
                <p className="text-xs text-muted-foreground">תיקייה נוכחית: <Badge variant="outline" className="text-xs">{formData.category}</Badge></p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>תגיות</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags?.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="gap-1 pl-1"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="הוסף תגית..."
                  className="text-right"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addTag}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row-reverse gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                שמור
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PsakDinEditDialog;
