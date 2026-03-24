import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Interfaces ──────────────────────────────────────────────

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PDFAnnotation {
  id: string;
  book_id: string;
  page_number: number;
  note_text: string;
  highlight_text: string | null;
  highlight_rects: HighlightRect[] | null;
  position_x: number | null;
  position_y: number | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface PDFBookmark {
  id: string;
  book_id: string;
  page_number: number;
  title: string;
  created_at: string;
}

// ─── Hook ────────────────────────────────────────────────────

export function usePDFAnnotations(bookId: string | null) {
  const qc = useQueryClient();
  const key = ["pdf-annotations", bookId] as const;

  // ── Query: all annotations for a book ──
  const { data: annotations = [], ...queryRest } = useQuery({
    queryKey: key,
    enabled: Boolean(bookId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_annotations" as any)
        .select("*")
        .eq("book_id", bookId!)
        .order("page_number")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as PDFAnnotation[];
    },
  });

  // ── Derived: bookmarks (note_text === 'BOOKMARK') ──
  const bookmarks: PDFBookmark[] = annotations
    .filter((a) => a.note_text === "BOOKMARK")
    .map((a) => ({
      id: a.id,
      book_id: a.book_id,
      page_number: a.page_number,
      title: `עמוד ${a.page_number}`,
      created_at: a.created_at,
    }));

  // ── Derived: real annotations (not bookmarks) ──
  const realAnnotations = annotations.filter((a) => a.note_text !== "BOOKMARK");

  // ── Derived: page annotation counts ──
  const annotationCountsByPage: Record<number, number> = {};
  for (const a of realAnnotations) {
    annotationCountsByPage[a.page_number] =
      (annotationCountsByPage[a.page_number] ?? 0) + 1;
  }

  // ── Helper: get annotations for specific page ──
  const getPageAnnotations = (page: number) =>
    realAnnotations.filter((a) => a.page_number === page);

  // ── Mutation: add annotation ──
  const addAnnotation = useMutation({
    mutationFn: async (input: {
      bookId: string;
      pageNumber: number;
      noteText: string;
      highlightText?: string;
      highlightRects?: HighlightRect[];
      color?: string;
    }) => {
      const { data, error } = await supabase
        .from("pdf_annotations" as any)
        .insert({
          book_id: input.bookId,
          page_number: input.pageNumber,
          note_text: input.noteText,
          highlight_text: input.highlightText ?? null,
          highlight_rects: input.highlightRects ?? null,
          color: input.color ?? "#FFEB3B",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PDFAnnotation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("האנוטציה נשמרה");
    },
    onError: () => toast.error("שמירת אנוטציה נכשלה"),
  });

  // ── Mutation: update annotation ──
  const updateAnnotation = useMutation({
    mutationFn: async (input: {
      id: string;
      noteText?: string;
      color?: string;
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.noteText !== undefined) updates.note_text = input.noteText;
      if (input.color !== undefined) updates.color = input.color;

      const { error } = await supabase
        .from("pdf_annotations" as any)
        .update(updates as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("האנוטציה עודכנה");
    },
    onError: () => toast.error("עדכון אנוטציה נכשל"),
  });

  // ── Mutation: delete annotation ──
  const deleteAnnotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pdf_annotations" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("האנוטציה נמחקה");
    },
    onError: () => toast.error("מחיקת אנוטציה נכשלה"),
  });

  // ── Mutation: add bookmark ──
  const addBookmark = useMutation({
    mutationFn: async (input: { bookId: string; pageNumber: number }) => {
      const { error } = await supabase
        .from("pdf_annotations" as any)
        .insert({
          book_id: input.bookId,
          page_number: input.pageNumber,
          note_text: "BOOKMARK",
          color: "#4CAF50",
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("סימניה נוספה");
    },
    onError: () => toast.error("הוספת סימניה נכשלה"),
  });

  // ── Mutation: delete bookmark ──
  const deleteBookmark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pdf_annotations" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("הסימניה נמחקה");
    },
    onError: () => toast.error("מחיקת סימניה נכשלה"),
  });

  return {
    annotations: realAnnotations,
    bookmarks,
    annotationCountsByPage,
    getPageAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addBookmark,
    deleteBookmark,
    isLoading: queryRest.isLoading,
    error: queryRest.error,
  };
}
