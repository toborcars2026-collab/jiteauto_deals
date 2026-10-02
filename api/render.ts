import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

interface VehicleRecord {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage?: number;
  transmission: string;
  fuelType: string;
  bodyType: string;
  location: string;
  dealership: string;
  images: string[];
  description: string;
  engine: string;
  color: string;
  condition: string;
  isFeatured: boolean;
  inSlideshow?: boolean;
  slideshowOrder?: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PageMetadata {
  title: string;
  description: string;
  image: string;
  imageSecureUrl?: string;
  imageType?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt: string;
  url: string;
  type: string;
  siteName: string;
  locale: string;
  twitterCard: 'summary_large_image' | 'summary';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  canonicalUrl: string;
  keywords?: string;
  vehicle?: VehicleRecord | null;
  requestedVehicleSlug?: string | null;
  vehicleLookupStatus?: 'found' | 'not_found' | 'error';
}

const DEFAULT_BRAND_IMAGE =
  'https://res.cloudinary.com/xh0efm5e/image/upload/c_fill,w_1200,h_630,q_auto:good,f_jpg/v1790903435/wide_cinematic_high_contrast_promotional_banner.jpg';
const DEFAULT_BRAND_IMAGE_TYPE = 'image/jpeg';
const DEFAULT_BRAND_IMAGE_WIDTH = 1200;
const DEFAULT_BRAND_IMAGE_HEIGHT = 630;
const DEFAULT_BRAND_IMAGE_ALT = 'Jite Auto Deals — Trusted Vehicle Consultant in Nigeria';
const DEFAULT_SITE_NAME = 'Jite Auto Deals';
const DEFAULT_LOCALE = 'en_NG';
const DEFAULT_BASE_URL = 'https://jiteautodeals.vercel.app';
const DEFAULT_HOME_DESCRIPTION =
  'Buying a car in Nigeria shouldn’t feel like a gamble. Avoid untrusted sellers, hidden faults and costly mistakes. Jite Auto Deals helps you find, source and choose the right vehicle with greater confidence.';

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0327661147';
const FIRESTORE_DATABASE_ID =
  process.env.VITE_FIRESTORE_DATABASE_ID || 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';

let cachedBaseHtml: string | null = null;
let cachedBaseHtmlTime = 0;
const BASE_HTML_TTL_MS = 60 * 1000;

let cachedFallbackVehicles: VehicleRecord[] | null = null;
let firestoreVehiclesCache: VehicleRecord[] | null = null;
let firestoreVehiclesCacheTime = 0;
const FIRESTORE_CACHE_TTL_MS = 15 * 1000;

function safeDecodeURIComponent(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function decodeUnicodeEscapes(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  let res = str;
  res = res.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });
  res = res.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    } catch {
      return _;
    }
  });
  res = res.replace(/^2728\s+/g, '✨ ');
  res = res.replace(/\s+2728$/g, ' ✨');
  res = res.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  return res;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMileage(km: number): string {
  return new Intl.NumberFormat('en-US').format(km) + ' km';
}

