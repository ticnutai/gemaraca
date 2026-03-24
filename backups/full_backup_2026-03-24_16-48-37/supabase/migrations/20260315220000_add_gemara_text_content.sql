-- Add text content columns to gemara_pages so we store the actual Sefaria text
-- This eliminates the need to call Sefaria API on every page view

ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS text_he JSONB DEFAULT NULL;
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS text_en JSONB DEFAULT NULL;
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS he_ref TEXT DEFAULT NULL;
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS book TEXT DEFAULT NULL;
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT NULL;
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS section_ref TEXT DEFAULT NULL;

-- Index for fast lookup by sefaria_ref (used by get-gemara-text)
CREATE INDEX IF NOT EXISTS idx_gemara_pages_sefaria_ref ON public.gemara_pages (sefaria_ref);

-- Index for fast lookup by sugya_id 
CREATE INDEX IF NOT EXISTS idx_gemara_pages_sugya_id ON public.gemara_pages (sugya_id);

-- Drop the unique constraint on (masechet, daf_number) since we now have amud-level entries
-- The sugya_id (e.g. "berakhot_2a") is the true unique identifier
ALTER TABLE public.gemara_pages DROP CONSTRAINT IF EXISTS gemara_pages_masechet_daf_unique;
ALTER TABLE public.gemara_pages ADD CONSTRAINT gemara_pages_sugya_id_unique UNIQUE (sugya_id);
