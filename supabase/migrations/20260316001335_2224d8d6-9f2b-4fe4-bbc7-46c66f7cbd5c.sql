
-- Drop the constraint (not index) that prevents storing both amudim per daf
ALTER TABLE public.gemara_pages DROP CONSTRAINT IF EXISTS gemara_pages_masechet_daf_unique;

-- Create a proper unique constraint on sugya_id
CREATE UNIQUE INDEX IF NOT EXISTS gemara_pages_sugya_id_unique ON public.gemara_pages USING btree (sugya_id);
