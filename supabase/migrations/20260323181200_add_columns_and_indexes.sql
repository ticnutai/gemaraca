ALTER TABLE public.user_books ADD COLUMN IF NOT EXISTS edited_text TEXT;
ALTER TABLE public.user_books ADD COLUMN IF NOT EXISTS edited_text_updated_at TIMESTAMPTZ;
ALTER TABLE public.talmud_references ADD COLUMN IF NOT EXISTS corrected_normalized text DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_talmud_refs_source ON public.talmud_references(source);
CREATE INDEX IF NOT EXISTS idx_talmud_refs_validated ON public.talmud_references(validation_status, source);
ALTER TABLE public.psakei_din ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_psakei_din_fts ON public.psakei_din USING gin(search_vector);
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
