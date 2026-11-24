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

function readLocalBootstrapState() {
  try {
    if (!fs.existsSync(AUTH_STORE_FILE)) {
      return { bootstrapped: false, primaryAdminUid: null, setupCompletedAt: null };
    }
    const raw = JSON.parse(fs.readFileSync(AUTH_STORE_FILE, 'utf-8'));
    const bootstrapped = Boolean(
      raw?.bootstrapped === true ||
        (raw?.config && (raw.config.hash || raw.config.authorizedEmail))
    );
    return {
      bootstrapped,
      primaryAdminUid: raw?.primaryAdminUid || null,
      setupCompletedAt: raw?.setupCompletedAt || raw?.config?.updatedAt || null,
    };
  } catch {
    return { bootstrapped: false, primaryAdminUid: null, setupCompletedAt: null };
  }
}

function saveLocalBootstrapState(state) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = {
      bootstrapped: Boolean(state.bootstrapped),
      primaryAdminUid: state.primaryAdminUid || null,
      setupCompletedAt: state.setupCompletedAt || new Date().toISOString(),
    };
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return true;
  } catch {
    // Vercel serverless environments have a read-only filesystem outside /tmp
    return false;
  }
}

/**
 * Checks Firestore's non-PII lock document /settings/admin_bootstrap so serverless deployments
 * (including Vercel cold starts) reliably know whether first-time setup has already locked.
 */
