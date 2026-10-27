import { BirthInput } from '../types/astrology';
import { PRESET_LOCATIONS } from '../data/locations';

const LOCAL_STORAGE_ACTIVE_KEY = 'zenith_birth_profile_v1';
const LOCAL_STORAGE_LIST_KEY = 'zenith_saved_profiles_list_v1';
const COOKIE_NAME = 'zenith_profile_v1';
const IDB_NAME = 'zenith_persistent_db';
const IDB_STORE = 'user_profiles';
const CACHE_PROFILE_NAME = 'zenith-user-profile-cache-v1';
const CACHE_PROFILE_URL = '/zenith/__user_profile__.json';

export const MAX_SAVED_PROFILES = 2;

export const DEFAULT_DEMO_PROFILE: BirthInput = {
  fullName: 'Deniz Yıldırım',
  birthDate: '1994-11-10',
  birthTime: '14:30',
  location: PRESET_LOCATIONS[0] // İstanbul
};

export function isSameBirthInput(a: BirthInput, b: BirthInput): boolean {
  return (
    a.fullName.trim().toLowerCase() === b.fullName.trim().toLowerCase() &&
    a.birthDate === b.birthDate &&
    a.birthTime === b.birthTime &&
    a.location.name.trim().toLowerCase() === b.location.name.trim().toLowerCase()
  );
}

export interface StoredProfilePayload {
  activeProfile: BirthInput;
  savedProfiles: BirthInput[];
  isUserCustomized: boolean;
  updatedAt: number;
}

function isValidBirthInput(obj: unknown): obj is BirthInput {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  if (typeof candidate.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.birthDate)) {
    return false;
  }
  if (typeof candidate.birthTime !== 'string' || !/^\d{2}:\d{2}/.test(candidate.birthTime)) {
    return false;
  }
  const loc = candidate.location as Record<string, unknown> | undefined;
  if (
    !loc ||
    typeof loc.name !== 'string' ||
    typeof loc.latitude !== 'number' ||
    typeof loc.longitude !== 'number' ||
    typeof loc.timezone !== 'string'
  ) {
    return false;
  }
  return true;
}

/**
 * Compact Base64-URL encoding for Cookie & URL parameter persistence
 */
export function encodeProfileCompact(input: BirthInput): string {
  try {
    const compact = {
      n: input.fullName,
      d: input.birthDate,
      t: input.birthTime,
      ln: input.location.name,
      la: Number(input.location.latitude.toFixed(4)),
      lo: Number(input.location.longitude.toFixed(4)),
      tz: input.location.timezone,
      c: input.location.country || 'Türkiye',
      id: input.location.id || 'custom'
    };
    const json = JSON.stringify(compact);
    return btoa(encodeURIComponent(json));
  } catch {
    return '';
  }
}

export function decodeProfileCompact(encoded: string): BirthInput | null {
  try {
    if (!encoded) return null;
    const json = decodeURIComponent(atob(encoded));
    const c = JSON.parse(json) as Record<string, unknown>;
    const restored: BirthInput = {
      fullName: typeof c.n === 'string' ? c.n : 'Zenith Kullanıcısı',
      birthDate: String(c.d || ''),
      birthTime: String(c.t || ''),
      location: {
        id: String(c.id || 'custom'),
        name: String(c.ln || 'İstanbul'),
        country: String(c.c || 'Türkiye'),
        latitude: Number(c.la),
        longitude: Number(c.lo),
        timezone: String(c.tz || 'Europe/Istanbul')
      }
    };
    return isValidBirthInput(restored) ? restored : null;
  } catch {
    return null;
  }
}

/**
 * 1. Cookie Layer (10-year expiration, shared across browser tab & WebClip in many mobile WebKit builds)
 */
