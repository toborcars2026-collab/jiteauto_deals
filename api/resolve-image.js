import { applyCorsHeaders } from '../lib/cors.js';
import { validateSafeIbbResolveUrl } from '../lib/url-safety.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res, {
    isPrivate: false,
    methods: 'GET, OPTIONS',
    allowHeaders: 'Content-Type',
    extraNoSniff: true,
  });

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const urlObj = new URL(req.url || '/', 'http://localhost');
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  const check = await validateSafeIbbResolveUrl(targetUrl);
  if (!check.ok) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: check.error }));
    return;
  }

  const safeHref = check.parsed.toString();

  try {
    if (check.hostname === 'ibb.co' || check.hostname === 'www.ibb.co') {
      const response = await fetch(safeHref, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      if (response.status >= 300 && response.status < 400) {
        const loc = response.headers.get('location') || '';
        const redirectCheck = await validateSafeIbbResolveUrl(loc);
        if (!redirectCheck.ok) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Blocked unsafe redirect from image host' }));
          return;
        }
      }

      if (response.ok) {
        const text = await response.text();
        const match = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        if (match && match[1]) {
          const ogCheck = await validateSafeIbbResolveUrl(match[1]);
          if (ogCheck.ok) {
            res.statusCode = 200;
            res.end(JSON.stringify({ resolvedUrl: ogCheck.parsed.toString() }));
            return;
          }
        }
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ resolvedUrl: safeHref }));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Unable to resolve image host at this time' }));
  }
}
