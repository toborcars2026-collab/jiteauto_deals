import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, type Firestore } from 'firebase/firestore';
import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase App for Server / Serverless environment
export function getDb(): Firestore {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export interface StoredAuthConfig {
  salt: string;
  hash: string;
  updatedAt: string;
}

// In-memory cache for fast verification
let cachedAuthConfig: StoredAuthConfig | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 1000; // 5 seconds

// Active session token store
const activeSessions = new Map<string, { createdAt: number; expiresAt: number }>();

// IP Rate Limiting
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_FAILED_ATTEMPTS = 7;
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
 * Fetches admin auth configuration from Firestore
 */
export async function getAdminAuthConfig(): Promise<StoredAuthConfig | null> {
  const now = Date.now();
  if (cachedAuthConfig && now - cacheTime < CACHE_TTL_MS) {
    return cachedAuthConfig;
  }

  try {
    const db = getDb();
    const docRef = doc(db, 'settings', 'admin_security');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.salt && data.hash) {
        cachedAuthConfig = {
          salt: data.salt,
          hash: data.hash,
          updatedAt: data.updatedAt || new Date().toISOString()
        };
        cacheTime = now;
        return cachedAuthConfig;
      }
    }
    cachedAuthConfig = null;
    return null;
  } catch (err) {
    console.error('[AdminAuth] Error fetching config from Firestore:', err);
    return cachedAuthConfig;
  }
}

/**
 * Persists admin auth configuration to Firestore
 */
export async function saveAdminAuthConfig(config: StoredAuthConfig): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'settings', 'admin_security');
  await setDoc(docRef, config);
  cachedAuthConfig = config;
  cacheTime = Date.now();
}

/**
 * Resets admin auth configuration in Firestore (returns system to First-Time Setup)
 */
export async function clearAdminAuthConfig(): Promise<void> {
  const db = getDb();
  const docRef = doc(db, 'settings', 'admin_security');
  try {
    await deleteDoc(docRef);
  } catch (err) {
    await setDoc(docRef, { salt: '', hash: '', updatedAt: new Date().toISOString() });
  }
  cachedAuthConfig = null;
  cacheTime = 0;
  activeSessions.clear();
}

export function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
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

export function isSessionValid(token: string | null): boolean {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (session) {
    return session.expiresAt > Date.now();
  }
  // If in a newly spawned serverless instance, accept valid 64-hex tokens
  return token.length === 64 && /^[0-9a-f]+$/i.test(token);
}

export function setCorsAndHeaders(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
}
