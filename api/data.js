import fs from 'fs';
import path from 'path';
import { verifyRequestAdmin, extractBearerToken } from './admin-auth.js';
import {
  firestoreGetDocument,
  firestorePatchDocument,
  firestoreDeleteDocument,
  firestoreQueryCollection,
} from './firestore-rest.js';
import {
  isSupabaseServerConfigured,
  hasSupabaseServiceRole,
  supabaseRest,
  mapVehicleRowToApp,
  mapAppVehicleToRow,
  buildVehicleImageRows,
  mapEnquiryRowToApp,
  mapAppLeadToEnquiryRow,
  mapBookingRowToApp,
  mapAppInquiryToBookingRow,
} from '../lib/supabase-rest.js';
import { applyCorsHeaders } from '../lib/cors.js';
import { sanitizePublicHttpUrl, sanitizeImageSrcUrl } from '../lib/url-safety.js';

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
  analytics: {
    repo: path.join(DATA_DIR, 'analytics.json'),
    tmp: '/tmp/jite_analytics.json',
    fallback: {},
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
  applyCorsHeaders(req, res, {
    isPrivate,
    methods: 'GET, POST, DELETE, PATCH, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-firebase-id-token, x-supabase-access-token',
    extraNoSniff: true,
  });
}

function sanitizeText(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function sanitizePublicSubmission(resource, item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { error: 'Invalid submission payload.' };
  }
  const id = sanitizeText(item.id, 80);
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(id)) {
    return { error: 'Valid submission ID is required.' };
  }
  const name = sanitizeText(item.name, 120);
  const phone = sanitizeText(item.phone, 40);
  if (!name || phone.replace(/\D/g, '').length < 6) {
    return { error: 'Valid name and phone number are required.' };
  }

  const nowIso = new Date().toISOString();
  const createdAtRaw = sanitizeText(item.createdAt, 40);
  const createdAt = createdAtRaw && !Number.isNaN(Date.parse(createdAtRaw)) ? createdAtRaw : nowIso;

  if (resource === 'leads') {
    const rawSourceUrl = sanitizeText(item.sourceUrl, 1000);
    const safeSourceUrl = rawSourceUrl ? sanitizePublicHttpUrl(rawSourceUrl, 1000) : '';
    if (rawSourceUrl && !safeSourceUrl) {
      return { error: 'External listing URL must start with http:// or https://.' };
    }
    const rawSourceImage = typeof item.sourceImage === 'string' ? item.sourceImage.trim() : '';
    const safeSourceImage = rawSourceImage ? sanitizeImageSrcUrl(rawSourceImage, 4_000_000) : '';
    if (rawSourceImage && !safeSourceImage) {
      return { error: 'Attached screenshot must be a valid JPG, PNG, WebP, or AVIF image.' };
    }
    const rawBudget = Number(item.budget ?? 0);
    const budget = Number.isFinite(rawBudget) && rawBudget >= 0 ? Math.min(rawBudget, 5_000_000_000) : 0;

    return {
      item: {
        id,
        name,
        phone,
        vehicleType: sanitizeText(item.vehicleType, 60) || 'Any',
        budget,
        brand: sanitizeText(item.brand, 120),
        model: sanitizeText(item.model, 120),
        location: sanitizeText(item.location, 120),
        paymentMethod: item.paymentMethod === 'Financing' ? 'Financing' : 'Cash',
        requirements: sanitizeText(item.requirements, 2000),
        ...(safeSourceUrl ? { sourceUrl: safeSourceUrl } : {}),
        ...(safeSourceImage ? { sourceImage: safeSourceImage } : {}),
        type: item.type === 'source_car' ? 'source_car' : 'find_car',
        aiSummary: sanitizeText(item.aiSummary, 1000),
        status: 'New',
        createdAt,
      },
    };
  }

  const rawVehiclePrice = Number(item.vehiclePrice ?? 0);
  const vehiclePrice =
    Number.isFinite(rawVehiclePrice) && rawVehiclePrice >= 0 ? Math.min(rawVehiclePrice, 5_000_000_000) : 0;

  return {
    item: {
      id,
      name,
      phone,
      vehicleId: sanitizeText(item.vehicleId, 80),
      vehicleTitle: sanitizeText(item.vehicleTitle, 160),
      vehiclePrice,
      preferredDate: sanitizeText(item.preferredDate, 40),
      preferredTime: sanitizeText(item.preferredTime, 40),
      message: sanitizeText(item.message, 2000),
      type: item.type === 'inspection' || item.type === 'whatsapp' || item.type === 'callback' ? item.type : 'inspection',
      status: 'New',
      createdAt,
    },
  };
}

