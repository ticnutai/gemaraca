import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderOpen, FolderPlus, Pencil, Trash2, Search, FileText,
  Loader2, Check, X, ChevronDown, ChevronLeft, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from "@tanstack/react-virtual";

interface FolderInfo {
  name: string;
  count: number;
}

interface PsakMinimal {
  id: string;
  title: string;
  court: string;
  year: number;
  category: string | null;
}

const FolderManagerTab = () => {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderPsakim, setFolderPsakim] = useState<PsakMinimal[]>([]);
  const [loadingPsakim, setLoadingPsakim] = useState(false);

  // Add folder
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Edit folder
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState("");
  const [editNewName, setEditNewName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete folder
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Assign psakim dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetFolder, setAssignTargetFolder] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [assignAllPsakim, setAssignAllPsakim] = useState<PsakMinimal[]>([]);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignPage, setAssignPage] = useState(0);
  const [assignHasMore, setAssignHasMore] = useState(true);
  const [loadingMoreAssign, setLoadingMoreAssign] = useState(false);
  const assignScrollRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      // Paginate to get ALL categories (Supabase default limit = 1000)
      const CHUNK = 1000;
      let allRows: { category: string | null }[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("psakei_din")
          .select("category")
          .range(page * CHUNK, (page + 1) * CHUNK - 1);
        if (error) throw error;
        const rows = data || [];
        allRows = [...allRows, ...rows];
        hasMore = rows.length === CHUNK;
        page++;
      }

      const countMap = new Map<string, number>();
      let noCategory = 0;
      allRows.forEach((r) => {
        if (r.category) {
          countMap.set(r.category, (countMap.get(r.category) || 0) + 1);
        } else {
          noCategory++;
        }
      });

      const folderList: FolderInfo[] = [];
      countMap.forEach((count, name) => folderList.push({ name, count }));
      folderList.sort((a, b) => a.name.localeCompare(b.name, "he"));

      setFolders(folderList);
      setUncategorizedCount(noCategory);
    } catch (err) {
      console.error("Error loading folders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const loadFolderPsakim = async (folderName: string | null) => {
    setLoadingPsakim(true);
    try {
      let query = supabase
        .from("psakei_din")
        .select("id, title, court, year, category")
        .order("year", { ascending: false })
        .limit(200);

      if (folderName === null) {
        query = query.is("category", null);
      } else {
        query = query.eq("category", folderName);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFolderPsakim(data || []);
    } catch (err) {
      console.error("Error loading folder psakim:", err);
    } finally {
      setLoadingPsakim(false);
    }
  };

  const handleExpandFolder = (folderName: string | null) => {
    const key = folderName ?? "__uncategorized__";
    if (expandedFolder === key) {
      setExpandedFolder(null);
      setFolderPsakim([]);
    } else {
      setExpandedFolder(key);
      loadFolderPsakim(folderName);
    }
  };

  // ─── Add Folder ────────────────────────────
  const handleAddFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.some((f) => f.name === name)) {
      toast({ title: "תיקייה בשם זה כבר קיימת", variant: "destructive" });
      return;
    }
    // Just add to local list with 0 count — becomes real when psakim are assigned
    setFolders((prev) => [...prev, { name, count: 0 }].sort((a, b) => a.name.localeCompare(b.name, "he")));
    setNewFolderName("");
    setAddDialogOpen(false);
    toast({ title: `תיקייה "${name}" נוצרה` });
  };

  // ─── Edit Folder ───────────────────────────
  const handleEditFolder = async () => {
    const newName = editNewName.trim();
    if (!newName || newName === editingFolder) {
      setEditDialogOpen(false);
      return;
    }
    if (folders.some((f) => f.name === newName)) {
      toast({ title: "תיקייה בשם זה כבר קיימת", variant: "destructive" });
      return;
    }
    setRenaming(true);
    try {
      const { error } = await supabase
        .from("psakei_din")
        .update({ category: newName })
        .eq("category", editingFolder);

      if (error) throw error;
      toast({ title: `שם התיקייה שונה ל"${newName}"` });
      setEditDialogOpen(false);
      await loadFolders();
    } catch (err) {
      console.error("Error renaming folder:", err);
      toast({ title: "שגיאה בשינוי שם", variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  // ─── Delete Folder ─────────────────────────
  const handleDeleteFolder = async () => {
    setDeleting(true);
    try {
      // Set category to null for all psakim in this folder
      const { error } = await supabase
        .from("psakei_din")
        .update({ category: null })
        .eq("category", deletingFolder);

      if (error) throw error;
      toast({ title: `תיקייה "${deletingFolder}" נמחקה, הפסקים הוחזרו לללא תיקייה` });
      setDeleteDialogOpen(false);
      setExpandedFolder(null);
      await loadFolders();
    } catch (err) {
      console.error("Error deleting folder:", err);
      toast({ title: "שגיאה במחיקת תיקייה", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Assign Psakim ─────────────────────────
  const ASSIGN_PAGE_SIZE = 500;

  const loadAssignPsakim = useCallback(async (_folder: string, page: number, reset: boolean) => {
    if (page === 0) setLoadingAssign(true);
    else setLoadingMoreAssign(true);
    try {
      const from = page * ASSIGN_PAGE_SIZE;
      const to = from + ASSIGN_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("psakei_din")
        .select("id, title, court, year, category")
        .order("title", { ascending: true })
        .range(from, to);

      if (error) throw error;
      const rows = data || [];
      if (reset) {
        setAssignAllPsakim(rows);
      } else {
        setAssignAllPsakim((prev) => [...prev, ...rows]);
      }
      setAssignHasMore(rows.length === ASSIGN_PAGE_SIZE);
      setAssignPage(page);
    } catch (err) {
      console.error("Error loading psakim for assign:", err);
    } finally {
      setLoadingAssign(false);
      setLoadingMoreAssign(false);
    }
  }, []);

  const openAssignDialog = async (folderName: string) => {
    setAssignTargetFolder(folderName);
    setAssignSearch("");
    setAssignSelected(new Set());
    setAssignAllPsakim([]);
    setAssignHasMore(true);
    setAssignDialogOpen(true);
    // Load first 2 pages in parallel for instant feel
    setLoadingAssign(true);
    try {
      const [res0, res1] = await Promise.all([
        supabase.from("psakei_din").select("id, title, court, year, category").order("title", { ascending: true }).range(0, ASSIGN_PAGE_SIZE - 1),
        supabase.from("psakei_din").select("id, title, court, year, category").order("title", { ascending: true }).range(ASSIGN_PAGE_SIZE, ASSIGN_PAGE_SIZE * 2 - 1),
      ]);
      const rows0 = res0.data || [];
      const rows1 = res1.data || [];
      setAssignAllPsakim([...rows0, ...rows1]);
      setAssignPage(rows1.length === ASSIGN_PAGE_SIZE ? 1 : 0);
      setAssignHasMore(rows1.length === ASSIGN_PAGE_SIZE);
    } catch (err) {
      console.error("Error loading initial psakim:", err);
    } finally {
      setLoadingAssign(false);
    }
  };

  const loadMoreAssignPsakim = useCallback(() => {
    if (loadingMoreAssign || !assignHasMore) return;
    loadAssignPsakim(assignTargetFolder, assignPage + 1, false);
  }, [loadingMoreAssign, assignHasMore, assignTargetFolder, assignPage, loadAssignPsakim]);

  // Filter by search
  const filteredAssignPsakim = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return assignAllPsakim;
    return assignAllPsakim.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.court.toLowerCase().includes(q) ||
        String(p.year).includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [assignAllPsakim, assignSearch]);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: filteredAssignPsakim.length,
    getScrollElement: () => assignScrollRef.current,
    estimateSize: () => 64,
    overscan: 15,
  });

  // Infinite scroll — load more when nearing the bottom
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const lastVirtualItemIndex = lastVirtualItem?.index ?? -1;
  useEffect(() => {
    if (
      lastVirtualItemIndex >= 0 &&
      lastVirtualItemIndex >= assignAllPsakim.length - 30 &&
      assignHasMore &&
      !loadingMoreAssign &&
      !assignSearch.trim()
    ) {
      loadMoreAssignPsakim();
    }
  }, [lastVirtualItemIndex, assignAllPsakim.length, assignHasMore, loadingMoreAssign, assignSearch, loadMoreAssignPsakim]);

  const toggleAssignSelect = (id: string) => {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssignPsakim = async () => {
    if (assignSelected.size === 0) return;
    setAssigning(true);
    try {
      const ids = Array.from(assignSelected);
      const { error } = await supabase
        .from("psakei_din")
        .update({ category: assignTargetFolder })
        .in("id", ids);

      if (error) throw error;
      toast({ title: `${ids.length} פסקים הועברו לתיקייה "${assignTargetFolder}"` });
      setAssignDialogOpen(false);
      await loadFolders();
      // Refresh expanded folder if it's the target
      if (expandedFolder === assignTargetFolder) {
        loadFolderPsakim(assignTargetFolder);
      }
    } catch (err) {
      console.error("Error assigning psakim:", err);
      toast({ title: "שגיאה בהעברת פסקים", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  // Remove single psak from folder
  const handleRemoveFromFolder = async (psakId: string) => {
    try {
      const { error } = await supabase
        .from("psakei_din")
        .update({ category: null })
        .eq("id", psakId);

      if (error) throw error;
      setFolderPsakim((prev) => prev.filter((p) => p.id !== psakId));
      await loadFolders();
    } catch (err) {
      console.error("Error removing psak from folder:", err);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-primary" />
            ניהול תיקיות
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            סווג את פסקי הדין לתיקיות, ערוך שמות ומחק תיקיות
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <FolderPlus className="w-4 h-4" />
          תיקייה חדשה
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{folders.length}</p>
            <p className="text-sm text-muted-foreground">תיקיות</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{uncategorizedCount}</p>
            <p className="text-sm text-muted-foreground">ללא תיקייה</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">
              {folders.reduce((sum, f) => sum + f.count, 0)}
            </p>
            <p className="text-sm text-muted-foreground">מסווגים</p>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Folders List */}
      {!loading && (
        <div className="space-y-3">
          {/* Uncategorized section */}
          <Card
            className={cn(
              "border shadow-sm hover:shadow-md transition-all cursor-pointer",
              expandedFolder === "__uncategorized__" && "ring-1 ring-amber-500/50 border-amber-500/30"
            )}
          >
            <CardContent className="p-0">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4"
                onClick={() => handleExpandFolder(null)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">ללא תיקייה</p>
                    <p className="text-xs text-muted-foreground">{uncategorizedCount} פסקי דין</p>
                  </div>
                </div>
                {expandedFolder === "__uncategorized__" ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {expandedFolder === "__uncategorized__" && (
                <div className="border-t border-border/50 px-4 pb-4">
                  {loadingPsakim ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[300px] mt-3">
                      <div className="space-y-2">
                        {folderPsakim.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
                          >
                            <div className="text-right flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.title}</p>
                              <p className="text-xs text-muted-foreground">{p.court} · {p.year}</p>
                            </div>
                          </div>
                        ))}
                        {folderPsakim.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">אין פסקים ללא תיקייה</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Named folders */}
          {folders.map((folder) => {
            const isExpanded = expandedFolder === folder.name;
            return (
              <Card
                key={folder.name}
                className={cn(
                  "border shadow-sm hover:shadow-md transition-all",
                  isExpanded && "ring-1 ring-primary/50 border-primary/30"
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4">
                    <button
                      type="button"
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => handleExpandFolder(folder.name)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.count} פסקי דין</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="הוסף פסקים"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignDialog(folder.name);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="שנה שם"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolder(folder.name);
                          setEditNewName(folder.name);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="מחק תיקייה"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingFolder(folder.name);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/50 px-4 pb-4">
                      {loadingPsakim ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[400px] mt-3">
                          <div className="space-y-2">
                            {folderPsakim.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                              >
                                <div className="text-right flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{p.title}</p>
                                  <p className="text-xs text-muted-foreground">{p.court} · {p.year}</p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  title="הסר מתיקייה"
                                  onClick={() => handleRemoveFromFolder(p.id)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                            {folderPsakim.length === 0 && (
                              <div className="text-center py-6">
                                <p className="text-sm text-muted-foreground mb-3">
                                  התיקייה ריקה
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => openAssignDialog(folder.name)}
                                >
                                  <Plus className="w-4 h-4" />
                                  הוסף פסקים
                                </Button>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {folders.length === 0 && !loading && (
            <Card className="border-dashed border-2">
              <CardContent className="p-12 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">אין תיקיות עדיין</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  צור תיקיות כדי לסווג את פסקי הדין שלך
                </p>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                  <FolderPlus className="w-4 h-4" />
                  צור תיקייה ראשונה
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Add Folder Dialog ─── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-primary" />
              תיקייה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>שם התיקייה</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="למשל: דיני שכירות, דיני נזיקין..."
                className="text-right"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFolder();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleAddFolder} disabled={!newFolderName.trim()} className="gap-2">
              <FolderPlus className="w-4 h-4" />
              צור
            </Button>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Folder Dialog ─── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              שינוי שם תיקייה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>שם חדש</Label>
              <Input
                value={editNewName}
                onChange={(e) => setEditNewName(e.target.value)}
                className="text-right"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEditFolder();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleEditFolder} disabled={renaming || !editNewName.trim()} className="gap-2">
              {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {renaming ? "משנה..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={renaming}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Folder Dialog ─── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              מחיקת תיקייה
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              האם למחוק את התיקייה <strong>"{deletingFolder}"</strong>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              פסקי הדין שבתיקייה לא יימחקו — הם יועברו ל"ללא תיקייה".
            </p>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteFolder}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "מוחק..." : "מחק"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Assign Psakim Dialog ─── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              הוסף פסקים לתיקייה "{assignTargetFolder}"
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="חפש פסקי דין לפי שם, בית דין, שנה..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="pr-9"
                autoFocus
              />
            </div>

            {/* Selection info + select all */}
            <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {filteredAssignPsakim.length} פסקים
                  {assignSearch.trim() && ` (מסוננים מתוך ${assignAllPsakim.length})`}
                </span>
                {assignSelected.size > 0 && (
                  <Badge variant="default" className="gap-1">
                    {assignSelected.size} נבחרו
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {filteredAssignPsakim.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => {
                      const allIds = new Set(filteredAssignPsakim.map((p) => p.id));
                      const allSelected = filteredAssignPsakim.every((p) => assignSelected.has(p.id));
                      if (allSelected) {
                        setAssignSelected((prev) => {
                          const next = new Set(prev);
                          allIds.forEach((id) => next.delete(id));
                          return next;
                        });
                      } else {
                        setAssignSelected((prev) => new Set([...prev, ...allIds]));
                      }
                    }}
                  >
                    {filteredAssignPsakim.every((p) => assignSelected.has(p.id))
                      ? "בטל בחירת הכל"
                      : "בחר הכל"}
                  </Button>
                )}
                {assignSelected.size > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => setAssignSelected(new Set())}
                  >
                    נקה בחירה
                  </Button>
                )}
              </div>
            </div>

            {/* Virtual scrolling results */}
            {loadingAssign ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                ref={assignScrollRef}
                className="flex-1 min-h-0 overflow-auto rounded-lg border"
                style={{ maxHeight: "50vh" }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const p = filteredAssignPsakim[virtualRow.index];
                    if (!p) return null;
                    const isSelected = assignSelected.has(p.id);
                    return (
                      <div
                        key={p.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-3 py-3 px-3 transition-colors cursor-pointer border-b border-border/30",
                            isSelected
                              ? "bg-primary/10"
                              : "hover:bg-muted/60"
                          )}
                          onClick={() => toggleAssignSelect(p.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAssignSelect(p.id)}
                          />
                          <div className="text-right flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{p.court}</span>
                              <span>·</span>
                              <span>{p.year}</span>
                              {p.category && (
                                <>
                                  <span>·</span>
                                  <Badge variant="outline" className="text-[10px] px-1">
                                    {p.category}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {loadingMoreAssign && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {filteredAssignPsakim.length === 0 && !loadingAssign && (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {assignSearch.trim() ? "לא נמצאו פסקי דין" : "אין פסקי דין זמינים"}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row-reverse gap-2 pt-4 border-t">
            <Button
              onClick={handleAssignPsakim}
              disabled={assigning || assignSelected.size === 0}
              className="gap-2"
            >
              {assigning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {assigning ? "מעביר..." : `העבר ${assignSelected.size} פסקים`}
            </Button>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assigning}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FolderManagerTab;
