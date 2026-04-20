import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SugyaViewMode = 'text' | 'sefaria' | 'edaf-image' | 'edaf-site' | 'cloud';

const STORAGE_KEY = 'gemara-view-preference';
const VALID_MODES: SugyaViewMode[] = ['text', 'sefaria', 'edaf-image', 'edaf-site', 'cloud'];
const DEFAULT_MODE: SugyaViewMode = 'sefaria';

const listeners = new Set<(mode: SugyaViewMode) => void>();
let currentMode: SugyaViewMode | null = null;

function readLocal(): SugyaViewMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID_MODES.includes(v as SugyaViewMode)) return v as SugyaViewMode;
  } catch {}
  return DEFAULT_MODE;
}

function hasLocalPreference() {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function getCurrentMode(): SugyaViewMode {
  if (currentMode) return currentMode;
  currentMode = readLocal();
  return currentMode;
}

function broadcastMode(next: SugyaViewMode) {
  currentMode = next;
  listeners.forEach((listener) => listener(next));
}

/**
 * Sugya view-mode preference, hybrid local + cloud sync.
 * - Reads instantly from localStorage
 * - On mount: if logged in, fetch cloud value and overwrite local (cloud is source of truth)
 * - On change: write local immediately + fire-and-forget upsert to cloud
 * - If logged-out user changes mode, value is in local; once they log in, it syncs up
 */
export function useSugyaViewMode() {
  const [viewMode, setViewModeState] = useState<SugyaViewMode>(getCurrentMode);
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(hasLocalPreference());
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    const syncMode = (next: SugyaViewMode) => setViewModeState(next);
    listeners.add(syncMode);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readLocal();
      broadcastMode(next);
    };

    window.addEventListener('storage', handleStorage);
    setViewModeState(getCurrentMode());

    return () => {
      listeners.delete(syncMode);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const nextUserId = data.session?.user?.id || null;
      setUserId(nextUserId);
      if (!nextUserId) setIsReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextUserId = session?.user?.id || null;
      setUserId(nextUserId);
      setIsReady(!nextUserId);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // On user login: pull cloud value (source of truth). If none, push local up.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsReady(false);
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('sugya_view_mode')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        const cloudVal = (data as any)?.sugya_view_mode as SugyaViewMode | null | undefined;
        if (cloudVal && VALID_MODES.includes(cloudVal)) {
          broadcastMode(cloudVal);
          try { localStorage.setItem(STORAGE_KEY, cloudVal); } catch {}
        } else {
          const local = readLocal();
          await supabase
            .from('user_preferences')
            .upsert(
              { user_id: userId, sugya_view_mode: local, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' }
            );
          if (!cancelled) broadcastMode(local);
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const setViewMode = useCallback((mode: SugyaViewMode) => {
    broadcastMode(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}

    // Fire-and-forget cloud sync
    if (userId) {
      supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, sugya_view_mode: mode, updated_at: new Date().toISOString() },
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

  return { viewMode, setViewMode, savedFlash, isCloudSynced: !!userId, isReady };
}