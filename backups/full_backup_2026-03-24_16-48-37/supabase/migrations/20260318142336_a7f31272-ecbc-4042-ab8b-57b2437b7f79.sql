
-- Create table for pinned & favorite items (per user, synced to cloud)
CREATE TABLE public.user_pinned_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'tractate', 'daf', 'ref'
  item_id TEXT NOT NULL, -- e.g. 'ברכות', 'ברכות-2'
  label TEXT NOT NULL,
  pin_type TEXT NOT NULL DEFAULT 'pin', -- 'pin' or 'favorite'
  tractate TEXT,
  daf TEXT,
  amud TEXT,
  ref_count INTEGER DEFAULT 0,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id, item_type, pin_type)
);

-- Enable RLS
ALTER TABLE public.user_pinned_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pinned items
CREATE POLICY "Users can view their own pinned items"
  ON public.user_pinned_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pinned items"
  ON public.user_pinned_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pinned items"
  ON public.user_pinned_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pinned items"
  ON public.user_pinned_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
