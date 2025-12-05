-- Add content_hash column for content-based duplicate detection
ALTER TABLE public.psakei_din 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_psakei_din_content_hash ON public.psakei_din(content_hash);