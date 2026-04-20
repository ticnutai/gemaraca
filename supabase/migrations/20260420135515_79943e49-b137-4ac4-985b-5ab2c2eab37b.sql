ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS gemara_daf_theme text DEFAULT 'vilna';