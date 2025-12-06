// Cache for Gemara pages and Sefaria text to reduce API calls

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const PAGE_CACHE_KEY = 'gemara_pages_cache';
const TEXT_CACHE_KEY = 'gemara_text_cache';

// In-memory cache for faster access
const memoryCache: Map<string, CacheEntry<any>> = new Map();

// Get from localStorage with expiry check
function getFromStorage<T>(storageKey: string, key: string): T | null {
  // First check memory cache
  const memKey = `${storageKey}:${key}`;
  const memEntry = memoryCache.get(memKey);
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_DURATION) {
    return memEntry.data;
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const cache: Record<string, CacheEntry<T>> = JSON.parse(stored);
    const entry = cache[key];

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      // Remove expired entry
      delete cache[key];
      localStorage.setItem(storageKey, JSON.stringify(cache));
      return null;
    }

    // Store in memory cache for faster subsequent access
    memoryCache.set(memKey, entry);

    return entry.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

// Save to localStorage
function saveToStorage<T>(storageKey: string, key: string, data: T): void {
  const memKey = `${storageKey}:${key}`;
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  
  // Save to memory cache
  memoryCache.set(memKey, entry);

  try {
    const stored = localStorage.getItem(storageKey);
    const cache: Record<string, CacheEntry<T>> = stored ? JSON.parse(stored) : {};
    
    cache[key] = entry;
    
    // Limit cache size to prevent localStorage overflow
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      // Remove oldest entries
      const sorted = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      for (let i = 0; i < 20; i++) {
        delete cache[sorted[i]];
      }
    }
    
    localStorage.setItem(storageKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Cache write error:', error);
    // If localStorage is full, clear old entries
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }
}

// Page cache functions
export function getCachedPage(sugyaId: string): any | null {
  return getFromStorage(PAGE_CACHE_KEY, sugyaId);
}

export function setCachedPage(sugyaId: string, pageData: any): void {
  saveToStorage(PAGE_CACHE_KEY, sugyaId, pageData);
}

// Gemara text cache functions
export function getCachedGemaraText(ref: string): any | null {
  return getFromStorage(TEXT_CACHE_KEY, ref);
}

export function setCachedGemaraText(ref: string, textData: any): void {
  saveToStorage(TEXT_CACHE_KEY, ref, textData);
}

// Clear all caches (useful for debugging or user action)
export function clearAllCaches(): void {
  memoryCache.clear();
  try {
    localStorage.removeItem(PAGE_CACHE_KEY);
    localStorage.removeItem(TEXT_CACHE_KEY);
  } catch {}
}

// Get cache stats for debugging
export function getCacheStats(): { pages: number; texts: number } {
  try {
    const pages = localStorage.getItem(PAGE_CACHE_KEY);
    const texts = localStorage.getItem(TEXT_CACHE_KEY);
    return {
      pages: pages ? Object.keys(JSON.parse(pages)).length : 0,
      texts: texts ? Object.keys(JSON.parse(texts)).length : 0,
    };
  } catch {
    return { pages: 0, texts: 0 };
  }
}
