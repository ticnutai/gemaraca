import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BookOpen, Trash2, Plus, RefreshCw, ArrowRight, X,
} from "lucide-react";
import {
  getOcrCorrections, removeOcrCorrection,
  addDictionaryWord, removeDictionaryWord,
  type CorrectionStats,
} from "@/lib/ocrService";

interface CorrectionsPanelProps {
  onClose: () => void;
}

export default function CorrectionsPanel({ onClose }: CorrectionsPanelProps) {
  const [data, setData] = useState<CorrectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [addingWord, setAddingWord] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await getOcrCorrections();
      setData(stats);
    } catch {
      toast.error("שגיאה בטעינת נתוני תיקונים");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveCorrection = useCallback(async (word: string) => {
    try {
      await removeOcrCorrection(word);
      toast.success(`תיקון "${word}" הוסר`);
      loadData();
    } catch {
      toast.error("שגיאה בהסרת תיקון");
    }
  }, [loadData]);

  const handleAddWord = useCallback(async () => {
    const word = newWord.trim();
    if (!word) return;
    setAddingWord(true);
    try {
      const res = await addDictionaryWord(word);
      if (res.status === "exists") {
        toast.info(`"${res.word}" כבר קיימת במילון`);
      } else {
        toast.success(`"${res.word}" נוספה למילון`);
      }
      setNewWord("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
    setAddingWord(false);
  }, [newWord, loadData]);

  const handleRemoveWord = useCallback(async (word: string) => {
    try {
      await removeDictionaryWord(word);
      toast.success(`"${word}" הוסרה מהמילון`);
      loadData();
    } catch {
      toast.error("שגיאה בהסרת מילה");
    }
  }, [loadData]);

  const corrections = data ? Object.entries(data.word_corrections) : [];
  const customWords = data?.custom_dictionary ?? [];
  const stats = data?.stats;

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            מנוע תיקונים
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">סה״כ {stats.total_applied} תיקונים</Badge>
            {stats.quote_fixes > 0 && <Badge variant="secondary">גרשיים: {stats.quote_fixes}</Badge>}
            {stats.gershayim_fixes > 0 && <Badge variant="secondary">יי→״: {stats.gershayim_fixes}</Badge>}
            {stats.sofit_fixes > 0 && <Badge variant="secondary">סופיות: {stats.sofit_fixes}</Badge>}
            {stats.similar_char_fixes > 0 && <Badge variant="secondary">תווים דומים: {stats.similar_char_fixes}</Badge>}
            {stats.user_corrections_applied > 0 && <Badge variant="secondary">נלמדים: {stats.user_corrections_applied}</Badge>}
            {stats.user_taught_count > 0 && <Badge variant="outline">נלמדו: {stats.user_taught_count} מילים</Badge>}
          </div>
        )}

        <Separator />

        {/* Learned corrections */}
        <div>
          <h3 className="text-sm font-semibold mb-2">תיקונים שנלמדו ({corrections.length})</h3>
          {corrections.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              אין תיקונים עדיין. לחץ פעמיים על שורה בתוצאות OCR כדי ללמד תיקון.
            </p>
          ) : (
            <ScrollArea className="h-[200px] rounded border bg-muted/20 p-2">
              <div className="space-y-1">
                {corrections.map(([from, to]) => (
                  <div
                    key={from}
                    className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/50 group text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-destructive line-through truncate">{from}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-green-600 font-medium truncate">{to}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={() => handleRemoveCorrection(from)}
                      title="דחה תיקון"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator />

        {/* Custom dictionary */}
        <div>
          <h3 className="text-sm font-semibold mb-2">מילון מותאם ({customWords.length})</h3>
          <p className="text-xs text-muted-foreground mb-2">
            הוסף מילים שהמערכת תשתמש בהן לזהות ולתקן שגיאות OCR
          </p>
          <div className="flex items-center gap-2 mb-2">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
              placeholder="הוסף מילה למילון..."
              className="flex-1 text-sm"
              dir="rtl"
            />
            <Button
              size="sm"
              onClick={handleAddWord}
              disabled={addingWord || !newWord.trim()}
            >
              <Plus className="h-4 w-4 ml-1" />
              הוסף
            </Button>
          </div>
          {customWords.length > 0 && (
            <ScrollArea className="h-[120px] rounded border bg-muted/20 p-2">
              <div className="flex flex-wrap gap-1">
                {customWords.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => handleRemoveWord(word)}
                    title="לחץ להסרה"
                  >
                    {word}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
