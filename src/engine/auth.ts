import { BirthInput } from '../types/astrology';
import { saveProfileEverywhere } from './storage';

export interface ZenithUserAccount {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  primaryChart: BirthInput;
  savedCharts: BirthInput[];
  createdAt: number;
  updatedAt: number;
}

export interface AuthState {
  currentUser: ZenithUserAccount | null;
  accounts: ZenithUserAccount[];
}

const LS_ACCOUNTS_KEY = 'zenith_accounts_v1';
const LS_SESSION_USER_KEY = 'zenith_active_user_id_v1';
const COOKIE_SESSION_NAME = 'zenith_user_session_v1';
const IDB_NAME = 'zenith_persistent_db';
const IDB_STORE = 'user_profiles';
const CACHE_AUTH_NAME = 'zenith-user-profile-cache-v1';
const CACHE_AUTH_URL = '/zenith/__user_accounts__.json';

/**
 * Hashes password using Web Crypto SHA-256 with deterministic fallback
 */
export async function hashPassword(password: string, emailSalt: string): Promise<string> {
  const normalized = `${emailSalt.trim().toLowerCase()}::zenith_salt_2026::${password}`;
  try {
    if (window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback below
  }
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function writeSessionCookie(account: ZenithUserAccount | null): void {
  try {
    const tenYearsSec = 60 * 60 * 24 * 365 * 10;
    if (!account) {
      document.cookie = `${COOKIE_SESSION_NAME}=; path=/; max-age=0; SameSite=Lax`;
      return;
    }
    const compact = btoa(
      encodeURIComponent(
        JSON.stringify({
          id: account.id,
          e: account.email,
          n: account.fullName,
          p: account.primaryChart,
          h: account.passwordHash,
          c: account.createdAt
        })
      )
    );
    document.cookie = `${COOKIE_SESSION_NAME}=${compact}; path=/; max-age=${tenYearsSec}; SameSite=Lax`;
  } catch {
    // Ignore cookie errors
  }
}

function readSessionCookie(): ZenithUserAccount | null {
  try {
    const cookies = document.cookie.split(';');
    for (const raw of cookies) {
      const [k, v] = raw.trim().split('=');
      if (k === COOKIE_SESSION_NAME && v) {
        const parsed = JSON.parse(decodeURIComponent(atob(v))) as Record<string, unknown>;
        if (parsed && typeof parsed.e === 'string' && parsed.p) {
          const primaryChart = parsed.p as BirthInput;
          return {
            id: String(parsed.id || `usr_${Date.now()}`),
            email: String(parsed.e),
            fullName: String(parsed.n || primaryChart.fullName || 'Zenith Üyesi'),
            passwordHash: String(parsed.h || ''),
            primaryChart,
            savedCharts: [primaryChart],
            createdAt: Number(parsed.c || Date.now()),
            updatedAt: Date.now()
          };
        }
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function openAuthDb(): Promise<IDBDatabase> {
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

async function writeIdbAuth(state: AuthState): Promise<void> {
  try {
    const db = await openAuthDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, 'auth_state_v1');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

async function readIdbAuth(): Promise<AuthState | null> {
  try {
    const db = await openAuthDb();
    const res = await new Promise<AuthState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('auth_state_v1');
      req.onsuccess = () => resolve((req.result as AuthState) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return res;
  } catch {
    return null;
  }
}

async function writeCacheAuth(state: AuthState): Promise<void> {
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open(CACHE_AUTH_NAME);
    await cache.put(
      CACHE_AUTH_URL,
      new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch {
    // Ignore
  }
}

async function readCacheAuth(): Promise<AuthState | null> {
  try {
    if (!('caches' in window)) return null;
    const cache = await caches.open(CACHE_AUTH_NAME);
    const res = await cache.match(CACHE_AUTH_URL);
    if (!res) return null;
    return ((await res.json()) as AuthState) || null;
  } catch {
    return null;
  }
}

export function loadAuthStateSync(): AuthState {
  let accounts: ZenithUserAccount[] = [];
  let activeId: string | null = null;

  try {
    const rawAccounts = localStorage.getItem(LS_ACCOUNTS_KEY);
    if (rawAccounts) {
      const parsed = JSON.parse(rawAccounts);
      if (Array.isArray(parsed)) {
        accounts = parsed;
      }
    }
    activeId = localStorage.getItem(LS_SESSION_USER_KEY);
  } catch {
    // Ignore
  }

  let currentUser = accounts.find((a) => a.id === activeId) || null;

  // Fallback to 10-year session cookie if localStorage was cleared by mobile OS
  if (!currentUser) {
    const cookieUser = readSessionCookie();
    if (cookieUser) {
      currentUser = cookieUser;
      if (!accounts.some((a) => a.email.toLowerCase() === cookieUser.email.toLowerCase())) {
        accounts = [cookieUser, ...accounts];
      }
    }
  }

  return {
    currentUser,
    accounts
  };
}

export async function recoverAuthStateAsync(): Promise<AuthState | null> {
  const idbState = await readIdbAuth();
  const cacheState = await readCacheAuth();
  const recovered = idbState || cacheState;
  if (!recovered) return null;

  try {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(recovered.accounts || []));
    if (recovered.currentUser) {
      localStorage.setItem(LS_SESSION_USER_KEY, recovered.currentUser.id);
      writeSessionCookie(recovered.currentUser);
    }
  } catch {
    // Ignore
  }

  return recovered;
}

export async function persistAuthState(state: AuthState): Promise<void> {
  try {
    localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(state.accounts));
    if (state.currentUser) {
      localStorage.setItem(LS_SESSION_USER_KEY, state.currentUser.id);
    } else {
      localStorage.removeItem(LS_SESSION_USER_KEY);
    }
  } catch {
    // Ignore
  }

  writeSessionCookie(state.currentUser);
  await Promise.all([writeIdbAuth(state), writeCacheAuth(state)]);

  if (state.currentUser) {
    await saveProfileEverywhere(
      state.currentUser.primaryChart,
      state.currentUser.savedCharts,
      true
    );
  }
}

export async function registerUserAccount(params: {
  fullName: string;
  email: string;
  password: string;
  birthChart: BirthInput;
  existingState: AuthState;
}): Promise<{ ok: boolean; error?: string; state: AuthState }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.fullName.trim() || params.birthChart.fullName || 'Zenith Üyesi';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      ok: false,
      error: 'Lütfen geçerli bir e-posta adresi giriniz.',
      state: params.existingState
    };
  }
  if (!params.password || params.password.length < 6) {
    return {
      ok: false,
      error: 'Şifreniz en az 6 karakter uzunluğunda olmalıdır.',
      state: params.existingState
    };
  }

  const alreadyExists = params.existingState.accounts.some(
    (a) => a.email.toLowerCase() === cleanEmail
  );
  if (alreadyExists) {
    return {
      ok: false,
      error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten mevcut. Giriş yapabilirsiniz.',
      state: params.existingState
    };
  }

  const passwordHash = await hashPassword(params.password, cleanEmail);
  const primaryChart: BirthInput = {
    ...params.birthChart,
    fullName: cleanName
  };

  const newAccount: ZenithUserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fullName: cleanName,
    email: cleanEmail,
    passwordHash,
    primaryChart,
    savedCharts: [primaryChart],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const nextState: AuthState = {
    currentUser: newAccount,
    accounts: [newAccount, ...params.existingState.accounts]
  };

  await persistAuthState(nextState);
  return { ok: true, state: nextState };
}

export async function signInUserAccount(params: {
  email: string;
  password: string;
  existingState: AuthState;
}): Promise<{ ok: boolean; error?: string; state: AuthState }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const found = params.existingState.accounts.find(
    (a) => a.email.toLowerCase() === cleanEmail
  );

  if (!found) {
    return {
      ok: false,
      error: 'Bu e-posta adresine ait kayıtlı bir hesap bulunamadı. Lütfen önce kayıt olun.',
      state: params.existingState
    };
  }

  const candidateHash = await hashPassword(params.password, cleanEmail);
  if (found.passwordHash !== candidateHash) {
    return {
      ok: false,
      error: 'Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.',
      state: params.existingState
    };
  }

  const updatedAccount: ZenithUserAccount = {
    ...found,
    updatedAt: Date.now()
  };

  const nextAccounts = params.existingState.accounts.map((a) =>
    a.id === updatedAccount.id ? updatedAccount : a
  );

  const nextState: AuthState = {
    currentUser: updatedAccount,
    accounts: nextAccounts
  };

  await persistAuthState(nextState);
  return { ok: true, state: nextState };
}

export async function resetUserPassword(params: {
  email: string;
  birthDateVerification: string;
  newPassword: string;
  existingState: AuthState;
}): Promise<{ ok: boolean; error?: string; state: AuthState }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const found = params.existingState.accounts.find(
    (a) => a.email.toLowerCase() === cleanEmail
  );

  if (!found) {
    return {
      ok: false,
      error: 'Bu e-posta adresine ait kayıtlı bir hesap bulunamadı.',
      state: params.existingState
    };
  }

  if (found.primaryChart.birthDate !== params.birthDateVerification.trim()) {
    return {
      ok: false,
      error: 'Doğum tarihi doğrulaması eşleşmedi. Lütfen kayıtlı doğum tarihinizi giriniz.',
      state: params.existingState
    };
  }

  if (!params.newPassword || params.newPassword.length < 6) {
    return {
      ok: false,
      error: 'Yeni şifreniz en az 6 karakter olmalıdır.',
      state: params.existingState
    };
  }

  const newHash = await hashPassword(params.newPassword, cleanEmail);
  const updatedAccount: ZenithUserAccount = {
    ...found,
    passwordHash: newHash,
    updatedAt: Date.now()
  };

  const nextAccounts = params.existingState.accounts.map((a) =>
    a.id === updatedAccount.id ? updatedAccount : a
  );

  const nextState: AuthState = {
    currentUser: updatedAccount,
    accounts: nextAccounts
  };

  await persistAuthState(nextState);
  return { ok: true, state: nextState };
}

export async function signOutUserAccount(existingState: AuthState): Promise<AuthState> {
  const nextState: AuthState = {
    currentUser: null,
    accounts: existingState.accounts
  };
  await persistAuthState(nextState);
  return nextState;
}

export async function syncChartToActiveAccount(
  chart: BirthInput,
  existingState: AuthState
): Promise<AuthState> {
  if (!existingState.currentUser) return existingState;

  const filtered = existingState.currentUser.savedCharts.filter(
    (c) =>
      !(
        c.fullName.trim().toLowerCase() === chart.fullName.trim().toLowerCase() &&
        c.birthDate === chart.birthDate &&
        c.birthTime === chart.birthTime
      )
  );

  const updatedUser: ZenithUserAccount = {
    ...existingState.currentUser,
    primaryChart: chart,
    savedCharts: [chart, ...filtered].slice(0, 12),
    updatedAt: Date.now()
  };

  const nextAccounts = existingState.accounts.map((a) =>
    a.id === updatedUser.id ? updatedUser : a
  );

  const nextState: AuthState = {
    currentUser: updatedUser,
    accounts: nextAccounts
  };

  await persistAuthState(nextState);
  return nextState;
}

/**
 * Exports a portable encrypted-like Base64 sync token so users can transfer their account across devices
 */
export function exportAccountSyncToken(account: ZenithUserAccount): string {
  try {
    return 'ZENITH-ACC-' + btoa(encodeURIComponent(JSON.stringify(account)));
  } catch {
    return '';
  }
}

export async function importAccountSyncToken(
  token: string,
  existingState: AuthState
): Promise<{ ok: boolean; error?: string; state: AuthState }> {
  try {
    const clean = token.trim().replace(/^ZENITH-ACC-/, '');
    const decoded = JSON.parse(decodeURIComponent(atob(clean))) as ZenithUserAccount;
    if (!decoded || !decoded.email || !decoded.primaryChart) {
      return {
        ok: false,
        error: 'Geçersiz hesap senkronizasyon anahtarı.',
        state: existingState
      };
    }

    const otherAccounts = existingState.accounts.filter(
      (a) => a.email.toLowerCase() !== decoded.email.toLowerCase()
    );

    const nextState: AuthState = {
      currentUser: decoded,
      accounts: [decoded, ...otherAccounts]
    };

    await persistAuthState(nextState);
    return { ok: true, state: nextState };
  } catch {
    return {
      ok: false,
      error: 'Hesap anahtarı çözümlenemedi. Lütfen kodu eksiksiz yapıştırdığınızdan emin olun.',
      state: existingState
    };
  }
}
