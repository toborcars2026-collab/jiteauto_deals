import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export const FIREBASE_PROJECT_ID = 'gen-lang-client-0327661147';
export const FIRESTORE_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/settings/admin_security`;
const FIRESTORE_ADMINS_COLLECTION_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/admins`;

const DATA_DIR = path.join(process.cwd(), 'data_store');
const AUTH_FILE = path.join(DATA_DIR, 'admin_auth.json');

// Cache configuration in memory
let cachedAuthConfig = null;
let cacheTime = 0;
const CACHE_TTL_MS = 3 * 1000;

// Active sessions: token -> { token, email, createdAt, expiresAt }
const activeSessions = new Map();

// Pending OTPs: preAuthToken -> { preAuthToken, otpHash, email, expiresAt, attempts, resendAllowedAt }
const pendingOtps = new Map();

// Rate limiting: IP -> { count, firstAttempt, lockedUntil }
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

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

  if (record.lockedUntil && now < record.lockedUntil) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (now - record.firstAttempt > LOCKOUT_PERIOD_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, waitSeconds: 0 };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_PERIOD_MS;
    const waitSeconds = Math.ceil(LOCKOUT_PERIOD_MS / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true, waitSeconds: 0 };
}

export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > LOCKOUT_PERIOD_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_PERIOD_MS;
    }
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

export function generateSixDigitOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '******';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAuthFile() {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) {
    return { config: null, sessions: [] };
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      config: parsed.config || parsed.passwordConfig || null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { config: null, sessions: [] };
  }
}

function saveAuthFile(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[admin_auth.json write error]:', err);
  }
}

export async function getAdminAuthConfig() {
  const now = Date.now();
  if (cachedAuthConfig && now - cacheTime < CACHE_TTL_MS) {
    return cachedAuthConfig;
  }

  // 1. Try reading from Firestore REST API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(FIRESTORE_DOC_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.fields) {
        const bootstrapped = data.fields.bootstrapped?.booleanValue === true;
        const authorizedEmail = data.fields.authorizedEmail?.stringValue || '';
        const salt = data.fields.salt?.stringValue || '';
        const hash = data.fields.hash?.stringValue || '';
        const primaryGoogleUid = data.fields.primaryGoogleUid?.stringValue || '';
        const updatedAt = data.fields.updatedAt?.stringValue || new Date().toISOString();
        const bootstrappedAt = data.fields.bootstrappedAt?.stringValue || updatedAt;

        if (bootstrapped && authorizedEmail && salt && hash) {
          cachedAuthConfig = {
            bootstrapped: true,
            authorizedEmail: authorizedEmail.toLowerCase().trim(),
            passwordSalt: salt,
            passwordHash: hash,
            primaryGoogleUid,
            updatedAt,
            bootstrappedAt,
          };
          cacheTime = now;
          return cachedAuthConfig;
        }
      }
    }
  } catch {
    // Fall back to local file
  }

  // 2. Try reading from local data_store/admin_auth.json
  const fileData = readAuthFile();
  if (fileData.config && fileData.config.authorizedEmail && fileData.config.bootstrapped) {
    cachedAuthConfig = {
      bootstrapped: true,
      authorizedEmail: fileData.config.authorizedEmail.toLowerCase().trim(),
      passwordSalt: fileData.config.passwordSalt || fileData.config.salt || '',
      passwordHash: fileData.config.passwordHash || fileData.config.hash || '',
      primaryGoogleUid: fileData.config.primaryGoogleUid || '',
      updatedAt: fileData.config.updatedAt || new Date().toISOString(),
      bootstrappedAt: fileData.config.bootstrappedAt || fileData.config.updatedAt || new Date().toISOString(),
    };
    cacheTime = now;
    return cachedAuthConfig;
  }

  // 3. Not bootstrapped
  cachedAuthConfig = {
    bootstrapped: false,
    authorizedEmail: null,
    passwordSalt: '',
    passwordHash: '',
    primaryGoogleUid: '',
    updatedAt: '',
    bootstrappedAt: '',
  };
  cacheTime = now;
  return cachedAuthConfig;
}

