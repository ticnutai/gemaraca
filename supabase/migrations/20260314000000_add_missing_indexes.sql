-- Add missing indexes for psakei_din search performance
CREATE INDEX IF NOT EXISTS idx_psakei_din_title ON public.psakei_din(title);
CREATE INDEX IF NOT EXISTS idx_psakei_din_court ON public.psakei_din(court);

-- Composite index for common filtering (court + year)
CREATE INDEX IF NOT EXISTS idx_psakei_din_court_year ON public.psakei_din(court, year);
