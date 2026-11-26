import fs from 'fs';
import path from 'path';
import { verifyRequestAdmin } from './admin-auth.js';
import {
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreDeleteDocument,
  firestoreQueryCollection,
} from './firestore-rest.js';

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

export function readStore(key) {
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

export function writeStore(key, data) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-firebase-id-token'
  );
}

function parseRouteParams(req) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const resource = String(req.query?.resource || urlObj.searchParams.get('resource') || '').toLowerCase();
  const action = String(req.query?.action || urlObj.searchParams.get('action') || '').trim();
  return { resource, action, actionLower: action.toLowerCase() };
}

function decodeUnicodeEscapes(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
      } catch {
        return _;
      }
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
      } catch {
        return _;
      }
    })
    .replace(/^2728\s+/g, '✨ ')
    .replace(/\s+2728$/g, ' ✨')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');
}

function normalizeVehicle(v) {
  if (!v || typeof v !== 'object') return v;
  const copy = { ...v };
  delete copy._docId;
  ['description', 'make', 'model', 'dealership', 'engine', 'color', 'condition', 'location'].forEach(
    (key) => {
      if (copy[key] && typeof copy[key] === 'string') {
        copy[key] = decodeUnicodeEscapes(copy[key]);
      }
    }
  );
  return copy;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(req, res, false);
    res.statusCode = 204;
    res.end();
    return;
  }

  const { resource, action, actionLower } = parseRouteParams(req);

  try {
    // ------------------------------------------------------------------------
    // VEHICLES (Cloud Firestore Authoritative + Local Mirror)
    // ------------------------------------------------------------------------
    if (resource === 'vehicles') {
      if (req.method === 'GET' && !actionLower) {
        setHeaders(req, res, false);
        try {
          const fsVehicles = await firestoreQueryCollection('vehicles');
          const normalized = fsVehicles.map(normalizeVehicle).filter((v) => v && v.id);
          writeStore('vehicles', normalized);
          res.statusCode = 200;
          res.end(JSON.stringify(normalized));
          return;
        } catch {
          const rawVehicles = readStore('vehicles');
          const rawDeleted = readStore('deleted');
          const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
          const vehicles = (Array.isArray(rawVehicles) ? rawVehicles : [])
            .map(normalizeVehicle)
            .filter((v) => v && v.id && !deletedSet.has(v.id));
          res.statusCode = 200;
          res.end(JSON.stringify(vehicles));
          return;
        }
      }

      if (req.method === 'DELETE') {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const id = decodeURIComponent(action || '').trim();
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing vehicle id' }));
          return;
        }
        if (adminCheck.firebaseIdToken) {
          await firestoreDeleteDocument(`vehicles/${id}`, adminCheck.firebaseIdToken);
        }
        const rawDeleted = readStore('deleted');
        const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
        deletedSet.add(id);
        writeStore('deleted', Array.from(deletedSet));

        const rawList = readStore('vehicles');
        const filtered = (Array.isArray(rawList) ? rawList : []).filter((v) => v && v.id !== id);
        writeStore('vehicles', filtered);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, deletedId: id, remaining: filtered.length }));
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

        if (actionLower === 'upsert') {
          const rawVehicle = body?.vehicle && typeof body.vehicle === 'object' ? body.vehicle : body;
          if (!rawVehicle || typeof rawVehicle.id !== 'string' || !rawVehicle.id.trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid vehicle payload' }));
            return;
          }
          const nowIso = new Date().toISOString();
          const vehicle = normalizeVehicle({
            ...rawVehicle,
            createdAt: rawVehicle.createdAt || nowIso,
            updatedAt: nowIso,
          });

          if (adminCheck.firebaseIdToken) {
            try {
              await firestorePatchDocument(`vehicles/${vehicle.id}`, vehicle, adminCheck.firebaseIdToken);
            } catch (fsErr) {
              const msg = String(fsErr?.message || '');
              if (msg.includes('exceeds') || msg.includes('1048576') || fsErr?.status === 400) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error:
                      'Vehicle document exceeds Firestore 1MB size limit (too many high-res inline photos). Remove excess photos or compress images.',
                  })
                );
                return;
              }
              throw fsErr;
            }
          }

          const rawDeleted = readStore('deleted');
          if (Array.isArray(rawDeleted) && rawDeleted.includes(vehicle.id)) {
            writeStore(
              'deleted',
              rawDeleted.filter((d) => d !== vehicle.id)
            );
          }

          const rawList = readStore('vehicles');
          const list = Array.isArray(rawList) ? rawList : [];
          const idx = list.findIndex((v) => v && v.id === vehicle.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...vehicle };
          } else {
            list.unshift(vehicle);
          }
          writeStore('vehicles', list);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, vehicle }));
          return;
        }

        if (actionLower === 'delete') {
          const id = typeof body?.id === 'string' ? body.id.trim() : '';
          if (!id) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing vehicle id' }));
            return;
          }
          if (adminCheck.firebaseIdToken) {
            await firestoreDeleteDocument(`vehicles/${id}`, adminCheck.firebaseIdToken);
          }
          const rawDeleted = readStore('deleted');
          const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);
          deletedSet.add(id);
          writeStore('deleted', Array.from(deletedSet));

          const rawList = readStore('vehicles');
          const filtered = (Array.isArray(rawList) ? rawList : []).filter((v) => v && v.id !== id);
          writeStore('vehicles', filtered);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, deletedId: id, remaining: filtered.length }));
          return;
        }
      }
    }

    // ------------------------------------------------------------------------
    // LEADS & INQUIRIES (Cloud Firestore Authoritative + Local Mirror)
    // ------------------------------------------------------------------------
    if (resource === 'leads' || resource === 'inquiries') {
      const storeKey = resource;
      const collectionName = resource;

      if (req.method === 'GET' && !actionLower) {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }

        if (adminCheck.firebaseIdToken) {
          try {
            const fsItems = await firestoreQueryCollection(collectionName, {
              idToken: adminCheck.firebaseIdToken,
              orderByField: 'createdAt',
              orderDirection: 'DESCENDING',
            });
            const cleaned = fsItems.map((item) => {
              const c = { ...item };
              delete c._docId;
              return c;
            });
            writeStore(storeKey, cleaned);
            res.statusCode = 200;
            res.end(JSON.stringify(cleaned));
            return;
          } catch {
            // Fall through to local mirror
          }
        }

        const items = readStore(storeKey);
        res.statusCode = 200;
        res.end(JSON.stringify(Array.isArray(items) ? items : []));
        return;
      }

      if (req.method === 'POST' && actionLower === 'submit') {
        setHeaders(req, res, false);
        const body = await readJsonBody(req);
        const item = body && typeof body === 'object' ? body : null;
        if (!item || typeof item.id !== 'string' || !item.id.trim()) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid submission payload' }));
          return;
        }
        try {
          await firestorePatchDocument(`${collectionName}/${item.id}`, item, '');
        } catch {
          // Client SDK also writes directly to Firestore
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

      if (
        req.method === 'POST' &&
        (!actionLower || actionLower === 'status' || actionLower === 'update')
      ) {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        const body = await readJsonBody(req);

        if (actionLower === 'status') {
          const id = typeof body?.id === 'string' ? body.id.trim() : '';
          const status = typeof body?.status === 'string' ? body.status.trim() : '';
          if (!id || !status) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing id or status' }));
            return;
          }
          const nowIso = new Date().toISOString();
          if (adminCheck.firebaseIdToken) {
            await firestorePatchDocument(
              `${collectionName}/${id}`,
              { status, updatedAt: nowIso },
              adminCheck.firebaseIdToken,
              ['status', 'updatedAt']
            );
          }
          const existing = readStore(storeKey);
          const list = Array.isArray(existing) ? existing : [];
          const updated = list.map((item) =>
            item && item.id === id ? { ...item, status, updatedAt: nowIso } : item
          );
          writeStore(storeKey, updated);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (actionLower === 'update') {
          const id = typeof body?.id === 'string' ? body.id.trim() : '';
          const updates = body?.updates && typeof body.updates === 'object' ? body.updates : {};
          if (!id || Object.keys(updates).length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing id or updates' }));
            return;
          }
          const patchPayload = { ...updates, updatedAt: new Date().toISOString() };
          delete patchPayload.id;
          if (adminCheck.firebaseIdToken) {
            await firestorePatchDocument(
              `${collectionName}/${id}`,
              patchPayload,
              adminCheck.firebaseIdToken,
              Object.keys(patchPayload)
            );
          }
          const existing = readStore(storeKey);
          const list = Array.isArray(existing) ? existing : [];
          const updated = list.map((item) =>
            item && item.id === id ? { ...item, ...patchPayload } : item
          );
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
    // BUSINESS SETTINGS (Cloud Firestore Authoritative + Local Mirror)
    // ------------------------------------------------------------------------
    if (resource === 'business-settings') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        try {
          const fsDoc = await firestoreGetDocument('settings/business');
          if (fsDoc) {
            delete fsDoc._docId;
            writeStore('business-settings', fsDoc);
            res.statusCode = 200;
            res.end(JSON.stringify({ settings: fsDoc }));
            return;
          }
        } catch {
          // Fall back to local cache
        }
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
        const rawSettings =
          body?.settings && typeof body.settings === 'object' ? body.settings : body;
        if (!rawSettings || typeof rawSettings !== 'object') {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid settings payload' }));
          return;
        }
        const settings = { ...rawSettings, updatedAt: new Date().toISOString() };
        delete settings._docId;

        if (adminCheck.firebaseIdToken) {
          await firestorePatchDocument('settings/business', settings, adminCheck.firebaseIdToken);
        }
        writeStore('business-settings', settings);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, settings }));
        return;
      }
    }

    // ------------------------------------------------------------------------
    // EDITORIAL POSTS (Cloud Firestore Authoritative + Local Mirror)
    // ------------------------------------------------------------------------
    if (resource === 'editorial-posts') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        try {
          const fsDoc = await firestoreGetDocument('settings/editorial');
          if (fsDoc && Array.isArray(fsDoc.posts)) {
            writeStore('editorial-posts', fsDoc.posts);
            res.statusCode = 200;
            res.end(JSON.stringify({ posts: fsDoc.posts }));
            return;
          }
        } catch {
          // Fall back to local cache
        }
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
        const nowIso = new Date().toISOString();
        if (adminCheck.firebaseIdToken) {
          await firestorePatchDocument(
            'settings/editorial',
            { posts, updatedAt: nowIso },
            adminCheck.firebaseIdToken
          );
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
  } catch (err) {
    setHeaders(req, res, false);
    res.statusCode = err?.status === 403 ? 403 : 500;
    res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
  }
}
