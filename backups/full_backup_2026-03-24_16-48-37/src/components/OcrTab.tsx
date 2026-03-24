import { useState, useCallback, useRef, DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import {
  FileText,
  Upload,
  Copy,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Server,
  Eye,
  Trash2,
  Pencil,
  Check,
  X,
  Sparkles,
  BookOpen,
  FileType,
  PenLine,
  Power,
  SpellCheck,
} from "lucide-react";
import {
  checkOcrHealth,
  runOcrBase64,
  fileToDataUrl,
  addOcrCorrection,
  shutdownOcrServer,
  startOcrServer,
  type OcrResult,
  type OcrPage,
  type OcrEngine,
} from "@/lib/ocrService";
import CorrectionsPanel from "@/components/CorrectionsPanel";

type Status = "idle" | "checking" | "processing" | "done" | "error";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp";

// Sofit letter maps (used by fixSofitLetters)
const SOFIT_MAP: Record<string, string> = { "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" };
const UNSOFIT_MAP: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

const OcrTab = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [engine, setEngine] = useState<OcrEngine>("auto");
  const [usedEngine, setUsedEngine] = useState<string | null>(null);
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingAll, setEditingAll] = useState(false);
  const [editAllText, setEditAllText] = useState("");
  const [showCorrections, setShowCorrections] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Start editing a line
  const startEdit = useCallback((lineIdx: number, currentText: string) => {
    setEditingLine(lineIdx);
    setEditValue(currentText);
    setTimeout(() => editRef.current?.focus(), 50);
  }, []);

  // Submit a user correction
  const submitCorrection = useCallback(async () => {
    if (editingLine === null || !result || !currentPage) return;
    const line = currentPage.text_lines[editingLine];
    const displayedText = line.text;
    // Send original OCR text (pre-auto-corrections) as "wrong" so the server
    // learns from the raw OCR mistake, not from the already-corrected version.
    const wrongText = line.original_text || line.text;

    if (editValue.trim() && editValue !== displayedText) {
      try {
        const res = await addOcrCorrection(wrongText, editValue);
        // Update local state
        const newResult = { ...result };
        newResult.pages[activePage].text_lines[editingLine] = {
          ...line,
          text: editValue,
          original_text: wrongText,
        };
        newResult.pages[activePage].full_text = newResult.pages[activePage]
          .text_lines.map((l) => l.text).join("\n");
        setResult(newResult);
        const learnedCount = res.learned?.length ?? (res.status === "saved" ? 1 : 0);
        if (learnedCount > 0) {
          const details = res.learned
            ? res.learned.map((l: { from: string; to: string }) => `${l.from}→${l.to}`).join(", ")
            : `${res.from}→${res.to}`;
          toast.success(`✅ נלמדו ${learnedCount} תיקונים: ${details}`);
        } else {
          toast.info("השורה עודכנה (לא נמצאו הבדלים ללמידה).");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "שגיאה בשמירת תיקון");
      }
    }
    setEditingLine(null);
    setEditValue("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLine, editValue, result, activePage]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingLine(null);
    setEditValue("");
  }, []);

  // Check server connectivity
  const checkServer = useCallback(async () => {
    setStatus("checking");
    try {
      const health = await checkOcrHealth();
      setServerOnline(true);
      setAvailableEngines(health.engines || ["surya"]);
      if (!health.models_loaded) {
        toast.info("השרת פעיל אבל המודלים עדיין נטענים...");
      } else {
        const engines = health.engines?.join(", ") || "surya";
        toast.success(`שרת OCR פעיל — מנועים: ${engines}`);
      }
    } catch {
      setServerOnline(false);
      toast.error("שרת OCR לא זמין. הפעל את השרת ונסה שוב.");
    }
    setStatus("idle");
  }, []);

  // Toggle server on/off
  const toggleServer = useCallback(async () => {
    if (serverOnline) {
      try {
        await shutdownOcrServer();
        setServerOnline(false);
        setAvailableEngines([]);
        toast.success("השרת כבה.");
      } catch {
        toast.error("לא הצלחתי לכבות את השרת.");
      }
    } else {
      // Start the server via the Vite launcher
      setStatus("checking");
      try {
        const launchResult = await startOcrServer();
        if (launchResult.status === "already_running") {
          toast.info("השרת כבר רץ, בודק...");
        } else {
          toast.info("מפעיל את השרת... ממתין להכנה.");
        }
        // Wait for server to be ready, then check health
        let ready = false;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const health = await checkOcrHealth();
            setServerOnline(true);
            setAvailableEngines(health.engines || ["surya"]);
            const engines = health.engines?.join(", ") || "surya";
            toast.success(`שרת OCR פעיל! מנועים: ${engines}`);
            ready = true;
            break;
          } catch {
            // Server not ready yet
          }
        }
        if (!ready) {
          toast.error("השרת לא הצליח לעלות. נסה שוב.");
        }
      } catch {
        toast.error("לא הצלחתי להפעיל את השרת.");
      }
      setStatus("idle");
    }
  }, [serverOnline]);

  // Process file
  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResult(null);
    setErrorMsg("");
    setActivePage(0);
    setUsedEngine(null);
    setStatus("processing");

    try {
      const dataUrl = await fileToDataUrl(file);
      const ocrResult = await runOcrBase64(dataUrl, file.name, engine);
      setResult(ocrResult);
      setUsedEngine(ocrResult.engine || engine);
      setStatus("done");
      setServerOnline(true);
      const engineLabel = ocrResult.engine === "born-digital" ? "טקסט מוטמע" :
        ocrResult.engine === "tesseract" ? "Tesseract" : "Surya GPU";
      toast.success(
        `זוהו ${ocrResult.total_lines} שורות ב-${ocrResult.processing_time_seconds} שניות (מנוע: ${engineLabel})`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
      setErrorMsg(message);
      setStatus("error");
      if (message.includes("Failed to fetch")) {
        setServerOnline(false);
        toast.error("שרת OCR לא זמין. הפעל את השרת.");
      } else {
        toast.error(message);
      }
    }
  }, [engine]);

  // Drag & Drop handlers
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // File input handler
  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (fileRef.current) fileRef.current.value = "";
    },
    [processFile]
  );

  // Copy all text
  const copyAll = useCallback(() => {
    if (!result) return;
    const text = result.pages
      .map((p, i) => {
        return result.pages.length > 1
          ? `--- עמוד ${i + 1} ---\n${p.full_text}`
          : p.full_text;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("הטקסט הועתק ללוח!");
  }, [result]);

  // Download as text
  const downloadTxt = useCallback(() => {
    if (!result) return;
    const text = result.pages
      .map((p, i) => {
        return result.pages.length > 1
          ? `--- עמוד ${i + 1} ---\n${p.full_text}`
          : p.full_text;
      })
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName || "ocr_result").replace(/\.[^.]+$/, "") + "_ocr.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("הקובץ הורד!");
  }, [result, fileName]);

  // Download as Word (.docx)
  const downloadDocx = useCallback(async () => {
    if (!result) return;
    const sections = result.pages.map((p, i) => {
      const paragraphs: Paragraph[] = [];
      if (result.pages.length > 1) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `--- עמוד ${i + 1} ---`, bold: true, size: 28, font: "David" })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            bidirectional: true,
          })
        );
      }
      for (const line of p.full_text.split("\n")) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 24, font: "David" })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 80 },
            bidirectional: true,
          })
        );
      }
      return { properties: {}, children: paragraphs };
    });
    const doc = new Document({ sections });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, (fileName || "ocr_result").replace(/\.[^.]+$/, "") + "_ocr.docx");
    toast.success("קובץ Word הורד!");
  }, [result, fileName]);

  // Toggle full-text editing mode
  const startEditAll = useCallback(() => {
    if (!result) return;
    const text = result.pages
      .map((p, i) => {
        return result.pages.length > 1
          ? `--- עמוד ${i + 1} ---\n${p.full_text}`
          : p.full_text;
      })
      .join("\n\n");
    setEditAllText(text);
    setEditingAll(true);
    setEditingLine(null);
  }, [result]);

  const saveEditAll = useCallback(async () => {
    if (!result) return;
    const newResult = { ...result };
    // Collect diffs for learning: {wrong, correct} pairs
    const diffs: Array<{ wrong: string; correct: string }> = [];

    if (result.pages.length === 1) {
      const lines = editAllText.split("\n");
      const oldLines = result.pages[0].text_lines;
      lines.forEach((newText, i) => {
        const oldLine = oldLines[i];
        if (oldLine && newText.trim() !== oldLine.text.trim()) {
          diffs.push({ wrong: oldLine.original_text || oldLine.text, correct: newText });
        }
      });
      newResult.pages[0] = {
        ...newResult.pages[0],
        full_text: editAllText,
        text_lines: lines.map((text, i) => {
          const oldLine = oldLines[i];
          return {
            text,
            confidence: oldLine?.confidence ?? 1.0,
            bbox: oldLine?.bbox ?? [],
            polygon: oldLine?.polygon ?? [],
            original_text: oldLine?.original_text || oldLine?.text,
          };
        }),
        line_count: lines.length,
      };
    } else {
      // Split by page delimiters
      const pageChunks = editAllText.split(/---\s*עמוד\s*\d+\s*---\n?/);
      const chunks = pageChunks.filter((c) => c.trim());
      chunks.forEach((chunk, i) => {
        if (i < newResult.pages.length) {
          const trimmed = chunk.trim();
          const lines = trimmed.split("\n");
          const oldLines = result.pages[i].text_lines;
          lines.forEach((newText, j) => {
            const oldLine = oldLines[j];
            if (oldLine && newText.trim() !== oldLine.text.trim()) {
              diffs.push({ wrong: oldLine.original_text || oldLine.text, correct: newText });
            }
          });
          newResult.pages[i] = {
            ...newResult.pages[i],
            full_text: trimmed,
            text_lines: lines.map((text, j) => {
              const oldLine = oldLines[j];
              return {
                text,
                confidence: oldLine?.confidence ?? 1.0,
                bbox: oldLine?.bbox ?? [],
                polygon: oldLine?.polygon ?? [],
                original_text: oldLine?.original_text || oldLine?.text,
              };
            }),
            line_count: lines.length,
          };
        }
      });
    }
    newResult.total_lines = newResult.pages.reduce((s, p) => s + p.line_count, 0);
    setResult(newResult);
    setEditingAll(false);

    // Send diffs to server for learning
    if (diffs.length > 0) {
      let learnedTotal = 0;
      for (const diff of diffs) {
        try {
          const res = await addOcrCorrection(diff.wrong, diff.correct);
          learnedTotal += res.learned?.length ?? (res.status === "saved" ? 1 : 0);
        } catch { /* best effort */ }
      }
      if (learnedTotal > 0) {
        toast.success(`✅ הטקסט עודכן ונלמדו ${learnedTotal} תיקונים!`);
      } else {
        toast.success("הטקסט עודכן!");
      }
    } else {
      toast.success("הטקסט עודכן!");
    }
  }, [result, editAllText]);

  const cancelEditAll = useCallback(() => {
    setEditingAll(false);
    setEditAllText("");
  }, []);

  // Fix sofit (final-form) letters in all results
  const fixSofitLetters = useCallback(() => {
    if (!result) return;
    let totalFixes = 0;
    const newResult = { ...result };
    newResult.pages = result.pages.map((page) => {
      const newLines = page.text_lines.map((line) => {
        const words = line.text.split(" ");
        let lineChanged = false;
        const fixedWords = words.map((word) => {
          if (!word) return word;
          const chars = [...word];
          // Find last Hebrew char index
          let lastHeb = -1;
          for (let i = chars.length - 1; i >= 0; i--) {
            if (chars[i] >= "\u0590" && chars[i] <= "\u05EA") { lastHeb = i; break; }
          }
          if (lastHeb < 0) return word;
          let changed = false;
          // End of word: regular → sofit
          if (SOFIT_MAP[chars[lastHeb]]) {
            chars[lastHeb] = SOFIT_MAP[chars[lastHeb]];
            changed = true;
          }
          // Start/middle: sofit → regular
          for (let i = 0; i < lastHeb; i++) {
            if (UNSOFIT_MAP[chars[i]]) {
              chars[i] = UNSOFIT_MAP[chars[i]];
              changed = true;
            }
          }
          if (changed) { lineChanged = true; totalFixes++; }
          return chars.join("");
        });
        if (!lineChanged) return line;
        return { ...line, text: fixedWords.join(" ") };
      });
      return {
        ...page,
        text_lines: newLines,
        full_text: newLines.map((l) => l.text).join("\n"),
      };
    });
    setResult(newResult);
    if (totalFixes > 0) {
      toast.success(`תוקנו אותיות סופיות ב-${totalFixes} מילים`);
    } else {
      toast.info("כל האותיות הסופיות תקינות!");
    }
  }, [result]);

  // Clear
  const clear = useCallback(() => {
    setResult(null);
    setStatus("idle");
    setFileName("");
    setErrorMsg("");
    setActivePage(0);
    setEditingAll(false);
  }, []);

  const currentPage: OcrPage | null =
    result && result.pages.length > 0 ? result.pages[activePage] : null;

  // Count total auto-corrections on current page
  const pageCorrections = currentPage
    ? currentPage.text_lines.reduce(
        (sum, l) => sum + (l.corrections?.length || 0),
        0
      )
    : 0;

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          <h2 className="text-xl md:text-2xl font-bold">זיהוי טקסט עברי (OCR)</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkServer}
            disabled={status === "checking"}
          >
            <Server className="h-4 w-4 ml-1" />
            {status === "checking" ? "בודק..." : "בדוק שרת"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={serverOnline ? "default" : "outline"}
                size="icon"
                className={`h-8 w-8 transition-colors ${
                  serverOnline
                    ? "bg-green-600 hover:bg-red-600 text-white"
                    : "text-muted-foreground hover:text-green-600"
                }`}
                onClick={toggleServer}
                disabled={status === "processing"}
              >
                <Power className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {serverOnline ? "כבה שרת" : "הדלק שרת"}
            </TooltipContent>
          </Tooltip>
          {serverOnline && (
            <Button
              variant={showCorrections ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCorrections(!showCorrections)}
            >
              <BookOpen className="h-4 w-4 ml-1" />
              תיקונים
            </Button>
          )}
        </div>
      </div>

      {/* Engine Selector */}
      {availableEngines.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">מנוע:</span>
          {([
            { value: "auto" as OcrEngine, label: "אוטומטי" },
            { value: "surya" as OcrEngine, label: "Surya GPU" },
            { value: "tesseract" as OcrEngine, label: "Tesseract מהיר" },
          ]).filter(
            (e) => e.value === "auto" || availableEngines.includes(e.value)
          ).map((e) => (
            <Button
              key={e.value}
              variant={engine === e.value ? "default" : "outline"}
              size="sm"
              onClick={() => setEngine(e.value)}
              disabled={status === "processing"}
            >
              {e.label}
            </Button>
          ))}
          {usedEngine && status === "done" && (
            <Badge variant="secondary" className="mr-2">
              {usedEngine === "born-digital" ? "טקסט מוטמע" :
               usedEngine === "tesseract" ? "Tesseract" : "Surya"}
            </Badge>
          )}
        </div>
      )}

      {/* Drop Zone */}
      <Card
        className={`cursor-pointer transition-all border-2 border-dashed ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => status !== "processing" && fileRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          {status === "processing" ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">מעבד: {fileName}...</p>
              <p className="text-sm text-muted-foreground">
                זיהוי טקסט עם {engine === "tesseract" ? "Tesseract" : engine === "surya" ? "Surya OCR + GPU" : "מנוע אוטומטי"}
              </p>
              <Progress className="w-64 mt-2" value={undefined} />
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium">
                גרור לכאן קובץ PDF או תמונה
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, PNG, JPG, TIFF, BMP, WEBP
              </p>
              <Button variant="secondary" size="sm" className="mt-2">
                <FileText className="h-4 w-4 ml-1" />
                בחר קובץ
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={onFileSelect}
      />

      {/* Error */}
      {status === "error" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">שגיאה</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <Button variant="ghost" size="sm" className="mr-auto" onClick={clear}>
              נסה שוב
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                תוצאות — {result.filename}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyAll}>
                  <Copy className="h-4 w-4 ml-1" />
                  העתק הכל
                </Button>
                <Button variant="outline" size="sm" onClick={downloadTxt}>
                  <Download className="h-4 w-4 ml-1" />
                  שמור כטקסט
                </Button>
                <Button variant="outline" size="sm" onClick={downloadDocx}>
                  <FileType className="h-4 w-4 ml-1" />
                  שמור כ-Word
                </Button>
                <Button
                  variant={editingAll ? "default" : "outline"}
                  size="sm"
                  onClick={editingAll ? cancelEditAll : startEditAll}
                  title="ערוך את כל הטקסט"
                >
                  <PenLine className="h-4 w-4 ml-1" />
                  {editingAll ? "בטל עריכה" : "ערוך הכל"}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fixSofitLetters}
                      title="תקן אותיות סופיות"
                    >
                      <SpellCheck className="h-4 w-4 ml-1" />
                      תקן סופיות
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" dir="rtl">
                    <p>מוודא שאותיות סופיות (ך/ם/ן/ף/ץ) בסוף מילה</p>
                    <p>ואותיות רגילות (כ/מ/נ/פ/צ) בתחילת/אמצע מילה</p>
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant={showCorrections ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCorrections(!showCorrections)}
                  title="מנוע תיקונים"
                >
                  <BookOpen className="h-4 w-4 ml-1" />
                  תיקונים
                </Button>
                {pageCorrections > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {pageCorrections} תיקונים אוטומטיים
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {result.pages.length} עמודים
              </span>
              <span>📏 {result.total_lines} שורות</span>
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5" />
                {result.processing_time_seconds} שניות
              </span>
            </div>
          </CardHeader>

          {/* Page tabs */}
          {result.pages.length > 1 && (
            <>
              <Separator />
              <div className="px-4 pt-3 flex gap-1 flex-wrap">
                {result.pages.map((_, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={i === activePage ? "default" : "outline"}
                    onClick={() => setActivePage(i)}
                  >
                    עמוד {i + 1}
                  </Button>
                ))}
              </div>
            </>
          )}

          {/* Text output */}
          <CardContent className="pt-3">
            {editingAll ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <PenLine className="h-3.5 w-3.5" />
                  <span>ערוך את הטקסט ולחץ "שמור" לעדכון</span>
                </div>
                <Textarea
                  value={editAllText}
                  onChange={(e) => setEditAllText(e.target.value)}
                  className="min-h-[400px] text-base leading-8 font-serif"
                  dir="rtl"
                  style={{ fontFamily: "'David', 'Noto Sans Hebrew', serif" }}
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={cancelEditAll}>
                    <X className="h-4 w-4 ml-1" />
                    ביטול
                  </Button>
                  <Button size="sm" onClick={saveEditAll}>
                    <Check className="h-4 w-4 ml-1" />
                    שמור שינויים
                  </Button>
                </div>
              </div>
            ) : currentPage ? (
              <>
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>לחץ פעמיים על שורה כדי לתקן — המערכת תלמד מהתיקון</span>
                </div>
                <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
                  <TooltipProvider delayDuration={200}>
                    <div
                      className="text-base leading-8 whitespace-pre-wrap font-serif"
                      dir="rtl"
                      style={{ fontFamily: "'David', 'Noto Sans Hebrew', serif" }}
                    >
                      {currentPage.text_lines.map((line, i) => (
                        editingLine === i ? (
                          <div key={i} className="flex items-center gap-2 my-1 bg-primary/10 rounded p-1">
                            <Input
                              ref={editRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitCorrection();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="flex-1 text-base font-serif"
                              dir="rtl"
                              style={{ fontFamily: "'David', 'Noto Sans Hebrew', serif" }}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={submitCorrection}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="group hover:bg-primary/5 rounded px-1 -mx-1 transition-colors cursor-pointer flex items-center gap-1"
                            onDoubleClick={() => startEdit(i, line.text)}
                          >
                            {line.corrections && line.corrections.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" dir="rtl" className="max-w-xs">
                                  <p className="font-bold mb-1">תיקונים אוטומטיים:</p>
                                  {line.corrections.map((c, ci) => (
                                    <p key={ci} className="text-xs">
                                      {c.type === "gershayim" ? "גרשיים" :
                                       c.type === "sofit" ? "אות סופית" :
                                       c.type === "quote" ? "גרשיים" :
                                       c.type === "geresh" ? "גרש" :
                                       c.type === "learned" ? "תיקון נלמד" :
                                       c.type === "similar_char" ? `תו דומה (${c.detail || ""})` : c.type}
                                      : {c.from} → {c.to}
                                    </p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="flex-1">
                              {line.text}
                            </span>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                          </div>
                        )
                      ))}
                    </div>
                  </TooltipProvider>
                </ScrollArea>
                {/* Per-page stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span>{currentPage.line_count} שורות</span>
                  <span>
                    🎯 ביטחון ממוצע:{" "}
                    {currentPage.text_lines.length > 0
                      ? (
                          (currentPage.text_lines.reduce(
                            (s, l) => s + l.confidence,
                            0
                          ) /
                            currentPage.text_lines.length) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
      {/* Corrections Panel */}
      {showCorrections && (
        <CorrectionsPanel onClose={() => setShowCorrections(false)} />
      )}
    </div>
  );
};

export default OcrTab;
