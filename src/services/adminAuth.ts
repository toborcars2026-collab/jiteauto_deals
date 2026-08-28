import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SESSION_TOKEN_KEY = 'jite_admin_session_active';
const LOCAL_CONFIG_KEY = 'jite_admin_sec_config';

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  role?: string;
}

export interface AdminSecurityConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

/**
 * Default initial administrator credentials ("toborium2006#")
 * Salt: 9f8b4a2c1d3e5f7a0b2c4d6e8f1a3b5c (16 hex bytes)
 * Algorithm: PBKDF2 (SHA-512, 100,000 iterations, 64-byte key)
 */
export const INITIAL_ADMIN_CONFIG: AdminSecurityConfig = {
  salt: '9f8b4a2c1d3e5f7a0b2c4d6e8f1a3b5c',
  hash: 'd97087b85cb39e5442199d06eaf7ccd99a8b451d4a4ab52f334ba3e8ca7ce142464176ed4d2093c2a569bc7e6da91bff11d7774730ba67e26a3b1fe7913897e2',
  updatedAt: '2026-08-28T00:00:00.000Z'
};

// In-memory cache of active config
let cachedConfig: AdminSecurityConfig | null = null;

/**
 * Cryptographic PBKDF2 hashing using browser native Web Crypto API.
 * 100% compatible with modern browsers and Node.js crypto.pbkdf2Sync.
 */
async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const subtle = (typeof window !== 'undefined' && window.crypto?.subtle) || (globalThis as any).crypto?.subtle;
  
  if (!subtle) {
    throw new Error('Web Crypto is not supported in this environment.');
  }

  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-512'
    },
    keyMaterial,
    512 // 64 bytes = 512 bits
  );

  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Timing-safe string comparison
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generates a cryptographically random 16-byte hex salt
 */
function generateRandomSalt(): string {
  const randomBytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 16; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Retrieves the active security config from Firestore (or local fallback/initial default).
 */
export async function getActiveAdminConfig(): Promise<AdminSecurityConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // 1. Try local cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.salt && parsed.hash) {
          cachedConfig = parsed;
        }
      }
    } catch {
      // Ignore
    }
  }

  // 2. Try Firestore `settings/admin_security`
  try {
    const fetchPromise = getDoc(doc(db, 'settings', 'admin_security'));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const snap = await Promise.race([fetchPromise, timeoutPromise]) as any;

    if (snap && snap.exists && snap.exists()) {
      const data = snap.data() as any;
      if (data && data.salt && data.hash) {
        cachedConfig = {
          salt: data.salt,
          hash: data.hash,
          updatedAt: data.updatedAt || new Date().toISOString()
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(cachedConfig));
        }
        return cachedConfig;
      }
    }
  } catch (err) {
    // Graceful fallback to initial default or cached config
  }

  if (!cachedConfig) {
    cachedConfig = INITIAL_ADMIN_CONFIG;
  }
  return cachedConfig;
}

/**
 * Authenticates administrator using the single master password.
 * Checks against the customized Firestore hash or the initial password hash.
 */
export async function authenticateAdmin(password: string): Promise<AdminAuthResult> {
  if (!password || !password.trim()) {
    return {
      success: false,
      error: 'Please enter the administrator password.'
    };
  }

  try {
    const config = await getActiveAdminConfig();
    
    // Check against active config
    const computedHash = await derivePasswordHash(password.trim(), config.salt);
    let isMatch = safeEqual(computedHash, config.hash);

    // Also check raw password without trimming in case trailing spaces were intentional
    if (!isMatch && password !== password.trim()) {
      const rawHash = await derivePasswordHash(password, config.salt);
      isMatch = safeEqual(rawHash, config.hash);
    }

    if (isMatch) {
      if (typeof window !== 'undefined') {
        const sessionToken = `admin_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      }
      return {
        success: true,
        role: 'admin'
      };
    }

    return {
      success: false,
      error: 'Incorrect administrator password. Please try again.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Incorrect administrator password. Please try again.'
    };
  }
}

/**
 * Verifies if an active administrator session is currently present.
 */
export async function verifyAdminSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const inSession = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (inSession) return true;
  const inLocal = localStorage.getItem(SESSION_TOKEN_KEY);
  if (inLocal) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, inLocal);
    return true;
  }
  return false;
}

/**
 * Changes administrator password:
 * - Validates current password against active hash
 * - Validates new password (minimum 8 chars)
 * - Cryptographically hashes new password
 * - Persists new credentials to Firestore `settings/admin_security`
 * - Immediately invalidates old password and activates new password
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!currentPassword || !newPassword) {
    return {
      success: false,
      error: 'Both current password and new password are required.'
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      error: 'New password must be at least 8 characters long.'
    };
  }

  try {
    const config = await getActiveAdminConfig();
    const currentHash = await derivePasswordHash(currentPassword.trim(), config.salt);
    const isCurrentValid = safeEqual(currentHash, config.hash);

    if (!isCurrentValid) {
      return {
        success: false,
        error: 'Incorrect current administrator password.'
      };
    }

    // Generate new cryptographic salt and hash for new password
    const newSalt = generateRandomSalt();
    const newHash = await derivePasswordHash(newPassword.trim(), newSalt);
    const nowIso = new Date().toISOString();

    const newConfig: AdminSecurityConfig = {
      salt: newSalt,
      hash: newHash,
      updatedAt: nowIso
    };

    // Save to Firestore
    try {
      const docRef = doc(db, 'settings', 'admin_security');
      await setDoc(docRef, newConfig, { merge: true });
    } catch (saveErr) {
      console.warn('[AdminAuth] Firestore write notice (saving to local store):', saveErr);
    }

    // Update in-memory and local cache
    cachedConfig = newConfig;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(newConfig));
      const newSessionToken = `admin_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem(SESSION_TOKEN_KEY, newSessionToken);
      localStorage.setItem(SESSION_TOKEN_KEY, newSessionToken);
    }

    return {
      success: true,
      message: 'Administrator password changed successfully.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Failed to update administrator password. Please try again.'
    };
  }
}

/**
 * Signs out administrator and removes active session token.
 */
export async function logoutAdminSession(): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}
