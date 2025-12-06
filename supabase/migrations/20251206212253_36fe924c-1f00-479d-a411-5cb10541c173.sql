-- Add unique constraint for text annotations upsert
ALTER TABLE public.text_annotations 
ADD CONSTRAINT text_annotations_source_offset_unique 
UNIQUE (source_type, source_id, start_offset, end_offset);