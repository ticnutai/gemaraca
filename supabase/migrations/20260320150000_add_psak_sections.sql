-- Add case_summary column to psakei_din for quick display
ALTER TABLE public.psakei_din
  ADD COLUMN IF NOT EXISTS case_summary TEXT;

-- Create psak_sections table for structured content extraction
CREATE TABLE IF NOT EXISTS public.psak_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psak_din_id UUID NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,   -- 'facts','plaintiff-claims','defendant-claims','ruling','decision','summary','discussion','reasoning','conclusion','law-sources','chapters','general'
  section_title TEXT NOT NULL,  -- original Hebrew title as found in document
  section_content TEXT NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_psak_sections_psak_din_id ON public.psak_sections(psak_din_id);
CREATE INDEX IF NOT EXISTS idx_psak_sections_type ON public.psak_sections(section_type);

-- RLS
ALTER TABLE public.psak_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psak_sections_select" ON public.psak_sections
  FOR SELECT USING (true);

CREATE POLICY "psak_sections_insert" ON public.psak_sections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "psak_sections_delete" ON public.psak_sections
  FOR DELETE USING (true);
