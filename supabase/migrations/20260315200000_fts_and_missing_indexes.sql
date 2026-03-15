-- Full-Text Search + Missing Indexes Migration
-- Adds tsvector column for fast Hebrew text search on psakei_din
-- Adds missing indexes on talmud_references and sugya_psak_links

-- 1. Full-text search on psakei_din
ALTER TABLE public.psakei_din
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate search_vector from existing data
UPDATE public.psakei_din
SET search_vector = to_tsvector('simple',
  coalesce(title, '') || ' ' ||
  coalesce(summary, '') || ' ' ||
  coalesce(court, '') || ' ' ||
  coalesce(full_text, '')
)
WHERE search_vector IS NULL;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_psakei_din_fts
  ON public.psakei_din USING gin(search_vector);

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION psakei_din_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    coalesce(NEW.court, '') || ' ' ||
    coalesce(NEW.full_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_psakei_din_search_vector ON public.psakei_din;
CREATE TRIGGER trg_psakei_din_search_vector
  BEFORE INSERT OR UPDATE ON public.psakei_din
  FOR EACH ROW
  EXECUTE FUNCTION psakei_din_search_vector_update();

-- 2. Missing indexes on talmud_references
CREATE INDEX IF NOT EXISTS idx_talmud_refs_tractate_daf
  ON public.talmud_references(tractate, daf);

CREATE INDEX IF NOT EXISTS idx_talmud_refs_psak_din_id
  ON public.talmud_references(psak_din_id);

CREATE INDEX IF NOT EXISTS idx_talmud_refs_user_id
  ON public.talmud_references(user_id);

-- 3. Missing index on sugya_psak_links
CREATE INDEX IF NOT EXISTS idx_sugya_psak_links_sugya_id
  ON public.sugya_psak_links(sugya_id);

CREATE INDEX IF NOT EXISTS idx_sugya_psak_links_psak_din_id
  ON public.sugya_psak_links(psak_din_id);

-- 4. Index on psakei_din for user queries
CREATE INDEX IF NOT EXISTS idx_psakei_din_user_created
  ON public.psakei_din(user_id, created_at DESC);
