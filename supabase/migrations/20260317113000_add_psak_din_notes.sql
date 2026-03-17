CREATE TABLE IF NOT EXISTS public.psak_din_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psak_din_id UUID NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psak_din_notes_psak_din_id
  ON public.psak_din_notes(psak_din_id);

ALTER TABLE public.psak_din_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psak_din_notes_select"
  ON public.psak_din_notes
  FOR SELECT
  USING (true);

CREATE POLICY "psak_din_notes_insert"
  ON public.psak_din_notes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "psak_din_notes_update"
  ON public.psak_din_notes
  FOR UPDATE
  USING (true);

CREATE POLICY "psak_din_notes_delete"
  ON public.psak_din_notes
  FOR DELETE
  USING (true);
