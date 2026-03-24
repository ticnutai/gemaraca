/**
 * IndexedDB-based cache for psakei din.
 * Provides instant local reads with background cloud refresh.
 */

const DB_NAME = 'gemaraca-psak-cache';
const DB_VERSION = 1;

// Object store names
const STORE_PSAKIM = 'psakim';           // Individual psakei din by id
const STORE_DAF_INDEX = 'daf_index';     // Psakim per tractate+daf
const STORE_BEAUTIFIED = 'beautified';   // Beautified HTML cache by psak id
const STORE_META = 'meta';               // Metadata (last sync times, etc.)

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PSAKIM)) {
        db.createObjectStore(STORE_PSAKIM, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DAF_INDEX)) {
        db.createObjectStore(STORE_DAF_INDEX, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_BEAUTIFIED)) {
        db.createObjectStore(STORE_BEAUTIFIED, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

// ── Generic helpers ──

async function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function putToStore<T>(storeName: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail — cache is optional
  }
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function putManyToStore<T>(storeName: string, items: T[]): Promise<void> {
  if (!items.length) return;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

// ── Psakim cache ──

export interface CachedPsak {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string | null;
  source_url?: string | null;
  case_number?: string | null;
  tags?: string[];
  _cachedAt: number;
}

export async function getCachedPsak(id: string): Promise<CachedPsak | undefined> {
  return getFromStore<CachedPsak>(STORE_PSAKIM, id);
}

export async function cachePsak(psak: CachedPsak): Promise<void> {
  await putToStore(STORE_PSAKIM, { ...psak, _cachedAt: Date.now() });
}

export async function cachePsakim(psakim: CachedPsak[]): Promise<void> {
  const withTimestamp = psakim.map(p => ({ ...p, _cachedAt: Date.now() }));
  await putManyToStore(STORE_PSAKIM, withTimestamp);
}

export async function getAllCachedPsakim(): Promise<CachedPsak[]> {
  return getAllFromStore<CachedPsak>(STORE_PSAKIM);
}

// ── Daf index cache (psakim for a specific tractate+daf) ──

interface CachedDafIndex {
  key: string;
  psakIds: string[];
  _cachedAt: number;
}

function dafKey(tractate: string, daf: string): string {
  return `${tractate}::${daf}`;
}

export async function getCachedDafPsakim(tractate: string, daf: string): Promise<string[] | undefined> {
  const entry = await getFromStore<CachedDafIndex>(STORE_DAF_INDEX, dafKey(tractate, daf));
  return entry?.psakIds;
}

export async function cacheDafPsakim(tractate: string, daf: string, psakIds: string[]): Promise<void> {
  await putToStore(STORE_DAF_INDEX, {
    key: dafKey(tractate, daf),
    psakIds,
    _cachedAt: Date.now(),
  });
}

// ── Beautified HTML cache ──

interface CachedBeautified {
  id: string;
  html: string;
  _cachedAt: number;
}

export async function getCachedBeautified(psakId: string): Promise<string | undefined> {
  const entry = await getFromStore<CachedBeautified>(STORE_BEAUTIFIED, psakId);
  return entry?.html;
}

export async function cacheBeautified(psakId: string, html: string): Promise<void> {
  await putToStore(STORE_BEAUTIFIED, { id: psakId, html, _cachedAt: Date.now() });
}

// ── Meta / sync timestamps ──

interface MetaEntry {
  key: string;
  value: unknown;
}

export async function getMeta(key: string): Promise<unknown> {
  const entry = await getFromStore<MetaEntry>(STORE_META, key);
  return entry?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await putToStore(STORE_META, { key, value });
}


