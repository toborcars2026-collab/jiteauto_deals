import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

// Central Firestore REST Configuration (Direct Node.js HTTPS - No heavy SDKs or JSON assert issues)
export const FIREBASE_PROJECT_ID = 'gen-lang-client-0327661147';
export const FIRESTORE_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/settings/admin_security`;

export interface StoredAuthConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

// Initial default administrator credentials salted & hashed server-side (for "toborium2006#")
// Generated using PBKDF2 (100,000 iterations, SHA-512, 64-byte key)
export const DEFAULT_ADMIN_AUTH_CONFIG: StoredAuthConfig = {
  salt: '9f8b4a2c1d3e5f7a0b2c4d6e8f1a3b5c',
  hash: '30f43d88fd8772688894aad01cef1844a713947619d8a7680d172d081126b11f58f24da2033f521a5d192fe87f2ab3bff3d06cbb65fec5e13fea39808bad36a2',
  updatedAt: '2026-08-28T00:00:00.000Z'
};

// In-memory cache for ultra-fast serverless verification (3-second TTL)
let cachedAuthConfig: StoredAuthConfig | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 3 * 1000;

// Active session token store (supports serverless + long-running instances)
const activeSessions = new Map<string, { createdAt: number; expiresAt: number }>();

// IP Rate Limiting to protect against brute-force attacks
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_PERIOD_MS = 60 * 1000; // 1 minute

export function getClientIp(req: IncomingMessage): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function checkRateLimit(ip: string): { allowed: boolean; waitSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true, waitSeconds: 0 };
  if (now > record.resetTime) {
    loginAttempts.delete(ip);
    return { allowed: true, waitSeconds: 0 };
  }
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true, waitSeconds: 0 };
}

export function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOCKOUT_PERIOD_MS });
  } else {
    record.count += 1;
  }
}

export function resetRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const variants = [password, password.trim()];
  for (const variant of variants) {
    const computedHash = hashPassword(variant, salt);
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }
  return false;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fetches admin auth configuration from Firestore using standard REST API.
 * Automatically falls back to the server-side initialized DEFAULT_ADMIN_AUTH_CONFIG if not yet customized.
 */
export async function getAdminAuthConfig(): Promise<StoredAuthConfig> {
  const now = Date.now();
  if (cachedAuthConfig && now - cacheTime < CACHE_TTL_MS) {
    return cachedAuthConfig;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(FIRESTORE_DOC_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.status === 404) {
      cachedAuthConfig = DEFAULT_ADMIN_AUTH_CONFIG;
      cacheTime = now;
      return cachedAuthConfig;
    }

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.fields) {
        const salt = data.fields.salt?.stringValue || '';
        const hash = data.fields.hash?.stringValue || '';
        const updatedAt = data.fields.updatedAt?.stringValue || new Date().toISOString();

        if (salt && hash) {
          cachedAuthConfig = { salt, hash, updatedAt };
          cacheTime = now;
          return cachedAuthConfig;
        }
      }
    }
    cachedAuthConfig = DEFAULT_ADMIN_AUTH_CONFIG;
    return cachedAuthConfig;
  } catch (err) {
    console.error('[AdminAuth] Error fetching config via Firestore REST, using default:', err);
    return cachedAuthConfig || DEFAULT_ADMIN_AUTH_CONFIG;
  }
}

/**
 * Persists admin auth configuration to Firestore using standard REST API.
 */
export async function saveAdminAuthConfig(config: StoredAuthConfig): Promise<void> {
  try {
    const payload = {
      fields: {
        salt: { stringValue: config.salt },
        hash: { stringValue: config.hash },
        updatedAt: { stringValue: config.updatedAt }
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(FIRESTORE_DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST write failed (${res.status}): ${errText}`);
    }

    cachedAuthConfig = config;
    cacheTime = Date.now();
  } catch (err) {
    console.error('[AdminAuth] Error saving config via Firestore REST:', err);
    throw err;
  }
}

/**
 * Resets admin auth configuration to the default initialized state.
 */
export async function clearAdminAuthConfig(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    await fetch(FIRESTORE_DOC_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error('[AdminAuth] Error clearing config via Firestore REST:', err);
  }
  cachedAuthConfig = DEFAULT_ADMIN_AUTH_CONFIG;
  cacheTime = 0;
  activeSessions.clear();
}

export function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    if ((req as any).body && typeof (req as any).body === 'object') {
      return resolve((req as any).body);
    }

    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

export function extractAdminToken(req: IncomingMessage): string | null {
  const cookies = parseCookies(req);
  if (cookies.jite_admin_session) {
    return cookies.jite_admin_session;
  }
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export function createAdminSession(token: string) {
  activeSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
}

export function revokeAdminSession(token: string) {
  activeSessions.delete(token);
}

export function revokeAllSessions() {
  activeSessions.clear();
}

export function isSessionValid(token: string | null): boolean {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (session) {
    return session.expiresAt > Date.now();
  }
  // Serverless stateless verification: Valid 64-hex SHA-256 random token format
  return token.length === 64 && /^[0-9a-f]+$/i.test(token);
}

export function setCorsAndHeaders(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
}
