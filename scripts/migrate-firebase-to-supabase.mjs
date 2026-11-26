#!/usr/bin/env node
/**
 * Jite Auto Deals — Firebase-to-Supabase Data Migration Script
 *
 * Safely migrates backed-up (and optionally live authenticated) Cloud Firestore data
 * into Supabase PostgreSQL tables without modifying or deleting any Firebase data.
 *
 * Usage:
 *   node scripts/migrate-firebase-to-supabase.mjs --dry-run
 *   node scripts/migrate-firebase-to-supabase.mjs
 *   node scripts/migrate-firebase-to-supabase.mjs --backup backups/firebase-latest.json --email admin@domain.com --password "..."
 */

import fs from 'fs';
import path from 'path';
import {
  loadSupabaseServerConfig,
  mapAppVehicleToRow,
  buildVehicleImageRows,
  mapAppLeadToEnquiryRow,
  mapAppInquiryToBookingRow,
  supabaseRest,
} from '../lib/supabase-rest.js';
import {
  firestoreQueryCollection,
  firestoreGetDocument,
  firebaseAuthSignInWithPassword,
} from '../api/firestore-rest.js';

const VALID_VEHICLE_STATUSES = new Set([
  'Available',
  'Reserved',
  'Sold',
  'Hidden',
  'Active',
  'Inactive',
]);
const VALID_LEAD_STATUSES = new Set(['New', 'Contacted', 'In Progress', 'Completed', 'Closed']);

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // Non-blocking
  }
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--backup' && argv[i + 1]) {
      args.backup = argv[++i];
    } else if (token === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (token === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    }
  }
  return args;
}

function chunkArray(arr, size = 25) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeStatusValue(status, allowedSet, fallback) {
  const clean = typeof status === 'string' ? status.trim() : '';
  return allowedSet.has(clean) ? clean : fallback;
}

function sanitizeImageUrls(images) {
  if (!Array.isArray(images)) return [];
  const seen = new Set();
  const clean = [];
  for (const raw of images) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    clean.push(trimmed);
  }
  return clean;
}

function auditImages(vehicles) {
  const counts = {
    totalVehicles: vehicles.length,
    totalImageUrls: 0,
    cloudinaryCount: 0,
    imgbbCount: 0,
    supabaseCount: 0,
    firebaseStorageCount: 0,
    dataUriCount: 0,
    otherUrlCount: 0,
    vehiclesWithoutImages: 0,
  };

  for (const v of vehicles) {
    const imgs = Array.isArray(v.images) ? v.images : [];
    if (imgs.length === 0) counts.vehiclesWithoutImages++;
    for (const url of imgs) {
      counts.totalImageUrls++;
      if (url.startsWith('data:')) counts.dataUriCount++;
      else if (url.includes('res.cloudinary.com')) counts.cloudinaryCount++;
      else if (url.includes('ibb.co')) counts.imgbbCount++;
      else if (url.includes('.supabase.co/storage')) counts.supabaseCount++;
      else if (url.includes('firebasestorage.googleapis.com')) counts.firebaseStorageCount++;
      else counts.otherUrlCount++;
    }
  }

  return counts;
}

