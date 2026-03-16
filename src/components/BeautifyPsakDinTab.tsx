import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Paintbrush, Upload, Download, Sparkles, FileText, Loader2, Eye, Code,
  RotateCcw, Database, Save, Copy, Search, X, CheckSquare, Square,
  Play, Pause, CheckCircle2, AlertCircle, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { parsePsakDinText, isPsakDinFormat } from "@/lib/psakDinParser";
import { generatePsakDinHtml } from "@/lib/psakDinHtmlTemplate";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "preview" | "source";

interface DbPsakItem {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  beautify_count?: number;
}

type JobStatus = "pending" | "processing" | "done" | "error";

interface BatchJob {
  id: string;
  title: string;
  status: JobStatus;
  html: string;
  rawText: string;
  error?: string;
}

// --- Concurrency helper ---
async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

const CONCURRENCY = 3;
const DB_PAGE = 50;

/** Detect HTML content and extract plain text */
function stripHtmlToText(input: string): string {
  // Quick check — if no HTML tags, return as-is
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;

  const doc = new DOMParser().parseFromString(input, 'text/html');

  // Remove elements whose text content is NOT real document content
  doc.querySelectorAll('style, script, link, meta, title, head').forEach(el => el.remove());

  // Inject line breaks before block-level elements so textContent preserves paragraphs
  doc.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6, li, tr, hr, blockquote').forEach(el => {
    el.insertAdjacentText('beforebegin', '\n');
  });

  const text = doc.body?.textContent || '';
  // Collapse excessive whitespace while preserving paragraph breaks
  return text.replace(/[ \t]+/g, ' ').replace(/\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const BeautifyPsakDinTab = () => {
  // --- Single mode state ---
  const [rawText, setRawText] = useState("");
  const [htmlResult, setHtmlResult] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadedPsakId, setLoadedPsakId] = useState<string | null>(null);
  const [loadedPsakTitle, setLoadedPsakTitle] = useState("");

  // --- DB Picker state ---
  const [showDbPicker, setShowDbPicker] = useState(false);
  const [dbItems, setDbItems] = useState<DbPsakItem[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbLoadingMore, setDbLoadingMore] = useState(false);
  const [dbHasMore, setDbHasMore] = useState(false);
  const [dbOffset, setDbOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dbBeautifyFilter, setDbBeautifyFilter] = useState<"all" | "beautified" | "not_beautified">("all");
  const [dbSortBy, setDbSortBy] = useState<"year" | "title">("year");
  const [dbLoadCount, setDbLoadCount] = useState<number>(DB_PAGE);

  // --- Batch state ---
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const batchAbortRef = useRef(false);

  // --- Inline edit/delete state ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ===== FILE UPLOAD =====
  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".html") && file.type !== "text/plain") {
      toast({ title: "שגיאה", description: "נא להעלות קובץ טקסט (.txt)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) setRawText(text);
    };
    reader.readAsText(file, "UTF-8");
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // ===== DB PICKER LOADING =====
  const loadDbItems = useCallback(async (search: string, offset: number, append: boolean, pageSize?: number) => {
    if (append) setDbLoadingMore(true);
    else setDbLoading(true);
    const limit = pageSize || dbLoadCount;
    try {
      let query = supabase
        .from("psakei_din")
        .select("id, title, court, year, summary, beautify_count" as any)
        .range(offset, offset + limit - 1);

      // Sort
      if (dbSortBy === "title") {
        query = query.order("title", { ascending: true });
      } else {
        query = query.order("year", { ascending: false });
      }

      // Search
      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,court.ilike.%${search}%,summary.ilike.%${search}%`);
      }

      // Beautify filter
      if (dbBeautifyFilter === "beautified") {
        query = query.gt("beautify_count", 0);
      } else if (dbBeautifyFilter === "not_beautified") {
        query = query.or("beautify_count.is.null,beautify_count.eq.0");
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []).map((d: any) => ({ ...d, beautify_count: d.beautify_count || 0 }));
      setDbHasMore(items.length === limit);
      if (append) {
        setDbItems(prev => [...prev, ...items]);
      } else {
        setDbItems(items);
      }
      setDbOffset(offset + items.length);
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בטעינת פסקי דין מהמאגר", variant: "destructive" });
    } finally {
      setDbLoading(false);
      setDbLoadingMore(false);
    }
  }, [toast, dbSortBy, dbBeautifyFilter, dbLoadCount]);

  const openDbPicker = useCallback(() => {
    setShowDbPicker(true);
    setDbSearch("");
    setDbOffset(0);
    setSelectedIds(new Set());
    loadDbItems("", 0, false);
  }, [loadDbItems]);

  // Debounced search + filter/sort change
  useEffect(() => {
    if (!showDbPicker) return;
    const timer = setTimeout(() => {
      setDbOffset(0);
      loadDbItems(dbSearch, 0, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [dbSearch, showDbPicker, loadDbItems, dbBeautifyFilter, dbSortBy]);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!showDbPicker || !dbHasMore || dbLoadingMore) return;
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadDbItems(dbSearch, dbOffset, true);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showDbPicker, dbHasMore, dbLoadingMore, dbSearch, dbOffset, loadDbItems]);

  // ===== SELECTION =====
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === dbItems.length) return new Set();
      return new Set(dbItems.map(i => i.id));
    });
  }, [dbItems]);

  const handleRenameItem = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const { error } = await supabase.from("psakei_din").update({ title: newTitle.trim() }).eq("id", id);
      if (error) throw error;
      setDbItems(prev => prev.map(i => i.id === id ? { ...i, title: newTitle.trim() } : i));
      toast({ title: "עודכן", description: "שם פסק הדין עודכן" });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בעדכון השם", variant: "destructive" });
    }
    setEditingItemId(null);
  }, [toast]);

  const handleDeleteItem = useCallback(async (id: string) => {
    if (!confirm("למחוק פסק דין זה?")) return;
    try {
      const { error } = await supabase.from("psakei_din").delete().eq("id", id);
      if (error) throw error;
      setDbItems(prev => prev.filter(i => i.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast({ title: "נמחק", description: "פסק הדין נמחק" });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה במחיקה", variant: "destructive" });
    }
  }, [toast]);

  // ===== LOAD SINGLE FROM DB =====
  const handleLoadSingle = useCallback(async (item: DbPsakItem) => {
    setShowDbPicker(false);
    setIsProcessing(true);
    setBatchJobs([]);
    try {
      const { data, error } = await supabase
        .from("psakei_din")
        .select("id, title, court, year, summary, full_text, case_number, source_url, tags")
        .eq("id", item.id)
        .single();
      if (error) throw error;

      const text = data.full_text || data.summary || "";
      setRawText(stripHtmlToText(text));
      setLoadedPsakId(data.id);
      setLoadedPsakTitle(data.title);
      setHtmlResult("");
      toast({ title: "נטען", description: `"${"${data.title}"}" נטען מהמאגר` });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בטעינת פסק הדין", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // ===== LOAD MULTI & BATCH PROCESS =====
  const handleLoadMultiple = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setShowDbPicker(false);
    const selectedItems = dbItems.filter(i => selectedIds.has(i.id));

    const jobs: BatchJob[] = selectedItems.map(item => ({
      id: item.id,
      title: item.title,
      status: "pending" as JobStatus,
      html: "",
      rawText: "",
    }));
    setBatchJobs(jobs);
    setRawText("");
    setHtmlResult("");
    setLoadedPsakId(null);
    setLoadedPsakTitle("");
    setPreviewJobId(null);
    setBatchRunning(true);
    batchAbortRef.current = false;

    await processWithConcurrency(jobs, CONCURRENCY, async (job) => {
      if (batchAbortRef.current) return;

      setBatchJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "processing" } : j));

      try {
        const { data, error } = await supabase
          .from("psakei_din")
          .select("full_text, summary")
          .eq("id", job.id)
          .single();
        if (error) throw error;

        const text = stripHtmlToText(data.full_text || data.summary || "");

        // Yield to main thread between CPU work
        await new Promise<void>(resolve => {
          setTimeout(() => {
            try {
              const parsed = parsePsakDinText(text);
              const html = generatePsakDinHtml(parsed);
              setBatchJobs(prev => prev.map(j =>
                j.id === job.id ? { ...j, status: "done", html, rawText: text } : j
              ));
            } catch (e) {
              setBatchJobs(prev => prev.map(j =>
                j.id === job.id ? { ...j, status: "error", rawText: text, error: e instanceof Error ? e.message : "שגיאה" } : j
              ));
            }
            resolve();
          }, 0);
        });
      } catch (e) {
        setBatchJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, status: "error", error: e instanceof Error ? e.message : "שגיאה בטעינה" } : j
        ));
      }
    });

    setBatchRunning(false);
    toast({ title: "הושלם", description: `${selectedItems.length} פסקי דין עובדו` });
  }, [selectedIds, dbItems, toast]);

  const handleAbortBatch = useCallback(() => {
    batchAbortRef.current = true;
  }, []);

  // ===== BATCH SAVE ALL =====
  const handleBatchSave = useCallback(async (mode: "save" | "duplicate") => {
    const doneJobs = batchJobs.filter(j => j.status === "done" && j.html);
    if (doneJobs.length === 0) return;
    setIsSaving(true);

    let successCount = 0;
    let failCount = 0;

    await processWithConcurrency(doneJobs, CONCURRENCY, async (job) => {
      try {
        const fileId = mode === "duplicate" ? crypto.randomUUID() : job.id;
        const fileName = `beautified/${fileId}-${Date.now()}.html`;
        const blob = new Blob([job.html], { type: "text/html;charset=utf-8" });

        await supabase.storage
          .from("psakei-din-files")
          .upload(fileName, blob, { contentType: "text/html", upsert: true });

        const { data: urlData } = supabase.storage
          .from("psakei-din-files")
          .getPublicUrl(fileName);

        if (mode === "save") {
          const { data: current } = await supabase.from("psakei_din").select("beautify_count").eq("id", job.id).single();
          const newCount = ((current?.beautify_count as number) || 0) + 1;
          const { error } = await (supabase
            .from("psakei_din") as any)
            .update({ full_text: job.html, source_url: urlData?.publicUrl || undefined, beautify_count: newCount })
            .eq("id", job.id);
          if (error) throw error;
        } else {
          const parsed = parsePsakDinText(job.rawText);
          const { error } = await (supabase
            .from("psakei_din") as any)
            .insert({
              id: fileId,
              title: `${job.title} (מעוצב)`,
              court: parsed.court || "לא ידוע",
              year: parsed.year || new Date().getFullYear(),
              case_number: parsed.caseNumber || null,
              summary: parsed.summary || job.rawText.slice(0, 500),
              full_text: job.html,
              source_url: urlData?.publicUrl || null,
              tags: ["מעוצב"],
              beautify_count: 1,
            });
          if (error) throw error;
        }
        successCount++;
      } catch {
        failCount++;
      }
    });

    setIsSaving(false);
    toast({
      title: mode === "save" ? "נשמרו" : "שוכפלו ונשמרו",
      description: `${successCount} הצליחו${failCount > 0 ? `, ${failCount} נכשלו` : ""}`,
      variant: failCount > 0 ? "destructive" : undefined,
    });
  }, [batchJobs, toast]);

  // ===== SINGLE FORMAT =====
  const handleFormat = useCallback(() => {
    if (!rawText.trim()) {
      toast({ title: "שגיאה", description: "נא להדביק טקסט או להעלות קובץ", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const parsed = parsePsakDinText(rawText);
      const html = generatePsakDinHtml(parsed);
      setHtmlResult(html);
      setViewMode("preview");
      toast({ title: "הצלחה", description: "פסק הדין עוצב בהצלחה" });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בעיבוד הטקסט", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [rawText, toast]);

  // ===== SINGLE AI ENHANCE =====
  const handleAiEnhance = useCallback(async () => {
    if (!rawText.trim()) {
      toast({ title: "שגיאה", description: "נא להדביק טקסט או להעלות קובץ", variant: "destructive" });
      return;
    }
    setIsAiProcessing(true);
    setAiProgress("מתחבר ל-AI...");
    setHtmlResult("");

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseUrl = (supabase as any).supabaseUrl ?? (supabase as any).rest?.url?.replace("/rest/v1", "") ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anonKey = (supabase as any).supabaseKey ?? (supabase as any).rest?.headers?.apikey ?? "";

      const res = await fetch(`${supabaseUrl}/functions/v1/beautify-psak-din`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ fullText: rawText }),
      });

      if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        setAiProgress("מעבד ומעצב...");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.done && parsed.html) {
                accumulated = parsed.html;
                break;
              }
              if (parsed.chunk) {
                accumulated += parsed.chunk;
                setHtmlResult(accumulated);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
            }
          }
        }

        if (accumulated) {
          setHtmlResult(accumulated);
          setViewMode("preview");
          toast({ title: "הצלחה", description: "פסק הדין עוצב בעזרת AI" });
        } else {
          toast({ title: "שגיאה", description: "לא התקבל תוצאה מה-AI", variant: "destructive" });
        }
      } else {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
    } catch (err) {
      toast({
        title: "שגיאת AI",
        description: err instanceof Error ? err.message : "שגיאה לא צפויה",
        variant: "destructive",
      });
    } finally {
      setIsAiProcessing(false);
      setAiProgress("");
    }
  }, [rawText, toast]);

  // ===== SINGLE SAVE =====
  const handleSave = useCallback(async () => {
    if (!htmlResult || !loadedPsakId) return;
    setIsSaving(true);
    try {
      const fileName = `beautified/${loadedPsakId}-${Date.now()}.html`;
      const blob = new Blob([htmlResult], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);

      // Fetch current beautify_count to increment
      const { data: current } = await supabase.from("psakei_din").select("beautify_count").eq("id", loadedPsakId).single();
      const newCount = ((current?.beautify_count as number) || 0) + 1;

      const { error } = await (supabase.from("psakei_din") as any)
        .update({ full_text: htmlResult, source_url: urlData?.publicUrl || undefined, beautify_count: newCount })
        .eq("id", loadedPsakId);
      if (error) throw error;

      toast({ title: "נשמר", description: `"${"${loadedPsakTitle}"}" עודכן בהצלחה` });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בשמירת פסק הדין", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [htmlResult, loadedPsakId, loadedPsakTitle, toast]);

  // ===== SINGLE DUPLICATE =====
  const handleDuplicateAndSave = useCallback(async () => {
    if (!htmlResult) return;
    setIsSaving(true);
    try {
      const newId = crypto.randomUUID();
      const fileName = `beautified/${newId}.html`;
      const blob = new Blob([htmlResult], { type: "text/html;charset=utf-8" });
      await supabase.storage.from("psakei-din-files").upload(fileName, blob, { contentType: "text/html", upsert: true });
      const { data: urlData } = supabase.storage.from("psakei-din-files").getPublicUrl(fileName);

      const parsed = parsePsakDinText(rawText);
      const { error } = await (supabase.from("psakei_din") as any).insert({
        id: newId,
        title: `${loadedPsakTitle || parsed.title} (מעוצב)`,
        court: parsed.court || "לא ידוע",
        year: parsed.year || new Date().getFullYear(),
        case_number: parsed.caseNumber || null,
        summary: parsed.summary || rawText.slice(0, 500),
        full_text: htmlResult,
        source_url: urlData?.publicUrl || null,
        tags: ["מעוצב"],
        beautify_count: 1,
      });
      if (error) throw error;

      setLoadedPsakId(newId);
      setLoadedPsakTitle(`${loadedPsakTitle || parsed.title} (מעוצב)`);
      toast({ title: "נשמר", description: "פסק דין מעוצב נשמר כפריט חדש" });
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בשמירת העותק", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [htmlResult, rawText, loadedPsakTitle, toast]);

  const handleDownload = useCallback(() => {
    if (!htmlResult) return;
    const blob = new Blob([htmlResult], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "psak-din-formatted.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [htmlResult]);

  // ===== OPEN IN BROWSER WITH EDITING TOOLBAR =====
  const handleOpenInBrowser = useCallback(() => {
    if (!htmlResult) return;
    const toolbarCss = `
      #editor-toolbar {
        position: sticky; top: 0; z-index: 999;
        background: #0B1F5B; color: #fff;
        display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
        padding: 6px 12px; font-family: sans-serif; direction: rtl;
      }
      #editor-toolbar button, #editor-toolbar select {
        background: rgba(255,255,255,0.15); color: #fff; border: none;
        border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 14px;
      }
      #editor-toolbar button:hover { background: rgba(255,255,255,0.3); }
      #editor-toolbar .sep { width: 1px; height: 24px; background: rgba(255,255,255,0.3); margin: 0 4px; }
      #editor-toolbar select { padding: 4px 6px; }
      #editor-toolbar select option { color: #000; }
    `;
    const toolbarHtml = `
      <div id="editor-toolbar">
        <button onclick="document.execCommand('bold')" title="\u05de\u05d5\u05d3\u05d2\u05e9"><b>B</b></button>
        <button onclick="document.execCommand('italic')" title="\u05e0\u05d8\u05d5\u05d9"><i>I</i></button>
        <button onclick="document.execCommand('underline')" title="\u05e7\u05d5 \u05ea\u05d7\u05ea\u05d5\u05df"><u>U</u></button>
        <button onclick="document.execCommand('strikeThrough')" title="\u05e7\u05d5 \u05d7\u05d5\u05e6\u05d4"><s>S</s></button>
        <div class="sep"></div>
        <select onchange="document.execCommand('fontSize',false,this.value);this.selectedIndex=0">
          <option>\u05d2\u05d5\u05d3\u05dc</option>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option>
          <option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option>
        </select>
        <select onchange="document.execCommand('foreColor',false,this.value);this.selectedIndex=0">
          <option>\u05e6\u05d1\u05e2</option>
          <option value="#000000" style="color:#000">\u25a0 \u05e9\u05d7\u05d5\u05e8</option>
          <option value="#0B1F5B" style="color:#0B1F5B">\u25a0 \u05db\u05d7\u05d5\u05dc</option>
          <option value="#c0392b" style="color:#c0392b">\u25a0 \u05d0\u05d3\u05d5\u05dd</option>
          <option value="#27ae60" style="color:#27ae60">\u25a0 \u05d9\u05e8\u05d5\u05e7</option>
          <option value="#D4AF37" style="color:#D4AF37">\u25a0 \u05d6\u05d4\u05d1</option>
        </select>
        <select onchange="document.execCommand('hiliteColor',false,this.value);this.selectedIndex=0">
          <option>\u05d4\u05d3\u05d2\u05e9\u05d4</option>
          <option value="#ffff00" style="background:#ffff00">\u05e6\u05d4\u05d5\u05d1</option>
          <option value="#90EE90" style="background:#90EE90">\u05d9\u05e8\u05d5\u05e7</option>
          <option value="#ADD8E6" style="background:#ADD8E6">\u05ea\u05db\u05dc\u05ea</option>
          <option value="#FFB6C1" style="background:#FFB6C1">\u05d5\u05e8\u05d5\u05d3</option>
          <option value="transparent">\u05dc\u05dc\u05d0</option>
        </select>
        <div class="sep"></div>
        <button onclick="document.execCommand('justifyRight')" title="\u05d9\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d9\u05de\u05d9\u05df">\u2261</button>
        <button onclick="document.execCommand('justifyCenter')" title="\u05de\u05e8\u05db\u05d5\u05d6">\u2550</button>
        <button onclick="document.execCommand('justifyLeft')" title="\u05d9\u05d9\u05e9\u05d5\u05e8 \u05dc\u05e9\u05de\u05d0\u05dc">\u2261</button>
        <button onclick="document.execCommand('justifyFull')" title="\u05de\u05d9\u05d5\u05e9\u05e8">\u2630</button>
        <div class="sep"></div>
        <button onclick="document.execCommand('insertUnorderedList')" title="\u05e8\u05e9\u05d9\u05de\u05d4">\u2022</button>
        <button onclick="document.execCommand('insertOrderedList')" title="\u05de\u05e1\u05e4\u05d5\u05e8">1.</button>
        <button onclick="document.execCommand('indent')" title="\u05d4\u05d6\u05d7\u05d4">\u21e5</button>
        <button onclick="document.execCommand('outdent')" title="\u05d4\u05e7\u05d8\u05e0\u05d4">\u21e4</button>
        <div class="sep"></div>
        <button onclick="document.execCommand('undo')" title="\u05d1\u05d8\u05dc">\u21a9</button>
        <button onclick="document.execCommand('redo')" title="\u05d7\u05d6\u05d5\u05e8">\u21aa</button>
        <button onclick="document.execCommand('removeFormat')" title="\u05e0\u05e7\u05d4 \u05e2\u05d9\u05e6\u05d5\u05d1">\u2718</button>
        <div class="sep"></div>
        <button onclick="window.print()" title="\u05d4\u05d3\u05e4\u05e1\u05d4">\ud83d\udda8\ufe0f</button>
        <button onclick="(function(){var b=new Blob([document.querySelector('.container').outerHTML],{type:'text/html'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='psak-din-edited.html';a.click()})()" title="\u05e9\u05de\u05d5\u05e8 HTML">\ud83d\udcbe</button>
      </div>
    `;

    // Inject toolbar + contentEditable into the HTML
    const editableHtml = htmlResult.replace(
      /<body([^>]*)>/i,
      `<body$1><style>${toolbarCss}</style>${toolbarHtml}`,
    ).replace(
      /class="container"/,
      'class="container" contenteditable="true" spellcheck="true"',
    );

    const blob = new Blob([editableHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Revoke after delay to allow browser to load
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [htmlResult]);

  const handleReset = useCallback(() => {
    setRawText("");
    setHtmlResult("");
    setViewMode("preview");
    setLoadedPsakId(null);
    setLoadedPsakTitle("");
    setBatchJobs([]);
    setPreviewJobId(null);
  }, []);

  // ===== BATCH DOWNLOAD ALL =====
  const handleBatchDownloadAll = useCallback(() => {
    const doneJobs = batchJobs.filter(j => j.status === "done" && j.html);
    for (const job of doneJobs) {
      const blob = new Blob([job.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.title.replace(/[/\\?%*:|"<>]/g, "-")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [batchJobs]);

  // ===== COMPUTED =====
  const isFormatted = isPsakDinFormat(rawText);
  const isBatchMode = batchJobs.length > 0;
  const batchDone = batchJobs.filter(j => j.status === "done").length;
  const batchError = batchJobs.filter(j => j.status === "error").length;
  const batchTotal = batchJobs.length;
  const batchProgress = batchTotal > 0 ? Math.round(((batchDone + batchError) / batchTotal) * 100) : 0;
  const previewJob = useMemo(() => batchJobs.find(j => j.id === previewJobId), [batchJobs, previewJobId]);

  return (
    <div className="p-3 md:p-6 space-y-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Paintbrush className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h2 className="text-xl font-bold">עיצוב פסקי דין</h2>
          <p className="text-sm text-muted-foreground">
            הדביקו טקסט, העלו קובץ, או בחרו מהמאגר — ניתן לעצב כמה פסקי דין במקביל
          </p>
        </div>
        <Button variant="outline" onClick={openDbPicker}>
          <Database className="h-4 w-4 ml-2" />
          טען מהמאגר
        </Button>
      </div>

      {/* ===== BATCH MODE ===== */}
      {isBatchMode && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                עיבוד {batchTotal} פסקי דין
                {batchRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {batchRunning && (
                  <Button variant="destructive" size="sm" onClick={handleAbortBatch}>
                    <Pause className="h-4 w-4 ml-1" />
                    עצור
                  </Button>
                )}
                {!batchRunning && batchDone > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleBatchDownloadAll}>
                      <Download className="h-4 w-4 ml-1" />
                      הורד הכל ({batchDone})
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBatchSave("save")} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                      שמור הכל
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBatchSave("duplicate")} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Copy className="h-4 w-4 ml-1" />}
                      שכפל ושמור הכל
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 ml-1" />
                  נקה
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Progress value={batchProgress} className="flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {batchDone + batchError}/{batchTotal}
                {batchError > 0 && ` (${batchError} שגיאות)`}
              </span>
            </div>

            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {batchJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => {
                      if (job.status === "done") {
                        setPreviewJobId(job.id);
                        setHtmlResult(job.html);
                        setRawText(job.rawText);
                        setViewMode("preview");
                      }
                    }}
                    className={`w-full flex items-center gap-2 p-2 rounded-md text-sm text-right transition-colors
                      ${previewJobId === job.id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"}
                      ${job.status === "done" ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {job.status === "pending" && <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {job.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                    {job.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                    {job.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span className="truncate flex-1">{job.title}</span>
                    {job.status === "done" && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">מוכן</Badge>
                    )}
                    {job.status === "error" && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">שגיאה</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ===== SINGLE MODE / PREVIEW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input Panel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                טקסט מקור
                {loadedPsakTitle && (
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                    {loadedPsakTitle}
                  </span>
                )}
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 ml-1" />
                  העלה קובץ
                </Button>
                {rawText && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 ml-1" />
                    נקה
                  </Button>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="הדביקו כאן את טקסט פסק הדין הגולמי, או גררו קובץ TXT לכאן..."
                className="min-h-[350px] font-mono text-sm leading-relaxed resize-y"
                dir="rtl"
              />
            </div>

            {rawText && (
              <p className="text-xs text-muted-foreground">
                {rawText.length.toLocaleString()} תווים
                {isFormatted && " • זוהה מבנה פסק דין ✓"}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleFormat} disabled={!rawText.trim() || isProcessing || isAiProcessing} className="flex-1">
                {isProcessing ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Paintbrush className="h-4 w-4 ml-2" />}
                עצב (Parser)
              </Button>
              <Button onClick={handleAiEnhance} disabled={!rawText.trim() || isProcessing || isAiProcessing} variant="secondary" className="flex-1">
                {isAiProcessing ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Sparkles className="h-4 w-4 ml-2" />}
                {isAiProcessing ? aiProgress : "שפר עם AI"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4" />
                תצוגה מקדימה
                {previewJob && (
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                    {previewJob.title}
                  </span>
                )}
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Button variant={viewMode === "preview" ? "default" : "outline"} size="sm" onClick={() => setViewMode("preview")}>
                  <Eye className="h-3 w-3 ml-1" />
                  תצוגה
                </Button>
                <Button variant={viewMode === "source" ? "default" : "outline"} size="sm" onClick={() => setViewMode("source")}>
                  <Code className="h-3 w-3 ml-1" />
                  קוד
                </Button>
                {htmlResult && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleOpenInBrowser} title="פתח בדפדפן עם עריכה">
                      <ExternalLink className="h-4 w-4 ml-1" />
                      ערוך בדפדפן
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 ml-1" />
                      הורד
                    </Button>
                    {loadedPsakId && !isBatchMode && (
                      <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                        שמור
                      </Button>
                    )}
                    {!isBatchMode && (
                      <Button variant="outline" size="sm" onClick={handleDuplicateAndSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Copy className="h-4 w-4 ml-1" />}
                        שכפל ושמור
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {htmlResult ? (
              viewMode === "preview" ? (
                <iframe
                  srcDoc={htmlResult}
                  className="w-full min-h-[400px] border rounded-md bg-white"
                  sandbox="allow-same-origin"
                  title="תצוגה מקדימה של פסק דין מעוצב"
                />
              ) : (
                <Textarea value={htmlResult} readOnly className="min-h-[400px] font-mono text-xs leading-relaxed resize-y" dir="ltr" />
              )
            ) : (
              <div className="min-h-[400px] flex items-center justify-center border rounded-md bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <Paintbrush className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{isBatchMode ? "לחצו על פסק דין מוכן לצפייה בתוצאה" : 'הדביקו טקסט ולחצו "עצב" לצפייה בתוצאה'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== DB PICKER — NON-MODAL SLIDE PANEL ===== */}
      {showDbPicker && (
        <div className="fixed inset-y-0 left-0 w-full max-w-xl z-50 shadow-2xl border-r bg-background flex flex-col" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Database className="h-5 w-5" />
              טען פסקי דין מהמאגר
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setShowDbPicker(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Search + Filters */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                placeholder="חיפוש לפי כותרת, בית דין או תקציר..."
                className="pr-9"
                dir="rtl"
                autoFocus
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={dbBeautifyFilter} onValueChange={(v) => setDbBeautifyFilter(v as any)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="beautified">עוצבו ✓</SelectItem>
                  <SelectItem value="not_beautified">לא עוצבו</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dbSortBy} onValueChange={(v) => setDbSortBy(v as any)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">לפי שנה</SelectItem>
                  <SelectItem value="title">לפי שם</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 mr-auto">
                <label className="text-xs text-muted-foreground whitespace-nowrap">כמות:</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={dbLoadCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || DB_PAGE;
                    setDbLoadCount(Math.min(500, Math.max(1, v)));
                  }}
                  className="w-[70px] h-8 text-xs text-center"
                />
              </div>
            </div>
          </div>

          {/* Selection bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b text-sm">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <Checkbox
                checked={dbItems.length > 0 && selectedIds.size === dbItems.length}
                onCheckedChange={toggleSelectAll}
              />
              {selectedIds.size === dbItems.length && dbItems.length > 0 ? "בטל הכל" : "בחר הכל"}
            </button>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} נבחרו</Badge>
              )}
              <Button
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={handleLoadMultiple}
              >
                <Play className="h-4 w-4 ml-1" />
                עצב {selectedIds.size > 0 ? `${selectedIds.size} פסקי דין` : ""}
              </Button>
              {selectedIds.size === 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const item = dbItems.find(i => selectedIds.has(i.id));
                    if (item) handleLoadSingle(item);
                  }}
                >
                  טען יחיד
                </Button>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto">
            {dbLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : dbItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">לא נמצאו פסקי דין</div>
            ) : (
              <div className="divide-y">
                {dbItems.map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-start gap-3 p-3 transition-colors hover:bg-accent/50 relative
                      ${selectedIds.has(item.id) ? "bg-primary/5" : ""}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadSingle(item)}>
                      {editingItemId === item.id ? (
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleRenameItem(item.id, editingTitle)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameItem(item.id, editingTitle);
                            if (e.key === "Escape") setEditingItemId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 text-sm"
                        />
                      ) : (
                        <div className="font-medium text-sm truncate flex items-center gap-2">
                          {item.title}
                          {(item.beautify_count || 0) > 0 && (
                            <Badge className="gap-1 text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:text-amber-400 shrink-0">
                              <Paintbrush className="w-2.5 h-2.5" />
                              עוצב {item.beautify_count}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                        <span>{item.court}</span>
                        <span>•</span>
                        <span>{item.year}</span>
                      </div>
                      {item.summary && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</div>
                      )}
                    </div>
                    {/* Hover action icons */}
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="ערוך שם"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemId(item.id);
                          setEditingTitle(item.title);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="מחק"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
                {/* Infinite scroll sentinel */}
                <div ref={scrollSentinelRef} className="h-4" />
                {dbLoadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BeautifyPsakDinTab;
