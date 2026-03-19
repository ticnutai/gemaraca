
CREATE TABLE public.gemara_edit_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sugya_id TEXT NOT NULL,
  view_mode TEXT NOT NULL DEFAULT 'text',
  edited_html TEXT NOT NULL DEFAULT '',
  text_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sugya_id, view_mode)
);

ALTER TABLE public.gemara_edit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own edit snapshots"
ON public.gemara_edit_snapshots FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own edit snapshots"
ON public.gemara_edit_snapshots FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own edit snapshots"
ON public.gemara_edit_snapshots FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own edit snapshots"
ON public.gemara_edit_snapshots FOR DELETE TO authenticated
USING (auth.uid() = user_id);
