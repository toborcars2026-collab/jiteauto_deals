import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  setCorsAndHeaders,
  getAdminAuthConfig,
  saveAdminAuthConfig,
  hashPassword,
  generateToken,
  createAdminSession,
  parseJsonBody
} from '../../_authHelper';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
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

    // Set secure HttpOnly cookie
    res.setHeader('Set-Cookie', `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      token,
      role: 'admin',
      message: 'Administrator password configured successfully.'
    }));
  } catch (err: any) {
    console.error('[API /api/admin/auth/setup] Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Failed to configure administrator password. Please try again.' }));
  }
}
