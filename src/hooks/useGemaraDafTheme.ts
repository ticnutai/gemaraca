import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DafThemeId = 'vilna' | 'modern' | 'minimal' | 'night' | 'parchment';

const STORAGE_KEY = 'gemara-daf-theme';
const VALID: DafThemeId[] = ['vilna', 'modern', 'minimal', 'night', 'parchment'];

function readLocal(): DafThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID.includes(v as DafThemeId)) return v as DafThemeId;
  } catch {}
  return 'vilna';
}

/**
 * Hybrid local + cloud sync for Gemara daf theme preference.
 * Same pattern as useSugyaViewMode.
 */
export function useGemaraDafTheme() {
  const [theme, setThemeState] = useState<DafThemeId>(readLocal);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('gemara_daf_theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const cloudVal = (data as any)?.gemara_daf_theme as DafThemeId | null | undefined;
      if (cloudVal && VALID.includes(cloudVal)) {
        setThemeState(cloudVal);
        try { localStorage.setItem(STORAGE_KEY, cloudVal); } catch {}
      } else {
        const local = readLocal();
        await supabase
          .from('user_preferences')
          .upsert(
            { user_id: userId, gemara_daf_theme: local, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const setTheme = useCallback((next: DafThemeId) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    if (userId) {
      supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, gemara_daf_theme: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (!error) {
            setSavedFlash(true);
            if (flashTimer.current) window.clearTimeout(flashTimer.current);
            flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1500);
          }
        });
    }
  }, [userId]);

  return { theme, setTheme, savedFlash };
}