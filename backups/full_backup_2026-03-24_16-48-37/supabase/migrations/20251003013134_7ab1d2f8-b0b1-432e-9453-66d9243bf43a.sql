-- Create table for gemara pages
CREATE TABLE public.gemara_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daf_number INTEGER NOT NULL UNIQUE,
  sugya_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  daf_yomi TEXT NOT NULL,
  sefaria_ref TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gemara_pages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view pages
CREATE POLICY "Anyone can view gemara pages"
ON public.gemara_pages
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_gemara_pages_updated_at
BEFORE UPDATE ON public.gemara_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing pages
INSERT INTO public.gemara_pages (daf_number, sugya_id, title, daf_yomi, sefaria_ref) VALUES
  (2, 'shnayim-ochazin', 'שנים אוחזין', 'ב ע״א', 'Bava_Batra.2a'),
  (21, 'eilu-metziot', 'אלו מציאות', 'כא ע״א', 'Bava_Batra.21a'),
  (27, 'hashavat-aveida', 'השבת אבידה', 'כז ע״א', 'Bava_Batra.27a'),
  (28, 'geneiva-aveida', 'גניבה אבידה', 'כח ע״א', 'Bava_Batra.28a'),
  (18, 'hamotzei-shtarot', 'המוציא שטרות', 'יח ע״א', 'Bava_Batra.18a'),
  (29, 'hamaafil', 'המעפיל', 'כט ע״א', 'Bava_Batra.29a');