import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const PINNED_KEY = 'pinned_index_items';
const FAVORITES_KEY = 'favorite_index_items';

export interface PinnedItem {
  type: 'tractate' | 'daf' | 'ref';
  id: string;
  label: string;
  tractate?: string;
  daf?: string;
  amud?: string;
  refCount?: number;
  color?: string;
  pinnedAt: number;
}

function loadLocal(key: string): PinnedItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function saveLocal(key: string, items: PinnedItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function usePinnedItems() {
  const { user } = useAuth();
  const [pinned, setPinned] = useState<PinnedItem[]>(() => loadLocal(PINNED_KEY));
  const [favorites, setFavorites] = useState<PinnedItem[]>(() => loadLocal(FAVORITES_KEY));
  const syncedRef = useRef(false);

  // Load from DB when user logs in
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    (async () => {
      const { data } = await supabase
        .from('user_pinned_items')
        .select('*')
        .eq('user_id', user.id);

      if (!data || data.length === 0) {
        // First login: push local items to DB
        const localPinned = loadLocal(PINNED_KEY);
        const localFavs = loadLocal(FAVORITES_KEY);
        const rows = [
          ...localPinned.map(p => toRow(user.id, p, 'pin')),
          ...localFavs.map(f => toRow(user.id, f, 'favorite')),
        ];
        if (rows.length > 0) {
          await supabase.from('user_pinned_items').upsert(rows, { onConflict: 'user_id,item_id,item_type,pin_type' });
        }
        return;
      }

      // Load from DB
      const dbPinned: PinnedItem[] = data.filter(r => r.pin_type === 'pin').map(fromRow);
      const dbFavs: PinnedItem[] = data.filter(r => r.pin_type === 'favorite').map(fromRow);
      setPinned(dbPinned);
      setFavorites(dbFavs);
      saveLocal(PINNED_KEY, dbPinned);
      saveLocal(FAVORITES_KEY, dbFavs);
    })();
  }, [user]);

  // Reset sync flag on logout
  useEffect(() => {
    if (!user) syncedRef.current = false;
  }, [user]);

  const togglePin = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    setPinned(prev => {
      const exists = prev.some(p => p.id === item.id && p.type === item.type);
      const next = exists
        ? prev.filter(p => !(p.id === item.id && p.type === item.type))
        : [...prev, { ...item, pinnedAt: Date.now() }];
      saveLocal(PINNED_KEY, next);

      // Sync to DB
      if (user) {
        if (exists) {
          supabase.from('user_pinned_items')
            .delete()
            .eq('user_id', user.id)
            .eq('item_id', item.id)
            .eq('item_type', item.type)
            .eq('pin_type', 'pin')
            .then();
        } else {
          supabase.from('user_pinned_items')
            .upsert(toRow(user.id, { ...item, pinnedAt: Date.now() }, 'pin'), { onConflict: 'user_id,item_id,item_type,pin_type' })
            .then();
        }
      }
      return next;
    });
  }, [user]);

  const toggleFavorite = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    setFavorites(prev => {
      const exists = prev.some(p => p.id === item.id && p.type === item.type);
      const next = exists
        ? prev.filter(p => !(p.id === item.id && p.type === item.type))
        : [...prev, { ...item, pinnedAt: Date.now() }];
      saveLocal(FAVORITES_KEY, next);

      if (user) {
        if (exists) {
          supabase.from('user_pinned_items')
            .delete()
            .eq('user_id', user.id)
            .eq('item_id', item.id)
            .eq('item_type', item.type)
            .eq('pin_type', 'favorite')
            .then();
        } else {
          supabase.from('user_pinned_items')
            .upsert(toRow(user.id, { ...item, pinnedAt: Date.now() }, 'favorite'), { onConflict: 'user_id,item_id,item_type,pin_type' })
            .then();
        }
      }
      return next;
    });
  }, [user]);

  const isPinned = useCallback((id: string, type: string) => {
    return pinned.some(p => p.id === id && p.type === type);
  }, [pinned]);

  const isFavorite = useCallback((id: string, type: string) => {
    return favorites.some(p => p.id === id && p.type === type);
  }, [favorites]);

  return { pinned, favorites, togglePin, toggleFavorite, isPinned, isFavorite };
}

function toRow(userId: string, item: PinnedItem, pinType: string) {
  return {
    user_id: userId,
    item_type: item.type,
    item_id: item.id,
    label: item.label,
    pin_type: pinType,
    tractate: item.tractate || null,
    daf: item.daf || null,
    amud: item.amud || null,
    ref_count: item.refCount ?? 0,
    color: item.color || null,
  };
}

function fromRow(row: any): PinnedItem {
  return {
    type: row.item_type,
    id: row.item_id,
    label: row.label,
    tractate: row.tractate,
    daf: row.daf,
    amud: row.amud,
    refCount: row.ref_count,
    color: row.color,
    pinnedAt: new Date(row.created_at).getTime(),
  };
}
