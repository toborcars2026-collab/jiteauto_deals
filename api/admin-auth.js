import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_PROJECT_ID = 'gen-lang-client-0327661147';
const DEFAULT_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';

function loadFirebaseRuntimeConfig() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: process.env.FIREBASE_PROJECT_ID || parsed.projectId || DEFAULT_PROJECT_ID,
        databaseId: process.env.FIRESTORE_DATABASE_ID || parsed.firestoreDatabaseId || DEFAULT_DATABASE_ID,
      };
    }
  } catch {
    // Fallback to defaults
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    databaseId: process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID,
  };
}

const DATA_DIR = path.join(process.cwd(), 'data_store');
const AUTH_STORE_FILE = path.join(DATA_DIR, 'admin_auth.json');
const TMP_AUTH_STORE_FILE = '/tmp/jite_admin_auth.json';

// Server HMAC session signing secret (reads process.env with CSPRNG in-memory fallback)
const SERVER_SESSION_SECRET =
  (process.env.ADMIN_SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

// Cached Google public X.509 certificates for optional Google Sign-In RS256 ID token verification
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
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

  for (const candidatePath of [AUTH_STORE_FILE, TMP_AUTH_STORE_FILE]) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const raw = JSON.parse(fs.readFileSync(candidatePath, 'utf-8'));
      if (raw?.credentials && raw.credentials.emailLower && raw.credentials.passwordHash && raw.credentials.salt) {
        const ts = Date.parse(raw.updatedAt || raw.credentials.updatedAt || raw.credentials.createdAt || '') || 0;
        if (!latest || ts > latestMs) {
          latestMs = ts;
          latest = {
            configured: true,
            source: candidatePath,
            credentials: raw.credentials,
            inactivityTimeoutMinutes:
              typeof raw.inactivityTimeoutMinutes === 'number' ? raw.inactivityTimeoutMinutes : 30,
          };
        }
      }
    } catch {
      // Check next candidate
    }
  }

  if (latest) {
    return latest;
  }

  return {
    configured: false,
    source: null,
    credentials: null,
    inactivityTimeoutMinutes: 30,
  };
}

function writeServerCredentialStore(data) {
  const payload = {
    bootstrapped: true,
    authMode: 'server-credentials',
    inactivityTimeoutMinutes: data.inactivityTimeoutMinutes || 30,
    credentials: data.credentials,
    updatedAt: new Date().toISOString(),
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

function resolveConfiguredServerCredentials() {
  const envEmail = (process.env.ADMIN_EMAIL || '').trim();
  const envPassword = process.env.ADMIN_PASSWORD || '';
  const envHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  const envFullName = (process.env.ADMIN_FULL_NAME || 'Primary Administrator').trim();

  const hasValidEnvEmail = envEmail.includes('@') && !isPlaceholderEnvValue(envEmail);
  const hasValidEnvSecret =
    (!isPlaceholderEnvValue(envPassword) && envPassword.length > 0) ||
    (!isPlaceholderEnvValue(envHash) && envHash.includes(':'));

  if (hasValidEnvEmail && hasValidEnvSecret) {
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

  const stored = readServerCredentialStore();
  if (stored.configured && stored.credentials) {
    return {
      configured: true,
      envManaged: false,
      email: stored.credentials.email,
      emailLower: stored.credentials.emailLower,
      fullName: stored.credentials.fullName || 'Primary Administrator',
      salt: stored.credentials.salt,
      passwordHash: stored.credentials.passwordHash,
      inactivityTimeoutMinutes: stored.inactivityTimeoutMinutes || 30,
      createdAt: stored.credentials.createdAt,
      updatedAt: stored.credentials.updatedAt,
    };
  }

  return {
    configured: false,
    envManaged: false,
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
      // Constant-time comparison via SHA-256 digests so length isn't leaked
      const inputDigest = crypto.createHash('sha256').update(String(password)).digest('hex');
      const expectedDigest = crypto.createHash('sha256').update(String(cfg.envPassword)).digest('hex');
      return safeTimingEqual(inputDigest, expectedDigest);
    }
    return false;
  }

  return verifyPasswordAgainstStored(password, cfg.salt, cfg.passwordHash);
}

// ============================================================================
// OPTIONAL GOOGLE FIREBASE ID TOKEN VERIFICATION (SECONDARY ONLY)
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

  const certs = await fetchGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Unknown signing certificate for token.');
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
    signInProvider: payload.firebase?.sign_in_provider || 'unknown',
    isCustomAdminClaim: payload.admin === true,
    expiresAt: payload.exp * 1000,
  };
}

