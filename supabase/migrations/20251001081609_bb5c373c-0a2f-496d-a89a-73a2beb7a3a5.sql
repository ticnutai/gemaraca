-- Delete sample data with example.com URLs
-- First delete the links
DELETE FROM sugya_psak_links 
WHERE psak_din_id IN (
  SELECT id FROM psakei_din WHERE source_url LIKE '%example.com%'
);

-- Then delete the sample psakei din
DELETE FROM psakei_din WHERE source_url LIKE '%example.com%';