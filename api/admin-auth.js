import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  loadFirebaseRuntimeConfig,
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreCreateDocument,
  firestoreDeleteDocument,
  firestoreQueryCollection,
  firebaseAuthSignInWithPassword,
  firebaseAuthUpdateAccount,
  firebaseAuthRefreshToken,
  firebaseAuthSendPasswordReset,
} from './firestore-rest.js';
import {
  isSupabaseServerConfigured,
  hasSupabaseServiceRole,
  supabaseRest,
} from '../lib/supabase-rest.js';
import { applyCorsHeaders } from '../lib/cors.js';

const DATA_DIR = path.join(process.cwd(), 'data_store');
const AUTH_STORE_FILE = path.join(DATA_DIR, 'admin_auth.json');
const TMP_AUTH_STORE_FILE = '/tmp/jite_admin_auth.json';

// Server HMAC session signing secret (reads process.env with CSPRNG in-memory fallback)
const SERVER_SESSION_SECRET =
  (process.env.ADMIN_SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

// Cached Google public X.509 certificates for Firebase RS256 ID token verification
let certCache = {
  certs: /** @type {Record<string, string>} */ ({}),
  expiresAt: 0,
};

// In-memory brute-force rate limiter & server security event log
const failedLoginMap = new Map();
const serverSecurityEvents = [];
const MAX_SECURITY_EVENTS = 100;

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function hashIpForAudit(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 10);
}

function maskEmailForAudit(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'unknown';
  const [local, domain] = email.split('@');
  if (!local) return `***@${domain}`;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function pushSecurityEvent(event) {
  const entry = {
    id: `sec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  serverSecurityEvents.unshift(entry);
  if (serverSecurityEvents.length > MAX_SECURITY_EVENTS) {
    serverSecurityEvents.length = MAX_SECURITY_EVENTS;
  }
  return entry;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = failedLoginMap.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      waitSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
    };
  }

  if (now - record.firstAttempt > 5 * 60 * 1000) {
    failedLoginMap.delete(ip);
    return { allowed: true };
  }

  if (record.count >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000;
    return { allowed: false, waitSeconds: 300 };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const existing = failedLoginMap.get(ip);
  if (!existing || now - existing.firstAttempt > 5 * 60 * 1000) {
    failedLoginMap.set(ip, { count: 1, firstAttempt: now });
    return 1;
  }
  existing.count += 1;
  if (existing.count >= 5) {
    existing.lockedUntil = now + 5 * 60 * 1000;
  }
  failedLoginMap.set(ip, existing);
  return existing.count;
}

function clearRateLimit(ip) {
  failedLoginMap.delete(ip);
}

function safeTimingEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPasswordScrypt(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

function verifyPasswordAgainstStored(password, salt, expectedHashHex) {
  if (!password || !salt || !expectedHashHex) return false;
  const computed = crypto.scryptSync(String(password), String(salt), 64);
  const expected = Buffer.from(String(expectedHashHex), 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  if (classes < 3) {
    return {
      valid: false,
      error:
        'Password must combine at least 3 character types (uppercase, lowercase, numbers, or symbols).',
    };
  }
  return { valid: true };
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

function signServerSessionToken(payload) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    sub: payload.sub || 'server_admin_owner',
    email: payload.email,
    fullName: payload.fullName || 'Primary Administrator',
    role: payload.role || 'owner',
    authMode: 'server-credentials',
    envManaged: Boolean(payload.envManaged),
    firebaseSynced: Boolean(payload.firebaseSynced),
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return {
    token: `srv.${encodedPayload}.${signature}`,
    expiresAt: fullPayload.exp * 1000,
    payload: fullPayload,
  };
}

function verifyServerSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('srv.')) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  if (!safeTimingEqual(providedSig, expectedSig)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return null;
  }

  return payload;
}

function readServerCredentialStore() {
  let latest = null;
  let latestMs = -1;
  let bootstrappedFlag = false;
  let primaryAdminUid = null;

  for (const candidatePath of [TMP_AUTH_STORE_FILE, AUTH_STORE_FILE]) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const raw = JSON.parse(fs.readFileSync(candidatePath, 'utf-8'));
      if (raw?.bootstrapped) bootstrappedFlag = true;
      if (raw?.primaryAdminUid && !primaryAdminUid) primaryAdminUid = raw.primaryAdminUid;
      if (
        raw?.credentials &&
        raw.credentials.emailLower &&
        raw.credentials.passwordHash &&
        raw.credentials.salt
      ) {
        const ts =
          Date.parse(raw.updatedAt || raw.credentials.updatedAt || raw.credentials.createdAt || '') || 0;
        if (!latest || ts > latestMs) {
          latestMs = ts;
          latest = {
            configured: true,
            source: candidatePath,
            credentials: raw.credentials,
            inactivityTimeoutMinutes:
              typeof raw.inactivityTimeoutMinutes === 'number' ? raw.inactivityTimeoutMinutes : 30,
            updatedAt: raw.updatedAt || raw.credentials.updatedAt || raw.credentials.createdAt || null,
          };
        }
      }
    } catch {
      // Check next candidate
    }
  }

  if (latest) {
    return {
      ...latest,
      bootstrapped: true,
      primaryAdminUid: primaryAdminUid || latest.credentials?.firebaseUid || null,
    };
  }

  return {
    configured: false,
    bootstrapped: bootstrappedFlag,
    primaryAdminUid,
    source: null,
    credentials: null,
    inactivityTimeoutMinutes: 30,
    updatedAt: null,
  };
}

function writeServerCredentialStore(data) {
  const nowIso = new Date().toISOString();
  const payload = {
    bootstrapped: true,
    authMode: 'server-credentials',
    primaryAdminUid: data.primaryAdminUid || data.credentials?.firebaseUid || null,
    inactivityTimeoutMinutes: data.inactivityTimeoutMinutes || 30,
    credentials: data.credentials,
    updatedAt: nowIso,
  };

  let persisted = false;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    persisted = true;
  } catch {
    // Vercel serverless environments have a read-only workspace directory
  }

  try {
    fs.writeFileSync(TMP_AUTH_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    persisted = true;
  } catch {
    // Ignore if /tmp unavailable
  }

  return persisted;
}

function isPlaceholderEnvValue(val) {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return /^MY_[A-Z0-9_]+$/i.test(trimmed) || /^your[-_]/i.test(trimmed);
}

function readEnvCredentials() {
  const envEmail = (process.env.ADMIN_EMAIL || '').trim();
  const envPassword = process.env.ADMIN_PASSWORD || '';
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const envFullName = (process.env.ADMIN_FULL_NAME || 'Primary Administrator').trim();

  const hasValidEnvEmail = envEmail.includes('@') && !isPlaceholderEnvValue(envEmail);
  const hasValidEnvSecret =
    (!isPlaceholderEnvValue(envPassword) && envPassword.length > 0) ||
    (!isPlaceholderEnvValue(envHash) && envHash.includes(':'));

  if (!hasValidEnvEmail || !hasValidEnvSecret) {
    return null;
  }

  return {
    configured: true,
    envManaged: true,
    email: envEmail,
    emailLower: envEmail.toLowerCase(),
    fullName: envFullName,
    envPassword,
    envHash,
    inactivityTimeoutMinutes: 30,
  };
}

/**
 * Resolves stored or environment credentials with Dashboard Precedence:
 * Dashboard-saved credentials ALWAYS override static env vars when present.
 */
function resolveConfiguredServerCredentials() {
  const stored = readServerCredentialStore();
  const envCfg = readEnvCredentials();

  if (stored.configured && stored.credentials) {
    return {
      configured: true,
      envManaged: false,
      envOverridden: Boolean(envCfg),
      dashboardOverride: Boolean(stored.credentials.dashboardOverride),
      firebaseUid: stored.credentials.firebaseUid || stored.primaryAdminUid || null,
      email: stored.credentials.email,
      emailLower: stored.credentials.emailLower,
      fullName: stored.credentials.fullName || 'Primary Administrator',
      salt: stored.credentials.salt,
      passwordHash: stored.credentials.passwordHash,
      inactivityTimeoutMinutes: stored.inactivityTimeoutMinutes || 30,
      createdAt: stored.credentials.createdAt,
      updatedAt: stored.credentials.updatedAt || stored.updatedAt,
    };
  }

  if (envCfg) {
    return {
      ...envCfg,
      envOverridden: false,
      dashboardOverride: false,
    };
  }

  return {
    configured: false,
    envManaged: false,
    envOverridden: false,
    dashboardOverride: false,
    bootstrapped: stored.bootstrapped,
    primaryAdminUid: stored.primaryAdminUid,
  };
}

function verifyPasswordWithResolvedConfig(email, password, cfg) {
  if (!cfg || !cfg.configured) return false;
  const inputEmailLower = String(email || '').trim().toLowerCase();
  if (!inputEmailLower || !safeTimingEqual(inputEmailLower, cfg.emailLower)) {
    return false;
  }

  if (cfg.envManaged) {
    if (cfg.envHash && cfg.envHash.includes(':')) {
      const [salt, hashHex] = cfg.envHash.split(':');
      return verifyPasswordAgainstStored(password, salt, hashHex);
    }
    if (cfg.envPassword) {
      const inputDigest = crypto.createHash('sha256').update(String(password)).digest('hex');
      const expectedDigest = crypto.createHash('sha256').update(String(cfg.envPassword)).digest('hex');
      return safeTimingEqual(inputDigest, expectedDigest);
    }
    return false;
  }

  return verifyPasswordAgainstStored(password, cfg.salt, cfg.passwordHash);
}

// ============================================================================
// GOOGLE FIREBASE ID TOKEN VERIFICATION
// ============================================================================
async function fetchGooglePublicCerts() {
  const now = Date.now();
  if (certCache.expiresAt > now && Object.keys(certCache.certs).length > 0) {
    return certCache.certs;
  }

  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Unable to fetch Google public certificates (${resp.status})`);
  }

  const certs = await resp.json();
  let maxAgeSec = 3600;
  const cacheControl = resp.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (match && match[1]) {
    maxAgeSec = Math.max(300, Math.min(86400, Number(match[1])));
  }

  certCache = {
    certs,
    expiresAt: now + maxAgeSec * 1000,
  };
  return certs;
}

