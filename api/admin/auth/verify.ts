import type { IncomingMessage, ServerResponse } from 'http';
import {
  setCorsAndHeaders,
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

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const token = extractAdminToken(req);
  const isValid = isSessionValid(token);

  if (!isValid) {
    res.statusCode = 401;
    res.end(JSON.stringify({ authenticated: false, error: 'Session expired or unauthenticated.' }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ authenticated: true, role: 'admin' }));
}