async function readRemoteBootstrapFlag() {
  try {
    const { projectId, databaseId } = loadFirebaseRuntimeConfig();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/settings/admin_bootstrap`;
    const resp = await fetch(url, { method: 'GET' });
    if (resp.status === 200) {
      const json = await resp.json();
      return Boolean(json?.fields?.setupCompleted?.booleanValue === true);
    }
    if (resp.status === 404) {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

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

function base64UrlDecode(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

/**
 * Cryptographically verifies a Firebase Auth RS256 ID token against Google's X.509 certificates.
 */
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
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
    throw new Error('Invalid token authentication timestamp.');
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

/**
 * Verifies admin authorization via Cloud Firestore Security Rules using the caller's verified ID token.
 * Zero hardcoded emails — trusts ONLY /admins/{uid} or verified active /admin_invites/{emailLower}.
 */
async function checkFirestoreAdminAuthorization(idToken, decoded) {
  const { projectId, databaseId } = loadFirebaseRuntimeConfig();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

  // 1. Check /admins/{uid}
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
      firestoreBootstrapped: true,
    };
  }

  // 2. Check /admin_invites/{emailLower} if caller email is verified
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
          firestoreBootstrapped: true,
        };
      }
    }
  }

  // 3. Check custom claim fallback if provisioned externally
  if (decoded.isCustomAdminClaim) {
    return {
      authorized: true,
      revoked: false,
      role: 'admin',
      hasAdminDoc: false,
      invited: false,
      firestoreBootstrapped: true,
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
 * Reusable verification helper for protected server endpoints (server.ts / upload API).
 */
export async function verifyRequestAdmin(req) {
  const idToken = extractBearerToken(req) || req.body?.idToken;
  if (!idToken) {
    return { authorized: false, error: 'Missing Bearer authentication token.' };
  }
  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    const fsAuth = await checkFirestoreAdminAuthorization(idToken, decoded);
    if (!fsAuth.authorized) {
      return { authorized: false, error: 'This account does not have administrator access.' };
    }
    return {
      authorized: true,
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.emailVerified,
      role: fsAuth.role || 'admin',
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
    //    Returns ONLY non-sensitive setup state. NEVER returns admin emails or UIDs!
    // ------------------------------------------------------------------------
    if (action === 'status' && req.method === 'GET') {
      const localState = readLocalBootstrapState();
      const envBootstrapped = process.env.ADMIN_BOOTSTRAPPED === 'true';
      const remoteBootstrapped = await readRemoteBootstrapFlag();
      const bootstrapped =
        remoteBootstrapped !== null
          ? Boolean(remoteBootstrapped || envBootstrapped)
          : Boolean(localState.bootstrapped || envBootstrapped);

      if (remoteBootstrapped === false && localState.bootstrapped) {
        saveLocalBootstrapState({
          bootstrapped: false,
          primaryAdminUid: null,
          setupCompletedAt: null,
        });
      }

      const setupSecretRequired = Boolean(
        process.env.ADMIN_SETUP_SECRET && process.env.ADMIN_SETUP_SECRET.trim().length > 0
      );

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          bootstrapped,
          setupSecretRequired,
          firebaseAuthConfigured: true,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 2. POST /api/admin-auth?action=verify-session
    //    Cryptographically verifies Firebase ID token & Firestore admin access
    // ------------------------------------------------------------------------
    if (action === 'verify-session' && req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.statusCode = 429;
        res.end(
          JSON.stringify({
            success: false,
            code: 'RATE_LIMITED',
            error: `Too many authentication attempts. Please wait ${rateCheck.waitSeconds} seconds.`,
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const idToken = extractBearerToken(req) || body.idToken;
      if (!idToken) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            code: 'UNAUTHENTICATED',
            error: 'Sign-in credentials could not be verified.',
          })
        );
        return;
      }

      let decoded;
      try {
        decoded = await verifyFirebaseIdToken(idToken);
      } catch (tokenErr) {
        recordFailedAttempt(clientIp);
        pushSecurityEvent({
          action: 'SESSION_VERIFY_FAILED',
          status: 'failure',
          actorEmailMasked: 'invalid-token',
          ipTag: hashIpForAudit(clientIp),
          details: tokenErr?.message || 'Token signature or expiry check failed.',
        });
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            code: 'INVALID_TOKEN',
            error: 'Authentication could not be verified. Please sign in again.',
          })
        );
        return;
      }

      const fsAuth = await checkFirestoreAdminAuthorization(idToken, decoded);
      if (!fsAuth.authorized) {
        recordFailedAttempt(clientIp);
        pushSecurityEvent({
          action: fsAuth.revoked ? 'REVOKED_ADMIN_ATTEMPT' : 'UNAUTHORIZED_ADMIN_ATTEMPT',
          status: 'warning',
          actorEmailMasked: maskEmailForAudit(decoded.email),
          ipTag: hashIpForAudit(clientIp),
          details: fsAuth.revoked
            ? 'Revoked administrator account attempted sign-in.'
            : `Unauthorized account attempted admin login via ${decoded.signInProvider}.`,
        });
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: fsAuth.revoked ? 'ACCOUNT_REVOKED' : 'ACCESS_DENIED',
            error: fsAuth.revoked
              ? 'Administrator access for this account has been revoked.'
              : 'This account does not have administrator access.',
          })
        );
        return;
      }

      clearRateLimit(clientIp);

      const localState = readLocalBootstrapState();
      if ((fsAuth.firestoreBootstrapped || fsAuth.hasAdminDoc) && !localState.bootstrapped) {
        saveLocalBootstrapState({
          bootstrapped: true,
          primaryAdminUid: decoded.uid,
          setupCompletedAt: new Date().toISOString(),
        });
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          uid: decoded.uid,
          email: decoded.email,
          emailVerified: decoded.emailVerified,
          role: fsAuth.role || 'admin',
          invited: Boolean(fsAuth.invited),
          signInProvider: decoded.signInProvider,
          bootstrapped: Boolean(localState.bootstrapped || fsAuth.firestoreBootstrapped || fsAuth.hasAdminDoc),
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 3. POST /api/admin-auth?action=bootstrap-complete
    //    Pre-flight validation & setup secret check before atomic Firestore batch claim
    // ------------------------------------------------------------------------
    if (action === 'bootstrap-complete' && req.method === 'POST') {
      const localState = readLocalBootstrapState();
      const remoteBootstrapped = await readRemoteBootstrapFlag();
      const alreadyBootstrapped =
        remoteBootstrapped !== null
          ? Boolean(remoteBootstrapped || process.env.ADMIN_BOOTSTRAPPED === 'true')
          : Boolean(localState.bootstrapped || process.env.ADMIN_BOOTSTRAPPED === 'true');
      if (alreadyBootstrapped) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'ALREADY_BOOTSTRAPPED',
            error: 'An administrator account has already been configured. Please sign in instead.',
          })
        );
        return;
      }

      const body = await readJsonBody(req);
      const idToken = extractBearerToken(req) || body.idToken;
      const providedSecret = req.headers?.['x-admin-setup-secret'] || body.setupSecret || '';
      const configuredSecret = (process.env.ADMIN_SETUP_SECRET || '').trim();

      if (configuredSecret) {
        if (!providedSecret || !safeTimingEqual(String(providedSecret), configuredSecret)) {
          recordFailedAttempt(clientIp);
          pushSecurityEvent({
            action: 'BOOTSTRAP_SECRET_REJECTED',
            status: 'warning',
            actorEmailMasked: 'anonymous',
            ipTag: hashIpForAudit(clientIp),
            details: 'Invalid setup authorization secret supplied during bootstrap attempt.',
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
      }

      if (!idToken) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            success: false,
            code: 'MISSING_TOKEN',
            error: 'Authenticated administrator verification token is required.',
          })
        );
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          readyForClaim: true,
          uid: decoded.uid,
          email: decoded.email,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 4. POST /api/admin-auth?action=bootstrap-finalize
    //    Locks local bootstrap file ONLY after verifying the atomic Firestore batch succeeded
    // ------------------------------------------------------------------------
    if (action === 'bootstrap-finalize' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const idToken = extractBearerToken(req) || body.idToken;
      if (!idToken) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Missing token.' }));
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);
      const fsAuth = await checkFirestoreAdminAuthorization(idToken, decoded);
      if (!fsAuth.authorized || !fsAuth.hasAdminDoc) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            success: false,
            code: 'BOOTSTRAP_NOT_COMMITTED',
            error: 'Administrator profile record was not yet committed in Firestore.',
          })
        );
        return;
      }

      saveLocalBootstrapState({
        bootstrapped: true,
        primaryAdminUid: decoded.uid,
        setupCompletedAt: new Date().toISOString(),
      });

      pushSecurityEvent({
        action: 'BOOTSTRAP_COMPLETED',
        status: 'success',
        actorEmailMasked: maskEmailForAudit(decoded.email),
        ipTag: hashIpForAudit(clientIp),
        details: `Primary administrator setup finalized (${decoded.signInProvider}).`,
      });

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          bootstrapped: true,
          uid: decoded.uid,
          email: decoded.email,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 5. POST /api/admin-auth?action=record-security-event
    //    Logs non-sensitive failed sign-in attempts for audit visibility & throttling
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
    // 6. GET /api/admin-auth?action=security-events (Admin-only)
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
    // 7. GET /api/admin-auth?action=diagnostics (Admin-only live health check)
    // ------------------------------------------------------------------------
    if (action === 'diagnostics' && req.method === 'GET') {
      const adminCheck = await verifyRequestAdmin(req);
      if (!adminCheck.authorized) {
        res.statusCode = 401;
        res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
        return;
      }

      const remoteBootstrapped = await readRemoteBootstrapFlag();
      const setupSecretConfigured = Boolean(
        process.env.ADMIN_SETUP_SECRET && process.env.ADMIN_SETUP_SECRET.trim().length > 0
      );

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          role: adminCheck.role,
          emailVerified: adminCheck.emailVerified,
          remoteBootstrapped,
          setupSecretConfigured,
          rs256VerificationActive: true,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 8. POST /api/admin-auth?action=logout
    // ------------------------------------------------------------------------
    if (action === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'jite_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
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
  const local = readLocalBootstrapState();
  const remote = await readRemoteBootstrapFlag();
  return {
    ...local,
    bootstrapped: Boolean(local.bootstrapped || remote || process.env.ADMIN_BOOTSTRAPPED === 'true'),
  };
}
