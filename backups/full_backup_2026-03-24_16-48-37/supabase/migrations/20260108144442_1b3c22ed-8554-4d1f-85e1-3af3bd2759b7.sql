-- Update storage bucket to allow HTML files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/pdf', 
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
  'text/plain', 
  'application/rtf', 
  'application/zip', 
  'application/x-zip-compressed',
  'text/html'
]
WHERE id = 'psakei-din-files';