-- Create storage bucket for psak din files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('psakei-din-files', 'psakei-din-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to the bucket (for now - can add auth later)
CREATE POLICY "Anyone can upload psak din files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'psakei-din-files');

-- Allow public read access
CREATE POLICY "Anyone can view psak din files"
ON storage.objects FOR SELECT
USING (bucket_id = 'psakei-din-files');

-- Allow insert to psakei_din table
CREATE POLICY "Allow insert to psakei din"
ON public.psakei_din FOR INSERT
WITH CHECK (true);

-- Allow insert to sugya_psak_links table  
CREATE POLICY "Allow insert to sugya psak links"
ON public.sugya_psak_links FOR INSERT
WITH CHECK (true);