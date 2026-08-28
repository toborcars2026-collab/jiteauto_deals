import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  setCorsAndHeaders,
  getAdminAuthConfig,
  saveAdminAuthConfig,
  clearAdminAuthConfig,
  hashPassword,
  verifyPassword,
  generateToken,
  createAdminSession,
  revokeAdminSession,
  extractAdminToken,
  isSessionValid,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  parseJsonBody
} from './_authHelper';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Parse action from URL or query
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let action = url.searchParams.get('action') || '';
  
  if (!action) {
    const parts = url.pathname.split('/').filter(Boolean);
    // e.g. /api/admin/auth/login -> action = login
    // e.g. /api/admin-auth -> default to status if GET, login if POST
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
        const isSetup = Boolean(config && config.salt && config.hash);
        res.statusCode = 200;
        res.end(JSON.stringify({
          isSetup,
          mode: 'password_only',
          updatedAt: config?.updatedAt || null
        }));
        return;
      }

      case 'setup': {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const existing = await getAdminAuthConfig();
        if (existing && existing.salt && existing.hash) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            success: false,
            error: 'Administrator password has already been configured. Please log in.'
          }));
          return;
        }

        const body = await parseJsonBody(req);
        const { password, confirmPassword } = body;

        if (!password || typeof password !== 'string') {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Administrator password is required.' }));
          return;
        }

        if (password.length < 8) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Password must be at least 8 characters long.' }));
          return;
        }

        if (confirmPassword && password !== confirmPassword) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Passwords do not match.' }));
          return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        const nowIso = new Date().toISOString();

        await saveAdminAuthConfig({
          salt,
          hash,
          updatedAt: nowIso
        });

        const token = generateToken();
        createAdminSession(token);

        res.setHeader('Set-Cookie', `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          token,
          role: 'admin',
          message: 'Administrator password configured successfully.'
        }));
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
          res.end(JSON.stringify({
            success: false,
            error: `Too many failed login attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
            code: 'RATE_LIMITED'
          }));
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
        if (!config || !config.salt || !config.hash) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            success: false,
            needsSetup: true,
            error: 'Administrator password has not been configured yet. Please complete initial setup.'
          }));
          return;
        }

        const isValid = verifyPassword(password, config.salt, config.hash);
        if (!isValid) {
          recordFailedAttempt(clientIp);
          res.statusCode = 401;
          res.end(JSON.stringify({
            success: false,
            error: 'Incorrect administrator password. Please try again.'
          }));
          return;
        }

        resetRateLimit(clientIp);
        const token = generateToken();
        createAdminSession(token);

        res.setHeader('Set-Cookie', `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          token,
          role: 'admin'
        }));
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
        if (!config || !config.salt || !config.hash) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Administrator configuration not found.' }));
          return;
        }

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
          updatedAt: nowIso
        });

        const token = generateToken();
        createAdminSession(token);

        res.setHeader('Set-Cookie', `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          token,
          message: 'Administrator password changed successfully.'
        }));
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
          res.end(JSON.stringify({
            success: false,
            error: 'Unauthorized: Resetting admin password requires an active session or the server ADMIN_RESET_KEY.'
          }));
          return;
        }

        await clearAdminAuthConfig();
        res.setHeader('Set-Cookie', 'jite_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: 'Administrator password reset successfully. System returned to First-Time Setup.'
        }));
        return;
      }

      default: {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
        return;
      }
    }
  } catch (err: any) {
    console.error('[Admin Auth API Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({
      success: false,
      error: 'Authentication server error. Please try again.'
    }));
  }
}
