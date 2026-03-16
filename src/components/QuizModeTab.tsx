import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, Check, X, Trophy, RotateCcw, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MASECHTOT } from "@/lib/masechtotData";

const HISTORY_KEY = "learning-history";
const QUIZ_RESULTS_KEY = "quiz-results";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

interface QuizResult {
  date: number;
  masechet: string;
  daf: string;
  score: number;
  total: number;
}

function loadResults(): QuizResult[] {
  try { return JSON.parse(localStorage.getItem(QUIZ_RESULTS_KEY) || "[]"); } catch { return []; }
}

export default function QuizModeTab() {
  const [quizState, setQuizState] = useState<"setup" | "playing" | "results">("setup");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>(loadResults);

  // Setup
  const [masechet, setMasechet] = useState("");
  const [daf, setDaf] = useState("");
  const [difficulty, setDifficulty] = useState("בינוני");
  const [numQuestions, setNumQuestions] = useState("5");

  // Use learning history for "smart quiz" (recent topics)
  const recentMasechtot = useMemo(() => {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const unique = [...new Set(history.slice(0, 30).map((h: any) => h.masechet))].filter(Boolean);
      return unique.slice(0, 5) as string[];
    } catch { return []; }
  }, []);

  const generateQuiz = useCallback(async () => {
    setIsGenerating(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Try to get text from cached data
      const textHe = "";
      const dbKey = masechet ? `${masechet} ${daf}` : recentMasechtot[0] || "ברכות";

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          masechet: masechet || dbKey,
          daf: daf || "ב",
          textHe,
          difficulty,
          numQuestions: parseInt(numQuestions),
        }),
      });

      if (!res.ok) throw new Error("Failed to generate quiz");
      const data = await res.json();

      if (!data.questions || data.questions.length === 0) throw new Error("No questions generated");

      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setCurrentQ(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setQuizState("playing");
    } catch (err) {
      toast.error("שגיאה ביצירת המבחן");
    } finally {
      setIsGenerating(false);
    }
  }, [masechet, daf, difficulty, numQuestions, recentMasechtot]);

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = selectedAnswer;
    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    setSelectedAnswer(null);
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      // Calculate results
      const score = answers.filter((a, i) => a === questions[i].correctIndex).length + 
        (selectedAnswer === questions[currentQ].correctIndex ? 1 : 0);
      const result: QuizResult = {
        date: Date.now(),
        masechet: masechet || "כללי",
        daf: daf || "",
        score,
        total: questions.length,
      };
      const updated = [result, ...quizResults].slice(0, 50);
      setQuizResults(updated);
      localStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(updated));
      setQuizState("results");
    }
  };

  const score = useMemo(() => {
    if (quizState !== "results") return 0;
    return answers.filter((a, i) => a === questions[i]?.correctIndex).length;
  }, [answers, questions, quizState]);

  // SETUP
  if (quizState === "setup") {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto" dir="rtl">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            מצב מבחן
          </h2>
          <p className="text-sm text-muted-foreground">שאלות אוטומטיות שנוצרות ע"י AI מתוך מה שלמדת</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">הגדרות מבחן</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">מסכת</label>
                <Select value={masechet} onValueChange={setMasechet}>
                  <SelectTrigger><SelectValue placeholder="בחר מסכת" /></SelectTrigger>
                  <SelectContent>
                    {MASECHTOT.map(m => <SelectItem key={m.hebrewName} value={m.hebrewName}>{m.hebrewName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">דף</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="למשל: ב׳ ע״א"
                  value={daf}
                  onChange={e => setDaf(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">רמת קושי</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="קל">קל</SelectItem>
                    <SelectItem value="בינוני">בינוני</SelectItem>
                    <SelectItem value="קשה">קשה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">מספר שאלות</label>
                <Select value={numQuestions} onValueChange={setNumQuestions}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="7">7</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {recentMasechtot.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">מבוסס על הלמידה האחרונה:</p>
                <div className="flex gap-1 flex-wrap">
                  {recentMasechtot.map(m => (
                    <Badge key={m} variant="outline" className="text-xs cursor-pointer hover:bg-primary/10" onClick={() => setMasechet(m)}>
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={generateQuiz} disabled={isGenerating} className="w-full gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isGenerating ? "ייצור שאלות..." : "התחל מבחן"}
            </Button>
          </CardContent>
        </Card>

        {/* Past Results */}
        {quizResults.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">תוצאות אחרונות</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {quizResults.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <span>{r.masechet} {r.daf}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.score / r.total >= 0.7 ? "default" : "destructive"} className="text-xs">
                          {r.score}/{r.total}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.date).toLocaleDateString("he-IL")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // PLAYING
  if (quizState === "playing" && questions.length > 0) {
    const q = questions[currentQ];
    const isCorrect = selectedAnswer === q.correctIndex;

    return (
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{currentQ + 1}/{questions.length}</Badge>
          <Badge variant="outline">{q.difficulty}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setQuizState("setup")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />

        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-medium mb-6 leading-relaxed">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                let cls = "border rounded-lg p-3 text-sm cursor-pointer transition-all";
                if (showExplanation) {
                  if (i === q.correctIndex) cls += " bg-green-50 border-green-500 dark:bg-green-950/30";
                  else if (i === selectedAnswer && !isCorrect) cls += " bg-red-50 border-red-500 dark:bg-red-950/30";
                  else cls += " opacity-50";
                } else if (selectedAnswer === i) {
                  cls += " border-primary bg-primary/10";
                } else {
                  cls += " hover:border-primary/50 hover:bg-secondary/30";
                }
                return (
                  <div key={i} className={cls} onClick={() => !showExplanation && setSelectedAnswer(i)}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground min-w-[24px]">{["א", "ב", "ג", "ד"][i]}.</span>
                      <span>{opt}</span>
                      {showExplanation && i === q.correctIndex && <Check className="h-4 w-4 text-green-600 mr-auto" />}
                      {showExplanation && i === selectedAnswer && !isCorrect && i !== q.correctIndex && <X className="h-4 w-4 text-red-500 mr-auto" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {showExplanation && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">הסבר:</p>
                <p className="text-sm">{q.explanation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          {!showExplanation ? (
            <Button onClick={submitAnswer} disabled={selectedAnswer === null}>אשר תשובה</Button>
          ) : (
            <Button onClick={nextQuestion}>
              {currentQ < questions.length - 1 ? "שאלה הבאה" : "סיום מבחן"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // RESULTS
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto text-center" dir="rtl">
      <Trophy className={`h-16 w-16 mx-auto ${score / questions.length >= 0.7 ? "text-yellow-500" : "text-muted-foreground"}`} />
      <h2 className="text-2xl font-bold">
        {score / questions.length >= 0.9 ? "מצוין! 🎉" :
         score / questions.length >= 0.7 ? "כל הכבוד! 👏" :
         score / questions.length >= 0.5 ? "לא רע! 📚" : "צריך לחזור... 📖"}
      </h2>
      <p className="text-4xl font-bold text-primary">{score}/{questions.length}</p>
      <p className="text-muted-foreground">{Math.round((score / questions.length) * 100)}% תשובות נכונות</p>

      <div className="flex gap-2 justify-center">
        <Button onClick={() => { setQuizState("setup"); }} variant="outline" className="gap-1">
          <RotateCcw className="h-4 w-4" /> מבחן חדש
        </Button>
        <Button onClick={generateQuiz} disabled={isGenerating} className="gap-1">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          נסה שוב
        </Button>
      </div>
    </div>
  );
}
