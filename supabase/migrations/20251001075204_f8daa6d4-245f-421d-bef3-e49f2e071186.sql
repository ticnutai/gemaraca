-- Create FAQ table for questions and answers about psakei din
CREATE TABLE public.faq_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  psak_din_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key to psakei_din
ALTER TABLE public.faq_items
ADD CONSTRAINT faq_items_psak_din_id_fkey
FOREIGN KEY (psak_din_id)
REFERENCES public.psakei_din(id)
ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view FAQ items
CREATE POLICY "Anyone can view FAQ items"
ON public.faq_items
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_faq_items_updated_at
BEFORE UPDATE ON public.faq_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some sample FAQ data for existing psakei din
INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'מה העיקרון ההלכתי המרכזי בפסק דין זה?',
  'פסק הדין מבוסס על עיקרון שנים אוחזין - כאשר יש מחלוקת על בעלות ואין ראיות מוכחות, בית המשפט חולק את הנכס בין הצדדים.',
  1
FROM public.psakei_din pd
LIMIT 1;

INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'איך בית המשפט קבע את חלוקת הנכס?',
  'בית המשפט בחן את מידת האחיזה והשימוש של כל צד בנכס, ובהתאם לכך קבע את היחס בחלוקה.',
  2
FROM public.psakei_din pd
LIMIT 1;

INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'מה ניתן ללמוד מפסק דין זה למקרים דומים?',
  'ניתן ללמוד שבהעדר ראיות ברורות לבעלות בלעדית, בית המשפט יעדיף פתרון של חלוקה הוגנת על פני פסילת טענות.',
  3
FROM public.psakei_din pd
LIMIT 1;