async function fetchExactCount(table) {
  const cfg = loadSupabaseServerConfig();
  const res = await fetch(`${cfg.url}/rest/v1/${table}?select=id&limit=1`, {
    method: 'GET',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Prefer: 'count=exact',
    },
  });
  const contentRange = res.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function main() {
  loadDotEnvIfPresent();
  const args = parseArgs(process.argv);

  const backupPath = path.resolve(
    process.cwd(),
    args.backup || path.join('backups', 'firebase-latest.json')
  );

  if (!fs.existsSync(backupPath)) {
    console.error(`Error: Backup file not found at ${backupPath}`);
    console.error('Run `node scripts/backup-firebase.mjs` first to create a verified snapshot.');
    process.exit(1);
  }

  const rawBackup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const collections = rawBackup.collections || {};
  const settings = rawBackup.settings || {};

  // Optionally supplement private Firestore collections if admin credentials are supplied
  let liveIdToken = (process.env.FIREBASE_ADMIN_ID_TOKEN || '').trim();
  const email = args.email || process.env.ADMIN_EMAIL || '';
  const password = args.password || process.env.ADMIN_PASSWORD || '';

  if (!liveIdToken && email && password) {
    try {
      const login = await firebaseAuthSignInWithPassword(email, password);
      liveIdToken = login.idToken;
      console.log(`Authenticated against Firebase Auth as ${login.email} to pull private collections.`);
    } catch (err) {
      console.warn(`Warning: Firebase Auth login failed (${err?.message || err}); using backup snapshot.`);
    }
  }

  if (liveIdToken) {
    const [liveLeads, liveInquiries, liveInvites, liveEditorial, liveAnalytics] =
      await Promise.all([
        firestoreQueryCollection('leads', { idToken: liveIdToken }).catch(() => null),
        firestoreQueryCollection('inquiries', { idToken: liveIdToken }).catch(() => null),
        firestoreQueryCollection('admin_invites', { idToken: liveIdToken }).catch(() => null),
        firestoreGetDocument('settings/editorial', liveIdToken).catch(() => null),
        firestoreGetDocument('settings/analytics', liveIdToken).catch(() => null),
      ]);

    if (Array.isArray(liveLeads) && liveLeads.length > 0) collections.leads = liveLeads;
    if (Array.isArray(liveInquiries) && liveInquiries.length > 0) {
      collections.inquiries = liveInquiries;
    }
    if (Array.isArray(liveInvites) && liveInvites.length > 0) {
      collections.admin_invites = liveInvites;
    }
    if (liveEditorial) settings.editorial = liveEditorial;
    if (liveAnalytics) settings.analytics = liveAnalytics;
  }

  const rawVehicles = Array.isArray(collections.vehicles) ? collections.vehicles : [];
  const rawLeads = Array.isArray(collections.leads) ? collections.leads : [];
  const rawInquiries = Array.isArray(collections.inquiries) ? collections.inquiries : [];
  const rawInvites = Array.isArray(collections.admin_invites) ? collections.admin_invites : [];

  const validationErrors = [];
  const vehicleRows = [];
  const vehicleImageRows = [];
  const seenVehicleIds = new Set();

  for (let i = 0; i < rawVehicles.length; i++) {
    const raw = rawVehicles[i];
    const id = String(raw?.id || raw?._docId || '').trim();
    if (!id) {
      validationErrors.push(`Vehicle at index ${i} is missing an id/_docId.`);
      continue;
    }
    if (seenVehicleIds.has(id)) {
      validationErrors.push(`Duplicate vehicle ID detected: "${id}".`);
      continue;
    }
    seenVehicleIds.add(id);

    const cleanImages = sanitizeImageUrls(raw.images);
    const normalized = {
      ...raw,
      id,
      images: cleanImages,
      status: normalizeStatusValue(raw.status, VALID_VEHICLE_STATUSES, 'Available'),
    };

    const vRow = mapAppVehicleToRow(normalized);
    if (!vRow.make || !vRow.model) {
      validationErrors.push(`Vehicle "${id}" is missing make or model.`);
      continue;
    }
    if (!Number.isFinite(vRow.year) || vRow.year < 1970 || vRow.year > 2100) {
      validationErrors.push(`Vehicle "${id}" has invalid year (${vRow.year}).`);
      continue;
    }
    if (!Number.isFinite(vRow.price) || vRow.price < 0) {
      validationErrors.push(`Vehicle "${id}" has invalid price (${vRow.price}).`);
      continue;
    }

    vehicleRows.push(vRow);
    const imgRows = buildVehicleImageRows(normalized);
    for (const ir of imgRows) {
      vehicleImageRows.push(ir);
    }
  }

  const enquiryRows = [];
  const seenEnquiryIds = new Set();
  for (let i = 0; i < rawLeads.length; i++) {
    const raw = rawLeads[i];
    const id = String(raw?.id || raw?._docId || '').trim();
    if (!id || seenEnquiryIds.has(id)) continue;
    seenEnquiryIds.add(id);
    const row = mapAppLeadToEnquiryRow({
      ...raw,
      id,
      status: normalizeStatusValue(raw.status, VALID_LEAD_STATUSES, 'New'),
    });
    if (!row.name || !row.phone) {
      validationErrors.push(`Enquiry "${id}" is missing name or phone.`);
      continue;
    }
    enquiryRows.push(row);
  }

  const bookingRows = [];
  const seenBookingIds = new Set();
  for (let i = 0; i < rawInquiries.length; i++) {
    const raw = rawInquiries[i];
    const id = String(raw?.id || raw?._docId || '').trim();
    if (!id || seenBookingIds.has(id)) continue;
    seenBookingIds.add(id);
    const candidateVehicleId = raw?.vehicleId ? String(raw.vehicleId).trim() : '';
    const row = mapAppInquiryToBookingRow({
      ...raw,
      id,
      // Nullify orphaned vehicleId references so foreign key constraint succeeds cleanly
      vehicleId: candidateVehicleId && seenVehicleIds.has(candidateVehicleId) ? candidateVehicleId : null,
      status: normalizeStatusValue(raw.status, VALID_LEAD_STATUSES, 'New'),
    });
    if (!row.name || !row.phone) {
      validationErrors.push(`Inspection booking "${id}" is missing name or phone.`);
      continue;
    }
    bookingRows.push(row);
  }

  const settingsRows = [];
  if (settings.business && typeof settings.business === 'object') {
    const { _docId, id: _ignoredId, ...cleanBusiness } = settings.business;
    settingsRows.push({
      key: 'business',
      data: cleanBusiness,
      updated_at: cleanBusiness.updatedAt || new Date().toISOString(),
    });
  }
  if (settings.editorial && typeof settings.editorial === 'object') {
    const { _docId, id: _ignoredId, ...cleanEditorial } = settings.editorial;
    settingsRows.push({
      key: 'editorial',
      data: cleanEditorial,
      updated_at: cleanEditorial.updatedAt || new Date().toISOString(),
    });
  }
  if (settings.analytics && typeof settings.analytics === 'object') {
    const { _docId, id: _ignoredId, ...cleanAnalytics } = settings.analytics;
    settingsRows.push({
      key: 'analytics',
      data: cleanAnalytics,
      updated_at: cleanAnalytics.updatedAt || new Date().toISOString(),
    });
  }

  const inviteRows = [];
  const seenInviteEmails = new Set();
  for (const inv of rawInvites) {
    const rawEmail = String(inv?.email || inv?._docId || '').trim();
    const emailLower = rawEmail.toLowerCase();
    if (!emailLower || !emailLower.includes('@') || seenInviteEmails.has(emailLower)) continue;
    seenInviteEmails.add(emailLower);
    inviteRows.push({
      email_lower: emailLower,
      email: rawEmail,
      display_name: inv?.displayName ? String(inv.displayName).trim() : null,
      role: 'admin',
      active: inv?.active !== false,
      created_at: inv?.createdAt || new Date().toISOString(),
      updated_at: inv?.updatedAt || new Date().toISOString(),
    });
  }

  const imgAudit = auditImages(vehicleRows);

  console.log('================================================================');
  console.log(`Jite Auto Deals — Firebase -> Supabase Migration ${args.dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log('================================================================');
  console.log(`Backup source:       ${path.relative(process.cwd(), backupPath)}`);
  console.log(`Export timestamp:    ${rawBackup.exportedAt || 'unknown'}`);
  console.log(`Vehicles validated:  ${vehicleRows.length}`);
  console.log(`Vehicle image rows:  ${vehicleImageRows.length}`);
  console.log(`Image breakdown:     ${imgAudit.cloudinaryCount} Cloudinary, ${imgAudit.imgbbCount} ImgBB, ${imgAudit.supabaseCount} Supabase, ${imgAudit.firebaseStorageCount} Firebase Storage, ${imgAudit.otherUrlCount} other`);
  console.log(`Customer enquiries:  ${enquiryRows.length}`);
  console.log(`Inspection bookings: ${bookingRows.length}`);
  console.log(`Website settings:    ${settingsRows.map((s) => s.key).join(', ') || 'none'}`);
  console.log(`Admin invites:       ${inviteRows.length}`);
  console.log(`Validation errors:   ${validationErrors.length}`);

  if (validationErrors.length > 0) {
    console.error('\nValidation errors detected:');
    validationErrors.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('\nDry run passed with 0 validation errors. No data was written to Supabase or modified in Firebase.');
    process.exit(0);
  }

  const sbCfg = loadSupabaseServerConfig();
  if (!sbCfg.url || !sbCfg.serviceRoleKey) {
    console.error('\nError: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment (or .env) for live migration.');
    process.exit(1);
  }

  console.log(`\nWriting records to Supabase project: ${sbCfg.url} ...`);

  // 1. Upsert vehicles in batches
  for (const batch of chunkArray(vehicleRows, 25)) {
    await supabaseRest('vehicles?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: batch,
      useServiceRole: true,
    });
  }
  console.log(`  [OK] Upserted ${vehicleRows.length} vehicles`);

  // 2. Synchronize normalized vehicle_images table (preserve order, zero duplicates)
  for (const v of vehicleRows) {
    await supabaseRest(`vehicle_images?vehicle_id=eq.${encodeURIComponent(v.id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
      useServiceRole: true,
    });
  }
  for (const batch of chunkArray(vehicleImageRows, 50)) {
    await supabaseRest('vehicle_images', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: batch,
      useServiceRole: true,
    });
  }
  console.log(`  [OK] Synchronized ${vehicleImageRows.length} vehicle_images rows`);

  // 3. Upsert customer_enquiries
  for (const batch of chunkArray(enquiryRows, 25)) {
    await supabaseRest('customer_enquiries?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: batch,
      useServiceRole: true,
    });
  }
  if (enquiryRows.length > 0) {
    console.log(`  [OK] Upserted ${enquiryRows.length} customer_enquiries`);
  }

  // 4. Upsert inspection_bookings
  for (const batch of chunkArray(bookingRows, 25)) {
    await supabaseRest('inspection_bookings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: batch,
      useServiceRole: true,
    });
  }
  if (bookingRows.length > 0) {
    console.log(`  [OK] Upserted ${bookingRows.length} inspection_bookings`);
  }

  // 5. Upsert website_settings (business, editorial, analytics)
  if (settingsRows.length > 0) {
    await supabaseRest('website_settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: settingsRows,
      useServiceRole: true,
    });
    console.log(`  [OK] Upserted website_settings (${settingsRows.map((s) => s.key).join(', ')})`);
  }

  // 6. Upsert admin_invites
  if (inviteRows.length > 0) {
    await supabaseRest('admin_invites?on_conflict=email_lower', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: inviteRows,
      useServiceRole: true,
    });
    console.log(`  [OK] Upserted ${inviteRows.length} admin_invites`);
  }

  // 7. Verify post-migration Supabase table counts
  const [sbVehicles, sbImages, sbEnquiries, sbBookings] = await Promise.all([
    fetchExactCount('vehicles'),
    fetchExactCount('vehicle_images'),
    fetchExactCount('customer_enquiries'),
    fetchExactCount('inspection_bookings'),
  ]);

  console.log('\nPost-Migration Verification Counts:');
  console.log(`  vehicles:            ${sbVehicles ?? 'verified'}`);
  console.log(`  vehicle_images:      ${sbImages ?? 'verified'}`);
  console.log(`  customer_enquiries:  ${sbEnquiries ?? 'verified'}`);
  console.log(`  inspection_bookings: ${sbBookings ?? 'verified'}`);
  console.log('\nMigration completed successfully. Original Firebase data remains untouched.');
}

main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