function normalizeImageUrlForMeta(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return '';
  }
  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  if (trimmed.includes('imgur.com/') && !trimmed.includes('i.imgur.com/')) {
    const match = trimmed.match(/imgur\.com\/(?:a\/)?([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.imgur.com/${match[1]}.jpg`;
    }
  }
  if (trimmed.includes('dropbox.com/s/')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }
  return trimmed;
}

function getPrimaryVehicleImage(vehicle: VehicleRecord | null | undefined): string {
  if (!vehicle) return '';
  const explicitPrimary = (vehicle as any).primaryImage;
  if (typeof explicitPrimary === 'string' && explicitPrimary.trim()) {
    const normalized = normalizeImageUrlForMeta(explicitPrimary);
    if (normalized) return normalized;
  }
  if (Array.isArray(vehicle.images)) {
    for (const img of vehicle.images) {
      const normalized = normalizeImageUrlForMeta(img);
      if (normalized) return normalized;
    }
  }
  return '';
}

function inferImageMimeType(imageUrl: string | undefined | null): string | undefined {
  if (!imageUrl || typeof imageUrl !== 'string') return undefined;
  const cleanUrl = imageUrl.split('?')[0].split('#')[0].toLowerCase();
  if (cleanUrl.endsWith('.png')) return 'image/png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.gif')) return 'image/gif';
  return undefined;
}

function getBaseVehicleSlug(vehicle: VehicleRecord): string {
  if (!vehicle) return '';
  const explicitSlug = (vehicle as any).slug;
  if (typeof explicitSlug === 'string' && explicitSlug.trim()) {
    return explicitSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  const make = (vehicle.make || '').toLowerCase().trim();
  const model = (vehicle.model || '').toLowerCase().trim();
  const year = vehicle.year || '';
  const base = `${year}-${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || (vehicle.id || 'car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function computeDisambiguatedVehicleSlug(vehicle: VehicleRecord, duplicateIndex = 1): string {
  const base = getBaseVehicleSlug(vehicle);
  if (!base) return '';
  const cleanId = (vehicle.id || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (cleanId && cleanId.startsWith(`${base}-`) && cleanId.length > base.length + 1) {
    return cleanId;
  }

  const baseTokens = new Set(base.split('-').filter(Boolean));
  const idTokens = cleanId ? cleanId.split('-').filter(Boolean) : [];
  const extraTokens = idTokens.filter((t) => !baseTokens.has(t));
  if (extraTokens.length > 0) {
    return `${base}-${extraTokens.slice(0, 3).join('-')}`;
  }

  const cleanColor = (vehicle.color || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (cleanColor) {
    return `${base}-${cleanColor}`;
  }

  return `${base}-${duplicateIndex + 1}`;
}

function getVehicleSlug(vehicle: VehicleRecord, allVehicles?: VehicleRecord[]): string {
  if (!vehicle) return '';
  const base = getBaseVehicleSlug(vehicle);
  if (!allVehicles || allVehicles.length <= 1) {
    return base;
  }
  const siblings = allVehicles
    .filter((v) => v && getBaseVehicleSlug(v) === base)
    .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  if (siblings.length <= 1) {
    return base;
  }
  const idx = siblings.findIndex((v) => v.id === vehicle.id);
  if (idx <= 0) {
    return base;
  }
  return computeDisambiguatedVehicleSlug(vehicle, idx);
}

function findVehicleInList(vehicles: VehicleRecord[], identifier: string): VehicleRecord | undefined {
  if (!identifier || !Array.isArray(vehicles) || vehicles.length === 0) return undefined;
  const sortedVehicles = [...vehicles].sort((a, b) => (a?.id || '').localeCompare(b?.id || ''));
  const cleanId = safeDecodeURIComponent(identifier)
    .toLowerCase()
    .trim()
    .replace(/^\/?(vehicles|car|v)\/?/, '')
    .replace(/\/+$/, '');
  if (!cleanId) return undefined;

  // Pass 1: Exact vehicle ID match
  const byExactId = sortedVehicles.find((v) => v && (v.id || '').toLowerCase().trim() === cleanId);
  if (byExactId) return byExactId;

  // Pass 2: Exact disambiguated slug match
  const byUniqueSlug = sortedVehicles.find(
    (v) => v && (getVehicleSlug(v, sortedVehicles) === cleanId || computeDisambiguatedVehicleSlug(v) === cleanId)
  );
  if (byUniqueSlug) return byUniqueSlug;

  // Pass 3: Exact base slug match
  const byExactSlug = sortedVehicles.find((v) => v && getBaseVehicleSlug(v) === cleanId);
  if (byExactSlug) return byExactSlug;

  const cleanIdNoDash = cleanId.replace(/[^a-z0-9]/g, '');
  if (!cleanIdNoDash || cleanIdNoDash.length < 3) return undefined;

  // Pass 4: Exact alphanumeric vehicle ID match
  const byAlphaId = sortedVehicles.find(
    (v) => v && (v.id || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanIdNoDash
  );
  if (byAlphaId) return byAlphaId;

  // Pass 5: Exact alphanumeric vehicle slug match
  const byAlphaSlug = sortedVehicles.find(
    (v) =>
      v &&
      (getVehicleSlug(v, sortedVehicles).replace(/[^a-z0-9]/g, '') === cleanIdNoDash ||
        getBaseVehicleSlug(v).replace(/[^a-z0-9]/g, '') === cleanIdNoDash)
  );
  if (byAlphaSlug) return byAlphaSlug;

  // Pass 6: Prefix match where Firestore ID or model trim has a suffix
  const byPrefix = sortedVehicles.find((v) => {
    if (!v) return false;
    const vId = (v.id || '').toLowerCase().trim();
    const baseSlug = getBaseVehicleSlug(v);
    return (
      (vId.startsWith(`${cleanId}-`) && vId.length <= cleanId.length + 18) ||
      (baseSlug.startsWith(`${cleanId}-`) && baseSlug.length <= cleanId.length + 18) ||
      (baseSlug && cleanId.startsWith(`${baseSlug}-`) && cleanId.length <= baseSlug.length + 18)
    );
  });
  if (byPrefix) return byPrefix;

  // Pass 7: Normalized make/model match within the same model year
  const yearMatch = cleanId.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    const targetYear = parseInt(yearMatch[1], 10);
    const normalizeMakeModel = (str: string) =>
      str
        .toLowerCase()
        .replace(/\b(19[89]\d|20[0-3]\d)\b/g, '')
        .replace(/mercedes[-\s]?benz/g, 'mercedes')
        .replace(/[^a-z0-9]/g, '');

    const targetMakeModel = normalizeMakeModel(cleanId);
    if (targetMakeModel.length >= 4) {
      const byNormalizedYearMakeModel = sortedVehicles.find((v) => {
        if (!v || Number(v.year) !== targetYear) return false;
        const candidateMakeModel = normalizeMakeModel(`${v.make || ''} ${v.model || ''}`);
        return (
          candidateMakeModel === targetMakeModel ||
          (candidateMakeModel.startsWith(targetMakeModel) &&
            candidateMakeModel.length <= targetMakeModel.length + 12)
        );
      });
      if (byNormalizedYearMakeModel) return byNormalizedYearMakeModel;
    }
  }

  return undefined;
}

function extractVehicleIdentifierFromUrl(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlOrPath, DEFAULT_BASE_URL);
  } catch {
    try {
      parsedUrl = new URL(`/${urlOrPath.replace(/^\/+/, '')}`, DEFAULT_BASE_URL);
    } catch {
      return null;
    }
  }

  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  if (pathname.startsWith('/vehicles/')) {
    const id = pathname.replace(/^\/vehicles\/?/, '').replace(/\/+$/, '').trim();
    if (id) return safeDecodeURIComponent(id);
  } else if (pathname.startsWith('/car/')) {
    const id = pathname.replace(/^\/car\/?/, '').replace(/\/+$/, '').trim();
    if (id) return safeDecodeURIComponent(id);
  } else if (pathname.startsWith('/v/')) {
    const id = pathname.replace(/^\/v\/?/, '').replace(/\/+$/, '').trim();
    if (id) return safeDecodeURIComponent(id);
  }

  const queryVehicle = searchParams.get('vehicle') || searchParams.get('v');
  if (queryVehicle && queryVehicle.trim()) {
    return safeDecodeURIComponent(queryVehicle.trim());
  }

  return null;
}

function generateVehicleMetadata(vehicle: VehicleRecord, requestUrl?: string): PageMetadata {
  const cleanBase = DEFAULT_BASE_URL;
  const slug = getBaseVehicleSlug(vehicle);

  const make = decodeUnicodeEscapes(vehicle.make || '').trim();
  const modelStr = decodeUnicodeEscapes(vehicle.model || '').trim();
  const trimCandidate = decodeUnicodeEscapes(((vehicle as any).trim || (vehicle as any).variant || '').toString()).trim();
  const modelWithTrim =
    trimCandidate && !modelStr.toLowerCase().includes(trimCandidate.toLowerCase())
      ? `${modelStr} ${trimCandidate}`.trim()
      : modelStr;
  const year = vehicle.year ? String(vehicle.year).trim() : '';

  const makeModelYear = [make, modelWithTrim, year].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const yearMakeModel = [year, make, modelWithTrim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const title = makeModelYear
    ? `${makeModelYear} | ${DEFAULT_SITE_NAME}`
    : `Vehicle Details | ${DEFAULT_SITE_NAME}`;

  const specParts: string[] = [];
  const transmission = decodeUnicodeEscapes(vehicle.transmission || '').trim();
  if (transmission) {
    specParts.push(
      transmission.toLowerCase().includes('transmission') ? transmission : `${transmission} transmission`
    );
  }
  if (typeof vehicle.mileage === 'number' && !isNaN(vehicle.mileage) && vehicle.mileage > 0) {
    specParts.push(formatMileage(vehicle.mileage));
  }
  const condition = decodeUnicodeEscapes(vehicle.condition || '').trim();
  if (condition) {
    specParts.push(condition);
  }
  const fuelType = decodeUnicodeEscapes(vehicle.fuelType || '').trim();
  if (fuelType) {
    specParts.push(fuelType);
  }
  if (typeof vehicle.price === 'number' && !isNaN(vehicle.price) && vehicle.price > 0) {
    specParts.push(formatCurrency(vehicle.price));
  }
  const location = decodeUnicodeEscapes(vehicle.location || '').trim();
  if (location) {
    specParts.push(location);
  }

  const specsSentence = specParts.length > 0 ? `${specParts.join(', ')}. ` : '';
  const description = `${yearMakeModel ? `${yearMakeModel}. ` : ''}${specsSentence}View the full vehicle details on ${DEFAULT_SITE_NAME}.`;

  const primaryVehicleImage = getPrimaryVehicleImage(vehicle);
  const isUsingBrandFallback = !primaryVehicleImage;
  const image = primaryVehicleImage || DEFAULT_BRAND_IMAGE;
  const imageSecureUrl = image.startsWith('https://') ? image : undefined;
  const imageType = isUsingBrandFallback ? DEFAULT_BRAND_IMAGE_TYPE : inferImageMimeType(image);
  const imageWidth = isUsingBrandFallback ? DEFAULT_BRAND_IMAGE_WIDTH : undefined;
  const imageHeight = isUsingBrandFallback ? DEFAULT_BRAND_IMAGE_HEIGHT : undefined;
  const imageAlt = yearMakeModel ? `${yearMakeModel} — ${DEFAULT_SITE_NAME}` : DEFAULT_BRAND_IMAGE_ALT;

  let vehiclePath = `/vehicles/${encodeURIComponent(slug)}`;
  if (requestUrl) {
    try {
      const parsed = new URL(requestUrl, cleanBase);
      if (parsed.pathname.startsWith('/vehicles/') && parsed.pathname.length > '/vehicles/'.length) {
        vehiclePath = parsed.pathname.replace(/\/+$/, '');
      }
    } catch {}
  }

  const canonicalUrl = `${cleanBase}${vehiclePath}`;
  const keywordParts = [
    yearMakeModel,
    make && modelWithTrim ? `buy ${make} ${modelWithTrim} Nigeria` : '',
    make && location ? `${make} for sale ${location}` : '',
    condition ? `${condition} cars Nigeria` : '',
    DEFAULT_SITE_NAME,
  ].filter(Boolean);

  return {
    title,
    description,
    image,
    imageSecureUrl,
    imageType,
    imageWidth,
    imageHeight,
    imageAlt,
    url: canonicalUrl,
    type: 'website',
    siteName: DEFAULT_SITE_NAME,
    locale: DEFAULT_LOCALE,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    twitterImageAlt: imageAlt,
    canonicalUrl,
    keywords: keywordParts.join(', '),
    vehicle,
  };
}

function generateTabMetadata(tab: string): PageMetadata {
  const cleanBase = DEFAULT_BASE_URL;
  const cleanTab = (tab || 'home').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');

  const baseBrandImageFields = {
    image: DEFAULT_BRAND_IMAGE,
    imageSecureUrl: DEFAULT_BRAND_IMAGE,
    imageType: DEFAULT_BRAND_IMAGE_TYPE,
    imageWidth: DEFAULT_BRAND_IMAGE_WIDTH,
    imageHeight: DEFAULT_BRAND_IMAGE_HEIGHT,
    imageAlt: DEFAULT_BRAND_IMAGE_ALT,
    twitterImage: DEFAULT_BRAND_IMAGE,
    twitterImageAlt: DEFAULT_BRAND_IMAGE_ALT,
  };

  switch (cleanTab) {
    case 'browse':
    case 'inventory':
    case 'catalog':
    case 'cars': {
      const title = 'Verified Vehicle Catalog & Inventory | Jite Auto Deals';
      const description =
        'Browse inspected, duty-paid foreign used (Tokunbo) and verified Nigerian used vehicles in Lagos and Abuja. Sourced and vetted by Jite Auto Deals.';
      const canonicalUrl = `${cleanBase}/browse`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'find-car':
    case 'find-my-car': {
      const title = 'Find My Car | Custom Vehicle Specification Finder - Jite Auto Deals';
      const description =
        'Specify your exact vehicle brand, model, target budget, and condition. We source verified vehicles directly across Lagos and Abuja.';
      const canonicalUrl = `${cleanBase}/find-car`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'source-car':
    case 'source-a-car': {
      const title = 'Source a Car | External Listing Verification - Jite Auto Deals';
      const description =
        'Found a car online or at another dealership? Send us the link or details for complete verification, duty check, and physical pre-purchase inspection.';
      const canonicalUrl = `${cleanBase}/source-car`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'how-it-works': {
      const title = 'How It Works & Vehicle Finance | Jite Auto Deals';
      const description =
        'Learn how our personalized vehicle sourcing, pre-purchase inspection, and auto finance partnership programs work in Nigeria.';
      const canonicalUrl = `${cleanBase}/how-it-works`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'about': {
      const title = 'About Tobor Jite | Jite Auto Deals - Vehicle Consultant';
      const description =
        'Meet Tobor Jite, dedicated vehicle consultant and sourcing specialist in Nigeria helping individuals and corporate clients buy quality cars with total confidence.';
      const canonicalUrl = `${cleanBase}/about`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'admin': {
      const title = 'Admin Portal | Jite Auto Deals';
      const description = 'Secure administration management portal for Jite Auto Deals inventory, leads, and inquiries.';
      const canonicalUrl = `${cleanBase}/admin`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
    case 'home':
    default: {
      const title = 'Jite Auto Deals | Trusted Vehicle Consultant';
      const description = DEFAULT_HOME_DESCRIPTION;
      const canonicalUrl = `${cleanBase}/`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }
  }
}

function parseFirestoreRestDocument(docObj: any): VehicleRecord | null {
  if (!docObj || !docObj.fields) return null;
  const f = docObj.fields;
  const docName = typeof docObj.name === 'string' ? docObj.name : '';
  const docIdFromPath = docName.split('/').pop() || '';

  const getStr = (key: string, fallback = ''): string => {
    const val = f[key]?.stringValue;
    return typeof val === 'string' ? decodeUnicodeEscapes(val) : fallback;
  };

  const getNum = (key: string, fallback = 0): number => {
    if (f[key]?.integerValue !== undefined) return Number(f[key].integerValue) || fallback;
    if (f[key]?.doubleValue !== undefined) return Number(f[key].doubleValue) || fallback;
    if (f[key]?.stringValue !== undefined) return Number(f[key].stringValue) || fallback;
    return fallback;
  };

  const getBool = (key: string, fallback = false): boolean => {
    if (typeof f[key]?.booleanValue === 'boolean') return f[key].booleanValue;
    return fallback;
  };

  const images: string[] = [];
  const rawValues = f.images?.arrayValue?.values;
  if (Array.isArray(rawValues)) {
    for (const item of rawValues) {
      if (typeof item?.stringValue === 'string' && item.stringValue.trim()) {
        images.push(item.stringValue.trim());
      }
    }
  }

  const id = getStr('id') || docIdFromPath;
  const make = getStr('make');
  const model = getStr('model');
  if (!id && !make && !model) return null;

  const mileageVal = getNum('mileage', 0);

  return {
    id,
    make,
    model,
    year: getNum('year', 2020),
    price: getNum('price', 0),
    mileage: mileageVal > 0 ? mileageVal : undefined,
    transmission: getStr('transmission', ''),
    fuelType: getStr('fuelType', ''),
    bodyType: getStr('bodyType', ''),
    location: getStr('location', ''),
    dealership: getStr('dealership', ''),
    images,
    description: getStr('description', ''),
    engine: getStr('engine', ''),
    color: getStr('color', ''),
    condition: getStr('condition', ''),
    isFeatured: getBool('isFeatured', true),
    inSlideshow: getBool('inSlideshow', false),
    slideshowOrder: getNum('slideshowOrder', 0),
    status: getStr('status', 'Active') || 'Active',
    createdAt: getStr('createdAt', ''),
    updatedAt: getStr('updatedAt', ''),
  };
}

async function queryVehiclesByIdPrefix(prefix: string): Promise<VehicleRecord[]> {
  if (!prefix) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'vehicles' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'id' },
                    op: 'GREATER_THAN_OR_EQUAL',
                    value: { stringValue: prefix },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'id' },
                    op: 'LESS_THAN_OR_EQUAL',
                    value: { stringValue: `${prefix}\uf8ff` },
                  },
                },
              ],
            },
          },
          limit: 10,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const vehicles: VehicleRecord[] = [];
    for (const row of rows) {
      if (row && row.document) {
        const parsed = parseFirestoreRestDocument(row.document);
        if (parsed) vehicles.push(parsed);
      }
    }
    return vehicles;
  } catch {
    return [];
  }
}

async function queryVehiclesByYear(year: number): Promise<VehicleRecord[]> {
  if (!year || isNaN(year)) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'vehicles' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'year' },
              op: 'EQUAL',
              value: { integerValue: String(year) },
            },
          },
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const vehicles: VehicleRecord[] = [];
    for (const row of rows) {
      if (row && row.document) {
        const parsed = parseFirestoreRestDocument(row.document);
        if (parsed) vehicles.push(parsed);
      }
    }
    return vehicles;
  } catch {
    return [];
  }
}