function writeCookieProfile(input: BirthInput): void {
  try {
    const encoded = encodeProfileCompact(input);
    if (!encoded) return;
    const tenYearsSec = 60 * 60 * 24 * 365 * 10;
    document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${tenYearsSec}; SameSite=Lax`;
  } catch {
    // Ignore cookie errors
  }
}

function readCookieProfile(): BirthInput | null {
  try {
    const cookies = document.cookie.split(';');
    for (const raw of cookies) {
      const [k, v] = raw.trim().split('=');
      if (k === COOKIE_NAME && v) {
        return decodeProfileCompact(v);
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * 2. URL Query Parameter Layer (?p=...) so Home Screen bookmarks capture the exact profile
 */
function syncUrlAndManifest(input: BirthInput, isUserCustomized: boolean): void {
  if (!isUserCustomized) return;
  try {
    const encoded = encodeProfileCompact(input);
    if (!encoded) return;
    const url = new URL(window.location.href);
    url.searchParams.set('p', encoded);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore URL replace errors
  }
}

function readUrlProfile(): BirthInput | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('p');
    if (param) {
      return decodeProfileCompact(param);
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * 3. IndexedDB Layer (Survives WebKit localStorage purges in standalone PWA mode)
 */
function openProfileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function writeIdbPayload(payload: StoredProfilePayload): Promise<void> {
  try {
    const db = await openProfileDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(payload, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IDB errors
  }
}

async function readIdbPayload(): Promise<StoredProfilePayload | null> {
  try {
    const db = await openProfileDb();
    const result = await new Promise<StoredProfilePayload | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('current');
      req.onsuccess = () => resolve((req.result as StoredProfilePayload) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result && isValidBirthInput(result.activeProfile)) {
      return result;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * 4. Cache Storage Layer (Shared with Service Worker and survives across PWA launches)
 */
async function writeCachePayload(payload: StoredProfilePayload): Promise<void> {
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_PROFILE_NAME);
    const response = new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(CACHE_PROFILE_URL, response);
  } catch {
    // Ignore Cache API errors
  }
}

async function readCachePayload(): Promise<StoredProfilePayload | null> {
  try {
    if (!('caches' in window)) return null;
    const cache = await caches.open(CACHE_PROFILE_NAME);
    const res = await cache.match(CACHE_PROFILE_URL);
    if (!res) return null;
    const data = (await res.json()) as StoredProfilePayload;
    if (data && isValidBirthInput(data.activeProfile)) {
      return data;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Synchronous initial load from URL -> localStorage -> Cookie -> Demo fallback
 */
export function loadProfileSync(): StoredProfilePayload {
  // 1. Check URL parameter first (e.g. launched from Home Screen bookmark with ?p=...)
  const fromUrl = readUrlProfile();

  // 2. Check localStorage
  let activeFromLs: BirthInput | null = null;
  let savedListFromLs: BirthInput[] = [];
  let hasExplicitSavedList = false;
  let isCustomFromLs = false;

  try {
    const rawActive = localStorage.getItem(LOCAL_STORAGE_ACTIVE_KEY);
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      if (isValidBirthInput(parsed)) {
        activeFromLs = parsed;
        isCustomFromLs = localStorage.getItem('zenith_is_custom_v1') === '1';
      }
    }
    const rawList = localStorage.getItem(LOCAL_STORAGE_LIST_KEY);
    if (rawList !== null) {
      const list = JSON.parse(rawList);
      if (Array.isArray(list)) {
        hasExplicitSavedList = true;
        savedListFromLs = list.filter(isValidBirthInput);
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  // 3. Check 10-year Cookie
  const fromCookie = readCookieProfile();

  const chosenActive = fromUrl || activeFromLs || fromCookie || DEFAULT_DEMO_PROFILE;
  const isUserCustomized = Boolean(fromUrl || isCustomFromLs || fromCookie);

  if (!hasExplicitSavedList && savedListFromLs.length === 0) {
    savedListFromLs = [chosenActive];
  } else {
    savedListFromLs = savedListFromLs.slice(0, MAX_SAVED_PROFILES);
  }

  // Re-hydrate localStorage & Cookie immediately if recovered from URL or Cookie
  if (isUserCustomized) {
    try {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, JSON.stringify(chosenActive));
      localStorage.setItem('zenith_is_custom_v1', '1');
      writeCookieProfile(chosenActive);
    } catch {
      // Ignore
    }
  }

  return {
    activeProfile: chosenActive,
    savedProfiles: savedListFromLs,
    isUserCustomized,
    updatedAt: Date.now()
  };
}

/**
 * Asynchronous recovery from IndexedDB & CacheStorage (in case iOS WebKit cleared localStorage)
 */
export async function recoverProfileAsync(): Promise<StoredProfilePayload | null> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch {
    // Ignore
  }

  const idbData = await readIdbPayload();
  const cacheData = await readCachePayload();

  const best =
    idbData && cacheData
      ? idbData.updatedAt >= cacheData.updatedAt
        ? idbData
        : cacheData
      : idbData || cacheData;

  if (best && isValidBirthInput(best.activeProfile)) {
    // Restore back into localStorage, Cookie, and URL
    try {
      localStorage.setItem(
        LOCAL_STORAGE_ACTIVE_KEY,
        JSON.stringify(best.activeProfile)
      );
      localStorage.setItem(
        LOCAL_STORAGE_LIST_KEY,
        JSON.stringify(Array.isArray(best.savedProfiles) ? best.savedProfiles : [best.activeProfile])
      );
      if (best.isUserCustomized) {
        localStorage.setItem('zenith_is_custom_v1', '1');
      }
      writeCookieProfile(best.activeProfile);
      syncUrlAndManifest(best.activeProfile, best.isUserCustomized);
    } catch {
      // Ignore
    }
    return best;
  }

  return null;
}

/**
 * Saves the user's birth profile across all 5 persistence layers simultaneously:
 * localStorage + 10-year Cookie + URL (?p=...) + IndexedDB + Cache Storage
 */
export async function saveProfileEverywhere(
  input: BirthInput,
  existingList: BirthInput[] = [],
  isUserCustomized = true
): Promise<StoredProfilePayload> {
  const dedupedExisting: BirthInput[] = [];
  for (const item of existingList) {
    if (!dedupedExisting.some((x) => isSameBirthInput(x, item))) {
      dedupedExisting.push(item);
    }
  }

  const existingIdx = dedupedExisting.findIndex((item) => isSameBirthInput(item, input));
  let updatedList: BirthInput[];

  if (existingIdx >= 0) {
    updatedList = dedupedExisting
      .map((item, idx) => (idx === existingIdx ? input : item))
      .slice(0, MAX_SAVED_PROFILES);
  } else if (dedupedExisting.length < MAX_SAVED_PROFILES) {
    updatedList = [...dedupedExisting, input].slice(0, MAX_SAVED_PROFILES);
  } else {
    updatedList = [dedupedExisting[0], input].slice(0, MAX_SAVED_PROFILES);
  }

  const payload: StoredProfilePayload = {
    activeProfile: input,
    savedProfiles: updatedList,
    isUserCustomized,
    updatedAt: Date.now()
  };

  // 1. localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_KEY, JSON.stringify(input));
    localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(updatedList));
    if (isUserCustomized) {
      localStorage.setItem('zenith_is_custom_v1', '1');
    }
  } catch {
    // Ignore
  }

  // 2. 10-year Cookie
  if (isUserCustomized) {
    writeCookieProfile(input);
  }

  // 3. URL parameter (?p=...)
  syncUrlAndManifest(input, isUserCustomized);

  // 4. IndexedDB & 5. Cache Storage
  await Promise.all([writeIdbPayload(payload), writeCachePayload(payload)]);

  return payload;
}

export async function removeSavedProfile(
  targetIndex: number,
  currentPayload: StoredProfilePayload
): Promise<StoredProfilePayload> {
  const nextList = currentPayload.savedProfiles.filter((_, i) => i !== targetIndex);
  if (nextList.length === 0) {
    const emptyPayload: StoredProfilePayload = {
      activeProfile: currentPayload.activeProfile,
      savedProfiles: [],
      isUserCustomized: currentPayload.isUserCustomized,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify([]));
    } catch {
      // Ignore
    }
    await Promise.all([writeIdbPayload(emptyPayload), writeCachePayload(emptyPayload)]);
    return emptyPayload;
  }
  const nextActive = nextList.some((c) => isSameBirthInput(c, currentPayload.activeProfile))
    ? currentPayload.activeProfile
    : nextList[0];
  return saveProfileEverywhere(nextActive, nextList, currentPayload.isUserCustomized);
}