export async function saveAdminAuthConfig(config) {
  const payload = {
    fields: {
      bootstrapped: { booleanValue: true },
      authorizedEmail: { stringValue: config.authorizedEmail.toLowerCase().trim() },
      salt: { stringValue: config.passwordSalt },
      hash: { stringValue: config.passwordHash },
      primaryGoogleUid: { stringValue: config.primaryGoogleUid || '' },
      updatedAt: { stringValue: config.updatedAt },
      bootstrappedAt: { stringValue: config.bootstrappedAt },
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    await fetch(FIRESTORE_DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error('[Firestore saveAdminAuthConfig error]:', err);
  }

  // Persist locally
  const fileData = readAuthFile();
  fileData.config = {
    bootstrapped: true,
    authorizedEmail: config.authorizedEmail.toLowerCase().trim(),
    passwordSalt: config.passwordSalt,
    passwordHash: config.passwordHash,
    primaryGoogleUid: config.primaryGoogleUid || '',
    updatedAt: config.updatedAt,
    bootstrappedAt: config.bootstrappedAt,
  };
  saveAuthFile(fileData);

  cachedAuthConfig = {
    bootstrapped: true,
    authorizedEmail: config.authorizedEmail.toLowerCase().trim(),
    passwordSalt: config.passwordSalt,
    passwordHash: config.passwordHash,
    primaryGoogleUid: config.primaryGoogleUid || '',
    updatedAt: config.updatedAt,
    bootstrappedAt: config.bootstrappedAt,
  };
  cacheTime = Date.now();
}

export async function saveAdminRoleDocument(uid, email) {
  if (!uid) return;
  const url = `${FIRESTORE_ADMINS_COLLECTION_URL}/${uid}`;
  const payload = {
    fields: {
      email: { stringValue: email.toLowerCase().trim() },
      role: { stringValue: 'admin' },
      createdAt: { stringValue: new Date().toISOString() },
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error('[Firestore saveAdminRoleDocument error]:', err);
  }
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

  const fileData = readAuthFile();
  fileData.config = null;
  fileData.sessions = [];
  saveAuthFile(fileData);

  cachedAuthConfig = {
    bootstrapped: false,
    authorizedEmail: null,
    passwordSalt: '',
    passwordHash: '',
    primaryGoogleUid: '',
    updatedAt: '',
    bootstrappedAt: '',
  };
  cacheTime = 0;
  activeSessions.clear();
  pendingOtps.clear();
}

/**
 * Transactional Email Dispatcher
 * Dispatches via Resend, SendGrid, or standard SMTP.
 */
export async function sendAdminEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'Jite Auto Deals <onboarding@resend.dev>';

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { delivered: true, provider: 'resend', id: data.id };
      }
      const errText = await res.text();
      return { delivered: false, error: `Resend delivery failed (${res.status}): ${errText}` };
    } catch (err) {
      return { delivered: false, error: `Resend error: ${err?.message || err}` };
    }
  }

  // 2. SendGrid API
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from.includes('<') ? from.match(/<([^>]+)>/)[1] : from, name: 'Jite Auto Deals' },
          subject,
          content: [
            { type: 'text/html', value: html },
            ...(text ? [{ type: 'text/plain', value: text }] : []),
          ],
        }),
      });

      if (res.status === 202 || res.status === 200) {
        return { delivered: true, provider: 'sendgrid' };
      }
      const errText = await res.text();
      return { delivered: false, error: `SendGrid delivery failed (${res.status}): ${errText}` };
    } catch (err) {
      return { delivered: false, error: `SendGrid error: ${err?.message || err}` };
    }
  }

  // 3. SMTP Transport
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });

      return { delivered: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      return { delivered: false, error: `SMTP error: ${err?.message || err}` };
    }
  }

  // If no email credentials configured in environment
  return {
    delivered: false,
    error: 'Email delivery service not configured. Please set RESEND_API_KEY or SMTP credentials in your server environment.',
  };
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

