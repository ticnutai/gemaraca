ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS sugya_view_mode text DEFAULT 'text';