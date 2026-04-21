import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MASECHTOT } from "@/lib/masechtotData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Upload,
  Trash2,
  Plus,
  ExternalLink,
  Search,
  Loader2,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const BUCKET = "shas-pdf-pages";

interface ShasPage {
  id: string;
  masechet: string;
  hebrew_name: string;
  seder: string;
  daf_number: number;
  amud: "a" | "b";
  storage_path: string;
  file_size: number | null;
  pdf_url: string;
  created_at: string;
}

export default function ShasManagerPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [filterMasechet, setFilterMasechet] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadTargetMasechet, setUploadTargetMasechet] = useState<string>("Berakhot");
  const [uploadQueue, setUploadQueue] = useState<{ name: string; status: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual add row state
  const [manualMasechet, setManualMasechet] = useState<string>("Berakhot");
  const [manualDaf, setManualDaf] = useState<string>("");
  const [manualAmud, setManualAmud] = useState<"a" | "b">("a");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: pages, isLoading } = useQuery<ShasPage[]>({
    queryKey: ["shas_pdf_pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shas_pdf_pages" as never)
        .select("*")
        .order("masechet", { ascending: true })
        .order("daf_number", { ascending: true })
        .order("amud", { ascending: true });
      if (error) throw error;
      return (data as unknown as ShasPage[]) || [];
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (page: ShasPage) => {
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([page.storage_path]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase
        .from("shas_pdf_pages" as never)
        .delete()
        .eq("id", page.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      toast({ title: "נמחק", description: "הקובץ הוסר מהבקט ומהטבלה." });
      qc.invalidateQueries({ queryKey: ["shas_pdf_pages"] });
    },
    onError: (e: Error) =>
      toast({ title: "שגיאת מחיקה", description: e.message, variant: "destructive" }),
  });

  const groupedByMasechet = useMemo(() => {
    const map = new Map<string, ShasPage[]>();
    (pages || []).forEach((p) => {
      if (!map.has(p.masechet)) map.set(p.masechet, []);
      map.get(p.masechet)!.push(p);
    });
    return map;
  }, [pages]);

  const masechetOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { sefariaName: string; hebrewName: string }[] = [];
    MASECHTOT.forEach((m) => {
      if (!seen.has(m.sefariaName)) {
        seen.add(m.sefariaName);
        opts.push({ sefariaName: m.sefariaName, hebrewName: m.hebrewName });
      }
    });
    return opts;
  }, []);

  const filtered = useMemo(() => {
    let list = pages || [];
    if (filterMasechet !== "all") list = list.filter((p) => p.masechet === filterMasechet);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.masechet.toLowerCase().includes(q) ||
          p.hebrew_name.includes(search.trim()) ||
          `${p.daf_number}${p.amud}`.toLowerCase().includes(q) ||
          p.storage_path.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pages, filterMasechet, search]);

  const uploadSingleFile = useCallback(
    async (file: File, masechetSefaria: string, daf: number, amud: "a" | "b") => {
      const info = MASECHTOT.find((m) => m.sefariaName === masechetSefaria);
      if (!info) throw new Error(`מסכת ${masechetSefaria} לא נמצאה ברשימה`);
      const storagePath = `${masechetSefaria}/${daf}${amud}.pdf`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("shas_pdf_pages" as never).upsert(
        {
          masechet: masechetSefaria,
          hebrew_name: info.hebrewName,
          seder: info.seder,
          daf_number: daf,
          amud,
          storage_path: storagePath,
          file_size: file.size,
        } as never,
        { onConflict: "masechet,daf_number,amud" }
      );
      if (dbErr) throw dbErr;
    },
    []
  );

  const parseFilename = (name: string): { daf: number; amud: "a" | "b" } | null => {
    const clean = name.replace(/\.pdf$/i, "").trim();
    // Patterns: "2a", "64b", "2 a", "berakhot_2a", "page_0002" (ignored)
    const m = clean.match(/(\d+)\s*([abאבAB])\s*$/);
    if (!m) return null;
    const amudRaw = m[2].toLowerCase();
    const amud: "a" | "b" = amudRaw === "a" || amudRaw === "א" ? "a" : "b";
    return { daf: parseInt(m[1], 10), amud };
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!userId) {
        toast({
          title: "נדרשת התחברות",
          description: "יש להתחבר כדי להעלות קבצים.",
          variant: "destructive",
        });
        return;
      }
      const arr = Array.from(files);
      setUploadQueue(arr.map((f) => ({ name: f.name, status: "ממתין" })));
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        const parsed = parseFilename(f.name);
        if (!parsed) {
          setUploadQueue((q) =>
            q.map((x, idx) => (idx === i ? { ...x, status: "דילוג: שם לא תקני" } : x))
          );
          continue;
        }
        try {
          setUploadQueue((q) =>
            q.map((x, idx) => (idx === i ? { ...x, status: "מעלה..." } : x))
          );
          await uploadSingleFile(f, uploadTargetMasechet, parsed.daf, parsed.amud);
          setUploadQueue((q) =>
            q.map((x, idx) =>
              idx === i ? { ...x, status: `הועלה ${parsed.daf}${parsed.amud}` } : x
            )
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setUploadQueue((q) =>
            q.map((x, idx) => (idx === i ? { ...x, status: `שגיאה: ${msg}` } : x))
          );
        }
      }
      qc.invalidateQueries({ queryKey: ["shas_pdf_pages"] });
      toast({ title: "סיים העלאה", description: `עיבדה ${arr.length} קבצים.` });
    },
    [userId, uploadTargetMasechet, uploadSingleFile, qc]
  );

  const handleManualFile = useCallback(
    async (file: File) => {
      if (!userId) {
        toast({
          title: "נדרשת התחברות",
          variant: "destructive",
        });
        return;
      }
      const daf = parseInt(manualDaf, 10);
      if (!daf || daf < 1) {
        toast({ title: "מספר דף לא תקין", variant: "destructive" });
        return;
      }
      try {
        await uploadSingleFile(file, manualMasechet, daf, manualAmud);
        toast({
          title: "הועלה",
          description: `${manualMasechet} ${daf}${manualAmud} נוסף בהצלחה.`,
        });
        setManualDaf("");
        qc.invalidateQueries({ queryKey: ["shas_pdf_pages"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "שגיאת העלאה", description: msg, variant: "destructive" });
      }
    },
    [userId, manualMasechet, manualDaf, manualAmud, uploadSingleFile, qc]
  );

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <h1 className="text-2xl font-bold">ניהול סריקות ש"ס</h1>
        <p className="text-muted-foreground">
          יש להתחבר כדי לנהל סריקות PDF. קריאה ציבורית פתוחה לכולם, אך שינויים דורשים חשבון.
        </p>
        <Button onClick={() => navigate("/auth")}>התחברות</Button>
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto p-4 md:p-6 space-y-6"
      dir="rtl"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          void handleFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ניהול סריקות ש"ס</h1>
          <p className="text-muted-foreground text-sm">
            העלאה, חיפוש ומחיקה של דפי PDF סרוקים. מופיע אוטומטית בטאב EmbedPDF של כל סוגיה.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary">{pages?.length ?? 0} דפים</Badge>
          <Badge variant="secondary">{groupedByMasechet.size} מסכתות</Badge>
        </div>
      </div>

      {/* Upload zone */}
      <Card
        className={`p-4 border-2 border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted"
        }`}
      >
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">מסכת יעד להעלאה:</label>
            <Select value={uploadTargetMasechet} onValueChange={setUploadTargetMasechet}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {masechetOptions.map((m) => (
                  <SelectItem key={m.sefariaName} value={m.sefariaName}>
                    {m.hebrewName} ({m.sefariaName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              שמות קבצים צריכים להיות בפורמט <code>2a.pdf</code>, <code>64b.pdf</code> וכו'.
              גרור קבצים לכאן או לחץ על הכפתור.
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" />
            בחר קבצים
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadQueue.length > 0 && (
          <div className="mt-3 max-h-40 overflow-auto border rounded p-2 text-xs space-y-1">
            {uploadQueue.map((q, i) => (
              <div key={i} className="flex justify-between">
                <span className="truncate mr-2">{q.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">{q.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Manual single-row add */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          הוספת דף ידנית
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs">מסכת</label>
            <Select value={manualMasechet} onValueChange={setManualMasechet}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {masechetOptions.map((m) => (
                  <SelectItem key={m.sefariaName} value={m.sefariaName}>
                    {m.hebrewName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs">מספר דף</label>
            <Input
              type="number"
              min={1}
              value={manualDaf}
              onChange={(e) => setManualDaf(e.target.value)}
              placeholder="2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs">עמוד</label>
            <Select value={manualAmud} onValueChange={(v) => setManualAmud(v as "a" | "b")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">א (a)</SelectItem>
                <SelectItem value="b">ב (b)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs">קובץ PDF</label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleManualFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי מסכת, דף או נתיב..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={filterMasechet} onValueChange={setFilterMasechet}>
            <SelectTrigger className="md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המסכתות</SelectItem>
              {Array.from(groupedByMasechet.keys())
                .sort()
                .map((m) => {
                  const hebrewName =
                    MASECHTOT.find((x) => x.sefariaName === m)?.hebrewName || m;
                  return (
                    <SelectItem key={m} value={m}>
                      {hebrewName} ({groupedByMasechet.get(m)!.length})
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            אין דפים תואמים לחיפוש.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מסכת</TableHead>
                <TableHead>דף</TableHead>
                <TableHead>גודל</TableHead>
                <TableHead>נתיב</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.hebrew_name}</div>
                    <div className="text-xs text-muted-foreground">{p.masechet}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {p.daf_number}
                      {p.amud}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.file_size ? `${Math.round(p.file_size / 1024)} KB` : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {p.storage_path}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(p.pdf_url, "_blank")}
                        title="פתח PDF"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deletePageMutation.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `למחוק ${p.hebrew_name} ${p.daf_number}${p.amud}? פעולה זו אינה הפיכה.`
                            )
                          ) {
                            deletePageMutation.mutate(p);
                          }
                        }}
                        title="מחק"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
