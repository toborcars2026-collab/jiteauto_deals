import type { IncomingMessage, ServerResponse } from 'http';
import {
  setCorsAndHeaders,
  getAdminAuthConfig,
  verifyPassword,
  generateToken,
  createAdminSession,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
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

  const clientIp = getClientIp(req);
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    res.statusCode = 429;
    res.end(JSON.stringify({
      success: false,
      error: `Too many failed attempts. Please wait ${rateCheck.waitSeconds} seconds before trying again.`,
      code: 'RATE_LIMITED'
    }));
    return;
  }

  try {
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
  } catch (err: any) {
    console.error('[Admin Login API Error]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({
      success: false,
      error: 'Authentication server error. Please try again.'
    }));
  }
}
