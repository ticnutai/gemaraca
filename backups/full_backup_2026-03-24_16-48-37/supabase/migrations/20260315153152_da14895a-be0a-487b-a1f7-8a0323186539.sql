
CREATE TABLE public.shas_download_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  masechet text NOT NULL,
  hebrew_name text NOT NULL,
  max_daf integer NOT NULL,
  current_daf integer NOT NULL DEFAULT 2,
  loaded_pages integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(masechet)
);

ALTER TABLE public.shas_download_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view download progress"
  ON public.shas_download_progress FOR SELECT
  TO public USING (true);

CREATE POLICY "Anyone can insert download progress"
  ON public.shas_download_progress FOR INSERT
  TO public WITH CHECK (true);

CREATE POLICY "Anyone can update download progress"
  ON public.shas_download_progress FOR UPDATE
  TO public USING (true);

CREATE POLICY "Anyone can delete download progress"
  ON public.shas_download_progress FOR DELETE
  TO public USING (true);

CREATE TRIGGER update_shas_download_progress_updated_at
  BEFORE UPDATE ON public.shas_download_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
