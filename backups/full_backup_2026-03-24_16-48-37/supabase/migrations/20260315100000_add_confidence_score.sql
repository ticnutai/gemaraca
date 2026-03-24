-- Add confidence scoring fields to talmud_references
ALTER TABLE public.talmud_references
  ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS confidence_factors jsonb DEFAULT '{}';

-- Index for score-based queries and sorting
CREATE INDEX IF NOT EXISTS idx_talmud_refs_score ON public.talmud_references(confidence_score DESC);
