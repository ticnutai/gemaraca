import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, ChevronLeft, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MASECHTOT } from "@/lib/masechtotData";

/* ── Daf Yomi cycle calculation ──
   Cycle 14 started on 2020-01-05 (5 January 2020).
   Total dapim in Bavli: 2711.
   Each masechet has a known number of dapim (starting from daf 2). */

const DAF_YOMI_ORDER: { name: string; sefariaName: string; dapim: number }[] = [
  { name: "ברכות", sefariaName: "Berakhot", dapim: 63 },
  { name: "שבת", sefariaName: "Shabbat", dapim: 156 },
  { name: "עירובין", sefariaName: "Eruvin", dapim: 104 },
  { name: "פסחים", sefariaName: "Pesachim", dapim: 120 },
  { name: "שקלים", sefariaName: "Shekalim", dapim: 21 },
  { name: "יומא", sefariaName: "Yoma", dapim: 87 },
  { name: "סוכה", sefariaName: "Sukkah", dapim: 55 },
  { name: "ביצה", sefariaName: "Beitzah", dapim: 39 },
  { name: "ראש השנה", sefariaName: "Rosh_Hashanah", dapim: 34 },
  { name: "תענית", sefariaName: "Taanit", dapim: 30 },
  { name: "מגילה", sefariaName: "Megillah", dapim: 31 },
  { name: "מועד קטן", sefariaName: "Moed_Katan", dapim: 28 },
  { name: "חגיגה", sefariaName: "Chagigah", dapim: 26 },
  { name: "יבמות", sefariaName: "Yevamot", dapim: 121 },
  { name: "כתובות", sefariaName: "Ketubot", dapim: 111 },
  { name: "נדרים", sefariaName: "Nedarim", dapim: 90 },
  { name: "נזיר", sefariaName: "Nazir", dapim: 65 },
  { name: "סוטה", sefariaName: "Sotah", dapim: 48 },
  { name: "גיטין", sefariaName: "Gittin", dapim: 89 },
  { name: "קידושין", sefariaName: "Kiddushin", dapim: 81 },
  { name: "בבא קמא", sefariaName: "Bava_Kamma", dapim: 118 },
  { name: "בבא מציעא", sefariaName: "Bava_Metzia", dapim: 118 },
  { name: "בבא בתרא", sefariaName: "Bava_Batra", dapim: 175 },
  { name: "סנהדרין", sefariaName: "Sanhedrin", dapim: 112 },
  { name: "מכות", sefariaName: "Makkot", dapim: 23 },
  { name: "שבועות", sefariaName: "Shevuot", dapim: 48 },
  { name: "עבודה זרה", sefariaName: "Avodah_Zarah", dapim: 75 },
  { name: "הוריות", sefariaName: "Horayot", dapim: 13 },
  { name: "זבחים", sefariaName: "Zevachim", dapim: 119 },
  { name: "מנחות", sefariaName: "Menachot", dapim: 109 },
  { name: "חולין", sefariaName: "Chullin", dapim: 141 },
  { name: "בכורות", sefariaName: "Bekhorot", dapim: 60 },
  { name: "ערכין", sefariaName: "Arakhin", dapim: 33 },
  { name: "תמורה", sefariaName: "Temurah", dapim: 33 },
  { name: "כריתות", sefariaName: "Keritot", dapim: 27 },
  { name: "מעילה", sefariaName: "Meilah", dapim: 36 },
  { name: "נדה", sefariaName: "Niddah", dapim: 72 },
];

const TOTAL_DAPIM = DAF_YOMI_ORDER.reduce((s, m) => s + m.dapim, 0); // 2711
const CYCLE_14_START = new Date(2020, 0, 5); // Jan 5, 2020

interface DafInfo {
  masechetName: string;
  sefariaName: string;
  daf: number; // 2-based
  amud: "a";
  dayInCycle: number;
}

