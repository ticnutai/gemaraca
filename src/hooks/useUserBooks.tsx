import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserBook {
  id: string;
  title: string;
  file_name: string | null;
  file_url: string;
  edited_text: string | null;
  edited_text_updated_at: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserBooks() {
  const qc = useQueryClient();
  const key = ["user-books"] as const;

  const { data: books = [], ...queryRest } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserBook[];
    },
  });

  const addBook = useMutation({
    mutationFn: async (input: {
      title: string;
      fileName?: string;
      fileUrl: string;
    }) => {
      const { data, error } = await supabase
        .from("user_books" as any)
        .insert({
          title: input.title,
          file_name: input.fileName ?? null,
          file_url: input.fileUrl,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as UserBook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("המסמך נוסף");
    },
    onError: () => toast.error("הוספת מסמך נכשלה"),
  });

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_books" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("המסמך נמחק");
    },
    onError: () => toast.error("מחיקת מסמך נכשלה"),
  });

  const updateBookEditedText = useMutation({
    mutationFn: async (input: { id: string; editedText: string | null }) => {
      const { data, error } = await supabase
        .from("user_books" as any)
        .update({
          edited_text: input.editedText,
          edited_text_updated_at: input.editedText ? new Date().toISOString() : null,
        } as any)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as UserBook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error("שמירת עריכת הטקסט למסד הנתונים נכשלה"),
  });

  return { books, addBook, deleteBook, updateBookEditedText, ...queryRest };
}
