-- Create table for storing AI-generated modern examples
CREATE TABLE public.modern_examples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sugya_id TEXT NOT NULL,
  masechet TEXT NOT NULL,
  daf_yomi TEXT NOT NULL,
  principle TEXT NOT NULL,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  practical_summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sugya_id)
);

-- Enable Row Level Security
ALTER TABLE public.modern_examples ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view modern examples" 
ON public.modern_examples 
FOR SELECT 
USING (true);

-- Create policy for insert access
CREATE POLICY "Anyone can insert modern examples" 
ON public.modern_examples 
FOR INSERT 
WITH CHECK (true);

-- Create policy for update access
CREATE POLICY "Anyone can update modern examples" 
ON public.modern_examples 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_modern_examples_updated_at
BEFORE UPDATE ON public.modern_examples
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();