function getDafForDate(date: Date): DafInfo {
  const msPerDay = 86_400_000;
  const diff = Math.floor((date.getTime() - CYCLE_14_START.getTime()) / msPerDay);
  const dayInCycle = ((diff % TOTAL_DAPIM) + TOTAL_DAPIM) % TOTAL_DAPIM;

  let remaining = dayInCycle;
  for (const m of DAF_YOMI_ORDER) {
    if (remaining < m.dapim) {
      return {
        masechetName: m.name,
        sefariaName: m.sefariaName,
        daf: remaining + 2, // daf starts at 2
        amud: "a",
        dayInCycle,
      };
    }
    remaining -= m.dapim;
  }
  // Fallback
  return { masechetName: DAF_YOMI_ORDER[0].name, sefariaName: DAF_YOMI_ORDER[0].sefariaName, daf: 2, amud: "a", dayInCycle };
}

function toHebDaf(num: number): string {
  // Simple Hebrew numeral conversion for daf numbers
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת"];
  if (num <= 0) return "";
  const h = hundreds[Math.floor(num / 100)] || "";
  const r = num % 100;
  if (r === 15) return h + 'ט"ו';
  if (r === 16) return h + 'ט"ז';
  const t = tens[Math.floor(r / 10)] || "";
  const o = ones[r % 10] || "";
  const str = h + t + o;
  return str.length > 1 ? str.slice(0, -1) + '"' + str.slice(-1) : str + "'";
}

export default function DafYomiTab() {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());

  const today = useMemo(() => getDafForDate(new Date()), []);
  const viewDaf = useMemo(() => getDafForDate(viewDate), [viewDate]);

  // Generate week view
  const weekDays = useMemo(() => {
    const days: { date: Date; daf: DafInfo; isToday: boolean }[] = [];
    const startOfWeek = new Date(viewDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        daf: getDafForDate(d),
        isToday: d.toDateString() === new Date().toDateString(),
      });
    }
    return days;
  }, [viewDate]);

  // Cycle progress
  const cycleProgress = useMemo(() => {
    return ((today.dayInCycle / TOTAL_DAPIM) * 100).toFixed(1);
  }, [today]);

  const navigateToDaf = (daf: DafInfo) => {
    const sugyaId = `${daf.sefariaName.toLowerCase()}_${daf.daf}a`;
    navigate(`/sugya/${sugyaId}`);
  };

  const shiftWeek = (delta: number) => {
    setViewDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta * 7);
      return n;
    });
  };

  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        לוח דף יומי
      </h2>

      {/* Today's Daf - prominent card */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">הדף היומי של היום</div>
              <div className="text-2xl md:text-3xl font-bold text-primary">
                {today.masechetName} דף {toHebDaf(today.daf)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                יום {today.dayInCycle + 1} מתוך {TOTAL_DAPIM} במחזור
              </div>
            </div>
            <Button onClick={() => navigateToDaf(today)} className="gap-2">
              <BookOpen className="h-4 w-4" />
              ללמוד
            </Button>
          </div>
          {/* Cycle progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>התקדמות במחזור</span>
              <span>{cycleProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${cycleProgress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week View */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {viewDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(({ date, daf, isToday }) => (
              <button
                key={date.toISOString()}
                onClick={() => { setViewDate(date); navigateToDaf(daf); }}
                className={`p-2 rounded-lg text-center transition-colors ${
                  isToday
                    ? "bg-primary text-primary-foreground ring-2 ring-primary"
                    : date.toDateString() === viewDate.toDateString()
                    ? "bg-accent/30"
                    : "hover:bg-accent/10"
                }`}
              >
                <div className="text-[10px] text-muted-foreground">{dayNames[date.getDay()]}</div>
                <div className="text-sm font-bold">{date.getDate()}</div>
                <div className="text-[9px] leading-tight mt-0.5 truncate">{daf.masechetName}</div>
                <div className="text-[10px] font-medium">{toHebDaf(daf.daf)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current masechet progress */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-bold mb-3">מסכתות בסדר הדף היומי</h3>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {DAF_YOMI_ORDER.map((m) => {
              const isCurrent = m.sefariaName === today.sefariaName;
              return (
                <div key={m.sefariaName} className={`flex items-center justify-between text-sm p-1.5 rounded ${isCurrent ? "bg-primary/10 font-bold" : ""}`}>
                  <span className="flex items-center gap-2">
                    {isCurrent && <Badge className="text-[10px] px-1.5 py-0">כעת</Badge>}
                    {m.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.dapim} דפים</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
