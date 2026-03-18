
CREATE TABLE public.user_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  prompt_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt templates"
  ON public.user_prompt_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prompt templates"
  ON public.user_prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompt templates"
  ON public.user_prompt_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompt templates"
  ON public.user_prompt_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_prompt_templates_updated_at
  BEFORE UPDATE ON public.user_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
