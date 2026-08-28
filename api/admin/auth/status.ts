import type { IncomingMessage, ServerResponse } from 'http';
import { setCorsAndHeaders, getAdminAuthConfig } from '../../_authHelper';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const config = await getAdminAuthConfig();
    res.statusCode = 200;
    res.end(JSON.stringify({
      isSetup: true,
      mode: 'password_only',
      updatedAt: config?.updatedAt || null
    }));
  } catch (err: any) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      isSetup: true,
      mode: 'password_only'
    }));
  }
}
