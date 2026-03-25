
-- Create table to persist folder/category names independently
CREATE TABLE IF NOT EXISTS public.folder_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.folder_categories ENABLE ROW LEVEL SECURITY;

-- Public read access (folders are shared)
CREATE POLICY "Anyone can view folder categories"
  ON public.folder_categories FOR SELECT
  TO public
  USING (true);

-- Authenticated users can manage folders
CREATE POLICY "Authenticated users can insert folder categories"
  ON public.folder_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update folder categories"
  ON public.folder_categories FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete folder categories"
  ON public.folder_categories FOR DELETE
  TO authenticated
  USING (true);

-- Seed existing categories from psakei_din
INSERT INTO public.folder_categories (name)
SELECT DISTINCT category FROM public.psakei_din
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;