export function extractAdminToken(req) {
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

export function createAdminSession(token, email) {
  const session = {
    token,
    email: email ? email.toLowerCase().trim() : '',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  activeSessions.set(token, session);

  // Sync to file
  const fileData = readAuthFile();
  fileData.sessions = fileData.sessions.filter((s) => s.expiresAt > Date.now()).slice(-30);
  fileData.sessions.push(session);
  saveAuthFile(fileData);
}

export function revokeAdminSession(token) {
  activeSessions.delete(token);
  const fileData = readAuthFile();
  fileData.sessions = fileData.sessions.filter((s) => s.token !== token);
  saveAuthFile(fileData);
}

export function revokeAllSessions() {
  activeSessions.clear();
  const fileData = readAuthFile();
  fileData.sessions = [];
  saveAuthFile(fileData);
}

export function isSessionValid(token) {
  if (!token) return false;
  const memorySession = activeSessions.get(token);
  if (memorySession) {
    return memorySession.expiresAt > Date.now();
  }
  const fileData = readAuthFile();
  const fileSession = fileData.sessions.find((s) => s.token === token);
  if (fileSession && fileSession.expiresAt > Date.now()) {
    activeSessions.set(token, fileSession);
    return true;
  }
  return false;
}

export function getSessionData(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (session && session.expiresAt > Date.now()) return session;
  const fileData = readAuthFile();
  const fileSession = fileData.sessions.find((s) => s.token === token);
  if (fileSession && fileSession.expiresAt > Date.now()) {
    activeSessions.set(token, fileSession);
    return fileSession;
  }
  return null;
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
      // 1. Status Check
      case 'status': {
        const config = await getAdminAuthConfig();
        const token = extractAdminToken(req);
        const session = getSessionData(token);
        const emailConfigured = Boolean(
          process.env.RESEND_API_KEY ||
          process.env.SENDGRID_API_KEY ||
          (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            bootstrapped: config.bootstrapped,
            authorizedEmailHint: config.authorizedEmail ? maskEmail(config.authorizedEmail) : null,
            emailDeliveryConfigured: emailConfigured,
            authenticated: Boolean(session),
            email: session ? session.email : null,
            role: session ? 'admin' : null,
            updatedAt: config.updatedAt || null,
          })
        );
        return;
      }

      // 2. Initial One-Time Administrator Setup (Bootstrap)
      case 'bootstrap': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const currentConfig = await getAdminAuthConfig();
        if (currentConfig.bootstrapped) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Initial administrator setup has already been completed. Further registrations are strictly disabled.',
              code: 'SETUP_ALREADY_COMPLETED',
            })
          );
          return;
        }

        const body = await parseJsonBody(req);
        const { email, password, confirmPassword, googleUid } = body;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'A valid administrator email address is required.' }));
          return;
        }

        const cleanEmail = email.toLowerCase().trim();

        if (!password || typeof password !== 'string' || password.length < 8) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Administrator password must be at least 8 characters long.',
            })
          );
          return;
        }

        if (confirmPassword && password !== confirmPassword) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Passwords do not match. Please verify and try again.' }));
          return;
        }

        // Establish the single administrator credentials
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        const nowIso = new Date().toISOString();

        await saveAdminAuthConfig({
          bootstrapped: true,
          authorizedEmail: cleanEmail,
          passwordSalt: salt,
          passwordHash: hash,
          primaryGoogleUid: googleUid || '',
          updatedAt: nowIso,
          bootstrappedAt: nowIso,
        });

        // If Google UID was linked, store admin role doc in Firestore
        if (googleUid) {
          await saveAdminRoleDocument(googleUid, cleanEmail);
        }

        // Create initial verified session
        const sessionToken = generateToken();
        createAdminSession(sessionToken, cleanEmail);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: sessionToken,
            role: 'admin',
            email: cleanEmail,
            message: 'Administrator account established and verified successfully.',
          })
        );
        return;
      }

      // 3. Continue with Google Authentication
      case 'google-signin': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const body = await parseJsonBody(req);
        const { email, uid } = body;

        if (!email || typeof email !== 'string') {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Missing authenticated Google account email.' }));
          return;
        }

        const config = await getAdminAuthConfig();

        if (!config.bootstrapped) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              needsSetup: true,
              error: 'Initial administrator setup has not been completed yet.',
            })
          );
          return;
        }

        const incomingEmail = email.toLowerCase().trim();
        const expectedEmail = config.authorizedEmail.toLowerCase().trim();

        // STRICT AUTHORISATION CHECK
        if (incomingEmail !== expectedEmail) {
          res.statusCode = 403;
          res.end(
            JSON.stringify({
              success: false,
              error: 'ACCESS DENIED. This Google account is not authorised to access the Jite Auto Deals Administration System.',
              code: 'UNAUTHORIZED_GOOGLE_ACCOUNT',
            })
          );
          return;
        }

        // Save admin role document for Firestore rule authorization
        if (uid) {
          await saveAdminRoleDocument(uid, expectedEmail);
        }

        // Issue verified admin session
        const sessionToken = generateToken();
        createAdminSession(sessionToken, expectedEmail);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: sessionToken,
            role: 'admin',
            email: expectedEmail,
          })
        );
        return;
      }

      // 4. Step 1: Email and Password Login -> Triggers OTP Email
      case 'email-login': {
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
        const { email, password } = body;

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
          recordFailedAttempt(clientIp);
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Please enter both your email address and password.' }));
          return;
        }

        const config = await getAdminAuthConfig();

        if (!config.bootstrapped) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              needsSetup: true,
              error: 'Administrator setup has not been completed. Please establish the administrator account first.',
            })
          );
          return;
        }

        const incomingEmail = email.toLowerCase().trim();
        const expectedEmail = config.authorizedEmail.toLowerCase().trim();

        // Verify authorized email address
        if (incomingEmail !== expectedEmail) {
          recordFailedAttempt(clientIp);
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Incorrect email address or password. Please verify and try again.',
            })
          );
          return;
        }

        // Verify password
        const isPasswordCorrect = verifyPassword(password, config.passwordSalt, config.passwordHash);
        if (!isPasswordCorrect) {
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

        // Generate 6-digit OTP code and temporary pre-auth token
        const preAuthToken = generateToken();
        const otpCode = generateSixDigitOtp();
        const otpHash = hashPassword(otpCode, preAuthToken);

        const now = Date.now();
        pendingOtps.set(preAuthToken, {
          preAuthToken,
          otpHash,
          email: expectedEmail,
          expiresAt: now + 5 * 60 * 1000, // 5 minutes
          attempts: 0,
          resendAllowedAt: now + 60 * 1000, // 60 seconds
        });

        // Send Email OTP
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
            <div style="background-color: #0f172a; padding: 28px 32px; border-bottom: 1px solid #1e293b; text-align: center;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">JITE AUTO DEALS</h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Administrator Security Verification</p>
            </div>
            <div style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello Administrator,</p>
              <p style="margin: 0 0 24px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">A sign-in attempt was initiated for the Jite Auto Deals Administrator Command Center. Use the one-time verification code below to complete your authentication:</p>
              <div style="background-color: #0f172a; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #fbbf24; font-family: monospace;">${otpCode}</span>
              </div>
              <p style="margin: 0 0 8px; color: #f59e0b; font-size: 13px; font-weight: 600;">Security Notice:</p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                <li>This code expires in <strong>5 minutes</strong>.</li>
                <li>It can only be used once.</li>
                <li>If you did not initiate this request, your password may be compromised. Please sign in and update your credentials immediately.</li>
              </ul>
              <div style="border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                Jite Auto Deals · Direct Foreign-Used Cars & Trusted Vehicle Consultation · Lagos, Nigeria
              </div>
            </div>
          </div>
        `;

        const emailResult = await sendAdminEmail({
          to: expectedEmail,
          subject: `Your Jite Auto Deals Verification Code: ${otpCode}`,
          html: emailHtml,
          text: `Your Jite Auto Deals verification code is: ${otpCode}. It expires in 5 minutes. Do not share this code.`,
        });

        const deliveryOk = Boolean(emailResult.delivered);
        if (!deliveryOk) {
          console.warn('[Admin Auth Email Warning]: Email provider did not confirm acceptance:', emailResult.error);
          console.log(`[DEV OTP INSPECTOR] Code for ${expectedEmail}: ${otpCode} (expires in 5m)`);
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            step: 'otp_required',
            preAuthToken,
            emailMasked: maskEmail(expectedEmail),
            resendIn: 60,
            expiresIn: 300,
            emailDelivered: deliveryOk,
            emailDeliveryError: deliveryOk ? null : (emailResult.error || 'Email service unconfigured'),
            devTestCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
          })
        );
        return;
      }

      // 5. Step 2: Verify 6-digit OTP Code
      case 'verify-otp': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const body = await parseJsonBody(req);
        const { preAuthToken, code } = body;

        if (!preAuthToken || !code || typeof code !== 'string') {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Please enter the 6-digit verification code.' }));
          return;
        }

        const cleanCode = code.replace(/\D/g, '').trim();
        if (cleanCode.length !== 6) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Verification code must be exactly 6 digits.' }));
          return;
        }

        const record = pendingOtps.get(preAuthToken);
        if (!record) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Session expired or invalid. Please sign in again to receive a fresh verification code.',
              code: 'INVALID_PREAUTH_TOKEN',
            })
          );
          return;
        }

        // Check expiration (5 minutes)
        if (Date.now() > record.expiresAt) {
          pendingOtps.delete(preAuthToken);
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Verification code has expired (5 minute limit). Please request a new code.',
              code: 'OTP_EXPIRED',
            })
          );
          return;
        }

        // Check attempt count (max 5)
        if (record.attempts >= 5) {
          pendingOtps.delete(preAuthToken);
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Too many incorrect verification attempts. For security, please sign in again.',
              code: 'TOO_MANY_OTP_ATTEMPTS',
            })
          );
          return;
        }

        // Verify timing-safe hash
        const computedHash = hashPassword(cleanCode, preAuthToken);
        const isMatch = verifyPassword(cleanCode, preAuthToken, record.otpHash);

        if (!isMatch) {
          record.attempts += 1;
          const remaining = 5 - record.attempts;
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              success: false,
              error: `Incorrect verification code. Please check your email and try again (${remaining} attempt${remaining === 1 ? '' : 's'} remaining).`,
              code: 'INVALID_OTP',
              attemptsRemaining: remaining,
            })
          );
          return;
        }

        // Single-use: delete immediately upon successful verification
        pendingOtps.delete(preAuthToken);

        // Issue verified admin session
        const sessionToken = generateToken();
        createAdminSession(sessionToken, record.email);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: sessionToken,
            role: 'admin',
            email: record.email,
          })
        );
        return;
      }

      // 6. Resend 6-Digit OTP Code
      case 'resend-otp': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const body = await parseJsonBody(req);
        const { preAuthToken } = body;

        if (!preAuthToken) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Missing session reference. Please sign in again.' }));
          return;
        }

        const record = pendingOtps.get(preAuthToken);
        if (!record) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              error: 'Verification session expired. Please sign in again.',
              code: 'SESSION_EXPIRED',
            })
          );
          return;
        }

        const now = Date.now();
        if (now < record.resendAllowedAt) {
          const waitSec = Math.ceil((record.resendAllowedAt - now) / 1000);
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              success: false,
              error: `Please wait ${waitSec} seconds before requesting a new code.`,
              code: 'RESEND_COOLDOWN',
              waitSeconds: waitSec,
            })
          );
          return;
        }

        // Generate fresh OTP code and reset timer
        const freshOtpCode = generateSixDigitOtp();
        record.otpHash = hashPassword(freshOtpCode, preAuthToken);
        record.expiresAt = now + 5 * 60 * 1000;
        record.resendAllowedAt = now + 60 * 1000;
        record.attempts = 0;

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
            <div style="background-color: #0f172a; padding: 28px 32px; border-bottom: 1px solid #1e293b; text-align: center;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">JITE AUTO DEALS</h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">New Verification Code</p>
            </div>
            <div style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello Administrator,</p>
              <p style="margin: 0 0 24px; color: #cbd5e1; font-size: 15px; line-height: 1.6;">Your requested new one-time verification code is below:</p>
              <div style="background-color: #0f172a; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #fbbf24; font-family: monospace;">${freshOtpCode}</span>
              </div>
              <p style="margin: 0 0 8px; color: #f59e0b; font-size: 13px; font-weight: 600;">Security Notice:</p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                <li>This code expires in <strong>5 minutes</strong>.</li>
                <li>Your previous code has been invalidated.</li>
              </ul>
              <div style="border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
                Jite Auto Deals · Direct Foreign-Used Cars & Trusted Vehicle Consultation · Lagos, Nigeria
              </div>
            </div>
          </div>
        `;

        const emailResult = await sendAdminEmail({
          to: record.email,
          subject: `Your New Jite Auto Deals Verification Code: ${freshOtpCode}`,
          html: emailHtml,
          text: `Your new Jite Auto Deals verification code is: ${freshOtpCode}. It expires in 5 minutes.`,
        });

        const deliveryOk = Boolean(emailResult.delivered);
        if (!deliveryOk) {
          console.warn('[Admin Auth Email Resend Warning]:', emailResult.error);
          console.log(`[DEV OTP INSPECTOR] Resent Code for ${record.email}: ${freshOtpCode}`);
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: deliveryOk ? 'A new verification code has been sent to your email.' : 'New verification code generated.',
            emailDelivered: deliveryOk,
            emailDeliveryError: deliveryOk ? null : (emailResult.error || 'Email service unconfigured'),
            devTestCode: process.env.NODE_ENV !== 'production' ? freshOtpCode : undefined,
            resendIn: 60,
          })
        );
        return;
      }

      // 7. Verify Active Session
      case 'verify': {
        const token = extractAdminToken(req);
        const session = getSessionData(token);

        if (!session) {
          res.statusCode = 401;
          res.end(JSON.stringify({ authenticated: false, error: 'Session expired or unauthenticated.' }));
          return;
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            authenticated: true,
            role: 'admin',
            email: session.email,
          })
        );
        return;
      }

      // 8. Change Password (Authenticated)
      case 'change-password': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const token = extractAdminToken(req);
        if (!isSessionValid(token)) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Active administrator session required.' }));
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
        const isCurrentValid = verifyPassword(passwordToCheck, config.passwordSalt, config.passwordHash);
        if (!isCurrentValid) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Incorrect current administrator password.' }));
          return;
        }

        const newSalt = crypto.randomBytes(16).toString('hex');
        const newHash = hashPassword(newPassword, newSalt);
        const nowIso = new Date().toISOString();

        await saveAdminAuthConfig({
          ...config,
          passwordSalt: newSalt,
          passwordHash: newHash,
          updatedAt: nowIso,
        });

        revokeAllSessions();
        const newToken = generateToken();
        createAdminSession(newToken, config.authorizedEmail);

        res.setHeader(
          'Set-Cookie',
          `jite_admin_session=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            token: newToken,
            message: 'Administrator password changed successfully.',
          })
        );
        return;
      }

      // 9. Sign Out
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

      // Legacy fallback
      case 'login': {
        // Redirect legacy login calls to email-login
        const body = await parseJsonBody(req);
        const config = await getAdminAuthConfig();
        if (config.bootstrapped && !body.email) {
          body.email = config.authorizedEmail;
        }
        req.body = body;
        return handler({ ...req, url: `${url.pathname}?action=email-login` }, res);
      }

      default: {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Unknown admin action: ${action}` }));
        return;
      }
    }
  } catch (err) {
    console.error(`[Admin Auth Error on action=${action}]:`, err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Internal server authentication error.' }));
  }
}
