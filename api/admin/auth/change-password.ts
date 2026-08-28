import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  setCorsAndHeaders,
  getAdminAuthConfig,
  saveAdminAuthConfig,
  hashPassword,
  verifyPassword,
  generateToken,
  createAdminSession,
  revokeAllSessions,
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
      updatedAt: nowIso
    });

    revokeAllSessions();
    const token = generateToken();
    createAdminSession(token);

    res.setHeader('Set-Cookie', `jite_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      token,
      message: 'Administrator password changed successfully.'
    }));
  } catch (err: any) {
    console.error('[Admin Change-Password Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({
      success: false,
      error: 'Unable to update password on server. Please try again.'
    }));
  }
}
