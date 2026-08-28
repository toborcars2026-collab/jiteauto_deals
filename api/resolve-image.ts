import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  try {
    if (targetUrl.includes('ibb.co/') && !targetUrl.includes('i.ibb.co/')) {
      const response = await fetch(targetUrl);
      const text = await response.text();
      const match = text.match(/meta property="og:image" content="([^"]+)"/);
      if (match && match[1]) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ resolvedUrl: match[1] }));
        return;
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ resolvedUrl: targetUrl }));
  } catch (err) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ resolvedUrl: targetUrl }));
  }
}
