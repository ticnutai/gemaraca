-- Create storage bucket for Psak Din files if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'psakei-din-files', 
  'psakei-din-files', 
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/rtf', 'application/zip', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- Create storage policies for the bucket
DROP POLICY IF EXISTS "Allow public read for psakei-din-files" ON storage.objects;
CREATE POLICY "Allow public read for psakei-din-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'psakei-din-files');

DROP POLICY IF EXISTS "Allow public upload for psakei-din-files" ON storage.objects;
CREATE POLICY "Allow public upload for psakei-din-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'psakei-din-files');

DROP POLICY IF EXISTS "Allow public delete for psakei-din-files" ON storage.objects;
CREATE POLICY "Allow public delete for psakei-din-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'psakei-din-files');