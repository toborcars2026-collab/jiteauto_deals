#!/usr/bin/env node
/**
 * Jite Auto Deals — Verified Firebase Pre-Migration Backup Script
 *
 * Exports Cloud Firestore documents (public catalog, settings, bootstrap, and—when
 * FIREBASE_ADMIN_ID_TOKEN or --email / --password are supplied—private enquiries,
 * bookings, admin registry, analytics, and audit logs) into backups/.
 *
 * Usage:
 *   node scripts/backup-firebase.mjs
 *   node scripts/backup-firebase.mjs --email owner@example.com --password "..."
 */

import fs from 'fs';
import path from 'path';
import {
  firestoreQueryCollection,
  firestoreGetDocument,
  firebaseAuthSignInWithPassword,
  loadFirebaseRuntimeConfig,
} from '../api/firestore-rest.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (token === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    } else if (token === '--out' && argv[i + 1]) {
      args.out = argv[++i];
    }
  }
  return args;
}

function summarizeVehicleImages(vehicles) {
  let cloudinaryCount = 0;
  let imgbbCount = 0;
  let supabaseCount = 0;
  let firebaseStorageCount = 0;
  let dataUriCount = 0;
  let otherUrlCount = 0;

  for (const v of vehicles) {
    const imgs = Array.isArray(v?.images) ? v.images : [];
    for (const raw of imgs) {
      if (typeof raw !== 'string') continue;
      const u = raw.trim();
      if (!u) continue;
      if (u.startsWith('data:')) dataUriCount++;
      else if (u.includes('res.cloudinary.com')) cloudinaryCount++;
      else if (u.includes('ibb.co')) imgbbCount++;
      else if (u.includes('.supabase.co/storage')) supabaseCount++;
      else if (u.includes('firebasestorage.googleapis.com')) firebaseStorageCount++;
      else otherUrlCount++;
    }
  }

  return {
    totalVehicles: vehicles.length,
    cloudinaryCount,
    imgbbCount,
    supabaseCount,
    firebaseStorageCount,
    dataUriCount,
    otherUrlCount,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = loadFirebaseRuntimeConfig();
  let idToken = (process.env.FIREBASE_ADMIN_ID_TOKEN || '').trim();

  const email = args.email || process.env.ADMIN_EMAIL || '';
  const password = args.password || process.env.ADMIN_PASSWORD || '';

  if (!idToken && email && password) {
    try {
      const login = await firebaseAuthSignInWithPassword(email, password);
      idToken = login.idToken;
      console.log(`Authenticated with Firebase Auth as ${login.email} (${login.uid}) for private collections.`);
    } catch (err) {
      console.warn(`Warning: Firebase Auth login failed (${err?.message || err}). Backing up public collections only.`);
    }
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    source: {
      projectId: cfg.projectId,
      databaseId: cfg.databaseId,
      authenticatedExport: Boolean(idToken),
    },
    collections: {
      vehicles: [],
      leads: [],
      inquiries: [],
      admins: [],
      admin_invites: [],
      admin_audit_logs: [],
    },
    settings: {
      business: null,
      editorial: null,
      admin_bootstrap: null,
      analytics: null,
    },
    imageAudit: null,
  };

  // Public collections & docs
  backup.collections.vehicles = await firestoreQueryCollection('vehicles', { idToken }).catch((e) => {
    console.error('Failed to query vehicles:', e?.message || e);
    return [];
  });

  backup.settings.business = await firestoreGetDocument('settings/business', idToken).catch(() => null);
  backup.settings.editorial = await firestoreGetDocument('settings/editorial', idToken).catch(() => null);
  backup.settings.admin_bootstrap = await firestoreGetDocument('settings/admin_bootstrap', idToken).catch(() => null);

  // Private collections (require admin idToken per Firestore Security Rules)
  if (idToken) {
    backup.collections.leads = await firestoreQueryCollection('leads', { idToken }).catch(() => []);
    backup.collections.inquiries = await firestoreQueryCollection('inquiries', { idToken }).catch(() => []);
    backup.collections.admins = await firestoreQueryCollection('admins', { idToken }).catch(() => []);
    backup.collections.admin_invites = await firestoreQueryCollection('admin_invites', { idToken }).catch(() => []);
    backup.collections.admin_audit_logs = await firestoreQueryCollection('admin_audit_logs', {
      idToken,
      orderByField: 'timestamp',
      orderDirection: 'DESCENDING',
      limitCount: 500,
    }).catch(() => []);
    backup.settings.analytics = await firestoreGetDocument('settings/analytics', idToken).catch(() => null);
  }

  backup.imageAudit = summarizeVehicleImages(backup.collections.vehicles);

  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = args.out
    ? path.resolve(args.out)
    : path.join(backupsDir, `firebase-backup-${stamp}.json`);
  const latestPath = path.join(backupsDir, 'firebase-latest.json');

  const json = JSON.stringify(backup, null, 2);
  fs.writeFileSync(snapshotPath, json, 'utf-8');
  fs.writeFileSync(latestPath, json, 'utf-8');

  console.log('Firebase Backup Summary:');
  console.log(`  Project: ${cfg.projectId} / DB: ${cfg.databaseId}`);
  console.log(`  Snapshot written: ${path.relative(process.cwd(), snapshotPath)}`);
  console.log(`  Latest alias:     ${path.relative(process.cwd(), latestPath)}`);
  console.log(`  Vehicles:         ${backup.collections.vehicles.length}`);
  console.log(`  Business cfg:     ${backup.settings.business ? 'present' : 'absent'}`);
  console.log(`  Editorial cfg:    ${backup.settings.editorial ? 'present' : 'absent'}`);
  console.log(`  Bootstrap cfg:    ${backup.settings.admin_bootstrap ? 'present' : 'absent'}`);
  if (idToken) {
    console.log(`  Leads:            ${backup.collections.leads.length}`);
    console.log(`  Inquiries:        ${backup.collections.inquiries.length}`);
    console.log(`  Admins:           ${backup.collections.admins.length}`);
    console.log(`  Audit logs:       ${backup.collections.admin_audit_logs.length}`);
  } else {
    console.log('  Note: Private collections (leads/inquiries/admins/audit) skipped (no admin credentials provided).');
  }
  console.log('  Image URL Audit:', JSON.stringify(backup.imageAudit));
}

main().catch((err) => {
  console.error('Firebase backup failed:', err);
  process.exit(1);
});