export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase authentication token.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed authentication token.');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Invalid token encoding.');
  }

  if (header?.alg !== 'RS256' || !header?.kid) {
    throw new Error('Unsupported token algorithm or missing key id.');
  }

  let certs = await fetchGooglePublicCerts();
  let certPem = certs[header.kid];
  if (!certPem) {
    // Force refresh once in case Google rotated keys
    certCache.expiresAt = 0;
    certs = await fetchGooglePublicCerts();
    certPem = certs[header.kid];
    if (!certPem) {
      throw new Error('Unknown signing certificate for token.');
    }
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = base64UrlDecode(sigB64);
  if (!verifier.verify(certPem, signature)) {
    throw new Error('Invalid token cryptographic signature.');
  }

  const { projectId } = loadFirebaseRuntimeConfig();
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error('Token audience mismatch.');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new Error('Invalid token subject.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Authentication session expired. Please sign in again.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Invalid token issued-at timestamp.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === 'string' ? payload.name : '',
    signInProvider: payload.firebase?.sign_in_provider || 'unknown',
    isCustomAdminClaim: payload.admin === true,
    expiresAt: payload.exp * 1000,
  };
}

async function checkFirestoreAdminAuthorization(idToken, decoded) {
  let adminDoc = null;
  try {
    adminDoc = await firestoreGetDocument(`admins/${decoded.uid}`, idToken);
  } catch {
    adminDoc = null;
  }

  if (adminDoc) {
    const isActive = adminDoc.active !== false;
    const role = adminDoc.role === 'owner' ? 'owner' : 'admin';
    return {
      authorized: isActive,
      revoked: !isActive,
      role,
      hasAdminDoc: true,
      invited: false,
      profile: adminDoc,
    };
  }

  // Also check if UID matches primaryAdminUid in settings/admin_bootstrap
  try {
    const bootstrapDoc = await firestoreGetDocument('settings/admin_bootstrap', idToken);
    if (bootstrapDoc && bootstrapDoc.primaryAdminUid === decoded.uid) {
      return {
        authorized: true,
        revoked: false,
        role: 'owner',
        hasAdminDoc: false,
        invited: false,
        profile: null,
      };
    }
  } catch {
    // Ignore
  }

  if (decoded.email && decoded.emailVerified) {
    const emailLower = decoded.email.trim().toLowerCase();
    try {
      const inviteDoc = await firestoreGetDocument(`admin_invites/${emailLower}`, idToken);
      if (inviteDoc && inviteDoc.active !== false) {
        return {
          authorized: true,
          revoked: false,
          role: 'admin',
          hasAdminDoc: false,
          invited: true,
          profile: null,
        };
      }
    } catch {
      // Ignore
    }
  }

  if (decoded.isCustomAdminClaim) {
    return {
      authorized: true,
      revoked: false,
      role: 'admin',
      hasAdminDoc: false,
      invited: false,
      profile: null,
    };
  }

  return {
    authorized: false,
    revoked: false,
    role: null,
    hasAdminDoc: false,
    invited: false,
    profile: null,
  };
}

export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function writeSupabaseAuditSafe({ action, actorUid, actorEmail, status, details, authMethod }) {
  if (!isSupabaseServerConfigured()) return;
  try {
    await supabaseRest('admin_audit_logs', {
      method: 'POST',
      body: {
        action: String(action || 'ADMIN_EVENT').slice(0, 100),
        actor_uid: String(actorUid || 'admin'),
        actor_email: String(actorEmail || ''),
        status: ['success', 'failure', 'warning'].includes(status) ? status : 'success',
        details: String(details || '').slice(0, 500),
        auth_method: String(authMethod || 'password'),
      },
    });
  } catch {
    // Non-blocking audit log write
  }
}

