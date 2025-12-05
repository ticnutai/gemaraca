-- Create upload_sessions table for realtime progress tracking across devices
CREATE TABLE public.upload_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  successful_files INTEGER NOT NULL DEFAULT 0,
  failed_files INTEGER NOT NULL DEFAULT 0,
  skipped_files INTEGER NOT NULL DEFAULT 0,
  current_file TEXT,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public access for cross-device sync (no auth required for this feature)
CREATE POLICY "Anyone can view upload sessions" 
ON public.upload_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert upload sessions" 
ON public.upload_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update upload sessions" 
ON public.upload_sessions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete upload sessions" 
ON public.upload_sessions 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_upload_sessions_updated_at
BEFORE UPDATE ON public.upload_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.upload_sessions;