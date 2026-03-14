import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StickyNote, Plus, Save, Trash2, Edit3, X } from "lucide-react";

const STORAGE_KEY = "user-notes";

export interface UserNote {
  id: string;
  sugyaId: string;
  dafYomi: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  color: string;
}

const COLORS = [
  { name: "צהוב", value: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
  { name: "כחול", value: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" },
  { name: "ירוק", value: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" },
  { name: "סגול", value: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700" },
];

function loadNotes(): UserNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNotesStorage(notes: UserNote[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch {}
}

export function getNotesForSugya(sugyaId: string): UserNote[] {
  return loadNotes().filter((n) => n.sugyaId === sugyaId);
}

interface PersonalNotesProps {
  sugyaId: string;
  dafYomi: string;
}

export default function PersonalNotes({ sugyaId, dafYomi }: PersonalNotesProps) {
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0].value);

  useEffect(() => {
    setNotes(getNotesForSugya(sugyaId));
  }, [sugyaId]);

  const saveNote = useCallback(() => {
    if (!newContent.trim()) return;

    const allNotes = loadNotes();

    if (editingId) {
      const idx = allNotes.findIndex((n) => n.id === editingId);
      if (idx >= 0) {
        allNotes[idx].content = newContent;
        allNotes[idx].updatedAt = Date.now();
        allNotes[idx].color = newColor;
      }
    } else {
      allNotes.unshift({
        id: crypto.randomUUID(),
        sugyaId,
        dafYomi,
        content: newContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        color: newColor,
      });
    }

    saveNotesStorage(allNotes);
    setNotes(allNotes.filter((n) => n.sugyaId === sugyaId));
    setNewContent("");
    setIsAdding(false);
    setEditingId(null);
  }, [newContent, newColor, editingId, sugyaId, dafYomi]);

  const deleteNote = useCallback((id: string) => {
    const allNotes = loadNotes().filter((n) => n.id !== id);
    saveNotesStorage(allNotes);
    setNotes(allNotes.filter((n) => n.sugyaId === sugyaId));
  }, [sugyaId]);

  const startEdit = (note: UserNote) => {
    setEditingId(note.id);
    setNewContent(note.content);
    setNewColor(note.color);
    setIsAdding(true);
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <StickyNote className="h-4 w-4 text-yellow-500" />
          הערות אישיות
          {notes.length > 0 && <Badge variant="secondary" className="text-[10px]">{notes.length}</Badge>}
        </h3>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => { setIsAdding(true); setEditingId(null); setNewContent(""); }}>
            <Plus className="h-3 w-3 ml-1" />
            הערה חדשה
          </Button>
        )}
      </div>

      {/* Editor */}
      {isAdding && (
        <Card className="border-dashed border-2">
          <CardContent className="p-3 space-y-2">
            <Textarea
              placeholder="כתוב הערה..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">צבע:</span>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`h-5 w-5 rounded border-2 ${c.value} ${newColor === c.value ? "ring-2 ring-primary ring-offset-1" : ""}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNote} disabled={!newContent.trim()}>
                <Save className="h-3 w-3 ml-1" />
                {editingId ? "עדכן" : "שמור"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setEditingId(null); }}>
                <X className="h-3 w-3 ml-1" />
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id} className={`border ${note.color}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1">{note.content}</p>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(note)}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteNote(note.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  {new Date(note.updatedAt).toLocaleString("he-IL")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {notes.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground text-center py-2">
          אין הערות לדף זה. לחץ "הערה חדשה" להוסיף.
        </p>
      )}
    </div>
  );
}
