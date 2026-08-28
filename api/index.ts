import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { INITIAL_VEHICLES } from '../src/data';
import { Vehicle } from '../src/types';
import { resolveRouteMetadata, injectMetadataIntoHtml, DEFAULT_BASE_URL } from '../src/metaHelper';
import { normalizeVehicleData } from '../src/utils';

// Firebase project & database configuration for direct REST lookups
const FIREBASE_PROJECT_ID = 'gen-lang-client-0327661147';
const FIRESTORE_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';

// In-memory cache for ultra-fast serverless execution (60-second TTL)
let cachedVehicles: Vehicle[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

function parseFirestoreField(field: any): any {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return parseFloat(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) {
    const values = field.arrayValue.values || [];
    return values.map(parseFirestoreField);
  }
  if ('mapValue' in field) {
    const fields = field.mapValue.fields || {};
    const obj: any = {};
    for (const key of Object.keys(fields)) {
      obj[key] = parseFirestoreField(fields[key]);
    }
    return obj;
  }
  return null;
}

/**
 * Fetches all vehicles directly from Firestore REST API with fallback to static catalog.
 */
async function fetchCatalogVehicles(): Promise<Vehicle[]> {
  const now = Date.now();
  if (cachedVehicles.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedVehicles;
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/vehicles?pageSize=300`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(firestoreUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.documents) && data.documents.length > 0) {
        const fetchedList: Vehicle[] = data.documents.map((docItem: any) => {
          const docId = docItem.name ? docItem.name.split('/').pop() : '';
          const fields = docItem.fields || {};
          const parsed: any = { id: docId };
          for (const key of Object.keys(fields)) {
            parsed[key] = parseFirestoreField(fields[key]);
          }
          return normalizeVehicleData(parsed as Vehicle);
        });

        cachedVehicles = fetchedList;
        cacheTimestamp = now;
        return fetchedList;
      }
    }
  } catch (err) {
    // If remote fetch times out or fails, gracefully use cached or initial vehicles
  }

  if (cachedVehicles.length > 0) {
    return cachedVehicles;
  }

  const initialNormalized = INITIAL_VEHICLES.map(normalizeVehicleData);
  cachedVehicles = initialNormalized;
  cacheTimestamp = now;
  return initialNormalized;
}

/**
 * Read the base HTML template from the built dist directory or local index.html.
 */
function getBaseHtml(): string {
  const possiblePaths = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', 'index.html'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf-8');
      } catch {}
    }
  }

  // Robust HTML fallback template if files cannot be read
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jite Auto Deals | Trusted Vehicle Consultant</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23E6A501' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.1 2 11.4V16c0 .6.4 1 1 1h2'/><circle cx='7' cy='17' r='2'/><path d='M9 17h6'/><circle cx='17' cy='17' r='2'/></svg>" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

/**
 * Vercel Serverless Function handler for all incoming page requests.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'jiteautodeals-sable.vercel.app';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const origin = `${proto}://${host}`;
    const requestUrl = req.url || '/';

    // 1. Fetch current catalog vehicles
    const vehicles = await fetchCatalogVehicles();

    // 2. Resolve route metadata (homepage, catalog, specific vehicle, or info pages)
    const metadata = resolveRouteMetadata(requestUrl, vehicles, origin);

    // 3. Read HTML template & inject dynamic Open Graph / Twitter tags
    const baseHtml = getBaseHtml();
    const dynamicHtml = injectMetadataIntoHtml(baseHtml, metadata);

    // 4. Send response with SEO caching headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(dynamicHtml);
  } catch (error) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(getBaseHtml());
  }
}