export async function verifyRequestAdmin(req) {
  const bearerToken = extractBearerToken(req) || req.body?.idToken;
  const sidecarFirebaseToken =
    typeof req.headers?.['x-firebase-id-token'] === 'string'
      ? req.headers['x-firebase-id-token'].trim()
      : '';

  const token = bearerToken;
  if (!token) {
    return { authorized: false, error: 'Missing Bearer authentication token.' };
  }

  if (token.startsWith('srv.')) {
    const verified = verifyServerSessionToken(token);
    if (!verified) {
      return { authorized: false, error: 'Session expired or invalid. Please sign in again.' };
    }

    let attachedFirebaseToken = null;
    if (sidecarFirebaseToken && !sidecarFirebaseToken.startsWith('srv.')) {
      try {
        const fbDecoded = await verifyFirebaseIdToken(sidecarFirebaseToken);
        const fsAuth = await checkFirestoreAdminAuthorization(sidecarFirebaseToken, fbDecoded);
        if (fsAuth.authorized) {
          attachedFirebaseToken = sidecarFirebaseToken;
        }
      } catch {
        // Non-blocking
      }
    }

    return {
      authorized: true,
      uid: verified.sub,
      email: verified.email,
      fullName: verified.fullName,
      emailVerified: true,
      role: verified.role || 'owner',
      authMode: 'server-credentials',
      envManaged: Boolean(verified.envManaged),
      signInProvider: 'password',
      firebaseIdToken: attachedFirebaseToken,
    };
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const fsAuth = await checkFirestoreAdminAuthorization(token, decoded);
    if (!fsAuth.authorized) {
      return { authorized: false, error: 'This account does not have administrator access.' };
    }
    return {
      authorized: true,
      uid: decoded.uid,
      email: fsAuth.profile?.email || decoded.email,
      fullName: fsAuth.profile?.displayName || decoded.name || 'Administrator',
      emailVerified: decoded.emailVerified,
      role: fsAuth.role || 'admin',
      authMode: decoded.signInProvider === 'password' ? 'server-credentials' : 'google-firebase',
      signInProvider: decoded.signInProvider,
      inactivityTimeoutMinutes:
        typeof fsAuth.profile?.inactivityTimeoutMinutes === 'number'
          ? fsAuth.profile.inactivityTimeoutMinutes
          : 30,
      firebaseIdToken: token,
    };
  } catch (err) {
    return { authorized: false, error: err?.message || 'Invalid authentication token.' };
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getAction(req) {
  if (req.query?.action) return String(req.query.action);
  try {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const qAction = urlObj.searchParams.get('action');
    if (qAction) return qAction;
    const parts = urlObj.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== 'admin-auth' && last !== 'auth') return last;
  } catch {
    // ignore
  }
  return 'status';
}

function setSecurityHeaders(req, res) {
  applyCorsHeaders(req, res, {
    isPrivate: true,
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-admin-setup-secret, x-firebase-id-token',
    extraNoSniff: true,
  });
}

async function writeFirestoreAuditSafe(idToken, { action, actorUid, actorEmail, status, details, authMethod }) {
  if (!idToken) return;
  try {
    await firestoreCreateDocument(
      'admin_audit_logs',
      {
        action: String(action || 'ADMIN_EVENT').slice(0, 100),
        actorUid: String(actorUid || 'admin'),
        actorEmail: String(actorEmail || ''),
        status: status || 'success',
        details: String(details || '').slice(0, 500),
        authMethod: String(authMethod || 'password'),
        timestamp: new Date().toISOString(),
      },
      idToken
    );
  } catch {
    // Non-blocking audit mirror
  }
}

export default async function handler(req, res) {
  setSecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const action = getAction(req);
  const clientIp = getClientIp(req);

  try {
    // ------------------------------------------------------------------------
    // 1. GET /api/admin-auth?action=status
    //    Reports live server credential configuration (env vars + local store)
    // ------------------------------------------------------------------------
    if (action === 'status' && req.method === 'GET') {
      const cfg = resolveConfiguredServerCredentials();
      const stored = readServerCredentialStore();
      const setupSecretRequired = !isPlaceholderEnvValue(process.env.ADMIN_SETUP_SECRET);
      const isBootstrapped = Boolean(cfg.configured || stored.bootstrapped);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          configured: isBootstrapped,
          bootstrapped: isBootstrapped,
          backend: 'server-credentials',
          supabaseConfigured: isSupabaseServerConfigured(),
          envManaged: Boolean(cfg.envManaged),
          envOverridden: Boolean(cfg.envOverridden),
          setupSecretRequired,
          firebaseAuthConfigured: Boolean(loadFirebaseRuntimeConfig().apiKey),
          passwordLoginAvailable: Boolean(cfg.configured),
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 2. POST /api/admin-auth?action=setup
    //    One-time initial owner setup (locked once env vars or store configured)
    // ------------------------------------------------------------------------
    if (action === 'setup' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const rawSecret = (process.env.ADMIN_SETUP_SECRET || '').trim();
      const configuredSecret = isPlaceholderEnvValue(rawSecret) ? '' : rawSecret;
      const providedSecret = req.headers?.['x-admin-setup-secret'] || body.setupSecret || '';
      const hasValidSetupSecret =
        Boolean(configuredSecret) && safeTimingEqual(String(providedSecret), configuredSecret);

      const cfg = resolveConfiguredServerCredentials();
      const stored = readServerCredentialStore();
      const alreadyBootstrapped = Boolean(cfg.configured || stored.bootstrapped);

      if (alreadyBootstrapped && !hasValidSetupSecret) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'ALREADY_CONFIGURED',
            error:
              'Administrator credentials are already configured. Please sign in with your email and password or manage credentials inside Security Settings.',
          })
        );
        return;
      }

      if (configuredSecret && !hasValidSetupSecret) {
        recordFailedAttempt(clientIp);
        pushSecurityEvent({
          action: 'SETUP_SECRET_REJECTED',
          status: 'warning',
          actorEmailMasked: maskEmailForAudit(body?.email),
          ipTag: hashIpForAudit(clientIp),
          details: 'Invalid setup authorization secret supplied during initial setup.',
        });
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'INVALID_SETUP_SECRET',
            error: 'Setup authorization secret is invalid or missing.',
          })
        );
        return;
      }

      const fullName = String(body?.fullName || '').trim() || 'Primary Administrator';
      const email = String(body?.email || '').trim();
      const password = String(body?.password || '');

      if (!email || !email.includes('@')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
        return;
      }

      const pwCheck = validatePasswordPolicy(password);
      if (!pwCheck.valid) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: pwCheck.error }));
        return;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordScrypt(password, salt);
      const nowIso = new Date().toISOString();

      writeServerCredentialStore({
        inactivityTimeoutMinutes: 30,
        credentials: {
          fullName,
          email,
          emailLower: email.toLowerCase(),
          salt,
          passwordHash,
          dashboardOverride: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      });

      const signed = signServerSessionToken({
        sub: 'server_admin_owner',
        email,
        fullName,
        role: 'owner',
        envManaged: false,
        firebaseSynced: false,
      });

      pushSecurityEvent({
        action: 'SERVER_ADMIN_CONFIGURED',
        status: 'success',
        actorEmailMasked: maskEmailForAudit(email),
        ipTag: hashIpForAudit(clientIp),
        details: 'Administrator email & password configured cleanly.',
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          token: signed.token,
          expiresAt: signed.expiresAt,
          admin: {
            uid: signed.payload.sub,
            email,
            displayName: fullName,
            role: 'owner',
            authMode: 'server-credentials',
            firebaseSynced: false,
            envManaged: false,
            inactivityTimeoutMinutes: 30,
          },
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 3. POST /api/admin-auth?action=login
    //    Verifies Email + Password directly against ADMIN_EMAIL/ADMIN_PASSWORD
    //    env vars or server credential store (zero Supabase Auth dependency)
    // ------------------------------------------------------------------------
    if (action === 'login' && req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.statusCode = 429;
        res.end(
          JSON.stringify({
            success: false,
            code: 'RATE_LIMITED',
            waitSeconds: rateCheck.waitSeconds,
            error: `Too many failed sign-in attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const email = String(body?.email || '').trim();
      const password = String(body?.password || '');

      if (!email || !password) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Please enter both your administrator email and password.',
          })
        );
        return;
      }

      const stored = readServerCredentialStore();
      const envCfg = readEnvCredentials();
      const hasDashboardOverride = Boolean(
        stored.configured && stored.credentials?.dashboardOverride
      );

      // Step A: Verify against active local/dashboard credential store (if present)
      if (
        stored.configured &&
        stored.credentials &&
        verifyPasswordWithResolvedConfig(email, password, {
          configured: true,
          envManaged: false,
          email: stored.credentials.email,
          emailLower: stored.credentials.emailLower,
          salt: stored.credentials.salt,
          passwordHash: stored.credentials.passwordHash,
        })
      ) {
        clearRateLimit(clientIp);
        const signed = signServerSessionToken({
          sub: stored.credentials.firebaseUid || stored.primaryAdminUid || 'server_admin_owner',
          email: stored.credentials.email,
          fullName: stored.credentials.fullName || 'Primary Administrator',
          role: 'owner',
          envManaged: false,
          firebaseSynced: false,
        });

        pushSecurityEvent({
          action: 'LOGIN_SUCCESS',
          status: 'success',
          actorEmailMasked: maskEmailForAudit(stored.credentials.email),
          ipTag: hashIpForAudit(clientIp),
          details: 'Administrator signed in via server credentials store.',
        });

        await writeSupabaseAuditSafe({
          action: 'LOGIN_SUCCESS',
          actorUid: signed.payload.sub,
          actorEmail: stored.credentials.email,
          status: 'success',
          details: 'Administrator signed in with Email and Password.',
          authMethod: 'password',
        });

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: signed.token,
            expiresAt: signed.expiresAt,
            admin: {
              uid: signed.payload.sub,
              email: stored.credentials.email,
              displayName: stored.credentials.fullName || 'Primary Administrator',
              role: 'owner',
              authMode: 'server-credentials',
              firebaseSynced: false,
              envManaged: false,
              inactivityTimeoutMinutes: stored.inactivityTimeoutMinutes || 30,
            },
          })
        );
        return;
      }

      // Step B: Verify against ADMIN_EMAIL + ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) env variables
      if (!hasDashboardOverride && envCfg && verifyPasswordWithResolvedConfig(email, password, envCfg)) {
        clearRateLimit(clientIp);
        const signed = signServerSessionToken({
          sub: 'server_admin_owner',
          email: envCfg.email,
          fullName: envCfg.fullName,
          role: 'owner',
          envManaged: true,
          firebaseSynced: false,
        });

        pushSecurityEvent({
          action: 'LOGIN_SUCCESS',
          status: 'success',
          actorEmailMasked: maskEmailForAudit(envCfg.email),
          ipTag: hashIpForAudit(clientIp),
          details: 'Administrator signed in with environment variables (ADMIN_EMAIL / ADMIN_PASSWORD).',
        });

        await writeSupabaseAuditSafe({
          action: 'LOGIN_SUCCESS',
          actorUid: signed.payload.sub,
          actorEmail: envCfg.email,
          status: 'success',
          details: 'Administrator signed in with configured server environment variables.',
          authMethod: 'password',
        });

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: signed.token,
            expiresAt: signed.expiresAt,
            admin: {
              uid: signed.payload.sub,
              email: envCfg.email,
              displayName: envCfg.fullName,
              role: 'owner',
              authMode: 'server-credentials',
              firebaseSynced: false,
              envManaged: true,
              inactivityTimeoutMinutes: 30,
            },
          })
        );
        return;
      }

      // Missing server credentials diagnostic
      if (!stored.configured && !envCfg) {
        pushSecurityEvent({
          action: 'LOGIN_FAILED_NO_CREDENTIALS',
          status: 'warning',
          actorEmailMasked: maskEmailForAudit(email),
          ipTag: hashIpForAudit(clientIp),
          details: 'Server lacks ADMIN_EMAIL/ADMIN_PASSWORD and no local credential file exists.',
        });
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            code: 'SERVER_CREDENTIALS_MISSING',
            error:
              'No email/password credentials are configured on this server (set ADMIN_EMAIL and ADMIN_PASSWORD environment variables, or complete First-Time Administrator Setup).',
          })
        );
        return;
      }

      // Rejected login
      const attempts = recordFailedAttempt(clientIp);
      pushSecurityEvent({
        action: 'LOGIN_FAILED',
        status: attempts >= 5 ? 'warning' : 'failure',
        actorEmailMasked: maskEmailForAudit(email),
        ipTag: hashIpForAudit(clientIp),
        details:
          attempts >= 5
            ? 'Repeated invalid password attempts triggered 5-minute cooldown.'
            : 'Incorrect administrator email or password.',
      });
      const updatedRate = checkRateLimit(clientIp);
      res.statusCode = updatedRate.allowed ? 401 : 429;
      res.end(
        JSON.stringify({
          success: false,
          code: updatedRate.allowed ? 'INVALID_CREDENTIALS' : 'RATE_LIMITED',
          error: updatedRate.allowed
            ? 'The email or password you entered is incorrect. Please try again.'
            : `Too many failed attempts. Please wait ${updatedRate.waitSeconds} seconds.`,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 4. POST /api/admin-auth?action=refresh
    //    Refreshes Firebase RS256 ID token cleanly before expiration
    // ------------------------------------------------------------------------
    if (action === 'refresh' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const refreshToken = String(body?.refreshToken || '').trim();
      if (!refreshToken) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Missing refresh token.' }));
        return;
      }

      try {
        const refreshed = await firebaseAuthRefreshToken(refreshToken);
        const decoded = await verifyFirebaseIdToken(refreshed.idToken);
        const fsAuth = await checkFirestoreAdminAuthorization(refreshed.idToken, decoded);
        if (!fsAuth.authorized) {
          res.statusCode = 403;
          res.end(JSON.stringify({ success: false, error: 'Administrator access revoked.' }));
          return;
        }

        const resolvedName = fsAuth.profile?.displayName || decoded.name || 'Primary Administrator';
        const signed = signServerSessionToken({
          sub: decoded.uid,
          email: fsAuth.profile?.email || decoded.email,
          fullName: resolvedName,
          role: fsAuth.role || 'owner',
          envManaged: false,
          firebaseSynced: true,
        });

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: signed.token,
            expiresAt: signed.expiresAt,
            firebaseIdToken: refreshed.idToken,
            firebaseRefreshToken: refreshed.refreshToken,
            firebaseExpiresAt: refreshed.expiresAt,
          })
        );
      } catch (err) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: err?.message || 'Session refresh failed.' }));
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 5. POST /api/admin-auth?action=update-credentials
    //    Dashboard ALWAYS takes precedence over env vars & updates Firebase Auth + Firestore
    // ------------------------------------------------------------------------
    if (action === 'update-credentials' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Active administrator session required.' }));
        return;
      }

      const body = await readJsonBody(req);
      const stored = readServerCredentialStore();
      const cfg = resolveConfiguredServerCredentials();

      const wantsPasswordChange =
        typeof body?.newPassword === 'string' && body.newPassword.length > 0;
      const wantsEmailChange =
        typeof body?.newEmail === 'string' && body.newEmail.trim().length > 0;

      if (wantsEmailChange && !String(body.newEmail).trim().includes('@')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
        return;
      }
      if (wantsPasswordChange) {
        const pwCheck = validatePasswordPolicy(body.newPassword);
        if (!pwCheck.valid) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: pwCheck.error }));
          return;
        }
      }

      let activeFirebaseIdToken = adminCheck.firebaseIdToken || '';
      let activeFirebaseRefreshToken = String(body?.firebaseRefreshToken || '').trim();
      let activeFirebaseExpiresAt = 0;
      let activeUid = adminCheck.uid || cfg.firebaseUid || 'server_admin_owner';
      let currentEmail = adminCheck.email || cfg.email || '';

      // Require and verify current password when changing email or password
      if (wantsPasswordChange || wantsEmailChange) {
        const currentPassword = String(body?.currentPassword || '');
        if (!currentPassword) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Please enter your current password to verify your identity.',
            })
          );
          return;
        }

        let verified = verifyPasswordWithResolvedConfig(currentEmail, currentPassword, cfg);
        if (!verified && currentEmail && activeFirebaseIdToken) {
          try {
            const reauth = await firebaseAuthSignInWithPassword(currentEmail, currentPassword);
            activeFirebaseIdToken = reauth.idToken;
            activeFirebaseRefreshToken = reauth.refreshToken;
            activeFirebaseExpiresAt = reauth.expiresAt;
            activeUid = reauth.uid || activeUid;
            verified = true;
          } catch {
            verified = false;
          }
        }

        if (!verified) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Your current password could not be verified. Please try again.',
            })
          );
          return;
        }
      }

      let nextEmail = currentEmail || cfg.email || '';
      let nextFullName =
        (typeof body?.fullName === 'string' && body.fullName.trim().length >= 2
          ? body.fullName.trim()
          : adminCheck.fullName || cfg.fullName) || 'Primary Administrator';
      let nextTimeout =
        typeof body?.inactivityTimeoutMinutes === 'number' &&
        body.inactivityTimeoutMinutes >= 5 &&
        body.inactivityTimeoutMinutes <= 180
          ? body.inactivityTimeoutMinutes
          : adminCheck.inactivityTimeoutMinutes || cfg.inactivityTimeoutMinutes || 30;

      // Apply password & email updates directly to Firebase Auth when we hold a Firebase ID token
      if (activeFirebaseIdToken && (wantsPasswordChange || wantsEmailChange || typeof body?.fullName === 'string')) {
        try {
          if (wantsPasswordChange) {
            const pwRes = await firebaseAuthUpdateAccount({
              idToken: activeFirebaseIdToken,
              password: body.newPassword,
            });
            activeFirebaseIdToken = pwRes.idToken || activeFirebaseIdToken;
            if (pwRes.refreshToken) activeFirebaseRefreshToken = pwRes.refreshToken;
            if (pwRes.expiresAt) activeFirebaseExpiresAt = pwRes.expiresAt;
          }

          if (wantsEmailChange) {
            const cleanNewEmail = body.newEmail.trim();
            try {
              const emailRes = await firebaseAuthUpdateAccount({
                idToken: activeFirebaseIdToken,
                email: cleanNewEmail,
              });
              activeFirebaseIdToken = emailRes.idToken || activeFirebaseIdToken;
              if (emailRes.refreshToken) activeFirebaseRefreshToken = emailRes.refreshToken;
              if (emailRes.expiresAt) activeFirebaseExpiresAt = emailRes.expiresAt;
              nextEmail = emailRes.email || cleanNewEmail;
            } catch (emailErr) {
              const errCode = String(emailErr?.code || emailErr?.message || '');
              if (errCode.includes('EMAIL_EXISTS')) {
                res.statusCode = 409;
                res.end(
                  JSON.stringify({
                    success: false,
                    error: 'That email address is already used by another account.',
                  })
                );
                return;
              }
              if (errCode.includes('OPERATION_NOT_ALLOWED') || errCode.includes('VERIFICATION')) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    success: false,
                    error:
                      'Firebase project policy requires email-link verification before changing the primary email address, or updating via Firebase Authentication settings.',
                  })
                );
                return;
              }
              throw emailErr;
            }
          }

          if (typeof body?.fullName === 'string' && body.fullName.trim().length >= 2) {
            await firebaseAuthUpdateAccount({
              idToken: activeFirebaseIdToken,
              displayName: nextFullName,
            }).catch(() => {});
          }
        } catch (fbUpdateErr) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error:
                fbUpdateErr?.message ||
                'Failed to synchronize credential changes with Firebase Authentication.',
            })
          );
          return;
        }
      } else if (wantsEmailChange) {
        nextEmail = body.newEmail.trim();
      }

      const nowIso = new Date().toISOString();
      let nextSalt = stored.credentials?.salt || cfg.salt || '';
      let nextHash = stored.credentials?.passwordHash || cfg.passwordHash || '';

      if (wantsPasswordChange) {
        nextSalt = crypto.randomBytes(16).toString('hex');
        nextHash = hashPasswordScrypt(body.newPassword, nextSalt);
      } else if (body?.currentPassword && (!nextSalt || !nextHash)) {
        nextSalt = crypto.randomBytes(16).toString('hex');
        nextHash = hashPasswordScrypt(body.currentPassword, nextSalt);
      }

      if (nextEmail && nextSalt && nextHash) {
        writeServerCredentialStore({
          primaryAdminUid: activeUid,
          inactivityTimeoutMinutes: nextTimeout,
          credentials: {
            firebaseUid: activeUid,
            fullName: nextFullName,
            email: nextEmail,
            emailLower: nextEmail.toLowerCase(),
            salt: nextSalt,
            passwordHash: nextHash,
            dashboardOverride: true,
            createdAt: stored.credentials?.createdAt || cfg.createdAt || nowIso,
            updatedAt: nowIso,
          },
        });
      }

      // Persist profile, timeout, and Dashboard Override marker to Cloud Firestore
      if (activeFirebaseIdToken && activeUid) {
        await Promise.allSettled([
          firestorePatchDocument(
            `admins/${activeUid}`,
            {
              uid: activeUid,
              email: nextEmail,
              displayName: nextFullName,
              role: adminCheck.role || 'owner',
              active: true,
              inactivityTimeoutMinutes: nextTimeout,
              updatedAt: nowIso,
            },
            activeFirebaseIdToken,
            ['uid', 'email', 'displayName', 'role', 'active', 'inactivityTimeoutMinutes', 'updatedAt']
          ),
          firestorePatchDocument(
            'settings/admin_bootstrap',
            {
              setupCompleted: true,
              primaryAdminUid: activeUid,
              dashboardOverride: true,
              updatedAt: nowIso,
              ...(wantsPasswordChange ? { passwordUpdatedAt: nowIso } : {}),
            },
            activeFirebaseIdToken,
            [
              'setupCompleted',
              'primaryAdminUid',
              'dashboardOverride',
              'updatedAt',
              ...(wantsPasswordChange ? ['passwordUpdatedAt'] : []),
            ]
          ),
        ]);
      }

      const refreshed = signServerSessionToken({
        sub: activeUid,
        email: nextEmail,
        fullName: nextFullName,
        role: adminCheck.role || 'owner',
        envManaged: false,
        firebaseSynced: Boolean(activeFirebaseIdToken),
      });

      const actionLabel = wantsPasswordChange
        ? 'PASSWORD_CHANGED'
        : wantsEmailChange
        ? 'EMAIL_CHANGED'
        : 'PROFILE_UPDATED';
      const actionDetail = wantsPasswordChange
        ? 'Administrator password updated from Dashboard and synced globally.'
        : wantsEmailChange
        ? `Administrator login email updated to ${nextEmail} and synced globally.`
        : `Updated administrator profile ("${nextFullName}", timeout ${nextTimeout} min).`;

      pushSecurityEvent({
        action: actionLabel,
        status: 'success',
        actorEmailMasked: maskEmailForAudit(nextEmail),
        ipTag: hashIpForAudit(clientIp),
        details: actionDetail,
      });

      await writeFirestoreAuditSafe(activeFirebaseIdToken, {
        action: actionLabel,
        actorUid: activeUid,
        actorEmail: nextEmail,
        status: 'success',
        details: actionDetail,
        authMethod: 'password',
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          token: refreshed.token,
          expiresAt: refreshed.expiresAt,
          ...(activeFirebaseIdToken ? { firebaseIdToken: activeFirebaseIdToken } : {}),
          ...(activeFirebaseRefreshToken ? { firebaseRefreshToken: activeFirebaseRefreshToken } : {}),
          ...(activeFirebaseExpiresAt ? { firebaseExpiresAt: activeFirebaseExpiresAt } : {}),
          admin: {
            uid: activeUid,
            email: nextEmail,
            displayName: nextFullName,
            role: adminCheck.role || 'owner',
            authMode: 'server-credentials',
            firebaseSynced: Boolean(activeFirebaseIdToken),
            envManaged: false,
            inactivityTimeoutMinutes: nextTimeout,
            updatedAt: nowIso,
          },
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 6. POST /api/admin-auth?action=password-reset
    //    Sends real Firebase Authentication Password Reset email cleanly
    // ------------------------------------------------------------------------
    if (action === 'password-reset' && req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.statusCode = 429;
        res.end(
          JSON.stringify({
            success: false,
            error: `Too many requests. Please wait ${rateCheck.waitSeconds} seconds.`,
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const email = String(body?.email || '').trim();
      if (!email || !email.includes('@')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
        return;
      }

      try {
        await firebaseAuthSendPasswordReset(email);
        pushSecurityEvent({
          action: 'PASSWORD_RESET_DISPATCHED',
          status: 'success',
          actorEmailMasked: maskEmailForAudit(email),
          ipTag: hashIpForAudit(clientIp),
          details: 'Password recovery email dispatched via Firebase Authentication.',
        });
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `A password reset link has been sent to ${email}. Check your inbox (and spam folder) and follow the link to set a new password.`,
          })
        );
      } catch (err) {
        const code = String(err?.code || err?.message || '');
        if (code.includes('TOO_MANY_ATTEMPTS') || err?.status === 429) {
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Too many reset requests. Please wait a few minutes and try again.',
            })
          );
          return;
        }
        // Return neutral privacy-safe confirmation if EMAIL_NOT_FOUND
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `If an administrator account exists for ${email}, a password reset link has been sent.`,
          })
        );
      }
      return;
    }

    // ------------------------------------------------------------------------
    // 7. POST /api/admin-auth?action=verify-session
    // ------------------------------------------------------------------------
    if (action === 'verify-session' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            code: 'UNAUTHENTICATED',
            error: adminCheck.error || 'Authentication could not be verified.',
          })
        );
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          uid: adminCheck.uid,
          email: adminCheck.email,
          emailVerified: adminCheck.emailVerified,
          role: adminCheck.role,
          authMode: adminCheck.authMode,
          signInProvider: adminCheck.signInProvider,
          supabaseSynced: false,
          firebaseSynced: Boolean(adminCheck.firebaseIdToken),
          bootstrapped: true,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 8. POST /api/admin-auth?action=record-audit (Admin-only)
    // ------------------------------------------------------------------------
    if (action === 'record-audit' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }
      const body = await readJsonBody(req);
      pushSecurityEvent({
        action: String(body?.action || 'ADMIN_EVENT').slice(0, 100),
        status: ['success', 'failure', 'warning'].includes(body?.status) ? body.status : 'success',
        actorEmailMasked: maskEmailForAudit(adminCheck.email),
        ipTag: hashIpForAudit(clientIp),
        details: String(body?.details || '').slice(0, 500),
      });
      if (isSupabaseServerConfigured()) {
        await writeSupabaseAuditSafe({
          action: body?.action,
          actorUid: adminCheck.uid,
          actorEmail: adminCheck.email,
          status: body?.status,
          details: body?.details,
          authMethod: body?.authMethod || adminCheck.signInProvider || 'password',
        });
      } else {
        await writeFirestoreAuditSafe(adminCheck.firebaseIdToken, {
          action: body?.action,
          actorUid: adminCheck.uid,
          actorEmail: adminCheck.email,
          status: body?.status,
          details: body?.details,
          authMethod: body?.authMethod || adminCheck.signInProvider || 'password',
        });
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ------------------------------------------------------------------------
    // 9. GET /api/admin-auth?action=audit-logs (Admin-only, merged DB + server events)
    // ------------------------------------------------------------------------
    if (action === 'audit-logs' && req.method === 'GET') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      const urlObj = new URL(req.url || '/', 'http://localhost');
      const maxEntries = Math.min(100, Math.max(5, Number(urlObj.searchParams.get('limit')) || 50));
      const entries = [];

      if (isSupabaseServerConfigured() && hasSupabaseServiceRole()) {
        try {
          const rows = await supabaseRest(
            `admin_audit_logs?select=*&order=created_at.desc&limit=${maxEntries}`,
            {
              useServiceRole: true,
            }
          );
          if (Array.isArray(rows)) {
            for (const item of rows) {
              entries.push({
                id: String(item.id),
                action: String(item.action || 'ADMIN_EVENT'),
                actorUid: String(item.actor_uid || ''),
                actorEmail: typeof item.actor_email === 'string' ? item.actor_email : undefined,
                status: item.status || 'success',
                details: String(item.details || ''),
                authMethod: typeof item.auth_method === 'string' ? item.auth_method : undefined,
                timestamp: String(item.created_at || new Date().toISOString()),
                source: 'supabase',
              });
            }
          }
        } catch {
          // Non-blocking fallback
        }
      } else if (adminCheck.firebaseIdToken) {
        try {
          const fsLogs = await firestoreQueryCollection('admin_audit_logs', {
            idToken: adminCheck.firebaseIdToken,
            orderByField: 'timestamp',
            orderDirection: 'DESCENDING',
            limitCount: maxEntries,
          });
          for (const item of fsLogs) {
            entries.push({
              id: item.id,
              action: String(item.action || 'ADMIN_EVENT'),
              actorUid: String(item.actorUid || ''),
              actorEmail: typeof item.actorEmail === 'string' ? item.actorEmail : undefined,
              status: item.status || 'success',
              details: String(item.details || ''),
              authMethod: typeof item.authMethod === 'string' ? item.authMethod : undefined,
              timestamp: String(item.timestamp || new Date().toISOString()),
              source: 'firestore',
            });
          }
        } catch {
          // Non-blocking fallback
        }
      }

      for (const ev of serverSecurityEvents) {
        entries.push({
          id: String(ev.id),
          action: String(ev.action || 'SECURITY_EVENT'),
          actorUid: String(ev.ipTag || 'network'),
          actorEmail: typeof ev.actorEmailMasked === 'string' ? ev.actorEmailMasked : undefined,
          status: ev.status || 'warning',
          details: String(ev.details || ''),
          authMethod: 'server-security',
          timestamp: String(ev.timestamp || new Date().toISOString()),
          source: 'security-server',
        });
      }

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, logs: entries.slice(0, maxEntries) }));
      return;
    }

    // ------------------------------------------------------------------------
    // 10. Access Registry (admin_profiles / admin_invites)
    // ------------------------------------------------------------------------
    if (action === 'access-registry' && req.method === 'GET') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      let admins = [];
      let invites = [];

      if (isSupabaseServerConfigured() && hasSupabaseServiceRole()) {
        const [sbAdmins, sbInvites] = await Promise.all([
          supabaseRest('admin_profiles?select=*', {
            useServiceRole: true,
          }).catch(() => []),
          supabaseRest('admin_invites?select=*', {
            useServiceRole: true,
          }).catch(() => []),
        ]);
        if (Array.isArray(sbAdmins)) {
          admins = sbAdmins.map((d) => ({
            uid: d.id,
            email: String(d.email || ''),
            displayName: typeof d.full_name === 'string' ? d.full_name : undefined,
            role: d.role === 'owner' ? 'owner' : 'admin',
            authMethods: Array.isArray(d.auth_methods) ? d.auth_methods : ['password'],
            active: d.active !== false,
            inactivityTimeoutMinutes:
              typeof d.inactivity_timeout_minutes === 'number' ? d.inactivity_timeout_minutes : 30,
            lastLoginAt: typeof d.last_login_at === 'string' ? d.last_login_at : undefined,
            createdAt: typeof d.created_at === 'string' ? d.created_at : undefined,
            updatedAt: typeof d.updated_at === 'string' ? d.updated_at : undefined,
          }));
        }
        if (Array.isArray(sbInvites)) {
          invites = sbInvites.map((d) => ({
            email: String(d.email || d.email_lower),
            displayName: typeof d.display_name === 'string' ? d.display_name : undefined,
            role: 'admin',
            active: d.active !== false,
            invitedByUid: typeof d.invited_by_uid === 'string' ? d.invited_by_uid : undefined,
            createdAt: typeof d.created_at === 'string' ? d.created_at : undefined,
            updatedAt: typeof d.updated_at === 'string' ? d.updated_at : undefined,
          }));
        }
      } else if (adminCheck.firebaseIdToken) {
        const [fsAdmins, fsInvites] = await Promise.all([
          firestoreQueryCollection('admins', { idToken: adminCheck.firebaseIdToken }).catch(() => []),
          firestoreQueryCollection('admin_invites', { idToken: adminCheck.firebaseIdToken }).catch(
            () => []
          ),
        ]);
        admins = fsAdmins.map((d) => ({
          uid: d.uid || d.id,
          email: String(d.email || ''),
          displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
          role: d.role === 'owner' ? 'owner' : 'admin',
          authMethods: Array.isArray(d.authMethods) ? d.authMethods : ['password'],
          active: d.active !== false,
          inactivityTimeoutMinutes:
            typeof d.inactivityTimeoutMinutes === 'number' ? d.inactivityTimeoutMinutes : 30,
          lastLoginAt: typeof d.lastLoginAt === 'string' ? d.lastLoginAt : undefined,
          createdAt: typeof d.createdAt === 'string' ? d.createdAt : undefined,
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
        }));
        invites = fsInvites.map((d) => ({
          email: String(d.email || d.id),
          displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
          role: 'admin',
          active: d.active !== false,
          invitedByUid: typeof d.invitedByUid === 'string' ? d.invitedByUid : undefined,
          createdAt: typeof d.createdAt === 'string' ? d.createdAt : undefined,
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
        }));
      }

      if (admins.length === 0) {
        admins.push({
          uid: adminCheck.uid || 'server_admin_owner',
          email: adminCheck.email || '',
          displayName: adminCheck.fullName || 'Primary Administrator',
          role: adminCheck.role || 'owner',
          authMethods: ['password'],
          active: true,
          inactivityTimeoutMinutes: adminCheck.inactivityTimeoutMinutes || 30,
        });
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, admins, invites }));
      return;
    }

    if (action === 'authorize-admin' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Cloud-synced administrator session required.',
          })
        );
        return;
      }

      if (adminCheck.role !== 'owner') {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Only the primary business owner can authorize additional administrators.',
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const cleanUid = String(body?.uid || '').trim();
      const cleanEmail = String(body?.email || '').trim();
      const cleanName = String(body?.displayName || '').trim();
      const cleanRole = body?.role === 'owner' ? 'owner' : 'admin';

      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Valid administrator email is required.' }));
        return;
      }
      if (!cleanName || cleanName.length < 2) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Administrator full name is required.' }));
        return;
      }

      const nowIso = new Date().toISOString();
      if (isSupabaseServerConfigured() && hasSupabaseServiceRole()) {
        if (cleanUid) {
          await supabaseRest('admin_profiles', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            useServiceRole: true,
            body: {
              id: cleanUid,
              email: cleanEmail,
              full_name: cleanName,
              role: cleanRole,
              active: true,
              auth_methods: ['password'],
              created_at: nowIso,
              updated_at: nowIso,
            },
          });
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, mode: 'uid' }));
          return;
        }

        const emailLower = cleanEmail.toLowerCase();
        await supabaseRest('admin_invites', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          useServiceRole: true,
          body: {
            email_lower: emailLower,
            email: cleanEmail,
            display_name: cleanName,
            role: 'admin',
            active: true,
            invited_by_uid: adminCheck.uid || null,
            created_at: nowIso,
            updated_at: nowIso,
          },
        });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, mode: 'invite' }));
        return;
      }

      if (!adminCheck.firebaseIdToken) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Cloud-synced administrator session required.',
          })
        );
        return;
      }

      if (cleanUid) {
        if (cleanUid.length < 6) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Auth UID appears too short.' }));
          return;
        }
        await firestorePatchDocument(
          `admins/${cleanUid}`,
          {
            uid: cleanUid,
            email: cleanEmail,
            displayName: cleanName,
            role: cleanRole,
            active: true,
            authMethods: [],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          adminCheck.firebaseIdToken
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, mode: 'uid' }));
        return;
      }

      const emailLower = cleanEmail.toLowerCase();
      await firestorePatchDocument(
        `admin_invites/${emailLower}`,
        {
          email: cleanEmail,
          displayName: cleanName,
          role: 'admin',
          active: true,
          invitedByUid: adminCheck.uid || '',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        adminCheck.firebaseIdToken
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, mode: 'invite' }));
      return;
    }

    if (action === 'toggle-admin' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }
      if (adminCheck.role !== 'owner') {
        res.statusCode = 403;
        res.end(JSON.stringify({ success: false, error: 'Owner permissions required.' }));
        return;
      }
      const body = await readJsonBody(req);
      const targetUid = String(body?.uid || '').trim();
      const active = Boolean(body?.active);
      const targetRole = body?.role;

      if (!targetUid) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Missing target administrator UID.' }));
        return;
      }
      if (targetUid === adminCheck.uid && !active) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: 'You cannot revoke your own currently active administrator account.',
          })
        );
        return;
      }
      if (targetRole === 'owner' && !active) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error: 'Primary owner accounts are protected and cannot be revoked.',
          })
        );
        return;
      }

      if (isSupabaseServerConfigured() && hasSupabaseServiceRole()) {
        await supabaseRest(`admin_profiles?id=eq.${encodeURIComponent(targetUid)}`, {
          method: 'PATCH',
          useServiceRole: true,
          body: { active, updated_at: new Date().toISOString() },
        });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (!adminCheck.firebaseIdToken) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      await firestorePatchDocument(
        `admins/${targetUid}`,
        { active, updatedAt: new Date().toISOString() },
        adminCheck.firebaseIdToken,
        ['active', 'updatedAt']
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (action === 'remove-invite' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }
      if (adminCheck.role !== 'owner') {
        res.statusCode = 403;
        res.end(JSON.stringify({ success: false, error: 'Owner permissions required.' }));
        return;
      }
      const body = await readJsonBody(req);
      const emailLower = String(body?.email || '').trim().toLowerCase();
      if (!emailLower) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Missing invitation email.' }));
        return;
      }
      if (isSupabaseServerConfigured() && hasSupabaseServiceRole()) {
        await supabaseRest(`admin_invites?email_lower=eq.${encodeURIComponent(emailLower)}`, {
          method: 'DELETE',
          useServiceRole: true,
        });
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (!adminCheck.firebaseIdToken) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }
      await firestoreDeleteDocument(`admin_invites/${emailLower}`, adminCheck.firebaseIdToken);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ------------------------------------------------------------------------
    // 11. POST /api/admin-auth?action=record-security-event
    // ------------------------------------------------------------------------
    if (action === 'record-security-event' && req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.statusCode = 429;
        res.end(
          JSON.stringify({
            success: false,
            code: 'RATE_LIMITED',
            waitSeconds: rateCheck.waitSeconds,
            error: `Too many failed sign-in attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const attemptCount = recordFailedAttempt(clientIp);
      pushSecurityEvent({
        action: 'LOGIN_FAILED',
        status: attemptCount >= 5 ? 'warning' : 'failure',
        actorEmailMasked: maskEmailForAudit(body?.emailHint),
        ipTag: hashIpForAudit(clientIp),
        details:
          attemptCount >= 5
            ? 'Repeated failed login attempts triggered temporary 5-minute rate lock.'
            : 'Unsuccessful administrator sign-in attempt.',
      });

      const updatedRate = checkRateLimit(clientIp);
      res.statusCode = updatedRate.allowed ? 200 : 429;
      res.end(
        JSON.stringify({
          success: true,
          rateLimited: !updatedRate.allowed,
          waitSeconds: updatedRate.waitSeconds || 0,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 12. GET /api/admin-auth?action=security-events (Admin-only)
    // ------------------------------------------------------------------------
    if (action === 'security-events' && req.method === 'GET') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          events: serverSecurityEvents,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 13. GET /api/admin-auth?action=diagnostics (Admin-only live health check)
    // ------------------------------------------------------------------------
    if (action === 'diagnostics' && req.method === 'GET') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      const cfg = resolveConfiguredServerCredentials();
      const setupSecretConfigured = !isPlaceholderEnvValue(process.env.ADMIN_SETUP_SECRET);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          backend: 'server-credentials',
          supabaseConfigured: isSupabaseServerConfigured(),
          uid: adminCheck.uid,
          role: adminCheck.role,
          authMode: adminCheck.authMode,
          emailVerified: adminCheck.emailVerified,
          supabaseSynced: false,
          firebaseSynced: Boolean(adminCheck.firebaseIdToken),
          dashboardOverrideActive: Boolean(cfg.dashboardOverride),
          serverCredentialsConfigured: Boolean(cfg.configured),
          envManaged: Boolean(cfg.envManaged),
          setupSecretConfigured,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 14. POST /api/admin-auth?action=logout
    // ------------------------------------------------------------------------
    if (action === 'logout' && req.method === 'POST') {
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found.' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        error: err?.message || 'Internal authentication verification error.',
      })
    );
  }
}

export async function getAdminAuthConfig() {
  const cfg = resolveConfiguredServerCredentials();
  const stored = readServerCredentialStore();
  const isBootstrapped = Boolean(cfg.configured || stored.bootstrapped);
  return {
    bootstrapped: isBootstrapped,
    configured: isBootstrapped,
    envManaged: Boolean(cfg.envManaged),
    backend: 'server-credentials',
  };
}

export { loadFirebaseRuntimeConfig };
