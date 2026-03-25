-- Add category column to psakei_din for folder-based classification
ALTER TABLE public.psakei_din ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_psakei_din_category ON public.psakei_din(category);
