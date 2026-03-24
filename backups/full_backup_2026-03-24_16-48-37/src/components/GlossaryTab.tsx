import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookA, Plus, Trash2, Search, Edit2, Save, X, Tag } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "personal-glossary";

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  language: "aramaic" | "hebrew" | "legal" | "other";
  source?: string; // masechet/daf reference
  tags: string[];
  createdAt: number;
}

const LANG_LABELS: Record<string, string> = {
  aramaic: "ארמית",
  hebrew: "עברית",
  legal: "משפטי",
  other: "אחר",
};

const LANG_COLORS: Record<string, string> = {
  aramaic: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800",
  hebrew: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  legal: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  other: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-300 dark:border-gray-800",
};

function loadTerms(): GlossaryTerm[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

export default function GlossaryTab() {
  const [terms, setTerms] = useState<GlossaryTerm[]>(loadTerms);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLang, setFilterLang] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ term: "", definition: "", language: "aramaic" as GlossaryTerm["language"], source: "", tags: "" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  }, [terms]);

  const addTerm = () => {
    if (!form.term.trim() || !form.definition.trim()) {
      toast.error("הזן מונח והגדרה");
      return;
    }
    const newTerm: GlossaryTerm = {
      id: Date.now().toString(36),
      term: form.term.trim(),
      definition: form.definition.trim(),
      language: form.language,
      source: form.source.trim() || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: Date.now(),
    };
    setTerms(prev => [newTerm, ...prev]);
    setForm({ term: "", definition: "", language: "aramaic", source: "", tags: "" });
    setIsAdding(false);
    toast.success("מונח נשמר!");
  };

  const updateTerm = () => {
    if (!editId) return;
    setTerms(prev => prev.map(t => t.id === editId ? {
      ...t,
      term: form.term.trim(),
      definition: form.definition.trim(),
      language: form.language,
      source: form.source.trim() || undefined,
      tags: form.tags.split(",").map(tag => tag.trim()).filter(Boolean),
    } : t));
    setEditId(null);
    toast.success("מונח עודכן!");
  };

  const deleteTerm = (id: string) => {
    setTerms(prev => prev.filter(t => t.id !== id));
    toast.success("מונח נמחק");
  };

  const startEdit = (t: GlossaryTerm) => {
    setEditId(t.id);
    setForm({ term: t.term, definition: t.definition, language: t.language, source: t.source || "", tags: t.tags.join(", ") });
  };

  const filtered = useMemo(() => {
    return terms.filter(t => {
      const matchSearch = !searchQuery || t.term.includes(searchQuery) || t.definition.includes(searchQuery) || t.tags.some(tag => tag.includes(searchQuery));
      const matchLang = filterLang === "all" || t.language === filterLang;
      return matchSearch && matchLang;
    });
  }, [terms, searchQuery, filterLang]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    terms.forEach(t => t.tags.forEach(tag => set.add(tag)));
    return [...set].sort();
  }, [terms]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookA className="h-5 w-5 text-purple-600" />
            מילון מונחים אישי
          </h2>
          <p className="text-sm text-muted-foreground">{terms.length} מונחים שמורים</p>
        </div>
        <Button onClick={() => { setIsAdding(true); setEditId(null); setForm({ term: "", definition: "", language: "aramaic", source: "", tags: "" }); }} className="gap-1">
          <Plus className="h-4 w-4" /> מונח חדש
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש מונח..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>
        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="aramaic">ארמית</SelectItem>
            <SelectItem value="hebrew">עברית</SelectItem>
            <SelectItem value="legal">משפטי</SelectItem>
            <SelectItem value="other">אחר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag Cloud */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-primary/20"
              onClick={() => setSearchQuery(tag)}
            >
              <Tag className="h-3 w-3 ml-1" />{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editId) && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editId ? "ערוך מונח" : "מונח חדש"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="מונח" value={form.term} onChange={e => setForm(p => ({ ...p, term: e.target.value }))} className="text-sm font-bold" />
              <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v as GlossaryTerm["language"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aramaic">ארמית</SelectItem>
                  <SelectItem value="hebrew">עברית</SelectItem>
                  <SelectItem value="legal">משפטי</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea placeholder="הגדרה" value={form.definition} onChange={e => setForm(p => ({ ...p, definition: e.target.value }))} className="text-sm min-h-[60px]" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="מקור (מסכת/דף)" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} className="text-sm" />
              <Input placeholder="תגיות (מופרדות בפסיק)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setEditId(null); }}>
                <X className="h-4 w-4 ml-1" /> ביטול
              </Button>
              <Button size="sm" onClick={editId ? updateTerm : addTerm}>
                <Save className="h-4 w-4 ml-1" /> {editId ? "עדכן" : "שמור"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terms List */}
      <ScrollArea className="max-h-[calc(100vh-380px)]">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {terms.length === 0 ? "אין מונחים עדיין. הוסף את המונח הראשון!" : "לא נמצאו תוצאות"}
            </p>
          ) : (
            filtered.map(t => (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base">{t.term}</span>
                        <Badge className={`text-xs border ${LANG_COLORS[t.language]}`}>
                          {LANG_LABELS[t.language]}
                        </Badge>
                        {t.source && (
                          <span className="text-xs text-muted-foreground">({t.source})</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.definition}</p>
                      {t.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {t.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTerm(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
