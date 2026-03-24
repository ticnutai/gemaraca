-- Cleanup: fix titles with folder path prefixes  
-- Fix "sample psakim/" prefix
UPDATE psakei_din SET title = regexp_replace(title, '^sample[ _-]?psakim/', '', 'i')
WHERE title ~* '^sample[ _-]?psakim/';

-- Fix "psakim downloads py/" prefix
UPDATE psakei_din SET title = regexp_replace(title, '^psakim[ _-]?downloads?[ _-]?py/', '', 'i')
WHERE title ~* '^psakim[ _-]?downloads?[ _-]?py/';

-- Fix "downloaded psakim/" prefix
UPDATE psakei_din SET title = regexp_replace(title, '^downloaded[ _-]?psakim/', '', 'i')
WHERE title ~* '^downloaded[ _-]?psakim/';

-- Fix "all psakim/" prefix
UPDATE psakei_din SET title = regexp_replace(title, '^all[ _-]?psakim/', '', 'i')
WHERE title ~* '^all[ _-]?psakim/';

-- Remove trailing file extensions from titles
UPDATE psakei_din SET title = regexp_replace(title, '\.(html?|pdf|docx?|txt|rtf)$', '', 'i')
WHERE title ~* '\.(html?|pdf|docx?|txt|rtf)$';

-- Trim whitespace from titles
UPDATE psakei_din SET title = trim(title)
WHERE title != trim(title);

-- Fix summaries with folder paths
UPDATE psakei_din SET summary = regexp_replace(
  summary,
  'פסק דין שהועלה מהקובץ:\s*(sample[ _-]?psakim/|psakim[ _-]?downloads?[ _-]?py/|downloaded[ _-]?psakim/)',
  'פסק דין שהועלה מהקובץ: ',
  'i'
)
WHERE summary ~* 'שהועלה מהקובץ.*/(.*\.)';

-- Remove .html/.pdf extensions from summaries
UPDATE psakei_din SET summary = regexp_replace(summary, '\.(html?|pdf|docx?|txt|rtf)', '', 'ig')
WHERE summary LIKE '%שהועלה מהקובץ%' AND summary ~* '\.(html?|pdf|docx?|txt|rtf)';
