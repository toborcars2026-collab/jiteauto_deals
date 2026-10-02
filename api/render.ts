import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  resolveServerRouteMetadata,
  injectMetadataIntoHtml,
  DEFAULT_BASE_URL,
} from '../src/metaHelper';
import type { Vehicle } from '../src/types';

let cachedBaseHtml: string | null = null;
let cachedFallbackVehicles: Vehicle[] | null = null;

function loadFallbackVehicles(): Vehicle[] {
  if (cachedFallbackVehicles) return cachedFallbackVehicles;
  try {
    const vehiclesPath = path.join(process.cwd(), 'data_store', 'vehicles.json');
    if (fs.existsSync(vehiclesPath)) {
      const raw = fs.readFileSync(vehiclesPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedFallbackVehicles = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore filesystem errors in constrained serverless environments
  }
  return [];
}

async function loadBaseHtml(req: IncomingMessage): Promise<string> {
  if (cachedBaseHtml) return cachedBaseHtml;

  // 1. Check built dist/index.html on filesystem
  try {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(distIndexPath)) {
      const html = fs.readFileSync(distIndexPath, 'utf-8');
      if (html && html.includes('<head>')) {
        cachedBaseHtml = html;
        return html;
      }
    }
  } catch {}

  // 2. Fetch deployed static /index.html from Vercel CDN edge (contains production hashed JS/CSS bundles)
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'jiteautodeals.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${origin}/index.html`, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      if (html && html.includes('<head>')) {
        cachedBaseHtml = html;
        return html;
      }
    }
  } catch {}

  // 3. Fallback to root index.html on disk
  try {
    const rootIndexPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(rootIndexPath)) {
      return fs.readFileSync(rootIndexPath, 'utf-8');
    }
  } catch {}

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <title>Jite Auto Deals | Trusted Vehicle Consultant</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const rawUrl = req.url || '/';
    const parsedReqUrl = new URL(rawUrl, DEFAULT_BASE_URL);

    // If Vercel rewrite passed ?path=/vehicles/..., reconstruct the original path + query
    const rewrittenPath = parsedReqUrl.searchParams.get('path');
    let targetUrlOrPath = rawUrl;
    if (rewrittenPath) {
      parsedReqUrl.searchParams.delete('path');
      const remainingQuery = parsedReqUrl.searchParams.toString();
      const cleanRewrittenPath = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
      targetUrlOrPath = remainingQuery ? `${cleanRewrittenPath}?${remainingQuery}` : cleanRewrittenPath;
    }

    const fallbackVehicles = loadFallbackVehicles();
    const [baseHtml, meta] = await Promise.all([
      loadBaseHtml(req),
      resolveServerRouteMetadata(targetUrlOrPath, fallbackVehicles),
    ]);

    const finalHtml = injectMetadataIntoHtml(baseHtml, meta);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(finalHtml);
  } catch (err) {
    const baseHtml = await loadBaseHtml(req);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(baseHtml);
  }
}
