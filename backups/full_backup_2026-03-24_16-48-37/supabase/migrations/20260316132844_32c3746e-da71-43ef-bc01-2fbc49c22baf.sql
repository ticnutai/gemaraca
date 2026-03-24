
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('user-books', 'user-books', true, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own books"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-books');

CREATE POLICY "Public read access for user books"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-books');

CREATE POLICY "Users can delete their own books"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-books');
