-- ═══════════════════════════════════════════════════════════
-- Migration: Create storage bucket and tracking table for
-- Shas PDF pages (scanned daf images from HebrewBooks)
-- ═══════════════════════════════════════════════════════════

-- 1) Create storage bucket for Shas PDF pages
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('shas-pdf-pages', 'shas-pdf-pages', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage policies: public read, authenticated upload/update/delete
CREATE POLICY "Anyone can read shas PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shas-pdf-pages');

CREATE POLICY "Authenticated users can upload shas PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shas-pdf-pages');

CREATE POLICY "Authenticated users can update shas PDFs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'shas-pdf-pages');

CREATE POLICY "Authenticated users can delete shas PDFs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'shas-pdf-pages');

-- 3) Tracking table for uploaded PDF pages
CREATE TABLE IF NOT EXISTS shas_pdf_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  masechet TEXT NOT NULL,            -- Sefaria English name, e.g. "Berakhot"
  hebrew_name TEXT NOT NULL,         -- e.g. "ברכות"
  seder TEXT NOT NULL,               -- e.g. "זרעים"
  daf_number INTEGER NOT NULL,       -- e.g. 2
  amud TEXT NOT NULL CHECK (amud IN ('a', 'b')),  -- a or b
  storage_path TEXT NOT NULL,        -- path in bucket, e.g. "Berakhot/2a.pdf"
  file_size INTEGER,                 -- bytes
  pdf_url TEXT GENERATED ALWAYS AS (
    'https://jaotdqumpcfhcbkgtfib.supabase.co/storage/v1/object/public/shas-pdf-pages/' || storage_path
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(masechet, daf_number, amud)
);

-- 4) Enable RLS with public read
ALTER TABLE shas_pdf_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shas_pdf_pages"
  ON shas_pdf_pages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shas_pdf_pages"
  ON shas_pdf_pages FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update shas_pdf_pages"
  ON shas_pdf_pages FOR UPDATE USING (true);

-- 5) Index for fast lookups
CREATE INDEX idx_shas_pdf_masechet_daf ON shas_pdf_pages (masechet, daf_number, amud);
CREATE INDEX idx_shas_pdf_seder ON shas_pdf_pages (seder);
