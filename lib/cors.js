const STATIC_ALLOWED_ORIGINS = new Set([
  'https://jiteautodeals.vercel.app',
  'https://jiteautodealss.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function normalizeOrigin(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return '';
  }
}

export function isAllowedOrigin(originHeader, req) {
  const origin = normalizeOrigin(originHeader);
  if (!origin) return false;

  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;

  const envAppUrl = normalizeOrigin(process.env.APP_URL || process.env.VITE_APP_URL || '');
  if (envAppUrl && origin === envAppUrl) return true;

  try {
    const parsedOrigin = new URL(origin);
    const reqHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();

    if (reqHost && parsedOrigin.host.toLowerCase() === reqHost) {
      return true;
    }

    const hostname = parsedOrigin.hostname.toLowerCase();
    if (
      parsedOrigin.protocol === 'https:' &&
      (/^jiteautodeals?(-[a-z0-9-]+)?\.vercel\.app$/.test(hostname) ||
        hostname.endsWith('.run.app'))
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function applyCorsHeaders(
  req,
  res,
  {
    isPrivate = true,
    methods = 'GET, POST, OPTIONS',
    allowHeaders = 'Content-Type, Authorization, x-firebase-id-token, x-supabase-access-token',
    extraNoSniff = false,
  } = {}
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    isPrivate ? 'no-store, no-cache, must-revalidate, private' : 'no-cache, must-revalidate'
  );
  if (isPrivate) {
    res.setHeader('Pragma', 'no-cache');
  }
  if (extraNoSniff) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  const origin = req?.headers?.origin;
  if (origin && isAllowedOrigin(origin, req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', allowHeaders);
}
