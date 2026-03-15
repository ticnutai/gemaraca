import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Trash2, Check, Clock, Target, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { MASECHTOT } from "@/lib/masechtotData";

const STORAGE_KEY = "weekly-planner";

interface PlanItem {
  id: string;
  day: number; // 0=Sunday ... 6=Saturday
  masechet: string;
  daf: string;
  goal: string;
  completed: boolean;
  timeSlot?: string;
}

interface WeekPlan {
  weekStart: string; // ISO date of week start (Sunday)
  items: PlanItem[];
}

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const TIME_SLOTS = ["בוקר (06:00-09:00)", "בוקר מאוחר (09:00-12:00)", "צהריים (12:00-15:00)", "אחה\"צ (15:00-18:00)", "ערב (18:00-21:00)", "לילה (21:00-00:00)"];

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Go to Sunday
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function loadPlan(): WeekPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const plan = JSON.parse(raw);
      if (plan.weekStart === getWeekStart()) return plan;
    }
  } catch {}
  return { weekStart: getWeekStart(), items: [] };
}

export default function WeeklyPlannerTab() {
  const [plan, setPlan] = useState<WeekPlan>(loadPlan);
  const [expandedDay, setExpandedDay] = useState<number | null>(new Date().getDay());
  const [newItem, setNewItem] = useState({ day: new Date().getDay(), masechet: "", daf: "", goal: "", timeSlot: "" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const addItem = () => {
    if (!newItem.masechet && !newItem.goal) {
      toast.error("הזן מסכת או יעד");
      return;
    }
    const item: PlanItem = {
      id: Date.now().toString(36),
      day: newItem.day,
      masechet: newItem.masechet,
      daf: newItem.daf,
      goal: newItem.goal,
      completed: false,
      timeSlot: newItem.timeSlot || undefined,
    };
    setPlan(prev => ({ ...prev, items: [...prev.items, item] }));
    setNewItem({ day: newItem.day, masechet: "", daf: "", goal: "", timeSlot: "" });
    toast.success("נוסף ללוח!");
  };

  const toggleComplete = (id: string) => {
    setPlan(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, completed: !i.completed } : i),
    }));
  };

  const removeItem = (id: string) => {
    setPlan(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const stats = useMemo(() => {
    const total = plan.items.length;
    const completed = plan.items.filter(i => i.completed).length;
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [plan.items]);

  const itemsByDay = useMemo(() => {
    const map: Record<number, PlanItem[]> = {};
    for (let d = 0; d < 7; d++) map[d] = [];
    plan.items.forEach(i => map[i.day]?.push(i));
    return map;
  }, [plan.items]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            לוח זמנים שבועי
          </h2>
          <p className="text-sm text-muted-foreground">תכנון לימוד שבועי עם יעדים ומעקב</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {stats.pct}%
          </Badge>
          <div className="text-xs text-muted-foreground">
            {stats.completed}/{stats.total} הושלמו
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-500 rounded-full"
          style={{ width: `${stats.pct}%` }}
        />
      </div>

      {/* Add New Item */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            הוסף יעד למידה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={String(newItem.day)} onValueChange={v => setNewItem(p => ({ ...p, day: Number(v) }))}>
              <SelectTrigger><SelectValue placeholder="יום" /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newItem.masechet} onValueChange={v => setNewItem(p => ({ ...p, masechet: v }))}>
              <SelectTrigger><SelectValue placeholder="מסכת" /></SelectTrigger>
              <SelectContent>
                {MASECHTOT.map(m => <SelectItem key={m.hebrewName} value={m.hebrewName}>{m.hebrewName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="דף (למשל ב עמוד א)"
              value={newItem.daf}
              onChange={e => setNewItem(p => ({ ...p, daf: e.target.value }))}
              className="text-sm"
            />
            <Select value={newItem.timeSlot} onValueChange={v => setNewItem(p => ({ ...p, timeSlot: v }))}>
              <SelectTrigger><SelectValue placeholder="זמן" /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="יעד חופשי (למשל: לחזור על הראשונים, סיכום הסוגיה...)"
              value={newItem.goal}
              onChange={e => setNewItem(p => ({ ...p, goal: e.target.value }))}
              className="text-sm flex-1"
            />
            <Button onClick={addItem} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> הוסף
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Days */}
      <ScrollArea className="max-h-[calc(100vh-350px)]">
        <div className="space-y-2">
          {DAYS.map((dayName, dayIdx) => {
            const items = itemsByDay[dayIdx];
            const isToday = new Date().getDay() === dayIdx;
            const dayCompleted = items.length > 0 && items.every(i => i.completed);
            const isExpanded = expandedDay === dayIdx;

            return (
              <Card key={dayIdx} className={`transition-all ${isToday ? "border-primary shadow-md" : ""} ${dayCompleted ? "bg-green-50/50 dark:bg-green-950/20 border-green-200" : ""}`}>
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/30 rounded-t-lg"
                  onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{isToday ? "📅 " : ""}{dayName}</span>
                    {items.length > 0 && (
                      <Badge variant={dayCompleted ? "default" : "secondary"} className="text-xs">
                        {items.filter(i => i.completed).length}/{items.length}
                      </Badge>
                    )}
                    {isToday && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">היום</Badge>}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                {isExpanded && (
                  <CardContent className="pt-0 pb-3 space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">אין יעדים ליום זה</p>
                    ) : (
                      items.map(item => (
                        <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border ${item.completed ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "border-border/50"}`}>
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleComplete(item.id)}
                            className="h-5 w-5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.masechet && (
                                <Badge variant="outline" className="text-xs">
                                  <BookOpen className="h-3 w-3 ml-1" />
                                  {item.masechet} {item.daf}
                                </Badge>
                              )}
                              {item.timeSlot && (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 ml-1" />
                                  {item.timeSlot}
                                </Badge>
                              )}
                            </div>
                            {item.goal && (
                              <p className={`text-sm mt-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                {item.goal}
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
