import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Layers, RotateCcw, Check, X, Eye, EyeOff, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STORAGE_KEY = "flashcards-data";
const REVIEW_KEY = "flashcards-review";

interface Flashcard {
  id: string;
  front: string; // Question / term
  back: string;  // Answer / definition
  masechet?: string;
  daf?: string;
  tags: string[];
  createdAt: number;
}

interface ReviewData {
  cardId: string;
  ease: number;      // 1.3 - 3.0
  interval: number;  // days
  nextReview: number; // timestamp
  repetitions: number;
}

function loadCards(): Flashcard[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function loadReviews(): Record<string, ReviewData> {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}"); } catch { return {}; }
}

function sm2(review: ReviewData, quality: number): ReviewData {
  // SM-2 algorithm
  const q = Math.max(0, Math.min(5, quality));
  let { ease, interval, repetitions } = review;

  if (q >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  } else {
    repetitions = 0;
    interval = 1;
  }

  return {
    ...review,
    ease,
    interval,
    repetitions,
    nextReview: Date.now() + interval * 86400000,
  };
}

export default function FlashcardsTab() {
  const [cards, setCards] = useState<Flashcard[]>(loadCards);
  const [reviews, setReviews] = useState<Record<string, ReviewData>>(loadReviews);
  const [mode, setMode] = useState<"manage" | "review">("manage");
  const [showBack, setShowBack] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ front: "", back: "", masechet: "", daf: "", tags: "" });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); }, [cards]);
  useEffect(() => { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews)); }, [reviews]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter(c => {
      const r = reviews[c.id];
      return !r || r.nextReview <= now;
    });
  }, [cards, reviews]);

  const addCard = () => {
    if (!form.front.trim() || !form.back.trim()) { toast.error("מלא שאלה ותשובה"); return; }
    const card: Flashcard = {
      id: Date.now().toString(36),
      front: form.front.trim(),
      back: form.back.trim(),
      masechet: form.masechet || undefined,
      daf: form.daf || undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: Date.now(),
    };
    setCards(prev => [card, ...prev]);
    setForm({ front: "", back: "", masechet: "", daf: "", tags: "" });
    setIsAdding(false);
    toast.success("כרטיסייה נוספה!");
  };

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    const newReviews = { ...reviews };
    delete newReviews[id];
    setReviews(newReviews);
  };

  const rateCard = useCallback((quality: number) => {
    if (dueCards.length === 0) return;
    const card = dueCards[currentIdx];
    const existing = reviews[card.id] || { cardId: card.id, ease: 2.5, interval: 0, nextReview: 0, repetitions: 0 };
    const updated = sm2(existing, quality);
    setReviews(prev => ({ ...prev, [card.id]: updated }));
    setShowBack(false);
    if (currentIdx < dueCards.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setMode("manage");
      toast.success("סיימת את החזרה! 🎉");
    }
  }, [dueCards, currentIdx, reviews]);

  const startReview = () => {
    if (dueCards.length === 0) { toast.info("אין כרטיסיות לחזרה כרגע"); return; }
    setCurrentIdx(0);
    setShowBack(false);
    setMode("review");
  };

  // Review mode
  if (mode === "review" && dueCards.length > 0) {
    const card = dueCards[currentIdx];
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-600" />
            חזרה מרווחת
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{currentIdx + 1}/{dueCards.length}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setMode("manage")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Progress value={((currentIdx + 1) / dueCards.length) * 100} className="h-2" />

        <Card className="min-h-[250px] flex flex-col items-center justify-center cursor-pointer" onClick={() => setShowBack(!showBack)}>
          <CardContent className="p-8 text-center">
            {!showBack ? (
              <>
                <p className="text-lg font-bold mb-4">{card.front}</p>
                <p className="text-xs text-muted-foreground">הקלק לראות תשובה</p>
                {card.masechet && (
                  <Badge variant="outline" className="mt-2 text-xs">{card.masechet} {card.daf}</Badge>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2 line-through">{card.front}</p>
                <p className="text-lg leading-relaxed">{card.back}</p>
              </>
            )}
          </CardContent>
        </Card>

        {showBack && (
          <div className="grid grid-cols-4 gap-2">
            <Button variant="destructive" onClick={() => rateCard(1)} className="text-sm">
              😵 שכחתי
            </Button>
            <Button variant="outline" onClick={() => rateCard(3)} className="text-sm border-amber-300 text-amber-700">
              😐 קשה
            </Button>
            <Button variant="outline" onClick={() => rateCard(4)} className="text-sm border-blue-300 text-blue-700">
              🙂 טוב
            </Button>
            <Button variant="default" onClick={() => rateCard(5)} className="text-sm bg-green-600 hover:bg-green-700">
              🤩 קל
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Manage mode
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-600" />
            כרטיסיות חזרה
          </h2>
          <p className="text-sm text-muted-foreground">{cards.length} כרטיסיות | {dueCards.length} לחזרה היום</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startReview} className="gap-1" disabled={dueCards.length === 0}>
            <RotateCcw className="h-4 w-4" />
            התחל חזרה ({dueCards.length})
          </Button>
          <Button variant="outline" onClick={() => setIsAdding(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            כרטיסייה חדשה
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm">כרטיסייה חדשה</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea placeholder="שאלה / צד קדמי" value={form.front} onChange={e => setForm(p => ({ ...p, front: e.target.value }))} className="text-sm min-h-[50px]" />
            <Textarea placeholder="תשובה / צד אחורי" value={form.back} onChange={e => setForm(p => ({ ...p, back: e.target.value }))} className="text-sm min-h-[50px]" />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="מסכת" value={form.masechet} onChange={e => setForm(p => ({ ...p, masechet: e.target.value }))} className="text-sm" />
              <Input placeholder="דף" value={form.daf} onChange={e => setForm(p => ({ ...p, daf: e.target.value }))} className="text-sm" />
              <Input placeholder="תגיות (פסיק)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>ביטול</Button>
              <Button size="sm" onClick={addCard}>שמור</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="max-h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {cards.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">אין כרטיסיות עדיין. צור את הראשונה!</p>
          ) : (
            cards.map(c => {
              const r = reviews[c.id];
              const isDue = !r || r.nextReview <= Date.now();
              return (
                <Card key={c.id} className={`${isDue ? "border-violet-200 dark:border-violet-800" : "opacity-70"}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.front}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.back}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {c.masechet && <Badge variant="outline" className="text-[10px]">{c.masechet} {c.daf}</Badge>}
                        {c.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                        {isDue && <Badge className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">לחזרה</Badge>}
                        {r && !isDue && <Badge variant="secondary" className="text-[10px]">חזרה ב-{new Date(r.nextReview).toLocaleDateString("he-IL")}</Badge>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteCard(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
