import type { IncomingMessage, ServerResponse } from 'http';
import {
  setCorsAndHeaders,
  getAdminAuthConfig
} from '../../_authHelper';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const config = await getAdminAuthConfig();
    const isSetup = Boolean(config && config.salt && config.hash);

    res.statusCode = 200;
    res.end(JSON.stringify({
      isSetup,
      mode: 'password_only',
      updatedAt: config?.updatedAt || null
    }));
  } catch (err: any) {
    console.error('[API /api/admin/auth/status] Error:', err);
    res.statusCode = 200;
    res.end(JSON.stringify({ isSetup: false, mode: 'password_only' }));
  }
}
