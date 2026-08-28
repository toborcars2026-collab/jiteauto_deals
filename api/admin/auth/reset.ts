import type { IncomingMessage, ServerResponse } from 'http';
import {
  setCorsAndHeaders,
  clearAdminAuthConfig,
  parseJsonBody,
  extractAdminToken,
  isSessionValid
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
    const { resetKey } = body;
    const token = extractAdminToken(req);
    const hasAdminSession = isSessionValid(token);

    // Security check: Must either have an active admin session or match environment ADMIN_RESET_KEY
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
  } catch (err: any) {
    console.error('[API /api/admin/auth/reset] Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: 'Failed to reset administrator setup.' }));
  }
}
