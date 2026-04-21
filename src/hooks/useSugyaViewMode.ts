import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SugyaViewMode = 'text' | 'sefaria' | 'edaf-image' | 'edaf-site' | 'cloud';

const STORAGE_KEY = 'gemara-view-preference';
const VALID_MODES: SugyaViewMode[] = ['text', 'sefaria', 'edaf-image', 'edaf-site', 'cloud'];
const DEFAULT_MODE: SugyaViewMode = 'sefaria';

const listeners = new Set<(mode: SugyaViewMode) => void>();
let currentMode: SugyaViewMode | null = null;

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  // Never block the UI: a local preference (or default) is always available immediately.
  const [isReady, setIsReady] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

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
    let cancelled = false;
    const authBootstrapFallback = window.setTimeout(() => {
      if (!cancelled) {
        // Never block UI forever on auth bootstrap.
        setIsReady(true);
      }
    }, 5000);

    withTimeout(supabase.auth.getSession(), 4000, 'auth.getSession')
      .then(({ data }) => {
        if (cancelled) return;
        const nextUserId = data.session?.user?.id || null;
        userIdRef.current = nextUserId;
        setUserId(nextUserId);
        if (!nextUserId) setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) setIsReady(true);
      })
      .finally(() => {
        window.clearTimeout(authBootstrapFallback);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextUserId = session?.user?.id || null;
      userIdRef.current = nextUserId;
      setUserId(nextUserId);
      // Never block UI on auth events. Local preference is always usable;
      // cloud sync happens in the background and broadcasts when ready.
      setIsReady(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(authBootstrapFallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  // On user login: pull cloud value (source of truth) in background. If none, push local up.
  // We do NOT toggle isReady here; the local value is shown immediately and cloud value
  // overrides it via broadcastMode if/when available.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await withTimeout(
          supabase
            .from('user_preferences')
            .select('sugya_view_mode')
            .eq('user_id', userId)
            .maybeSingle(),
          5000,
          'user_preferences.select'
        );
        if (cancelled) return;
        const cloudVal = (data as { sugya_view_mode?: SugyaViewMode } | null)?.sugya_view_mode;
        if (cloudVal && VALID_MODES.includes(cloudVal)) {
          if (cloudVal !== getCurrentMode()) broadcastMode(cloudVal);
          try { localStorage.setItem(STORAGE_KEY, cloudVal); } catch {}
        } else {
          const local = readLocal();
          await withTimeout(
            supabase
              .from('user_preferences')
              .upsert(
                { user_id: userId, sugya_view_mode: local, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
              ),
            5000,
            'user_preferences.upsert'
          );
        }
      } catch {
        // Cloud sync failures are non-fatal; local preference remains active.
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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