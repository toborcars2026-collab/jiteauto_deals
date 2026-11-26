import dns from 'dns/promises';
import net from 'net';

const ALLOWED_IMAGE_RESOLVE_HOSTS = new Set(['ibb.co', 'www.ibb.co', 'i.ibb.co']);
const SAFE_DATA_IMAGE_RE = /^data:image\/(?:jpeg|jpg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/i;

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

export function isPrivateOrReservedIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return true;
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIpv4(ip);
  }
  if (version === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) {
      return isPrivateIpv4(ip.slice('::ffff:'.length));
    }
    const firstHextet = parseInt(ip.split(':')[0] || '0', 16);
    if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return true;
}

export async function validateSafeIbbResolveUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 1024) {
    return { ok: false, error: 'Invalid image URL' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'Malformed image URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only HTTPS image URLs are allowed' };
  }
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    return { ok: false, error: 'Disallowed URL credentials or port' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (net.isIP(hostname) !== 0 || !ALLOWED_IMAGE_RESOLVE_HOSTS.has(hostname)) {
    return { ok: false, error: 'Only verified ibb.co image links can be resolved' };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!Array.isArray(records) || records.length === 0) {
      return { ok: false, error: 'Image host did not resolve' };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec?.address)) {
        return { ok: false, error: 'Image host resolved to a restricted network address' };
      }
    }
  } catch {
    return { ok: false, error: 'Unable to verify image host DNS' };
  }

  return { ok: true, parsed, hostname };
}

export function sanitizePublicHttpUrl(rawUrl, maxLen = 1000) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim().slice(0, maxLen);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function sanitizeImageSrcUrl(rawUrl, maxLen = 4_000_000) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > maxLen) return '';
  if (SAFE_DATA_IMAGE_RE.test(trimmed)) return trimmed;
  return sanitizePublicHttpUrl(trimmed, 2048);
}
