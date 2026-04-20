ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS sugya_view_mode text;

UPDATE public.user_preferences
SET sugya_view_mode = 'sefaria'
WHERE sugya_view_mode IS NULL
   OR sugya_view_mode NOT IN ('text', 'sefaria', 'edaf-image', 'edaf-site', 'cloud');

ALTER TABLE public.user_preferences
ALTER COLUMN sugya_view_mode SET DEFAULT 'sefaria';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_sugya_view_mode_check'
  ) THEN
    ALTER TABLE public.user_preferences
    ADD CONSTRAINT user_preferences_sugya_view_mode_check
    CHECK (sugya_view_mode IN ('text', 'sefaria', 'edaf-image', 'edaf-site', 'cloud'));
  END IF;
END $$;