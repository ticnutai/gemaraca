-- Add corrected_normalized column for user corrections to detected references
ALTER TABLE public.talmud_references
  ADD COLUMN IF NOT EXISTS corrected_normalized text DEFAULT NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_talmud_refs_source ON public.talmud_references(source);

-- Composite index for approved-only queries
CREATE INDEX IF NOT EXISTS idx_talmud_refs_validated ON public.talmud_references(validation_status, source);
