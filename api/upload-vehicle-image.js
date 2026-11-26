import crypto from 'crypto';
import { verifyRequestAdmin } from './admin-auth.js';
import {
  isSupabaseServerConfigured,
  hasSupabaseServiceRole,
  loadSupabaseServerConfig,
  supabaseRest,
  supabaseStorageCreateSignedUploadUrl,
  supabaseStorageUploadBuffer,
  supabaseStorageDeleteObjects,
  extractSupabaseStoragePathFromUrl,
} from '../lib/supabase-rest.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

function setCorsHeaders(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const origin = req.headers?.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-firebase-id-token, x-supabase-access-token'
  );
}

function getAction(req) {
  if (req.query?.action) return String(req.query.action).toLowerCase();
  try {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    return String(urlObj.searchParams.get('action') || '').toLowerCase();
  } catch {
    return '';
  }
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

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const adminCheck = await verifyRequestAdmin(req);
  if (!adminCheck.authorized) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: adminCheck.error || 'Unauthorized upload request.' }));
    return;
  }

  const action = getAction(req);
  const sbCfg = loadSupabaseServerConfig();
  const sbReady = isSupabaseServerConfigured() && hasSupabaseServiceRole();

  try {
    // ------------------------------------------------------------------------
    // 1. GET ?action=status
    // ------------------------------------------------------------------------
    if (req.method === 'GET' && action === 'status') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          configured: sbReady,
          supabaseConfigured: sbReady,
          bucket: sbCfg.storageBucket || 'vehicle-images',
          maxFileSizeBytes: 15 * 1024 * 1024,
        })
      );
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const body = await readJsonBody(req);

    // ------------------------------------------------------------------------
    // 2. POST ?action=sign-supabase (Signed direct browser-to-Supabase Storage URL)
    // ------------------------------------------------------------------------
    if (action === 'sign-supabase') {
      if (!sbReady) {
        res.statusCode = 503;
        res.end(
          JSON.stringify({
            configured: false,
            error: 'Supabase Storage is not configured on this server (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).',
          })
        );
        return;
      }

      const rawVehicleId = String(body?.vehicleId || 'inventory')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      const rawContentType = String(body?.contentType || 'image/jpeg').toLowerCase();
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'].includes(rawContentType)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Unsupported image MIME type. Use JPG, PNG, WebP, or AVIF.' }));
        return;
      }
      let ext = 'jpg';
      if (rawContentType.includes('png')) ext = 'png';
      else if (rawContentType.includes('webp')) ext = 'webp';
      else if (rawContentType.includes('avif')) ext = 'avif';

      const objectPath = `vehicles/${rawVehicleId}/img_${Date.now()}_${crypto.randomBytes(5).toString('hex')}.${ext}`;
      const signed = await supabaseStorageCreateSignedUploadUrl(objectPath, sbCfg.storageBucket);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          configured: true,
          ...signed,
        })
      );
      return;
    }

    // ------------------------------------------------------------------------
    // 3. POST ?action=delete-supabase (Deletes unshared Supabase Storage files)
    // ------------------------------------------------------------------------
    if (action === 'delete-supabase') {
      if (!sbReady) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, skipped: true, deleted: [] }));
        return;
      }

      const vehicleId = String(body?.vehicleId || '').trim();
      const rawPaths = Array.isArray(body?.storagePaths) ? body.storagePaths : [];
      const rawUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];

      const candidatePaths = new Set();
      for (const p of rawPaths) {
        if (typeof p === 'string' && p.trim()) {
          candidatePaths.add(p.trim().replace(/^\/+/, ''));
        }
      }
      for (const u of rawUrls) {
        const extracted = extractSupabaseStoragePathFromUrl(u, sbCfg.storageBucket);
        if (extracted) candidatePaths.add(extracted);
      }

      if (candidatePaths.size === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, deleted: [] }));
        return;
      }

      // Check across remaining vehicles & vehicle_images so shared assets are never deleted
      const protectedPaths = new Set();
      try {
        const otherImgs = await supabaseRest(
          vehicleId
            ? `vehicle_images?vehicle_id=neq.${encodeURIComponent(vehicleId)}&select=storage_path,secure_url`
            : 'vehicle_images?select=storage_path,secure_url'
        );
        if (Array.isArray(otherImgs)) {
          for (const row of otherImgs) {
            if (row?.storage_path) protectedPaths.add(String(row.storage_path).replace(/^\/+/, ''));
            const fromUrl = extractSupabaseStoragePathFromUrl(row?.secure_url, sbCfg.storageBucket);
            if (fromUrl) protectedPaths.add(fromUrl);
          }
        }
      } catch {
        // Non-blocking
      }

      const deletable = Array.from(candidatePaths).filter((p) => !protectedPaths.has(p));
      if (deletable.length === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, deleted: [], skippedShared: Array.from(candidatePaths) }));
        return;
      }

      const result = await supabaseStorageDeleteObjects(deletable, sbCfg.storageBucket);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, ...result }));
      return;
    }

    // ------------------------------------------------------------------------
    // 4. POST (Default base64 payload upload — stores directly in Supabase Storage when configured)
    // ------------------------------------------------------------------------
    const { base64Data, vehicleId } = body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing base64Data payload' }));
      return;
    }

    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const mimeType = (matches ? matches[1] : 'image/jpeg').toLowerCase();
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

    if (sbReady) {
      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('avif')) ext = 'avif';

      const cleanVehicleId = String(vehicleId || 'car')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      const objectPath = `vehicles/${cleanVehicleId}/img_${Date.now()}_${crypto.randomBytes(5).toString('hex')}.${ext}`;
      const uploaded = await supabaseStorageUploadBuffer(
        objectPath,
        buffer,
        mimeType,
        sbCfg.storageBucket
      );
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          url: uploaded.publicUrl,
          publicId: uploaded.path,
          storagePath: uploaded.path,
          storageBucket: uploaded.bucket,
          size: buffer.length,
          mimeType,
        })
      );
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