async function fetchVehicleById(docId: string): Promise<VehicleRecord | null> {
  if (!docId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/vehicles/${encodeURIComponent(docId)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFirestoreRestDocument(data);
  } catch {
    return null;
  }
}

async function fetchAllVehicles(): Promise<VehicleRecord[]> {
  const now = Date.now();
  if (firestoreVehiclesCache && now - firestoreVehiclesCacheTime < FIRESTORE_CACHE_TTL_MS) {
    return firestoreVehiclesCache;
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'vehicles' }],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return firestoreVehiclesCache || [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return firestoreVehiclesCache || [];
    const vehicles: VehicleRecord[] = [];
    for (const row of rows) {
      if (row && row.document) {
        const parsed = parseFirestoreRestDocument(row.document);
        if (parsed) vehicles.push(parsed);
      }
    }
    if (vehicles.length > 0) {
      firestoreVehiclesCache = vehicles;
      firestoreVehiclesCacheTime = now;
    }
    return vehicles;
  } catch {
    return firestoreVehiclesCache || [];
  }
}

async function fetchSingleVehicle(
  cleanId: string,
  fallbackVehicles: VehicleRecord[] = []
): Promise<VehicleRecord | null> {
  if (!cleanId) return null;

  // 1. Targeted prefix range query on `id`
  const prefixMatches = await queryVehiclesByIdPrefix(cleanId);
  if (prefixMatches.length === 1) {
    const only = prefixMatches[0];
    if (
      (only.id || '').toLowerCase().trim() === cleanId ||
      getBaseVehicleSlug(only) === cleanId
    ) {
      return only;
    }
  }

  // 2. Targeted single-year query if slug contains a 4-digit year
  const yearMatch = cleanId.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    const yearNum = parseInt(yearMatch[1], 10);
    const yearVehicles = await queryVehiclesByYear(yearNum);
    if (yearVehicles.length > 0) {
      const matched = findVehicleInList(yearVehicles, cleanId);
      if (matched) return matched;
    }
  }

  if (prefixMatches.length > 0) {
    const matched = findVehicleInList(prefixMatches, cleanId);
    if (matched) return matched;
  }

  // 3. Direct document ID fetch
  const directDoc = await fetchVehicleById(cleanId);
  if (directDoc) return directDoc;

  // 4. Fallback to full collection + local store
  const liveVehicles = await fetchAllVehicles();
  const mergedMap = new Map<string, VehicleRecord>();
  for (const v of fallbackVehicles) {
    if (v && v.id) mergedMap.set(v.id, v);
  }
  for (const v of liveVehicles) {
    if (v && v.id) mergedMap.set(v.id, v);
  }
  const combined = Array.from(mergedMap.values());
  return findVehicleInList(combined, cleanId) || null;
}

