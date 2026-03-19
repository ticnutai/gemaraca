import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";

const LOCAL_KEY_PREFIX = "gemara_edit_snapshot_";

interface SavedSnapshot {
  editedHtml: string;
  textSettings?: Record<string, unknown>;
  updatedAt: string;
}

export function useGemaraAutoSave(sugyaId: string, viewMode: string) {
  const [userId, setUserId] = useState<string | null>(null);
  const [savedHtml, setSavedHtml] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

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

  // Load saved snapshot on mount/change
  useEffect(() => {
    const localKey = `${LOCAL_KEY_PREFIX}${sugyaId}_${viewMode}`;

    // Try local cache first
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed: SavedSnapshot = JSON.parse(cached);
        setSavedHtml(parsed.editedHtml);
        lastSavedRef.current = parsed.editedHtml;
      }
    } catch {}

    // Then try cloud
    if (userId) {
      (supabase as any)
        .from("gemara_edit_snapshots")
        .select("edited_html, updated_at")
        .eq("user_id", userId)
        .eq("sugya_id", sugyaId)
        .eq("view_mode", viewMode)
        .maybeSingle()
        .then((result: any) => {
          const data = result?.data;
          if (data?.edited_html) {
            setSavedHtml(data.edited_html);
            lastSavedRef.current = data.edited_html;
            // Update local cache
            localStorage.setItem(localKey, JSON.stringify({
              editedHtml: data.edited_html,
              updatedAt: data.updated_at,
            }));
          }
        });
    }
  }, [userId, sugyaId, viewMode]);

  const saveToCloud = useCallback(
    (html: string, textSettings?: Record<string, unknown>) => {
      if (!html || html === lastSavedRef.current) return;
      lastSavedRef.current = html;

      const localKey = `${LOCAL_KEY_PREFIX}${sugyaId}_${viewMode}`;
      const now = new Date().toISOString();

      // Save locally immediately
      localStorage.setItem(localKey, JSON.stringify({
        editedHtml: html,
        textSettings,
        updatedAt: now,
      }));

      // Debounced cloud save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!userId) return;
        setIsSaving(true);
        (supabase as any)
          .from("gemara_edit_snapshots")
          .upsert(
            {
              user_id: userId,
              sugya_id: sugyaId,
              view_mode: viewMode,
              edited_html: html,
              text_settings: textSettings || {},
              updated_at: now,
            },
            { onConflict: "user_id,sugya_id,view_mode" }
          )
          .then((res: any) => {
            setIsSaving(false);
            if (res.error) {
              console.error("Auto-save error:", res.error);
            }
          });
      }, 1500);
    },
    [userId, sugyaId, viewMode]
  );

  // Trigger save from an iframe ref
  const saveFromIframe = useCallback(
    (iframeRef: React.RefObject<HTMLIFrameElement | null>, textSettings?: Record<string, unknown>) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.body) return;
      const html = doc.body.innerHTML;
      saveToCloud(html, textSettings);
    },
    [saveToCloud]
  );

  // Attach input listener to iframe for auto-save
  const attachIframeAutoSave = useCallback(
    (iframeRef: React.RefObject<HTMLIFrameElement | null>, textSettings?: Record<string, unknown>) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return () => {};

      const handler = () => saveFromIframe(iframeRef, textSettings);

      doc.addEventListener("input", handler);
      // Also catch execCommand changes via MutationObserver
      const observer = new MutationObserver(handler);
      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      return () => {
        doc.removeEventListener("input", handler);
        observer.disconnect();
      };
    },
    [saveFromIframe]
  );

  return {
    savedHtml,
    isSaving,
    saveToCloud,
    saveFromIframe,
    attachIframeAutoSave,
  };
}
