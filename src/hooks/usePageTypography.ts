import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface TypographySettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

const DEFAULTS: TypographySettings = {
  fontFamily: "Arial",
  fontSize: 16,
  lineHeight: 1.6,
};

const CACHE_KEY = "page_typography_cache";

function getLocalCache(): Record<string, TypographySettings> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setLocalCache(pageKey: string, s: TypographySettings) {
  const cache = getLocalCache();
  cache[pageKey] = s;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function usePageTypography() {
  const location = useLocation();
  const pageKey = location.pathname + location.hash;

  const cached = getLocalCache()[pageKey];
  const [settings, setSettings] = useState<TypographySettings>(cached || DEFAULTS);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user id
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Load from cloud on mount / page change
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("page_typography_settings" as any)
      .select("font_family, font_size, line_height")
      .eq("user_id", userId)
      .eq("page_key", pageKey)
      .maybeSingle()
      .then(({ data }: { data: { font_family?: string; font_size?: number; line_height?: number } | null }) => {
        if (data) {
          const s: TypographySettings = {
            fontFamily: data.font_family,
            fontSize: data.font_size,
            lineHeight: Number(data.line_height),
          };
          setSettings(s);
          setLocalCache(pageKey, s);
        }
      });
  }, [userId, pageKey]);

  // Apply CSS variables to document
  useEffect(() => {
    document.documentElement.style.setProperty("--page-font-family", settings.fontFamily);
    document.documentElement.style.setProperty("--page-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--page-line-height", `${settings.lineHeight}`);
  }, [settings]);

  const updateSettings = useCallback(
    (partial: Partial<TypographySettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        setLocalCache(pageKey, next);

        // Save to cloud (fire & forget)
        if (userId) {
          (supabase as any)
            .from("page_typography_settings")
            .upsert(
              {
                user_id: userId,
                page_key: pageKey,
                font_family: next.fontFamily,
                font_size: next.fontSize,
                line_height: next.lineHeight,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,page_key" }
            )
            .then(() => {});
        }

        return next;
      });
    },
    [userId, pageKey]
  );

  return { settings, updateSettings, pageKey };
}
