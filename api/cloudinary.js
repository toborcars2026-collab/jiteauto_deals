import crypto from 'crypto';
import { verifyRequestAdmin } from './admin-auth.js';
import { readStore } from './data.js';
import { firestoreQueryCollection } from './firestore-rest.js';
import { applyCorsHeaders } from '../lib/cors.js';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);

function setHeaders(req, res) {
  applyCorsHeaders(req, res, {
    isPrivate: true,
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-firebase-id-token, x-supabase-access-token',
    extraNoSniff: true,
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  const uploadPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();

  const missing = [];
  if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

  return {
    configured: missing.length === 0,
    cloudName,
    apiKey,
    apiSecret,
    uploadPreset,
    missing,
  };
}

export function generateCloudinarySignature(params, apiSecret) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
    .sort();
  const payload = keys.map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export function extractCloudinaryPublicId(url, expectedCloudName) {
  if (!url || typeof url !== 'string' || !expectedCloudName) return null;
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes('res.cloudinary.com')) return null;
    const prefix = `/${expectedCloudName}/image/upload/`;
    const idx = parsed.pathname.indexOf(prefix);
    if (idx === -1) return null;
    let rest = parsed.pathname.slice(idx + prefix.length).replace(/^\/+/, '');
    if (!rest) return null;

    // Strip any delivery transform segments (e.g. c_limit,w_800,q_auto,f_auto/)
    const segments = rest.split('/');
    while (
      segments.length > 1 &&
      !/^v\d+$/.test(segments[0]) &&
      (segments[0].includes(',') || /^(c|w|h|q|f|dpr|g|ar|e|b|bo|l|o|r|t)_/.test(segments[0]))
    ) {
      segments.shift();
    }
    if (segments.length > 1 && /^v\d+$/.test(segments[0])) {
      segments.shift();
    }
    const joined = decodeURIComponent(segments.join('/'));
    return joined.replace(/\.[a-z0-9]{2,5}$/i, '');
  } catch {
    return null;
  }
}