function loadFallbackVehicles(): VehicleRecord[] {
  if (cachedFallbackVehicles) return cachedFallbackVehicles;
  try {
    const vehiclesPath = path.join(process.cwd(), 'data_store', 'vehicles.json');
    if (fs.existsSync(vehiclesPath)) {
      const raw = fs.readFileSync(vehiclesPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedFallbackVehicles = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
}

async function resolveRouteMetadata(
  urlOrPath: string,
  fallbackVehicles: VehicleRecord[] = []
): Promise<PageMetadata> {
  const vehicleIdentifier = extractVehicleIdentifierFromUrl(urlOrPath);

  if (vehicleIdentifier) {
    const cleanId = safeDecodeURIComponent(vehicleIdentifier)
      .toLowerCase()
      .trim()
      .replace(/^\/?(vehicles|car|v)\/?/, '')
      .replace(/\/+$/, '');

    try {
      const matched = await fetchSingleVehicle(cleanId, fallbackVehicles);
      if (matched) {
        const meta = generateVehicleMetadata(matched, urlOrPath);
        meta.requestedVehicleSlug = cleanId;
        meta.vehicleLookupStatus = 'found';
        return meta;
      }

      const homeMeta = generateTabMetadata('home');
      return {
        ...homeMeta,
        title: `Vehicle Not Found | ${DEFAULT_SITE_NAME}`,
        twitterTitle: `Vehicle Not Found | ${DEFAULT_SITE_NAME}`,
        url: `${DEFAULT_BASE_URL}/vehicles/${encodeURIComponent(cleanId)}`,
        canonicalUrl: `${DEFAULT_BASE_URL}/vehicles/${encodeURIComponent(cleanId)}`,
        vehicle: null,
        requestedVehicleSlug: cleanId,
        vehicleLookupStatus: 'not_found',
      };
    } catch {
      const homeMeta = generateTabMetadata('home');
      return {
        ...homeMeta,
        vehicle: null,
        requestedVehicleSlug: cleanId,
        vehicleLookupStatus: 'error',
      };
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlOrPath, DEFAULT_BASE_URL);
  } catch {
    parsedUrl = new URL('/', DEFAULT_BASE_URL);
  }

  const tabQuery = parsedUrl.searchParams.get('tab');
  if (tabQuery) {
    return generateTabMetadata(tabQuery);
  }

  const cleanPath = parsedUrl.pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  if (cleanPath) {
    return generateTabMetadata(cleanPath);
  }

  return generateTabMetadata('home');
}

function injectMetadataIntoHtml(html: string, meta: PageMetadata): string {
  if (!html) return html;

  const escapeAttr = (str: string | undefined | null) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const safeTitle = escapeAttr(meta.title);
  const safeDesc = escapeAttr(meta.description);
  const safeImage = escapeAttr(meta.image);
  const safeImageSecure = escapeAttr(meta.imageSecureUrl || (meta.image.startsWith('https://') ? meta.image : ''));
  const safeImageType = meta.imageType ? escapeAttr(meta.imageType) : '';
  const safeImageAlt = escapeAttr(meta.imageAlt || meta.title);
  const safeUrl = escapeAttr(meta.url);
  const safeCanonical = escapeAttr(meta.canonicalUrl || meta.url);
  const safeSiteName = escapeAttr(meta.siteName || DEFAULT_SITE_NAME);
  const safeLocale = escapeAttr(meta.locale || DEFAULT_LOCALE);
  const safeKeywords = meta.keywords ? escapeAttr(meta.keywords) : '';
  const safeTwitterTitle = escapeAttr(meta.twitterTitle || meta.title);
  const safeTwitterDesc = escapeAttr(meta.twitterDescription || meta.description);
  const safeTwitterImage = escapeAttr(meta.twitterImage || meta.image);
  const safeTwitterImageAlt = escapeAttr(meta.twitterImageAlt || meta.imageAlt || meta.title);

  const ogImageExtraTags = [
    safeImageSecure ? `<meta property="og:image:secure_url" content="${safeImageSecure}" />` : '',
    safeImageType ? `<meta property="og:image:type" content="${safeImageType}" />` : '',
    meta.imageWidth && meta.imageWidth > 0 ? `<meta property="og:image:width" content="${meta.imageWidth}" />` : '',
    meta.imageHeight && meta.imageHeight > 0 ? `<meta property="og:image:height" content="${meta.imageHeight}" />` : '',
    `<meta property="og:image:alt" content="${safeImageAlt}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  let hydrationScriptTag = '';
  if (meta.requestedVehicleSlug) {
    const payload = JSON.stringify({
      slugOrId: meta.requestedVehicleSlug,
      status: meta.vehicleLookupStatus || (meta.vehicle ? 'found' : 'not_found'),
      vehicle: meta.vehicle || null,
    }).replace(/</g, '\\u003c');
    hydrationScriptTag = `\n    <script id="__JITE_INITIAL_ROUTE__" type="application/json">${payload}</script>`;
  }

  const newMetaBlock = `
    <!-- Primary SEO Meta Tags -->
    <title>${safeTitle}</title>
    <meta name="title" content="${safeTitle}" />
    <meta name="description" content="${safeDesc}" />
    ${safeKeywords ? `<meta name="keywords" content="${safeKeywords}" />` : ''}
    <link rel="canonical" href="${safeCanonical}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / Telegram -->
    <meta property="og:type" content="${meta.type || 'website'}" />
    <meta property="og:site_name" content="${safeSiteName}" />
    <meta property="og:locale" content="${safeLocale}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    ${ogImageExtraTags}

    <!-- Twitter / X -->
    <meta name="twitter:card" content="${meta.twitterCard || 'summary_large_image'}" />
    <meta name="twitter:url" content="${safeUrl}" />
    <meta name="twitter:title" content="${safeTwitterTitle}" />
    <meta name="twitter:description" content="${safeTwitterDesc}" />
    <meta name="twitter:image" content="${safeTwitterImage}" />
    <meta name="twitter:image:alt" content="${safeTwitterImageAlt}" />${hydrationScriptTag}`;

  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']title["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']keywords["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, '')
    .replace(/<script\s+id=["']__JITE_INITIAL_ROUTE__["'][\s\S]*?<\/script>/gi, '');

  if (cleaned.includes('<head>')) {
    return cleaned.replace('<head>', `<head>${newMetaBlock}`);
  }
  if (cleaned.includes('<head ')) {
    return cleaned.replace(/<head[^>]*>/, `$&${newMetaBlock}`);
  }
  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', `${newMetaBlock}\n  </head>`);
  }

  return `${newMetaBlock}\n${cleaned}`;
}

async function loadBaseHtml(req: IncomingMessage): Promise<string> {
  const now = Date.now();
  if (cachedBaseHtml && now - cachedBaseHtmlTime < BASE_HTML_TTL_MS) {
    return cachedBaseHtml;
  }

  // 1. Check built dist/index.html on filesystem (contains production hashed /assets/ bundles)
  try {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(distIndexPath)) {
      const html = fs.readFileSync(distIndexPath, 'utf-8');
      if (html && html.includes('<head>')) {
        cachedBaseHtml = html;
        cachedBaseHtmlTime = now;
        return html;
      }
    }
  } catch {}

  // 2. Fetch deployed static /index.html from Vercel CDN edge (contains production hashed JS/CSS bundles)
  const rawHost = req.headers['x-forwarded-host'] || req.headers.host || 'jiteautodeals.vercel.app';
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const rawProto = req.headers['x-forwarded-proto'] || 'https';
  const proto = Array.isArray(rawProto) ? rawProto[0] : rawProto;
  const originsToTry = Array.from(new Set([`${proto}://${host}`, DEFAULT_BASE_URL]));

  for (const origin of originsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${origin}/index.html`, {
        method: 'GET',
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        if (html && html.includes('<head>')) {
          cachedBaseHtml = html;
          cachedBaseHtmlTime = now;
          return html;
        }
      }
    } catch {}
  }

  // 3. Fallback to root index.html on disk
  try {
    const rootIndexPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(rootIndexPath)) {
      return fs.readFileSync(rootIndexPath, 'utf-8');
    }
  } catch {}

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <title>Jite Auto Deals | Trusted Vehicle Consultant</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const rawUrl = req.url || '/';
    let parsedReqUrl: URL;
    try {
      parsedReqUrl = new URL(rawUrl, DEFAULT_BASE_URL);
    } catch {
      parsedReqUrl = new URL('/', DEFAULT_BASE_URL);
    }

    const rewrittenPath = parsedReqUrl.searchParams.get('path');
    let targetUrlOrPath = rawUrl;
    if (rewrittenPath) {
      parsedReqUrl.searchParams.delete('path');
      const remainingQuery = parsedReqUrl.searchParams.toString();
      const cleanRewrittenPath = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
      targetUrlOrPath = remainingQuery ? `${cleanRewrittenPath}?${remainingQuery}` : cleanRewrittenPath;
    }

    const fallbackVehicles = loadFallbackVehicles();
    const [baseHtml, meta] = await Promise.all([
      loadBaseHtml(req),
      resolveRouteMetadata(targetUrlOrPath, fallbackVehicles),
    ]);

    const finalHtml = injectMetadataIntoHtml(baseHtml, meta);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.end(finalHtml);
  } catch {
    try {
      const baseHtml = await loadBaseHtml(req);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(baseHtml);
    } catch {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>Jite Auto Deals</title></head><body><div id="root"></div></body></html>');
    }
  }
}
