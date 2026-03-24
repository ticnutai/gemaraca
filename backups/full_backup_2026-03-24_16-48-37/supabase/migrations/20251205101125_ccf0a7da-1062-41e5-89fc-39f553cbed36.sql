-- Drop the global unique constraint on daf_number
ALTER TABLE public.gemara_pages DROP CONSTRAINT IF EXISTS gemara_pages_daf_number_key;

-- Add a masechet column to properly identify pages
ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS masechet TEXT;

-- Update existing rows to extract masechet from sefaria_ref
UPDATE public.gemara_pages 
SET masechet = SPLIT_PART(sefaria_ref, '.', 1)
WHERE masechet IS NULL;

-- Make masechet NOT NULL with a default
ALTER TABLE public.gemara_pages ALTER COLUMN masechet SET DEFAULT 'Bava_Batra';
ALTER TABLE public.gemara_pages ALTER COLUMN masechet SET NOT NULL;

-- Create a composite unique constraint on masechet + daf_number
ALTER TABLE public.gemara_pages ADD CONSTRAINT gemara_pages_masechet_daf_unique UNIQUE (masechet, daf_number);

-- Also update sugya_id unique constraint to allow different masechtot
ALTER TABLE public.gemara_pages DROP CONSTRAINT IF EXISTS gemara_pages_sugya_id_key;