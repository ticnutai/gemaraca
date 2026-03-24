import { supabase } from '@/integrations/supabase/client';

const RECENT_PSAKIM_KEY = 'recently_viewed_psakim';

export function trackRecentPsak(id: string) {
  try {
    const recent: string[] = JSON.parse(localStorage.getItem(RECENT_PSAKIM_KEY) || '[]');
    const updated = [id, ...recent.filter(r => r !== id)].slice(0, 20);
    localStorage.setItem(RECENT_PSAKIM_KEY, JSON.stringify(updated));

    // Async cloud sync (fire-and-forget)
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('user_preferences')
          .upsert(
            { user_id: data.user.id, recently_viewed_psakim: updated, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
          .then(() => {});
      }
    });
  } catch { /* ignore */ }
}

