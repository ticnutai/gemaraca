
-- Create function_logs table for monitoring edge function calls
CREATE TABLE public.function_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  status_code integer,
  duration_ms integer,
  request_body jsonb DEFAULT '{}'::jsonb,
  response_summary text,
  error_message text,
  user_id uuid,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_function_logs_function_name ON public.function_logs(function_name);
CREATE INDEX idx_function_logs_created_at ON public.function_logs(created_at DESC);
CREATE INDEX idx_function_logs_status ON public.function_logs(status);

-- Enable RLS
ALTER TABLE public.function_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Only admins can view function logs"
ON public.function_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role / edge functions to insert logs (via service role key)
CREATE POLICY "Allow insert function logs"
ON public.function_logs FOR INSERT
WITH CHECK (true);

-- Admins can delete logs
CREATE POLICY "Only admins can delete function logs"
ON public.function_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.function_logs;
