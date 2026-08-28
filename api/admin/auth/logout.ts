import type { IncomingMessage, ServerResponse } from 'http';
import {
  setCorsAndHeaders,
  extractAdminToken,
  revokeAdminSession
} from '../../_authHelper';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const token = extractAdminToken(req);
  if (token) {
    revokeAdminSession(token);
  }

  res.setHeader('Set-Cookie', 'jite_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, message: 'Logged out successfully.' }));
}