function normalizeVehicleId(rawId) {
  const clean = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return clean || `vehicle-${Date.now().toString(36)}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  setHeaders(req, res);

  // Strict administrator authentication required for all Cloudinary operations
  const adminCheck = await verifyRequestAdmin(req);
  if (!adminCheck.authorized) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: adminCheck.error || 'Unauthorized administrator access required.',
        code: 'UNAUTHORIZED_ADMIN',
      })
    );
    return;
  }

  const urlObj = new URL(req.url || '/', 'http://localhost');
  const action = String(req.query?.action || urlObj.searchParams.get('action') || 'status')
    .trim()
    .toLowerCase();

  const cfg = getCloudinaryConfig();

  // --------------------------------------------------------------------------
  // GET /api/cloudinary?action=status
  // --------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'status') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        configured: cfg.configured,
        cloudNameConfigured: Boolean(cfg.cloudName),
        apiKeyConfigured: Boolean(cfg.apiKey),
        apiSecretConfigured: Boolean(cfg.apiSecret),
        uploadPresetConfigured: Boolean(cfg.uploadPreset),
        cloudName: cfg.cloudName || '',
        missing: cfg.missing,
        folderPattern: 'Jite-Auto-Deals/Vehicles/{vehicleId}/Vehicle-Images',
        maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
      })
    );
    return;
  }

  // --------------------------------------------------------------------------
  // POST /api/cloudinary?action=sign (or /api/cloudinary-sign)
  // --------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'sign') {
    if (!cfg.configured) {
      res.statusCode = 503;
      res.end(
        JSON.stringify({
          configured: false,
          code: 'CLOUDINARY_NOT_CONFIGURED',
          missing: cfg.missing,
          error:
            'Cloudinary server credentials are not configured yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your environment variables.',
        })
      );
      return;
    }

    const body = await readJsonBody(req);
    const vehicleId = normalizeVehicleId(body?.vehicleId);
    const mimeType = String(body?.mimeType || '').trim().toLowerCase();
    const fileName = String(body?.fileName || '').trim();
    const fileSize = Number(body?.fileSize || 0);
    const slotNumber = Math.max(1, Math.min(40, Number(body?.slot || 1) || 1));

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: `Optimized file exceeds the ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB per-image upload limit.`,
        })
      );
      return;
    }

    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: 'Unsupported image MIME type. Only JPG, PNG, WebP, AVIF, or HEIC images are allowed.',
        })
      );
      return;
    }

    if (fileName) {
      const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
      if (extMatch && !ALLOWED_EXTENSIONS.has(extMatch[1].toLowerCase())) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Unsupported image file format. Use JPG, PNG, WebP, AVIF, or HEIC.',
          })
        );
        return;
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `Jite-Auto-Deals/Vehicles/${vehicleId}/Vehicle-Images`;
    const publicId = `img_${slotNumber}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tags = `jite-auto-deals,vehicle_${vehicleId}`;

    const signParams = {
      folder,
      public_id: publicId,
      tags,
      timestamp,
    };
    if (cfg.uploadPreset) {
      signParams.upload_preset = cfg.uploadPreset;
    }

    const signature = generateCloudinarySignature(signParams, cfg.apiSecret);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        configured: true,
        cloudName: cfg.cloudName,
        apiKey: cfg.apiKey,
        timestamp,
        signature,
        folder,
        publicId,
        tags,
        uploadPreset: cfg.uploadPreset || '',
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`,
      })
    );
    return;
  }

  // --------------------------------------------------------------------------
  // POST /api/cloudinary?action=delete (or /api/cloudinary-delete)
  // Safely deletes unshared Cloudinary vehicle images only when permanently deleted.
  // --------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'delete') {
    if (!cfg.configured) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          notConfigured: true,
          deleted: [],
          skippedShared: [],
        })
      );
      return;
    }

    const body = await readJsonBody(req);
    const deletedVehicleId = String(body?.vehicleId || '').trim();
    const requestedPublicIds = Array.isArray(body?.publicIds)
      ? body.publicIds.filter((id) => typeof id === 'string' && id.trim())
      : [];
    const requestedImageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.filter((u) => typeof u === 'string' && u.trim())
      : [];

    // Gather every image URL and publicId used by all OTHER vehicles so shared assets are never deleted
    const protectedPublicIds = new Set();
    const protectedUrls = new Set();

    const collectProtected = (list) => {
      if (!Array.isArray(list)) return;
      for (const v of list) {
        if (!v || typeof v !== 'object') continue;
        if (deletedVehicleId && v.id === deletedVehicleId) continue;
        if (Array.isArray(v.images)) {
          for (const url of v.images) {
            if (typeof url === 'string' && url.trim()) {
              protectedUrls.add(url.trim());
              const pid = extractCloudinaryPublicId(url, cfg.cloudName);
              if (pid) protectedPublicIds.add(pid);
            }
          }
        }
        if (Array.isArray(v.imageMetadata)) {
          for (const meta of v.imageMetadata) {
            if (meta?.publicId) protectedPublicIds.add(String(meta.publicId).trim());
            if (meta?.secureUrl) protectedUrls.add(String(meta.secureUrl).trim());
          }
        }
      }
    };

    try {
      const fsVehicles = await firestoreQueryCollection('vehicles');
      collectProtected(fsVehicles);
    } catch {
      // Also merge local mirror store
    }
    collectProtected(readStore('vehicles'));

    const candidates = new Set();
    for (const pid of requestedPublicIds) {
      const trimmed = pid.trim();
      if (trimmed.startsWith('Jite-Auto-Deals/Vehicles/')) {
        candidates.add(trimmed);
      }
    }
    for (const imgUrl of requestedImageUrls) {
      if (protectedUrls.has(imgUrl.trim())) continue;
      const pid = extractCloudinaryPublicId(imgUrl, cfg.cloudName);
      if (pid && pid.startsWith('Jite-Auto-Deals/Vehicles/')) {
        candidates.add(pid);
      }
    }

    const deleted = [];
    const skippedShared = [];
    const failed = [];

    for (const publicId of candidates) {
      if (protectedPublicIds.has(publicId)) {
        skippedShared.push(publicId);
        continue;
      }

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = generateCloudinarySignature(
          { invalidate: 'true', public_id: publicId, timestamp },
          cfg.apiSecret
        );

        const form = new URLSearchParams();
        form.set('public_id', publicId);
        form.set('timestamp', String(timestamp));
        form.set('invalidate', 'true');
        form.set('api_key', cfg.apiKey);
        form.set('signature', signature);

        const destroyRes = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/destroy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
          }
        );

        const destroyJson = await destroyRes.json().catch(() => ({}));
        if (destroyRes.ok && (destroyJson?.result === 'ok' || destroyJson?.result === 'not found')) {
          deleted.push(publicId);
        } else {
          failed.push({ publicId, reason: destroyJson?.error?.message || destroyJson?.result || 'unknown' });
        }
      } catch (err) {
        failed.push({ publicId, reason: err?.message || 'network_error' });
      }
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        deleted,
        skippedShared,
        failed,
      })
    );
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Unsupported Cloudinary endpoint action.' }));
}
