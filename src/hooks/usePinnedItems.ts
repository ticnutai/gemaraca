import { useState, useCallback, useEffect } from 'react';

const PINNED_KEY = 'pinned_index_items';
const FAVORITES_KEY = 'favorite_index_items';

export interface PinnedItem {
  type: 'tractate' | 'daf' | 'ref';
  id: string; // e.g. "ברכות" or "ברכות-2" or ref id
  label: string;
  tractate?: string;
  daf?: string;
  amud?: string;
  refCount?: number;
  color?: string;
  pinnedAt: number;
}

function loadItems(key: string): PinnedItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function saveItems(key: string, items: PinnedItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function usePinnedItems() {
  const [pinned, setPinned] = useState<PinnedItem[]>(() => loadItems(PINNED_KEY));
  const [favorites, setFavorites] = useState<PinnedItem[]>(() => loadItems(FAVORITES_KEY));

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PINNED_KEY) setPinned(loadItems(PINNED_KEY));
      if (e.key === FAVORITES_KEY) setFavorites(loadItems(FAVORITES_KEY));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const togglePin = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    setPinned(prev => {
      const exists = prev.some(p => p.id === item.id && p.type === item.type);
      const next = exists
        ? prev.filter(p => !(p.id === item.id && p.type === item.type))
        : [...prev, { ...item, pinnedAt: Date.now() }];
      saveItems(PINNED_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    setFavorites(prev => {
      const exists = prev.some(p => p.id === item.id && p.type === item.type);
      const next = exists
        ? prev.filter(p => !(p.id === item.id && p.type === item.type))
        : [...prev, { ...item, pinnedAt: Date.now() }];
      saveItems(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const isPinned = useCallback((id: string, type: string) => {
    return pinned.some(p => p.id === id && p.type === type);
  }, [pinned]);

  const isFavorite = useCallback((id: string, type: string) => {
    return favorites.some(p => p.id === id && p.type === type);
  }, [favorites]);

  return { pinned, favorites, togglePin, toggleFavorite, isPinned, isFavorite };
}
