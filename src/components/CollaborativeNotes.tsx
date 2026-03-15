import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Send, MessageCircle, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CollaborativeNotesProps {
  sugyaId: string;
  masechet?: string;
  daf?: string;
}

interface SharedNote {
  id: string;
  sugya_id: string;
  user_email: string;
  content: string;
  created_at: string;
  color: string;
}

const NOTE_COLORS = ["#FEF3C7", "#DBEAFE", "#D1FAE5", "#F3E8FF", "#FCE7F3"];

export default function CollaborativeNotes({ sugyaId, masechet, daf }: CollaborativeNotesProps) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load notes from localStorage (simulated collaborative storage)
  // In production, you'd use Supabase realtime
  const storageKey = `collab-notes-${sugyaId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setNotes(saved);
    } catch {}
  }, [storageKey]);

  const saveToStorage = useCallback((updatedNotes: SharedNote[]) => {
    localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  }, [storageKey]);

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: SharedNote = {
      id: Date.now().toString(36),
      sugya_id: sugyaId,
      user_email: user?.email || "אורח",
      content: newNote.trim(),
      created_at: new Date().toISOString(),
      color: noteColor,
    };
    const updated = [...notes, note];
    saveToStorage(updated);
    setNewNote("");
    toast.success("הערה נוספה!");
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const deleteNote = (id: string) => {
    saveToStorage(notes.filter(n => n.id !== id));
    toast.success("הערה נמחקה");
  };

  return (
    <Card className="border-indigo-200 dark:border-indigo-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
          <Users className="h-4 w-4" />
          הערות שיתופיות
          {masechet && daf && (
            <Badge variant="secondary" className="text-xs">{masechet} {daf}</Badge>
          )}
          <Badge variant="outline" className="text-xs">{notes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <ScrollArea className="max-h-[250px]" ref={scrollRef}>
          <div className="space-y-2">
            {notes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                אין הערות עדיין. כתוב את ההערה הראשונה!
              </p>
            )}
            {notes.map(note => (
              <div
                key={note.id}
                className="rounded-lg p-2.5 text-sm border relative group"
                style={{ backgroundColor: note.color + "40" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {note.user_email}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.created_at).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Color Picker */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground ml-2">צבע:</span>
          {NOTE_COLORS.map(c => (
            <button
              key={c}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${noteColor === c ? "border-primary scale-125" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              onClick={() => setNoteColor(c)}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="הוסף הערה..."
            className="text-sm min-h-[50px] flex-1"
            dir="rtl"
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) addNote(); }}
          />
          <Button size="icon" onClick={addNote} disabled={!newNote.trim()} className="self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Ctrl+Enter לשליחה</p>
      </CardContent>
    </Card>
  );
}
