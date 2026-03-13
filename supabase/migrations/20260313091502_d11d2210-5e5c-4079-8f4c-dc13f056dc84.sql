
CREATE TABLE public.migration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sql_content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  executed_by uuid REFERENCES auth.users(id),
  rows_affected integer DEFAULT 0,
  execution_time_ms integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view migrations"
  ON public.migration_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert migrations"
  ON public.migration_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update migrations"
  ON public.migration_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete migrations"
  ON public.migration_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
