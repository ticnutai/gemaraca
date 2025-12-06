-- Create table for text annotations (word/phrase formatting)
CREATE TABLE public.text_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'gemara', 'modern_examples', 'commentary'
  source_id TEXT NOT NULL, -- sugya_id or page reference
  start_offset INTEGER NOT NULL, -- character position start
  end_offset INTEGER NOT NULL, -- character position end
  original_text TEXT NOT NULL, -- the original text being annotated
  styles JSONB NOT NULL DEFAULT '{}', -- {fontSize, fontFamily, color, backgroundColor, isBold, isItalic}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate annotations on same text range
CREATE UNIQUE INDEX idx_text_annotations_unique ON public.text_annotations(source_type, source_id, start_offset, end_offset);

-- Create index for faster lookups
CREATE INDEX idx_text_annotations_source ON public.text_annotations(source_type, source_id);

-- Enable Row Level Security
ALTER TABLE public.text_annotations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required)
CREATE POLICY "Anyone can view text annotations"
ON public.text_annotations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert text annotations"
ON public.text_annotations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update text annotations"
ON public.text_annotations
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete text annotations"
ON public.text_annotations
FOR DELETE
USING (true);