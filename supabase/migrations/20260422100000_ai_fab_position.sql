-- Add AI tutor floating button (FAB) position to user_preferences
-- Persists the AI chat FAB position across devices and sessions
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS ai_fab_position jsonb;

COMMENT ON COLUMN public.user_preferences.ai_fab_position IS
  'Stores {x, y} pixel coordinates of the AI tutor floating action button. Null = use default bottom-right.';
