import fs from 'fs';
import path from 'path';
import { verifyRequestAdmin } from './admin-auth.js';

const DATA_DIR = path.join(process.cwd(), 'data_store');

const RESOURCE_FILES = {
  vehicles: { repo: path.join(DATA_DIR, 'vehicles.json'), tmp: '/tmp/jite_vehicles.json', fallback: [] },
  deleted: { repo: path.join(DATA_DIR, 'deleted_ids.json'), tmp: '/tmp/jite_deleted_ids.json', fallback: [] },
  leads: { repo: path.join(DATA_DIR, 'leads.json'), tmp: '/tmp/jite_leads.json', fallback: [] },
  inquiries: { repo: path.join(DATA_DIR, 'inquiries.json'), tmp: '/tmp/jite_inquiries.json', fallback: [] },
  'business-settings': {
    repo: path.join(DATA_DIR, 'business_settings.json'),
    tmp: '/tmp/jite_business_settings.json',
    fallback: null,
  },
  'editorial-posts': {
    repo: path.join(DATA_DIR, 'editorial_posts.json'),
    tmp: '/tmp/jite_editorial_posts.json',
    fallback: [],
  },
};

function readStore(key) {
  const cfg = RESOURCE_FILES[key];
  if (!cfg) return null;
  for (const candidate of [cfg.tmp, cfg.repo]) {
    try {
      if (!fs.existsSync(candidate)) continue;
      return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
    } catch {
      // Check next candidate
    }
  }
  return cfg.fallback;
}

function writeStore(key, data) {
  const cfg = RESOURCE_FILES[key];
  if (!cfg) return;
  const serialized = JSON.stringify(data, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(cfg.repo, serialized, 'utf-8');
  } catch {
    // Vercel serverless environments have a read-only workspace directory
  }
  try {
    fs.writeFileSync(cfg.tmp, serialized, 'utf-8');
  } catch {
    // Ignore /tmp errors
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

function setHeaders(req, res, isPrivate = false) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    isPrivate ? 'no-store, no-cache, must-revalidate, private' : 'no-cache, must-revalidate'
  );
  const origin = req.headers?.origin;
  if (origin && typeof origin === 'string') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseRouteParams(req) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const resource = String(req.query?.resource || urlObj.searchParams.get('resource') || '').toLowerCase();
  const action = String(req.query?.action || urlObj.searchParams.get('action') || '').toLowerCase();
  return { resource, action };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(req, res, false);
    res.statusCode = 204;
    res.end();
    return;
  }

  const { resource, action } = parseRouteParams(req);

  try {
    // ------------------------------------------------------------------------
    // VEHICLES
    // ------------------------------------------------------------------------
    if (resource === 'vehicles') {
      if (req.method === 'GET' && !action) {
        setHeaders(req, res, false);
        const rawVehicles = readStore('vehicles');
        const rawDeleted = readStore('deleted');
        const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
        const vehicles = (Array.isArray(rawVehicles) ? rawVehicles : []).filter(
          (v) => v && !deletedSet.has(v.id)
        );
        res.statusCode = 200;
        res.end(JSON.stringify(vehicles));
        return;
      }

      if (req.method === 'POST') {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }

        const body = await readJsonBody(req);

        if (action === 'upsert') {
          const vehicle = body?.vehicle && typeof body.vehicle === 'object' ? body.vehicle : body;
          if (!vehicle || typeof vehicle.id !== 'string' || !vehicle.id.trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid vehicle payload' }));
            return;
          }
          const rawList = readStore('vehicles');
          const list = Array.isArray(rawList) ? rawList : [];
          const idx = list.findIndex((v) => v && v.id === vehicle.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...vehicle, updatedAt: new Date().toISOString() };
          } else {
            list.unshift({
              ...vehicle,
              createdAt: vehicle.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          writeStore('vehicles', list);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, vehicle: idx >= 0 ? list[idx] : list[0] }));
          return;
        }

        if (action === 'delete') {
          const id = typeof body?.id === 'string' ? body.id.trim() : '';
          if (!id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing vehicle id' }));
            return;
          }
          const rawDeleted = readStore('deleted');
          const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
          deletedSet.add(id);
          writeStore('deleted', Array.from(deletedSet));

          const rawList = readStore('vehicles');
          const filtered = (Array.isArray(rawList) ? rawList : []).filter((v) => v && v.id !== id);
          writeStore('vehicles', filtered);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, deletedId: id }));
          return;
        }
      }
    }

    // ------------------------------------------------------------------------
    // LEADS & INQUIRIES
    // ------------------------------------------------------------------------
    if (resource === 'leads' || resource === 'inquiries') {
      const storeKey = resource;

      if (req.method === 'GET' && !action) {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const items = readStore(storeKey);
        res.statusCode = 200;
        res.end(JSON.stringify(Array.isArray(items) ? items : []));
        return;
      }

      if (req.method === 'POST' && action === 'submit') {
        setHeaders(req, res, false);
        const body = await readJsonBody(req);
        const item = body && typeof body === 'object' ? body : null;
        if (!item || typeof item.id !== 'string' || !item.id.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid submission payload' }));
          return;
        }
        const existing = readStore(storeKey);
        const list = Array.isArray(existing) ? existing : [];
        if (!list.some((x) => x && x.id === item.id)) {
          list.unshift(item);
          writeStore(storeKey, list);
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'POST' && (!action || action === 'status')) {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const body = await readJsonBody(req);
        if (action === 'status') {
          const id = typeof body?.id === 'string' ? body.id : '';
          const status = typeof body?.status === 'string' ? body.status : '';
          if (!id || !status) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing id or status' }));
            return;
          }
          const existing = readStore(storeKey);
          const list = Array.isArray(existing) ? existing : [];
          const updated = list.map((item) => (item && item.id === id ? { ...item, status } : item));
          writeStore(storeKey, updated);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (Array.isArray(body)) {
          writeStore(storeKey, body);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }
      }
    }

    // ------------------------------------------------------------------------
    // BUSINESS SETTINGS
    // ------------------------------------------------------------------------
    if (resource === 'business-settings') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        const settings = readStore('business-settings');
        res.statusCode = 200;
        res.end(JSON.stringify({ settings }));
        return;
      }
      if (req.method === 'POST') {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const body = await readJsonBody(req);
        const settings = body?.settings && typeof body.settings === 'object' ? body.settings : body;
        if (!settings || typeof settings !== 'object') {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid settings payload' }));
          return;
        }
        writeStore('business-settings', settings);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, settings }));
        return;
      }
    }

    // ------------------------------------------------------------------------
    // EDITORIAL POSTS
    // ------------------------------------------------------------------------
    if (resource === 'editorial-posts') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        const posts = readStore('editorial-posts');
        res.statusCode = 200;
        res.end(JSON.stringify({ posts: Array.isArray(posts) ? posts : [] }));
        return;
      }
      if (req.method === 'POST') {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const body = await readJsonBody(req);
        const posts = Array.isArray(body) ? body : body?.posts;
        if (!Array.isArray(posts)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Expected posts array' }));
          return;
        }
        writeStore('editorial-posts', posts);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, posts }));
        return;
      }
    }

    setHeaders(req, res, false);
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Resource not found' }));
  } catch {
    setHeaders(req, res, false);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
