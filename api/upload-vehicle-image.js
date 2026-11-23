import { verifyRequestAdmin } from './admin-auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const origin = req.headers?.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  const adminCheck = await verifyRequestAdmin(req);
  if (!adminCheck.authorized) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: adminCheck.error || 'Unauthorized upload request.' }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { base64Data } = body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing base64Data payload' }));
      return;
    }

    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid image MIME type' }));
      return;
    }
    const rawData = matches ? matches[2] : base64Data;
    const buffer = Buffer.from(rawData, 'base64');

    if (buffer.length > 15 * 1024 * 1024) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Image exceeds 15MB limit' }));
      return;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        url: base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${rawData}`,
        size: buffer.length,
        mimeType,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Upload failed: ' + (err?.message || String(err)) }));
  }
}
