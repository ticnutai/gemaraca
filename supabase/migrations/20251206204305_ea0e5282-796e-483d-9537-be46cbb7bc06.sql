-- Create table for storing smart index analysis results
CREATE TABLE public.smart_index_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psak_din_id UUID NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  masechtot TEXT[] NOT NULL DEFAULT '{}'::text[],
  books TEXT[] NOT NULL DEFAULT '{}'::text[],
  word_count INTEGER NOT NULL DEFAULT 0,
  has_full_text BOOLEAN NOT NULL DEFAULT false,
  analysis_method TEXT NOT NULL DEFAULT 'pattern_matching',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(psak_din_id)
);

-- Enable RLS
ALTER TABLE public.smart_index_results ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view smart index results" 
ON public.smart_index_results 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert smart index results" 
ON public.smart_index_results 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update smart index results" 
ON public.smart_index_results 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete smart index results" 
ON public.smart_index_results 
FOR DELETE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_smart_index_masechtot ON public.smart_index_results USING GIN(masechtot);
CREATE INDEX idx_smart_index_books ON public.smart_index_results USING GIN(books);

-- Create table for pattern-based sugya links (without AI)
CREATE TABLE public.pattern_sugya_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psak_din_id UUID NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  sugya_id TEXT NOT NULL,
  masechet TEXT NOT NULL,
  daf TEXT,
  amud TEXT,
  source_text TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pattern_sugya_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view pattern sugya links" 
ON public.pattern_sugya_links 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert pattern sugya links" 
ON public.pattern_sugya_links 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete pattern sugya links" 
ON public.pattern_sugya_links 
FOR DELETE 
USING (true);

-- Create indexes
CREATE INDEX idx_pattern_links_psak ON public.pattern_sugya_links(psak_din_id);
CREATE INDEX idx_pattern_links_sugya ON public.pattern_sugya_links(sugya_id);
CREATE INDEX idx_pattern_links_masechet ON public.pattern_sugya_links(masechet);

-- Add trigger for updated_at
CREATE TRIGGER update_smart_index_results_updated_at
BEFORE UPDATE ON public.smart_index_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();