async function checkFirestoreAdminAuthorization(idToken, decoded) {
  const { projectId, databaseId } = loadFirebaseRuntimeConfig();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

  const adminDocRes = await fetch(`${baseUrl}/admins/${encodeURIComponent(decoded.uid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (adminDocRes.status === 200) {
    const docJson = await adminDocRes.json();
    const fields = docJson?.fields || {};
    const activeField = fields.active;
    const isActive = activeField ? activeField.booleanValue !== false : true;
    const role = fields.role?.stringValue === 'owner' ? 'owner' : 'admin';
    return {
      authorized: isActive,
      revoked: !isActive,
      role,
      hasAdminDoc: true,
      invited: false,
    };
  }

  if (decoded.email && decoded.emailVerified) {
    const emailLower = decoded.email.trim().toLowerCase();
    const inviteRes = await fetch(`${baseUrl}/admin_invites/${encodeURIComponent(emailLower)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (inviteRes.status === 200) {
      const inviteJson = await inviteRes.json();
      const fields = inviteJson?.fields || {};
      const activeField = fields.active;
      const isActive = activeField ? activeField.booleanValue !== false : true;
      if (isActive) {
        return {
          authorized: true,
          revoked: false,
          role: 'admin',
          hasAdminDoc: false,
          invited: true,
        };
      }
    }
  }

  if (decoded.isCustomAdminClaim) {
    return {
      authorized: true,
      revoked: false,
      role: 'admin',
      hasAdminDoc: false,
      invited: false,
    };
  }

  return {
    authorized: false,
    revoked: false,
    role: null,
    hasAdminDoc: false,
    invited: false,
  };
}

export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Reusable verification helper for protected server endpoints (/api/vehicles, /api/upload-vehicle-image, etc.).
 * Accepts standalone Server Email/Password HMAC Bearer tokens (no Firestore needed) OR Firebase Google ID tokens.
 */
export async function verifyRequestAdmin(req) {
  const token = extractBearerToken(req) || req.body?.idToken;
  if (!token) {
    return { authorized: false, error: 'Missing Bearer authentication token.' };
  }

  if (token.startsWith('srv.')) {
    const verified = verifyServerSessionToken(token);
    if (!verified) {
      return { authorized: false, error: 'Session expired or invalid. Please sign in again.' };
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
      email: decoded.email,
      emailVerified: decoded.emailVerified,
      role: fsAuth.role || 'admin',
      authMode: 'google-firebase',
      signInProvider: decoded.signInProvider,
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
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const origin = req.headers?.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-setup-secret');
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
    //    Checks ONLY standalone server email/password configuration (zero Firestore)
    // ------------------------------------------------------------------------
    if (action === 'status' && req.method === 'GET') {
      const cfg = resolveConfiguredServerCredentials();
      const setupSecretRequired = !isPlaceholderEnvValue(process.env.ADMIN_SETUP_SECRET);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          configured: cfg.configured,
          bootstrapped: cfg.configured,
          envManaged: cfg.envManaged,
          setupSecretRequired,
          firebaseAuthConfigured: true,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 2. POST /api/admin-auth?action=setup
    //    One-time standalone server Email + Password registration (no Firestore)
    // ------------------------------------------------------------------------
    if (action === 'setup' && req.method === 'POST') {
      const cfg = resolveConfiguredServerCredentials();
      const body = await readJsonBody(req);
      const rawSecret = (process.env.ADMIN_SETUP_SECRET || '').trim();
      const configuredSecret = isPlaceholderEnvValue(rawSecret) ? '' : rawSecret;
      const providedSecret = req.headers?.['x-admin-setup-secret'] || body.setupSecret || '';
      const hasValidSetupSecret =
        Boolean(configuredSecret) && safeTimingEqual(String(providedSecret), configuredSecret);

      if (cfg.envManaged) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'ENV_MANAGED',
            error:
              'Administrator email and password are set via server environment variables (ADMIN_EMAIL / ADMIN_PASSWORD). Update or clear them in your environment settings.',
          })
        );
        return;
      }

      if (cfg.configured && !hasValidSetupSecret) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'ALREADY_CONFIGURED',
            error:
              'Administrator email and password are already configured. Please sign in or update them inside Security Settings.',
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
      });

      pushSecurityEvent({
        action: 'SERVER_ADMIN_CONFIGURED',
        status: 'success',
        actorEmailMasked: maskEmailForAudit(email),
        ipTag: hashIpForAudit(clientIp),
        details: 'Standalone server email & password administrator account created.',
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
            envManaged: false,
            inactivityTimeoutMinutes: 30,
          },
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 3. POST /api/admin-auth?action=login
    //    Standalone Email + Password authentication (zero Firestore dependency)
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

      const cfg = resolveConfiguredServerCredentials();
      if (!cfg.configured) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'NOT_CONFIGURED',
            error:
              'Administrator email and password have not been configured yet. Complete First-Time Setup first.',
          })
        );
        return;
      }

      const matched = verifyPasswordWithResolvedConfig(email, password, cfg);
      if (!matched) {
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

      clearRateLimit(clientIp);

      const signed = signServerSessionToken({
        sub: 'server_admin_owner',
        email: cfg.email,
        fullName: cfg.fullName,
        role: 'owner',
        envManaged: cfg.envManaged,
      });

      pushSecurityEvent({
        action: 'LOGIN_SUCCESS',
        status: 'success',
        actorEmailMasked: maskEmailForAudit(cfg.email),
        ipTag: hashIpForAudit(clientIp),
        details: 'Administrator signed in with Email and Password (server-verified).',
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          token: signed.token,
          expiresAt: signed.expiresAt,
          admin: {
            uid: signed.payload.sub,
            email: cfg.email,
            displayName: cfg.fullName,
            role: 'owner',
            authMode: 'server-credentials',
            envManaged: cfg.envManaged,
            inactivityTimeoutMinutes: cfg.inactivityTimeoutMinutes || 30,
          },
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 4. POST /api/admin-auth?action=update-credentials
    //    Signed-in admin updates Email, Full Name, Password, or Timeout cleanly
    // ------------------------------------------------------------------------
    if (action === 'update-credentials' && req.method === 'POST') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Active administrator session required.' }));
        return;
      }

      const cfg = resolveConfiguredServerCredentials();
      const body = await readJsonBody(req);

      if (cfg.envManaged && (body?.newEmail || body?.newPassword)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            error:
              'Credentials are currently managed via server environment variables (ADMIN_EMAIL / ADMIN_PASSWORD). Update them in your hosting environment settings.',
          })
        );
        return;
      }

      if (!cfg.configured) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Server credentials not initialized yet.' }));
        return;
      }

      // Require current password verification when changing email or password
      if (body?.newEmail || body?.newPassword) {
        const currentPassword = String(body?.currentPassword || '');
        if (!currentPassword || !verifyPasswordWithResolvedConfig(cfg.email, currentPassword, cfg)) {
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

      let nextEmail = cfg.email;
      let nextFullName = cfg.fullName;
      let nextSalt = cfg.salt;
      let nextHash = cfg.passwordHash;
      let nextTimeout = cfg.inactivityTimeoutMinutes || 30;

      if (typeof body?.fullName === 'string' && body.fullName.trim().length >= 2) {
        nextFullName = body.fullName.trim();
      }
      if (
        typeof body?.inactivityTimeoutMinutes === 'number' &&
        body.inactivityTimeoutMinutes >= 5 &&
        body.inactivityTimeoutMinutes <= 180
      ) {
        nextTimeout = body.inactivityTimeoutMinutes;
      }
      if (typeof body?.newEmail === 'string' && body.newEmail.trim()) {
        const cleanEmail = body.newEmail.trim();
        if (!cleanEmail.includes('@')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
          return;
        }
        nextEmail = cleanEmail;
      }
      if (typeof body?.newPassword === 'string' && body.newPassword.length > 0) {
        const pwCheck = validatePasswordPolicy(body.newPassword);
        if (!pwCheck.valid) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: pwCheck.error }));
          return;
        }
        nextSalt = crypto.randomBytes(16).toString('hex');
        nextHash = hashPasswordScrypt(body.newPassword, nextSalt);
      }

      const nowIso = new Date().toISOString();
      writeServerCredentialStore({
        inactivityTimeoutMinutes: nextTimeout,
        credentials: {
          fullName: nextFullName,
          email: nextEmail,
          emailLower: nextEmail.toLowerCase(),
          salt: nextSalt,
          passwordHash: nextHash,
          createdAt: cfg.createdAt || nowIso,
          updatedAt: nowIso,
        },
      });

      const refreshed = signServerSessionToken({
        sub: 'server_admin_owner',
        email: nextEmail,
        fullName: nextFullName,
        role: 'owner',
        envManaged: false,
      });

      pushSecurityEvent({
        action: body?.newPassword
          ? 'PASSWORD_CHANGED'
          : body?.newEmail
          ? 'EMAIL_CHANGED'
          : 'PROFILE_UPDATED',
        status: 'success',
        actorEmailMasked: maskEmailForAudit(nextEmail),
        ipTag: hashIpForAudit(clientIp),
        details: body?.newPassword
          ? 'Administrator password updated cleanly on backend server.'
          : body?.newEmail
          ? 'Administrator login email updated cleanly on backend server.'
          : `Updated administrator profile ("${nextFullName}", timeout ${nextTimeout} min).`,
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          token: refreshed.token,
          expiresAt: refreshed.expiresAt,
          admin: {
            uid: refreshed.payload.sub,
            email: nextEmail,
            displayName: nextFullName,
            role: 'owner',
            authMode: 'server-credentials',
            envManaged: false,
            inactivityTimeoutMinutes: nextTimeout,
          },
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 5. POST /api/admin-auth?action=verify-session
    //    Verifies standalone Server HMAC token OR optional Firebase Google token
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
          bootstrapped: true,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 6. POST /api/admin-auth?action=record-security-event
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
    // 7. GET /api/admin-auth?action=security-events (Admin-only)
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
    // 8. GET /api/admin-auth?action=diagnostics (Admin-only live health check)
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
          role: adminCheck.role,
          authMode: adminCheck.authMode,
          emailVerified: adminCheck.emailVerified,
          serverCredentialsConfigured: cfg.configured,
          envManaged: cfg.envManaged,
          setupSecretConfigured,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 9. POST /api/admin-auth?action=logout
    // ------------------------------------------------------------------------
    if (action === 'logout' && req.method === 'POST') {
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found.' }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Internal authentication verification error.' }));
  }
}

export async function getAdminAuthConfig() {
  const cfg = resolveConfiguredServerCredentials();
  return {
    bootstrapped: cfg.configured,
    configured: cfg.configured,
    envManaged: cfg.envManaged,
  };
}
