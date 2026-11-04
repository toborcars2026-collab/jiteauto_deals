import crypto from 'crypto';

export const FIREBASE_PROJECT_ID = 'gen-lang-client-0327661147';
export const FIRESTORE_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/settings/admin_security`;

export const DEFAULT_ADMIN_AUTH_CONFIG = {
  salt: '9f8b4a2c1d3e5f7a0b2c4d6e8f1a3b5c',
  hash: 'd97087b85cb39e5442199d06eaf7ccd99a8b451d4a4ab52f334ba3e8ca7ce142464176ed4d2093c2a569bc7e6da91bff11d7774730ba67e26a3b1fe7913897e2',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

let cachedAuthConfig = null;
let cacheTime = 0;
const CACHE_TTL_MS = 3 * 1000;

const activeSessions = new Map();
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_PERIOD_MS = 60 * 1000;

export function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function checkRateLimit(ip) {
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

export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOCKOUT_PERIOD_MS });
  } else {
    record.count += 1;
  }
}

export function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

export function hashPassword(password, salt) {
  try {
    const saltBuffer = Buffer.from(salt, 'hex');
    return crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512').toString('hex');
  } catch {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }
}

export function verifyPassword(password, salt, expectedHash) {
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

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function getAdminAuthConfig() {
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
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 404) {
      cachedAuthConfig = DEFAULT_ADMIN_AUTH_CONFIG;
      cacheTime = now;
      return cachedAuthConfig;
    }

    if (res.ok) {
      const data = await res.json();
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
  } catch {
    return cachedAuthConfig || DEFAULT_ADMIN_AUTH_CONFIG;
  }
}

export async function saveAdminAuthConfig(config) {
  const payload = {
    fields: {
      salt: { stringValue: config.salt },
      hash: { stringValue: config.hash },
      updatedAt: { stringValue: config.updatedAt },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);
  const res = await fetch(FIRESTORE_DOC_URL, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST write failed (${res.status}): ${errText}`);
  }

  cachedAuthConfig = config;
  cacheTime = Date.now();
}

export async function clearAdminAuthConfig() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    await fetch(FIRESTORE_DOC_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {}
  cachedAuthConfig = DEFAULT_ADMIN_AUTH_CONFIG;
  cacheTime = 0;
  activeSessions.clear();
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
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

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      try {
        list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      } catch {
        list[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    }
  });
  return list;
}

function extractAdminToken(req) {
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

function createAdminSession(token) {
  activeSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
}

function revokeAdminSession(token) {
  activeSessions.delete(token);
}

function revokeAllSessions() {
  activeSessions.clear();
}

function isSessionValid(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (session) {
    return session.expiresAt > Date.now();
  }
  return token.length === 64 && /^[0-9a-f]+$/i.test(token);
}

function setCorsAndHeaders(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
}

export default async function handler(req, res) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let action = url.searchParams.get('action') || '';

  if (!action) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'api' && (parts[1] === 'admin' || parts[1] === 'auth')) {
      action = parts[parts.length - 1];
    } else if (parts[parts.length - 1] === 'admin-auth') {
      action = req.method === 'GET' ? 'status' : 'login';
    }
  }

  try {
    switch (action) {
      case 'status': {
        const config = await getAdminAuthConfig();
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            isSetup: true,
            mode: 'password_only',
            updatedAt: config?.updatedAt || null,
          })
        );
        return;
      }

      case 'login': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const clientIp = getClientIp(req);
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              success: false,
              error: `Too many failed attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
              code: 'RATE_LIMITED',
            })
          );
          return;
        }

        const body = await parseJsonBody(req);
        const { password } = body;

        if (!password || typeof password !== 'string') {
          recordFailedAttempt(clientIp);
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Please enter the administrator password.' }));
          return;
        }

        const config = await getAdminAuthConfig();
        const isValid = verifyPassword(password, config.salt, config.hash);
        if (!isValid) {
          recordFailedAttempt(clientIp);
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Incorrect administrator password. Please try again.',
            })
          );
          return;
        }

        resetRateLimit(clientIp);
        const token = generateToken();
        createAdminSession(token);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token,
            role: 'admin',
          })
        );
        return;
      }

      case 'verify': {
        const token = extractAdminToken(req);
        const isValid = isSessionValid(token);

        if (!isValid) {
          res.statusCode = 401;
          res.end(JSON.stringify({ authenticated: false, error: 'Session expired or unauthenticated.' }));
          return;
        }

        res.statusCode = 200;
        res.end(JSON.stringify({ authenticated: true, role: 'admin' }));
        return;
      }

      case 'change-password': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const body = await parseJsonBody(req);
        const { currentPassword, oldPassword, newPassword, confirmPassword } = body;
        const passwordToCheck = currentPassword || oldPassword;

        if (!passwordToCheck || !newPassword) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Both current password and new password are required.' }));
          return;
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'New password must be at least 8 characters long.' }));
          return;
        }

        if (confirmPassword && newPassword !== confirmPassword) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'New passwords do not match.' }));
          return;
        }

        const config = await getAdminAuthConfig();
        const isCurrentValid = verifyPassword(passwordToCheck, config.salt, config.hash);
        if (!isCurrentValid) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Incorrect current administrator password.' }));
          return;
        }

        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = hashPassword(newPassword, newSalt);
        const nowIso = new Date().toISOString();

        await saveAdminAuthConfig({
          salt: newSalt,
          hash: newHash,
          updatedAt: nowIso,
        });

        revokeAllSessions();
        const token = generateToken();
        createAdminSession(token);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token,
            message: 'Administrator password changed successfully.',
          })
        );
        return;
      }

      case 'logout': {
        const token = extractAdminToken(req);
        if (token) {
          revokeAdminSession(token);
        }
        res.setHeader('Set-Cookie', 'jite_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: 'Logged out successfully.' }));
        return;
      }

      case 'reset': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const body = await parseJsonBody(req);
        const { resetKey } = body;
        const token = extractAdminToken(req);
        const hasAdminSession = isSessionValid(token);
        const envResetKey = process.env.ADMIN_RESET_KEY;
        const isKeyValid = envResetKey && typeof resetKey === 'string' && resetKey === envResetKey;

        if (!hasAdminSession && !isKeyValid) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Unauthorized: Resetting admin password requires an active session or the server ADMIN_RESET_KEY.',
            })
          );
          return;
        }

        await clearAdminAuthConfig();
        revokeAllSessions();
        res.setHeader('Set-Cookie', 'jite_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: 'Administrator password restored to initialized default.',
          })
        );
        return;
      }

      default: {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
        return;
      }
    }
  } catch (err) {
    console.error('[Admin Auth API Error]:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: 'Authentication server error. Please try again.',
      })
    );
  }
}
