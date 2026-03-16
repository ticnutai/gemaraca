
CREATE TABLE public.page_typography_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_key text NOT NULL,
  font_family text NOT NULL DEFAULT 'Arial',
  font_size integer NOT NULL DEFAULT 16,
  line_height numeric NOT NULL DEFAULT 1.6,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

ALTER TABLE public.page_typography_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own typography settings"
ON public.page_typography_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own typography settings"
ON public.page_typography_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own typography settings"
ON public.page_typography_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own typography settings"
ON public.page_typography_settings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
