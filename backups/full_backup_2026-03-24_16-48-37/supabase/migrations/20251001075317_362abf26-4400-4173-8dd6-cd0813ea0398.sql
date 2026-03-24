-- Add more sample FAQ items with varied content
INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'מהו המקרה העובדתי שבו עסק בית המשפט?',
  'בית המשפט דן במקרה של מחלוקת בין שני צדדים על בעלות נכס משותף, כאשר כל צד טען לבעלות בלעדית על הנכס ללא הוכחות מספיקות.',
  4
FROM public.psakei_din pd
LIMIT 1;

INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'האם יש תקדים דומה לפסק דין זה?',
  'פסק דין זה מצטרף לשורה של פסקי דין דומים שעוסקים במחלוקות בעלות במקרקעין ונדל"ן, וממשיך את הקו הפסיקתי המבוסס על עקרונות הגמרא.',
  5
FROM public.psakei_din pd
LIMIT 1;

INSERT INTO public.faq_items (psak_din_id, question, answer, order_index)
SELECT 
  pd.id,
  'מה המשמעות המעשית של פסק הדין?',
  'פסק הדין קובע שבמקרים של מחלוקת בעלות, כאשר אין ראיות מוצקות, יש לחלק את הנכס בצורה שווה או לפי יחס האחיזה של הצדדים.',
  6
FROM public.psakei_din pd
LIMIT 1;