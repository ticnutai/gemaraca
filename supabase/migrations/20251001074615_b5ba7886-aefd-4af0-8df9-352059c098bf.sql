-- Create table for storing real psak din (court rulings)
CREATE TABLE public.psakei_din (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  court TEXT NOT NULL,
  year INTEGER NOT NULL,
  case_number TEXT,
  summary TEXT NOT NULL,
  full_text TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for linking psakei din to sugyot
CREATE TABLE public.sugya_psak_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sugya_id TEXT NOT NULL,
  psak_din_id UUID NOT NULL REFERENCES public.psakei_din(id) ON DELETE CASCADE,
  connection_explanation TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 5 CHECK (relevance_score >= 1 AND relevance_score <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sugya_id, psak_din_id)
);

-- Enable Row Level Security
ALTER TABLE public.psakei_din ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugya_psak_links ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (anyone can view)
CREATE POLICY "Anyone can view psakei din"
ON public.psakei_din
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view sugya-psak links"
ON public.sugya_psak_links
FOR SELECT
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_sugya_psak_links_sugya_id ON public.sugya_psak_links(sugya_id);
CREATE INDEX idx_sugya_psak_links_psak_din_id ON public.sugya_psak_links(psak_din_id);
CREATE INDEX idx_psakei_din_year ON public.psakei_din(year);
CREATE INDEX idx_psakei_din_tags ON public.psakei_din USING GIN(tags);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_psakei_din_updated_at
BEFORE UPDATE ON public.psakei_din
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data to demonstrate the system
INSERT INTO public.psakei_din (title, court, year, case_number, summary, tags, source_url) VALUES
('מחלוקת על בעלות רכב משפחתי', 'בית משפט לתביעות קטנות - תל אביב', 2021, 'ת"ק 45678/21', 
 'בני זוג לשעבר התדיינו על בעלות רכב שנרכש במהלך הנישואין. בית המשפט חילק את שווי הרכב בהתאם לעקרון "שנים אוחזין" מהגמרא.',
 ARRAY['בעלות', 'רכוש', 'גירושין'], 'https://example.com/case/45678-21'),

('מציאת כסף במכונת כביסה ציבורית', 'בית דין צדק - בני ברק', 2022, 'פס"ד 156/תשפ"ב',
 'שאלה הלכתית: האם מותר לשמור כסף שנמצא במכונת כביסה. נפסק שאם אין דרך לזהות הבעלים - מותר לפי דיני מציאה.',
 ARRAY['מציאה', 'אבידה', 'הלכה'], 'https://example.com/psak/156-5782'),

('פסיקה על מציאת טלפון סלולרי', 'בית משפט השלום - תל אביב', 2020, 'ת"פ 2345/20',
 'נפסק שמוצא טלפון חייב להשקיע מאמץ סביר למצוא בעלים (להפעיל ולבדוק אנשי קשר). יישום מודרני של חובת השבת אבידה.',
 ARRAY['אבידה', 'טכנולוגיה', 'השבה'], 'https://example.com/case/2345-20'),

('חברת שמירה שאיבדה פיקדון', 'בית המשפט המחוזי - תל אביב', 2023, 'ת"א 1234/23',
 'חברת שמירה (שומר שכר) חויבה בפיצוי מלא על אובדן פיקדון גם כשטענה לגניבה, בהתאם לדיני שומרים בגמרא.',
 ARRAY['פיקדון', 'שומרים', 'אחריות'], 'https://example.com/case/1234-23');

-- Link the sample psakei din to relevant sugyot
INSERT INTO public.sugya_psak_links (sugya_id, psak_din_id, connection_explanation, relevance_score) VALUES
('shnayim-ochazin', (SELECT id FROM public.psakei_din WHERE case_number = 'ת"ק 45678/21'), 
 'העיקרון הגמראי של חלוקת הנכס במחלוקת יושם במקרה מודרני של רכב משפחתי', 9),

('eilu-metziot', (SELECT id FROM public.psakei_din WHERE case_number = 'פס"ד 156/תשפ"ב'),
 'יישום עיקרון "אין בה סימן" - כשאי אפשר לזהות הבעלים במציאה מודרנית', 8),

('hashavat-aveida', (SELECT id FROM public.psakei_din WHERE case_number = 'ת"פ 2345/20'),
 'חובת השבה מודרנית - חיפוש פעיל אחר הבעלים באמצעים טכנולוגיים', 9),

('hamaafil', (SELECT id FROM public.psakei_din WHERE case_number = 'ת"א 1234/23'),
 'אחריות מוגברת של שומר שכר לפי הדין הגמראי', 10);