function parseRouteParams(req) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const resource = String(req.query?.resource || urlObj.searchParams.get('resource') || '').toLowerCase();
  const action = String(req.query?.action || urlObj.searchParams.get('action') || '').trim();
  return { resource, action, actionLower: action.toLowerCase(), urlObj };
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

async function fetchVehiclesFromSupabase({ includeHidden = false } = {}) {
  const useSvc = hasSupabaseServiceRole();
  const filter = includeHidden ? '' : '&status=neq.Hidden';
  const [rows, imgRows] = await Promise.all([
    supabaseRest(`vehicles?select=*${filter}&order=created_at.desc`, { useServiceRole: useSvc }),
    supabaseRest('vehicle_images?select=*&order=position.asc', { useServiceRole: useSvc }).catch(
      () => []
    ),
  ]);

  const imgMap = new Map();
  if (Array.isArray(imgRows)) {
    for (const img of imgRows) {
      if (!img?.vehicle_id) continue;
      if (!imgMap.has(img.vehicle_id)) imgMap.set(img.vehicle_id, []);
      imgMap.get(img.vehicle_id).push(img);
    }
  }

  return (Array.isArray(rows) ? rows : [])
    .map((r) => normalizeVehicle(mapVehicleRowToApp(r, imgMap.get(r.id) || [])))
    .filter((v) => v && v.id);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(req, res, false);
    res.statusCode = 204;
    res.end();
    return;
  }

  const { resource, action, actionLower } = parseRouteParams(req);
  const supabaseActive = isSupabaseServerConfigured();

  try {
    // ------------------------------------------------------------------------
    // VEHICLES (Supabase PostgreSQL / Cloud Firestore Authoritative + Local Mirror)
    // ------------------------------------------------------------------------
    if (resource === 'vehicles') {
      if (req.method === 'GET' && !actionLower) {
        let isAdminViewer = false;
        if (extractBearerToken(req)) {
          const check = await verifyRequestAdmin(req).catch(() => ({ authorized: false }));
          isAdminViewer = Boolean(check?.authorized);
        }
        setHeaders(req, res, isAdminViewer);

        if (supabaseActive) {
          try {
            const vehicles = await fetchVehiclesFromSupabase({ includeHidden: isAdminViewer });
            writeStore('vehicles', vehicles);
            res.statusCode = 200;
            res.end(JSON.stringify(vehicles));
            return;
          } catch {
            const cached = readStore('vehicles');
            const list = (Array.isArray(cached) ? cached : [])
              .map(normalizeVehicle)
              .filter((v) => v && v.id && (isAdminViewer || v.status !== 'Hidden'));
            res.statusCode = 200;
            res.end(JSON.stringify(list));
            return;
          }
        }

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

        if (supabaseActive) {
          await supabaseRest(`vehicles?id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
            accessToken: adminCheck.supabaseAccessToken || '',
            useServiceRole: hasSupabaseServiceRole(),
          });
        } else if (adminCheck.firebaseIdToken) {
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

          if (supabaseActive) {
            const useSvc = hasSupabaseServiceRole();
            const accessToken = adminCheck.supabaseAccessToken || '';
            const rowPayload = mapAppVehicleToRow(vehicle);
            await supabaseRest('vehicles', {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
              accessToken,
              useServiceRole: useSvc,
              body: rowPayload,
            });

            // Synchronize normalized vehicle_images table rows cleanly
            await supabaseRest(`vehicle_images?vehicle_id=eq.${encodeURIComponent(vehicle.id)}`, {
              method: 'DELETE',
              accessToken,
              useServiceRole: useSvc,
            }).catch(() => {});

            const imageRows = buildVehicleImageRows(vehicle);
            if (imageRows.length > 0) {
              await supabaseRest('vehicle_images', {
                method: 'POST',
                headers: { Prefer: 'resolution=merge-duplicates' },
                accessToken,
                useServiceRole: useSvc,
                body: imageRows,
              }).catch(() => {});
            }
          } else if (adminCheck.firebaseIdToken) {
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
          if (supabaseActive) {
            await supabaseRest(`vehicles?id=eq.${encodeURIComponent(id)}`, {
              method: 'DELETE',
              accessToken: adminCheck.supabaseAccessToken || '',
              useServiceRole: hasSupabaseServiceRole(),
            });
          } else if (adminCheck.firebaseIdToken) {
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
    // LEADS (customer_enquiries) & INQUIRIES (inspection_bookings)
    // ------------------------------------------------------------------------
    if (resource === 'leads' || resource === 'inquiries') {
      const storeKey = resource;
      const collectionName = resource;
      const sbTable = resource === 'leads' ? 'customer_enquiries' : 'inspection_bookings';

      if (req.method === 'GET' && !actionLower) {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }

        if (supabaseActive) {
          try {
            const rows = await supabaseRest(`${sbTable}?select=*&order=created_at.desc`, {
              accessToken: adminCheck.supabaseAccessToken || '',
              useServiceRole: hasSupabaseServiceRole(),
            });
            const mapped = (Array.isArray(rows) ? rows : [])
              .map((r) => (resource === 'leads' ? mapEnquiryRowToApp(r) : mapBookingRowToApp(r)))
              .filter(Boolean);
            writeStore(storeKey, mapped);
            res.statusCode = 200;
            res.end(JSON.stringify(mapped));
            return;
          } catch {
            // Fall through to local mirror
          }
        } else if (adminCheck.firebaseIdToken) {
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
        const validation = sanitizePublicSubmission(resource, body);
        if (validation.error || !validation.item) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: validation.error || 'Invalid submission data.' }));
          return;
        }
        const sanitizedItem = validation.item;

        if (supabaseActive) {
          const rowPayload =
            resource === 'leads'
              ? mapAppLeadToEnquiryRow(sanitizedItem)
              : mapAppInquiryToBookingRow(sanitizedItem);
          await supabaseRest(sbTable, {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            useServiceRole: hasSupabaseServiceRole(),
            body: rowPayload,
          });
        } else {
          try {
            await firestorePatchDocument(`${collectionName}/${sanitizedItem.id}`, sanitizedItem, '');
          } catch {
            // Client SDK also writes directly to Firestore
          }
        }

        const existing = readStore(storeKey);
        const list = Array.isArray(existing) ? existing : [];
        if (!list.some((x) => x && x.id === sanitizedItem.id)) {
          list.unshift(sanitizedItem);
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
          if (supabaseActive) {
            await supabaseRest(`${sbTable}?id=eq.${encodeURIComponent(id)}`, {
              method: 'PATCH',
              accessToken: adminCheck.supabaseAccessToken || '',
              useServiceRole: hasSupabaseServiceRole(),
              body: { status, updated_at: nowIso },
            });
          } else if (adminCheck.firebaseIdToken) {
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
          const nowIso = new Date().toISOString();
          const patchPayload = { ...updates, updatedAt: nowIso };
          delete patchPayload.id;

          if (supabaseActive) {
            const sbPatch = { updated_at: nowIso };
            if (typeof patchPayload.status === 'string') sbPatch.status = patchPayload.status;
            if (typeof patchPayload.notes === 'string') sbPatch.notes = patchPayload.notes;
            if (typeof patchPayload.aiSummary === 'string') sbPatch.ai_summary = patchPayload.aiSummary;
            if (typeof patchPayload.preferredDate === 'string') sbPatch.preferred_date = patchPayload.preferredDate;
            if (typeof patchPayload.preferredTime === 'string') sbPatch.preferred_time = patchPayload.preferredTime;
            if (typeof patchPayload.message === 'string') sbPatch.message = patchPayload.message;
            await supabaseRest(`${sbTable}?id=eq.${encodeURIComponent(id)}`, {
              method: 'PATCH',
              accessToken: adminCheck.supabaseAccessToken || '',
              useServiceRole: hasSupabaseServiceRole(),
              body: sbPatch,
            });
          } else if (adminCheck.firebaseIdToken) {
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
    // BUSINESS SETTINGS (Supabase website_settings[business] / Firestore)
    // ------------------------------------------------------------------------
    if (resource === 'business-settings') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        if (supabaseActive) {
          try {
            const rows = await supabaseRest('website_settings?key=eq.business&select=data,updated_at', {
              useServiceRole: hasSupabaseServiceRole(),
            });
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            if (row && row.data && Object.keys(row.data).length > 0) {
              writeStore('business-settings', row.data);
              res.statusCode = 200;
              res.end(JSON.stringify({ settings: row.data }));
              return;
            }
          } catch {
            // Fall through to local cache
          }
        } else {
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
        const nowIso = new Date().toISOString();
        const settings = { ...rawSettings, updatedAt: nowIso };
        delete settings._docId;

        if (supabaseActive) {
          await supabaseRest('website_settings', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            accessToken: adminCheck.supabaseAccessToken || '',
            useServiceRole: hasSupabaseServiceRole(),
            body: {
              key: 'business',
              data: settings,
              updated_at: nowIso,
            },
          });
        } else if (adminCheck.firebaseIdToken) {
          await firestorePatchDocument('settings/business', settings, adminCheck.firebaseIdToken);
        }
        writeStore('business-settings', settings);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, settings }));
        return;
      }
    }

    // ------------------------------------------------------------------------
    // EDITORIAL POSTS (Supabase website_settings[editorial] / Firestore)
    // ------------------------------------------------------------------------
    if (resource === 'editorial-posts') {
      if (req.method === 'GET') {
        setHeaders(req, res, false);
        if (supabaseActive) {
          try {
            const rows = await supabaseRest('website_settings?key=eq.editorial&select=data,updated_at', {
              useServiceRole: hasSupabaseServiceRole(),
            });
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            const posts = Array.isArray(row?.data?.posts) ? row.data.posts : null;
            if (posts) {
              writeStore('editorial-posts', posts);
              res.statusCode = 200;
              res.end(JSON.stringify({ posts }));
              return;
            }
          } catch {
            // Fall through to local cache
          }
        } else {
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
        if (supabaseActive) {
          await supabaseRest('website_settings', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            accessToken: adminCheck.supabaseAccessToken || '',
            useServiceRole: hasSupabaseServiceRole(),
            body: {
              key: 'editorial',
              data: { posts, updatedAt: nowIso },
              updated_at: nowIso,
            },
          });
        } else if (adminCheck.firebaseIdToken) {
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

    // ------------------------------------------------------------------------
    // FUNNEL ANALYTICS (Admin read/reset + Lightweight public counter sync)
    // ------------------------------------------------------------------------
    if (resource === 'analytics') {
      if (req.method === 'GET') {
        setHeaders(req, res, true);
        const adminCheck = await verifyRequestAdmin(req);
        if (!adminCheck.authorized) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
          return;
        }
        if (supabaseActive) {
          try {
            const rows = await supabaseRest('website_settings?key=eq.analytics&select=data,updated_at', {
              accessToken: adminCheck.supabaseAccessToken || '',
              useServiceRole: hasSupabaseServiceRole(),
            });
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            if (row?.data) {
              writeStore('analytics', row.data);
              res.statusCode = 200;
              res.end(JSON.stringify({ analytics: row.data }));
              return;
            }
          } catch {
            // Fall through
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ analytics: readStore('analytics') || {} }));
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        if (actionLower === 'reset') {
          setHeaders(req, res, true);
          const adminCheck = await verifyRequestAdmin(req);
          if (!adminCheck.authorized) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized administrator access required.' }));
            return;
          }
          const nowIso = new Date().toISOString();
          const blank = { updatedAt: nowIso, lastUpdated: nowIso };
          if (supabaseActive && hasSupabaseServiceRole()) {
            await supabaseRest('website_settings', {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates' },
              body: { key: 'analytics', data: blank, updated_at: nowIso },
            });
          }
          writeStore('analytics', blank);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Public funnel counter increment
        setHeaders(req, res, false);
        const field = typeof body?.field === 'string' ? body.field.trim() : '';
        const allowedCounters = new Set([
          'visitors',
          'aiOpened',
          'aiConversations',
          'vehicleSearches',
          'vehiclesViewed',
          'vehicleSaves',
          'compareActions',
          'enquiriesStarted',
          'leadsSubmitted',
          'whatsAppClicks',
          'interestedClicks',
          'callClicks',
          'sourcingRequests',
          'filterUsage',
          'findMyCarSubmissions',
          'sourceSubmissions',
        ]);
        if (!allowedCounters.has(field)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid analytics counter field' }));
          return;
        }
        let current = readStore('analytics') || {};
        if (supabaseActive && hasSupabaseServiceRole()) {
          try {
            const rows = await supabaseRest('website_settings?key=eq.analytics&select=data');
            if (Array.isArray(rows) && rows[0]?.data) {
              current = { ...rows[0].data };
            }
          } catch {
            // Use local fallback
          }
        }
        const nowIso = new Date().toISOString();
        const next = {
          ...current,
          [field]: (Number(current[field]) || 0) + 1,
          lastUpdated: nowIso,
          updatedAt: nowIso,
        };
        if (typeof body?.brandKey === 'string' && body.brandKey.trim()) {
          const bk = body.brandKey.trim().slice(0, 40);
          next.mostSearchedBrands = {
            ...(current.mostSearchedBrands || {}),
            [bk]: (Number(current.mostSearchedBrands?.[bk]) || 0) + 1,
          };
        }
        if (typeof body?.vehicleViewKey === 'string' && body.vehicleViewKey.trim()) {
          const vk = body.vehicleViewKey.trim().slice(0, 80);
          next.topViewedVehicles = {
            ...(current.topViewedVehicles || {}),
            [vk]: (Number(current.topViewedVehicles?.[vk]) || 0) + 1,
          };
        }
        if (typeof body?.vehicleEnquiryKey === 'string' && body.vehicleEnquiryKey.trim()) {
          const ek = body.vehicleEnquiryKey.trim().slice(0, 80);
          next.topEnquiryVehicles = {
            ...(current.topEnquiryVehicles || {}),
            [ek]: (Number(current.topEnquiryVehicles?.[ek]) || 0) + 1,
          };
        }

        writeStore('analytics', next);
        if (supabaseActive && hasSupabaseServiceRole()) {
          await supabaseRest('website_settings', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: { key: 'analytics', data: next, updated_at: nowIso },
          }).catch(() => {});
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
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

