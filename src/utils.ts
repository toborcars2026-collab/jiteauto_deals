import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, OperationType, handleFirestoreError } from './firebase';
import { Vehicle, Lead, Inquiry, BusinessSettings, VehicleStatus, LeadStatus } from './types';
import { INITIAL_VEHICLES } from './data';

// LocalStorage Keys (used as fast instant local cache / offline fallback)
const VEHICLES_KEY = 'jite_vehicles_v14';
const LEADS_KEY = 'jite_leads_v2';
const INQUIRIES_KEY = 'jite_inquiries_v2';
const SETTINGS_KEY = 'jite_business_settings_v1';


// Global tombstone blacklist of permanently removed vehicle IDs
export const PERMANENTLY_DELETED_VEHICLE_IDS = new Set<string>([
  'toyota-corolla-s-2015-silver-few-months-used',
  'lexus-rx350-2015-silver-duty-paid',
  'toyota-highlander-xle-2017-brown-foreign-used',
  'toyota-corolla-le-2015-silver-direct-belgium'
]);

// Format Currency to Nigerian Naira (₦)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format Mileage
export function formatMileage(km: number): string {
  return new Intl.NumberFormat('en-US').format(km) + ' km';
}

// Check if a vehicle is active (defaulting to true if status is undefined or 'Active')
export function isVehicleActive(v: Vehicle): boolean {
  return !v.status || v.status === 'Active';
}

/**
 * Generates a clean, SEO-friendly, permanent slug for a vehicle.
 * E.g. "2014-bmw-328i"
 */
export function getVehicleSlug(vehicle: Vehicle): string {
  if (!vehicle) return '';
  const make = (vehicle.make || '').toLowerCase().trim();
  const model = (vehicle.model || '').toLowerCase().trim();
  const year = vehicle.year || '';
  const base = `${year}-${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || vehicle.id || 'car';
}

/**
 * Gets the direct, permanent public URL for a vehicle.
 */
export function getVehicleShareUrl(vehicle: Vehicle): string {
  if (!vehicle) return '';
  const slug = getVehicleSlug(vehicle);
  
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    return `${origin}/?vehicle=${encodeURIComponent(slug)}`;
  }
  
  return `https://jiteautodeals-sable.vercel.app/?vehicle=${encodeURIComponent(slug)}`;
}

/**
 * Gets the clean SEO path format for vehicle links
 */
export function getVehiclePathUrl(vehicle: Vehicle): string {
  if (!vehicle) return '';
  const slug = getVehicleSlug(vehicle);
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://jiteautodeals-sable.vercel.app';
  return `${origin}/vehicles/${slug}`;
}

/**
 * Locates a vehicle from an array by exact ID, exact slug, or normalized make-model-year.
 */
export function findVehicleBySlugOrId(vehicles: Vehicle[], identifier: string): Vehicle | undefined {
  if (!identifier || !Array.isArray(vehicles) || vehicles.length === 0) return undefined;
  const clean = decodeURIComponent(identifier).toLowerCase().trim().replace(/^\/vehicles\/?/, '').replace(/\/$/, '');
  if (!clean) return undefined;

  // 1. Exact ID match (case-insensitive)
  const byId = vehicles.find(v => v.id && v.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Exact generated slug match
  const bySlug = vehicles.find(v => getVehicleSlug(v) === clean);
  if (bySlug) return bySlug;

  // 3. Fallback matching without special characters
  const cleanAlphaNum = clean.replace(/[^a-z0-9]/g, '');
  const byFuzzy = vehicles.find(v => {
    const sAlpha = getVehicleSlug(v).replace(/[^a-z0-9]/g, '');
    if (sAlpha === cleanAlphaNum) return true;
    const modelAlpha = (v.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const makeAlpha = (v.make || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanAlphaNum.includes(modelAlpha) && cleanAlphaNum.includes(makeAlpha);
  });

  return byFuzzy;
}

/**
 * Generates formatted social share links and text for a vehicle.
 */
export function getVehicleSocialShareLinks(vehicle: Vehicle) {
  const url = getVehicleShareUrl(vehicle);
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const price = formatCurrency(vehicle.price);
  
  const text = 
    `✨ *${title}* ✨\n` +
    `💰 *Price:* ${price}\n` +
    `🛡️ *Condition:* ${vehicle.condition}\n` +
    `📍 *Location:* ${vehicle.location}\n` +
    `🚗 *Transmission:* ${vehicle.transmission}\n\n` +
    `🔗 *View Full Specs & HD Photos on Jite Auto Deals:*\n${url}`;

  return {
    url,
    title,
    price,
    text,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitterUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this ${title} for ${price} on Jite Auto Deals!`)}&url=${encodeURIComponent(url)}`,
    telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`✨ ${title} - ${price} on Jite Auto Deals`)}`
  };
}

// Intelligently format large NGN portfolio value
export function formatPortfolioValue(totalNGN: number): string {
  if (!totalNGN || isNaN(totalNGN) || totalNGN <= 0) return '₦0';
  if (totalNGN >= 1_000_000_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}T+`;
  }
  if (totalNGN >= 1_000_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}B+`;
  }
  if (totalNGN >= 1_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}M+`;
  }
  if (totalNGN >= 1_000) {
    const val = (Math.floor((totalNGN / 1_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}K+`;
  }
  return formatCurrency(totalNGN);
}

/**
 * Decodes all forms of Unicode escape sequences into real, properly rendered Unicode text/emojis.
 */
export function decodeUnicodeEscapes(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  let res = str;

  // 1. ES6 bracketed unicode escape: \u{1F1F3} or \u{1F9FE}
  res = res.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 2. Standard 4-digit hex escape: \u2728, \u2014, \u20A6, \u2022
  res = res.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    } catch {
      return _;
    }
  });

  // 3. 8-digit uppercase \U0001F1F3
  res = res.replace(/\\U([0-9a-fA-F]{8})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 4. Hex escape \xB0
  res = res.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return _;
    }
  });

  // 5. HTML hexadecimal entities: &#x1F1F3;
  res = res.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 6. HTML decimal entities: &#128664;
  res = res.replace(/&#([0-9]{1,7});/g, (_, dec) => {
    try {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  // 7. Accidental stripped prefix at start or whitespace: e.g. "2728 2014 BMW" -> "✨ 2014 BMW"
  res = res.replace(/^2728\s+/g, '✨ ');
  res = res.replace(/\s+2728$/g, ' ✨');

  // 8. Convert literal \n or \r\n to real newlines if present
  res = res.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  return res;
}

/**
 * Normalizes vehicle data by decoding all text fields and ensuring required defaults.
 */
export function normalizeVehicleData(vehicle: Vehicle): Vehicle {
  if (!vehicle) return vehicle;
  return {
    ...vehicle,
    make: decodeUnicodeEscapes(vehicle.make || ''),
    model: decodeUnicodeEscapes(vehicle.model || ''),
    dealership: decodeUnicodeEscapes(vehicle.dealership || 'Jite Premium Sourcing'),
    engine: decodeUnicodeEscapes(vehicle.engine || ''),
    color: decodeUnicodeEscapes(vehicle.color || ''),
    condition: decodeUnicodeEscapes(vehicle.condition || 'Foreign Used') as any,
    location: decodeUnicodeEscapes(vehicle.location || 'Lagos'),
    description: decodeUnicodeEscapes(vehicle.description || ''),
    status: vehicle.status || 'Active',
    isFeatured: vehicle.isFeatured ?? true,
    images: Array.isArray(vehicle.images) ? vehicle.images.filter(Boolean) : [],
    createdAt: vehicle.createdAt || new Date().toISOString(),
    updatedAt: vehicle.updatedAt || new Date().toISOString(),
  };
}

// Map of known ImgBB page codes to 100% full original resolution direct CDN URLs
const KNOWN_IMGBB_MAP: Record<string, string> = {
  'FbMN1Pdd': 'https://i.ibb.co/fY5BWcTT/IMG-20260821-WA0006.jpg',
  'RTgSG1gx': 'https://i.ibb.co/WvH3NQHb/IMG-20260821-WA0012.jpg',
  '4gPF1WJ5': 'https://i.ibb.co/x8J2Fh3R/IMG-20260821-WA0016.jpg',
  'G4G0VhDW': 'https://i.ibb.co/B5vtg1Jy/IMG-20260821-WA0014.jpg',
  '6J09NPP2': 'https://i.ibb.co/DgfcLCCN/IMG-20260821-WA0018.jpg',
  'vvQrXdRk': 'https://i.ibb.co/93VfZ4SW/IMG-20260821-WA0000.jpg',
  'PZ38L9XG': 'https://i.ibb.co/gMHC2PqZ/IMG-20260821-WA0001.jpg',
  'prPMnkmw': 'https://i.ibb.co/wrLPY2vg/IMG-20260821-WA0004.jpg',
  'dwQVvFQs': 'https://i.ibb.co/0Rf6LTfp/IMG-20260821-WA0002.jpg',
  'TMSWnYQF': 'https://i.ibb.co/fd5DKq3P/IMG-20260821-WA0003.jpg',
  '359fpyvg': 'https://i.ibb.co/Myx8cDfF/IMG-20260819-WA0012.jpg',
  'prBSRtyr': 'https://i.ibb.co/M5xmGY65/IMG-20260819-WA0016.jpg',
  'PvgXDknN': 'https://i.ibb.co/W4f8VCw6/IMG-20260819-WA0018.jpg',
  'JRZGVMQh': 'https://i.ibb.co/PZkPKfQS/IMG-20260819-WA0020.jpg',
  'v6c4shvf': 'https://i.ibb.co/hJgFXc1r/IMG-20260819-WA0014.jpg',
  'LDNWGn6K': 'https://i.ibb.co/8nYph62k/IMG-20260819-WA0002.jpg',
  'gcbjvcp': 'https://i.ibb.co/mPrDvPw/IMG-20260819-WA0004.jpg',
  'ZzKMS9Ct': 'https://i.ibb.co/4RMV2kx9/IMG-20260819-WA0008.jpg',
  'yBdT1XYS': 'https://i.ibb.co/mFbswGX8/IMG-20260819-WA0006.jpg',
  'wZtKS2Yy': 'https://i.ibb.co/JWZzvSCn/IMG-20260819-WA0010.jpg',
  'XZvJcrKp': 'https://i.ibb.co/Kj3yTpf7/IMG-20260820-WA0010.jpg',
  'Lzpbc58J': 'https://i.ibb.co/1f2hP6Ld/IMG-20260820-WA0009.jpg',
  'skjWZJ0': 'https://i.ibb.co/yG04rBw/IMG-20260820-WA0014.jpg',
  'Cp5DT1cW': 'https://i.ibb.co/BHVFSzpw/IMG-20260820-WA0013.jpg',
  'tpFsmFqK': 'https://i.ibb.co/3mQNrQpd/IMG-20260820-WA0017.jpg',
  'S7XwDCwm': 'https://i.ibb.co/zHhVWvV2/IMG-20260730-WA0041.jpg',
  '8gYZRD6R': 'https://i.ibb.co/v4XnrxZr/IMG-20260730-WA0048.jpg',
  'BHBsT1DZ': 'https://i.ibb.co/zWZfPkcR/IMG-20260730-WA0049.jpg',
  '7xN3nXf7': 'https://i.ibb.co/5XxQr60q/IMG-20260730-WA0050.jpg',
  'S4RSRySF': 'https://i.ibb.co/4nPkPtkh/IMG-20260730-WA0052.jpg',
  'ynQB0P8m': 'https://i.ibb.co/wNzrygKZ/IMG-20260730-WA0051.jpg',
  'yncjHgxK': 'https://i.ibb.co/Gv4SzCrG/IMG-20260730-WA0047.jpg',
  '5XL9LFbM': 'https://i.ibb.co/hxVMVf37/IMG-20260730-WA0032.jpg',
  'FkfCd8df': 'https://i.ibb.co/rKLNX5XL/IMG-20260730-WA0035.jpg',
  'N2rv6xVq': 'https://i.ibb.co/KxDPj60g/IMG-20260730-WA0036.jpg',
  'PGqLXrsK': 'https://i.ibb.co/MkFvwgyr/IMG-20260730-WA0039.jpg',
  'Swz3WG5C': 'https://i.ibb.co/1Gkmhj7W/IMG-20260730-WA0040.jpg',
  'GQBwvLVC': 'https://i.ibb.co/Jj0LR4zr/IMG-20260730-WA0022.jpg',
  'LDLLnD3S': 'https://i.ibb.co/20DDg0Tq/IMG-20260730-WA0024.jpg',
  'gFd1qHsb': 'https://i.ibb.co/4g2yv9Bw/IMG-20260730-WA0026.jpg',
  'q3DsWcKw': 'https://i.ibb.co/v6cPQTp8/IMG-20260730-WA0028.jpg',
  '1YhCcNtY': 'https://i.ibb.co/KcRtngpc/IMG-20260730-WA0030.jpg',
  'fYhkvtss': 'https://i.ibb.co/6R3HBbkk/IMG-20260729-WA0002.jpg',
  'SXh2xmJR': 'https://i.ibb.co/tM7Sh238/IMG-20260729-WA0003.jpg',
  'yBs2zzW9': 'https://i.ibb.co/rfy9BB4j/IMG-20260729-WA0012.jpg',
  'gbBdws3x': 'https://i.ibb.co/fVP9tm2s/IMG-20260729-WA0016.jpg',
  'SXj7gSSZ': 'https://i.ibb.co/5W0x3ZZJ/IMG-20260729-WA0017.jpg',
  'vvkG4czB': 'https://i.ibb.co/n8jvMwk0/IMG-20260729-WA0018.jpg',
  'vx10V7m6': 'https://i.ibb.co/gMykm5wL/IMG-20260729-WA0022.jpg',
  'cSpyPtnL': 'https://i.ibb.co/sdDghQYH/IMG-20260729-WA0012.jpg',
  'cKYFSVv5': 'https://i.ibb.co/BHnZ5FPD/IMG-20260803-WA0012.jpg',
  'XxQLVtBM': 'https://i.ibb.co/1GgQbTVj/IMG-20260803-WA0014.jpg',
  'v4bPVjNS': 'https://i.ibb.co/7tHWj13q/IMG-20260803-WA0016.jpg',
  'XrJywthH': 'https://i.ibb.co/gLgvnJ5Y/IMG-20260803-WA0018.jpg',
  'RG8N3KxC': 'https://i.ibb.co/bjtFsVSr/IMG-20260803-WA0020.jpg',
  'QtzNd3Q': 'https://i.ibb.co/6LVPB7w/IMG-20260805-WA0004.jpg',
  'Y4vMxZPL': 'https://i.ibb.co/zWKYzJQ4/IMG-20260805-WA0008.jpg',
  'zh3xKGxb': 'https://i.ibb.co/5WQ4qB4v/IMG-20260805-WA0006.jpg',
  '97KSV8L': 'https://i.ibb.co/gxqhPjp/IMG-20260805-WA0010.jpg',
  'n8B7sx2z': 'https://i.ibb.co/QjkPFyBr/IMG-20260805-WA0012.jpg',
  'HfXqM9tM': 'https://i.ibb.co/YFbhKVcK/IMG-20260805-WA0016.jpg',
  'vC4TY8s1': 'https://i.ibb.co/XfxK8TyX/IMG-20260805-WA0020.jpg',
  'R4CQFPL3': 'https://i.ibb.co/Dg7wJk39/IMG-20260805-WA0018.jpg',
  'mrjT6xzY': 'https://i.ibb.co/vCFqZtzr/IMG-20260805-WA0022-1.jpg',
  'B5cmmcKP': 'https://i.ibb.co/nN6TT680/IMG-20260805-WA0024.jpg',
  '218GLZJw': 'https://i.ibb.co/C3JRXPLq/IMG-20260805-WA0069.jpg',
  'qLL3M38j': 'https://i.ibb.co/MyyxDxHS/IMG-20260805-WA0071.jpg',
  'k68TnQgn': 'https://i.ibb.co/Lhtywnzw/IMG-20260805-WA0073.jpg',
  'cXhFLgwX': 'https://i.ibb.co/BK2ZNzGK/IMG-20260805-WA0075.jpg',
  'prZ31ysJ': 'https://i.ibb.co/sJQFgHDy/IMG-20260805-WA0077.jpg',
  'ccBkx39G': 'https://i.ibb.co/gM2m6985/IMG-20260805-WA0079.jpg',
  '5XFLD3Q3': 'https://i.ibb.co/xKH6vbnb/IMG-20260807-WA0002.jpg',
  'Fk2GbP3j': 'https://i.ibb.co/rKYnGW01/IMG-20260807-WA0003.jpg',
  'hxVKXbj4': 'https://i.ibb.co/5XL5YmyS/IMG-20260807-WA0005.jpg',
  'bgRQVYdj': 'https://i.ibb.co/TBqYGJhD/IMG-20260807-WA0007.jpg',
  'TV5YKJy': 'https://i.ibb.co/CkFmJ4L/IMG-20260805-WA0081.jpg',
  'k2vNv3pv': 'https://i.ibb.co/F4CRCs9C/IMG-20260807-WA0010.jpg',
  '7t2CWvfR': 'https://i.ibb.co/Wvg5ynhP/IMG-20260807-WA0017.jpg',
  'hRD78rTm': 'https://i.ibb.co/Z6WLTvbM/IMG-20260807-WA0016.jpg',
  '4ZbyR1Q7': 'https://i.ibb.co/6RKh0Xdm/IMG-20260807-WA0015.jpg',
  'gbWs5TzZ': 'https://i.ibb.co/dspnd2G4/IMG-20260807-WA0014.jpg',
  '665Y81X': 'https://i.ibb.co/QsG9kCD/IMG-20260807-WA0019.jpg',
  'gZ5PyRG6': 'https://i.ibb.co/ZznYdM3N/IMG-20260807-WA0027.jpg',
  'ZRLhZ75C': 'https://i.ibb.co/RGvC5dfW/IMG-20260807-WA0024.jpg',
  'wZ5zdnrN': 'https://i.ibb.co/BH0CfhKV/IMG-20260807-WA0026.jpg',
  'G4bFkgVZ': 'https://i.ibb.co/tTW3cyb0/IMG-20260807-WA0025.jpg',
  'hxrhq75X': 'https://i.ibb.co/WN7qTx9D/IMG-20260811-WA0030.jpg',
  '8gJZkTyb': 'https://i.ibb.co/WvQJCqr0/IMG-20260811-WA0036.jpg',
  'xPmNvNm': 'https://i.ibb.co/d1bR9Rb/IMG-20260811-WA0037.jpg',
  'Kjd4T093': 'https://i.ibb.co/0jT4HDfd/IMG-20260811-WA0038.jpg',
  'N6k1R01G': 'https://i.ibb.co/6RpvQKvq/IMG-20260811-WA0032.jpg',
  'CF0svRr': 'https://i.ibb.co/w16rC5v/IMG-20260811-WA0050.jpg',
  'gFtZGB74': 'https://i.ibb.co/WpBvQY3V/IMG-20260811-WA0045.jpg',
  'FP22yqX': 'https://i.ibb.co/vtppTvh/IMG-20260811-WA0049.jpg',
  '27SdB4g5': 'https://i.ibb.co/FbXztTgn/IMG-20260811-WA0048.jpg',
  'j9hq6Hjc': 'https://i.ibb.co/BHLvzwYX/IMG-20260811-WA0047.jpg',
  'zT44cCK7': 'https://i.ibb.co/VcqqybXQ/IMG-20260811-WA0065.jpg',
  '1tnrSMXK': 'https://i.ibb.co/RkS35N6P/IMG-20260811-WA0068.jpg',
  'C5dxKkCJ': 'https://i.ibb.co/JRLXjf6x/IMG-20260811-WA0067.jpg',
  '9m9pv9hg': 'https://i.ibb.co/spvgPvCR/IMG-20260811-WA0069.jpg',
  'Nn6qb8mM': 'https://i.ibb.co/zHhgDy7z/IMG-20260811-WA0066.jpg',
  'd4HLZZTx': 'https://i.ibb.co/s9X677fz/IMG-20260811-WA0071.jpg',
  'gLJRqP4X': 'https://i.ibb.co/Mx7CwGBj/IMG-20260811-WA0076.jpg',
  'mr5RC3Yk': 'https://i.ibb.co/PsGrZdbK/IMG-20260811-WA0077.jpg',
  'qYm3rFkm': 'https://i.ibb.co/b5NMKRzN/IMG-20260811-WA0079.jpg',
  '8nTtfc05': 'https://i.ibb.co/5XtwSF68/IMG-20260811-WA0073.jpg',
  'Z6DLgts8': 'https://i.ibb.co/3yZrFGXN/IMG-20260811-WA0081.jpg',
  '21kbRL9v': 'https://i.ibb.co/Pv6SJbLc/IMG-20260811-WA0083.jpg',
  'WWQb5zZt': 'https://i.ibb.co/gMG59WNV/IMG-20260811-WA0088.jpg',
  'qMv3DNRw': 'https://i.ibb.co/KjJp529H/IMG-20260811-WA0089.jpg',
  'C3fZ0Rm6': 'https://i.ibb.co/sdZG38bC/IMG-20260811-WA0087.jpg',
  'VYJ9tq2d': 'https://i.ibb.co/gZm93RzG/IMG-20260811-WA0092.jpg',
  'b0mB7VY': 'https://i.ibb.co/7fCWbDB/IMG-20260811-WA0097.jpg',
  '5fmWnLs': 'https://i.ibb.co/ybtnYqg/IMG-20260811-WA0099.jpg',
  'hFsWng15': 'https://i.ibb.co/MknVjg5T/IMG-20260811-WA0094.jpg',
  'zWV2W472': 'https://i.ibb.co/p6jK6LRK/IMG-20260811-WA0096.jpg',
  'NgCgFgtj': 'https://i.ibb.co/Fk3khkmw/IMG-20260811-WA0101.jpg',
  't1j3dBZ': 'https://i.ibb.co/40vJQWs/IMG-20260811-WA0103.jpg',
  '8g2kYSrk': 'https://i.ibb.co/b5Ltb8st/IMG-20260811-WA0109.jpg',
  'Z6zD08t5': 'https://i.ibb.co/wNhmfW3V/IMG-20260811-WA0108.jpg',
  'bpSXkXd': 'https://i.ibb.co/qbtpvp1/IMG-20260811-WA0107.jpg',
  'PvQ5N8ZY': 'https://i.ibb.co/1t69Lxfn/IMG-20260811-WA0111.jpg',
  'Z1kRFsc8': 'https://i.ibb.co/DgSPvXwC/IMG-20260811-WA0117.jpg',
  '5Wk69Trh': 'https://i.ibb.co/27Sy6qv3/IMG-20260811-WA0118.jpg',
  'YTYcKyzv': 'https://i.ibb.co/LhbxqJL4/IMG-20260811-WA0115.jpg',
  '8nzqT3rH': 'https://i.ibb.co/wZJV3HSf/IMG-20260811-WA0119.jpg',
  'NdrXskvs': 'https://i.ibb.co/cSwP1pB1/IMG-20260811-WA0121.jpg',
  '9kN4jDXm': 'https://i.ibb.co/397FH3X5/IMG-20260811-WA0127.jpg',
  '27f4xZVN': 'https://i.ibb.co/VWP4Rwnm/IMG-20260811-WA0125.jpg',
  's9wsjgG1': 'https://i.ibb.co/60PDYyxt/IMG-20260811-WA0128.jpg',
  '4wNWXZzP': 'https://i.ibb.co/cKTJZc0D/IMG-20260811-WA0129.jpg',
  'JwZdMxt1': 'https://i.ibb.co/Q30c18Qg/IMG-20260808-WA0015.jpg',
  '4R05LfDf': 'https://i.ibb.co/xqrRbscs/IMG-20260811-WA0134.jpg',
  '7xNxVD92': 'https://i.ibb.co/Kczc7g1F/IMG-20260811-WA0135.jpg',
  'DgDbvgjQ': 'https://i.ibb.co/R4pSs4Jc/IMG-20260811-WA0136.jpg',
  'nM3RM6Cc': 'https://i.ibb.co/23853WNt/IMG-20260811-WA0137.jpg',
  '3yj0mWVw': 'https://i.ibb.co/VWzvYDbd/IMG-20260808-WA0016.jpg',
  '0VYY4StJ': 'https://i.ibb.co/n8QQdvCk/IMG-20260811-WA0139.jpg',
  'F4zRN7f7': 'https://i.ibb.co/b5Xcqdyd/IMG-20260811-WA0149.jpg',
  'wH4w5qr': 'https://i.ibb.co/W9fPmXp/IMG-20260811-WA0144.jpg',
  'Lz7pxgGm': 'https://i.ibb.co/JRJkvphV/IMG-20260811-WA0142.jpg',
  '0jt1qmpN': 'https://i.ibb.co/99tBncmX/IMG-20260811-WA0147.jpg',
  'bgrv8dFX': 'https://i.ibb.co/3y0FLhvc/IMG-20260811-WA0148.jpg',
  'wh1kJ1yT': 'https://i.ibb.co/tp5GZ5BS/IMG-20260811-WA0154.jpg',
  'gZWJqkx3': 'https://i.ibb.co/Xx5t0cqb/IMG-20260811-WA0157.jpg',
  'JwVcLzdf': 'https://i.ibb.co/S4b6TKxh/IMG-20260811-WA0156.jpg',
  'Y4vw7sWx': 'https://i.ibb.co/CpxD5Gtf/IMG-20260811-WA0155.jpg',
  'Df6p0rBw': 'https://i.ibb.co/GQ1TzHZC/IMG-20260811-WA0159.jpg',
  'FFfJnSS': 'https://i.ibb.co/Q4qnX22/IMG-20260811-WA0161.jpg',
  '60fdNKRM': 'https://i.ibb.co/5hf72QW0/IMG-20260728-WA0030.jpg',
  '21m3wXsT': 'https://i.ibb.co/RkZT1LBq/IMG-20260728-WA0032.jpg',
  'CKqf709N': 'https://i.ibb.co/8gJH58xT/IMG-20260811-WA0163.jpg',
  'MxM3t1C8': 'https://i.ibb.co/gLzBfWRv/IMG-20260811-WA0165.jpg',
  '0pDPJxh6': 'https://i.ibb.co/nqghkFzY/IMG-20260811-WA0166.jpg',
  'pj0zhHNv': 'https://i.ibb.co/m5DqNndC/IMG-20260814-WA0028.jpg',
  'jk88P4VJ': 'https://i.ibb.co/xq22t5mF/IMG-20260815-WA0000.jpg',
  'NdvZK076': 'https://i.ibb.co/RkFzcX7p/IMG-20260815-WA0001.jpg',
  '5hhGR0JG': 'https://i.ibb.co/Jjjms1Sm/IMG-20260815-WA0002.jpg',
  'SDqNr6v3': 'https://i.ibb.co/nqhrCwkL/IMG-20260815-WA0003.jpg',
  '4gsH1PrF': 'https://i.ibb.co/TqKsWm3w/IMG-20260814-WA0011.jpg',
  'WvL66pHf': 'https://i.ibb.co/5hP66x1L/IMG-20260814-WA0014.jpg',
  'TBg6zZP8': 'https://i.ibb.co/vxjp2bLP/IMG-20260815-WA0004.jpg',
  'pvxD8fwy': 'https://i.ibb.co/cc15H63L/IMG-20260815-WA0005.jpg',
  'cXNJDpLG': 'https://i.ibb.co/fGCM4Kvh/IMG-20260815-WA0006.jpg',
  'wh3DH1GC': 'https://i.ibb.co/GQBgwjYk/IMG-20260815-WA0007.jpg',
  'Qj8DHjwZ': 'https://i.ibb.co/CsJP9sGq/IMG-20260814-WA0030.jpg',
  'WpyLdPr2': 'https://i.ibb.co/Lht3qJTZ/IMG-20260815-WA0009.jpg',
  'zkLGFMq': 'https://i.ibb.co/VKh2x1f/IMG-20260815-WA0011.jpg',
  'YBSPHCHm': 'https://i.ibb.co/B2Jc0p0b/IMG-20260814-WA0013.jpg',
  'ycnnJVfQ': 'https://i.ibb.co/q3MMwxyr/IMG-20260814-WA0015.jpg',
  'QvDFrSgf': 'https://i.ibb.co/TMWBmjfk/IMG-20260815-WA0013.jpg',
  'yB0tkmpc': 'https://i.ibb.co/0VqT9pKR/IMG-20260815-WA0017.jpg',
  'KpGLyCLn': 'https://i.ibb.co/sdP63L67/IMG-20260815-WA0022.jpg',
  'gbxp2RjT': 'https://i.ibb.co/kVtf7SH8/IMG-20260815-WA0019.jpg',
  'P8qWgCR': 'https://i.ibb.co/8V1x98J/IMG-20260815-WA0023.jpg',
  'BV2hjpfb': 'https://i.ibb.co/3ymxW3T2/IMG-20260815-WA0018.jpg',
  'ccDk4W41': 'https://i.ibb.co/zhGQq3qr/IMG-20260815-WA0025.jpg',
  '99wcKkxV': 'https://i.ibb.co/mCvbZVnX/IMG-20260815-WA0027.jpg',
  'fGxXQFtB': 'https://i.ibb.co/HpHKX4Y1/IMG-20260815-WA0031.jpg',
  'Wp7FyFJP': 'https://i.ibb.co/HpRYzY8x/IMG-20260815-WA0029.jpg',
  '21hxHXth': 'https://i.ibb.co/MxSrQqVS/IMG-20260815-WA0033.jpg',
  'yBVWpSLG': 'https://i.ibb.co/wrYM7sD3/IMG-20260815-WA0043.jpg',
  'zV7NvhJb': 'https://i.ibb.co/whwYmNsC/IMG-20260815-WA0045.jpg',
  '8Dv5bnX3': 'https://i.ibb.co/hRQWcxC5/IMG-20260815-WA0044.jpg',
  'v6bZj3HM': 'https://i.ibb.co/tTS8Jq41/IMG-20260815-WA0047.jpg',
  '0RGHhQ8Y': 'https://i.ibb.co/XrCcSVNF/IMG-20260815-WA0049.jpg',
  'k2D20vVT': 'https://i.ibb.co/jkwkGs9Y/IMG-20260822-WA0001.jpg',
  'qLr3GPg7': 'https://i.ibb.co/ymQcTbkd/IMG-20260822-WA0007.jpg',
  'Kzjctrv0': 'https://i.ibb.co/M5DyzC02/IMG-20260822-WA0008.jpg',
  'B2X04c1v': 'https://i.ibb.co/qYtT07Zh/IMG-20260822-WA0006.jpg',
  'RK9KQzZ': 'https://i.ibb.co/q8d8mkX/IMG-20260822-WA0009.jpg',
  'LXNPfbqK': 'https://i.ibb.co/XrY4TNdH/IMG-20260822-WA0023.jpg',
  '4wtLBNCZ': 'https://i.ibb.co/gb98sgQM/IMG-20260823-WA0001.jpg',
  'wFgz95nS': 'https://i.ibb.co/ycPQwHz6/IMG-20260822-WA0027.jpg',
  'ns2zckZW': 'https://i.ibb.co/rGP46yTW/IMG-20260821-WA0008.jpg',
  '93mdrM57': 'https://i.ibb.co/Qj7xK5w4/IMG-20260822-WA0026.jpg',
  'Ld7GkJzh': 'https://i.ibb.co/4RrQmYZg/IMG-20260822-WA0015.jpg',
  'ZRNz6TGh': 'https://i.ibb.co/Kcmxjyb9/IMG-20260822-WA0019.jpg',
  'xtbSs7Jy': 'https://i.ibb.co/7dDJz12H/IMG-20260822-WA0021.jpg',
  'qF52Cz0N': 'https://i.ibb.co/M56Jfb8c/IMG-20260822-WA0020.jpg',
  '8448X6Fq': 'https://i.ibb.co/cXXTxDz0/IMG-20260822-WA0013.jpg',
  'VYD3wzNj': 'https://i.ibb.co/DfkLrvbV/IMG-20260822-WA0018.jpg',
  'XkvcW0vF': 'https://i.ibb.co/qFPTDqPm/IMG-20260822-WA0001-1.jpg',
  'q4Mp2yK': 'https://i.ibb.co/G1vRrxy/IMG-20260822-WA0007-1.jpg',
  'tMsfP0Qd': 'https://i.ibb.co/pvzDrHbm/IMG-20260822-WA0006-1.jpg',
  'BVWRkWS1': 'https://i.ibb.co/1fyxcywS/IMG-20260822-WA0008-1.jpg',
  'XZVLLfBC': 'https://i.ibb.co/Fbn33kvD/IMG-20260822-WA0009-1.jpg',
  'rK3GHvJP': 'https://i.ibb.co/SDcXBJpT/IMG-20260820-WA0021.jpg',
  'rRZd4dDJ': 'https://i.ibb.co/W4cVgVm1/IMG-20260824-WA0003.jpg',
  'fdSDx0Bv': 'https://i.ibb.co/pjPhLXGy/IMG-20260824-WA0006.jpg',
  'Zzq98DSN': 'https://i.ibb.co/LdVKt7rv/IMG-20260824-WA0008.jpg',
  'G4q4ZMQJ': 'https://i.ibb.co/Xrqrn5x4/IMG-20260824-WA0009.jpg',
  'TFhp7VM': 'https://i.ibb.co/3LhGjDm/IMG-20260824-WA0035.jpg',
  '0VX6qWkW': 'https://i.ibb.co/6JZTYp2p/IMG-20260824-WA0037.jpg',
  'zTkQHyyg': 'https://i.ibb.co/9kMc3FF0/IMG-20260824-WA0039.jpg',
  'xKHyhFGz': 'https://i.ibb.co/LD5MSN69/IMG-20260824-WA0041.jpg',
  'qLRL8MDv': 'https://i.ibb.co/cKNK9cyj/IMG-20260824-WA0016.jpg',
  'MzVFHst': 'https://i.ibb.co/LTtVy8c/IMG-20260824-WA0011.jpg',
  'LdbPtk06': 'https://i.ibb.co/CKNt71wv/IMG-20260824-WA0023.jpg',
  'ychj9h89': 'https://i.ibb.co/KpNvPN9P/IMG-20260824-WA0018.jpg',
  'dHm6t4q': 'https://i.ibb.co/SZf0cw8/IMG-20260824-WA0021.jpg',
  '998YmLBw': 'https://i.ibb.co/N6VYgPf1/IMG-20260824-WA0019.jpg',
  'bgnV74MS': 'https://i.ibb.co/GvjDFZ4K/IMG-20260824-WA0025.jpg',
};

// Normalize image URLs (convert ImgBB webpage links, Google Drive, Imgur to direct CDN links while maintaining 100% original quality)
export function normalizeImageInput(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();

  if (!trimmed) return '';

  // Data URLs or blob URLs
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // ImgBB webpage links like https://ibb.co/yBs2zzW9
  if (trimmed.includes('ibb.co/') && !trimmed.includes('i.ibb.co/')) {
    const match = trimmed.match(/ibb\.co\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const code = match[1];
      if (KNOWN_IMGBB_MAP[code]) {
        return KNOWN_IMGBB_MAP[code];
      }
      return `https://i.ibb.co/${code}/image.jpg`;
    }
  }

  // Google Drive share links
  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // Imgur page links
  if (trimmed.includes('imgur.com/') && !trimmed.includes('i.imgur.com/')) {
    const match = trimmed.match(/imgur\.com\/(?:a\/)?([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.imgur.com/${match[1]}.jpg`;
    }
  }

  // Dropbox links
  if (trimmed.includes('dropbox.com/s/')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }

  // Postimg.cc links
  if (trimmed.includes('postimg.cc/') && !trimmed.includes('i.postimg.cc/')) {
    const match = trimmed.match(/postimg\.cc\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.postimg.cc/${match[1]}/image.jpg`;
    }
  }

  return trimmed;
}

// Async helper to resolve ImgBB og:image direct CDN links dynamically
export async function resolveImageLink(url: string): Promise<string> {
  const syncNormalized = normalizeImageInput(url);
  if (syncNormalized.includes('ibb.co/') && !syncNormalized.includes('i.ibb.co/')) {
    try {
      const res = await fetch(`/api/resolve-image?url=${encodeURIComponent(syncNormalized)}`);
      const data = await res.json();
      if (data && data.resolvedUrl) {
        return data.resolvedUrl;
      }
    } catch (e) {
      console.warn('Failed to resolve image link via server API:', e);
    }
  }
  return syncNormalized;
}

export function getImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=100&w=2400';
  }

  return normalizeImageInput(url);
}

// ============================================================================
// CLOUD FIRESTORE INTEGRATION & REAL-TIME SYNC
// ============================================================================

let hasSeededFirestore = false;

/**
 * Seeds initial vehicles into Cloud Firestore if the collection is empty.
 */
async function seedInitialVehiclesIfEmpty(existingVehiclesCount: number): Promise<void> {
  if (hasSeededFirestore || existingVehiclesCount > 0) return;
  hasSeededFirestore = true;

  try {
    const batch = writeBatch(db);
    const normalizedSeed = INITIAL_VEHICLES
      .map(normalizeVehicleData)
      .filter(v => !PERMANENTLY_DELETED_VEHICLE_IDS.has(v.id));

    normalizedSeed.forEach((vehicle) => {
      const docRef = doc(db, 'vehicles', vehicle.id);
      batch.set(docRef, vehicle);
    });

    await batch.commit();
    console.log(`[Firestore] Successfully seeded ${normalizedSeed.length} initial vehicles to Cloud Firestore.`);
  } catch (error) {
    console.warn('[Firestore] Seed check skipped or failed:', error);
  }
}

/**
 * Subscribes in real-time to the Cloud Firestore `vehicles` collection.
 * Any update (add, edit, delete) anywhere immediately updates all connected devices.
 */
export function subscribeToVehicles(onUpdate: (vehicles: Vehicle[]) => void): () => void {
  try {
    const vehiclesCol = collection(db, 'vehicles');
    
    const unsubscribe = onSnapshot(
      vehiclesCol,
      (snapshot) => {
        if (snapshot.empty) {
          // If Firestore is completely empty on initial startup, seed initial catalog once
          seedInitialVehiclesIfEmpty(0).then(() => {
            const seed = INITIAL_VEHICLES.map(normalizeVehicleData).filter(v => !PERMANENTLY_DELETED_VEHICLE_IDS.has(v.id));
            try {
              localStorage.setItem(VEHICLES_KEY, JSON.stringify(seed));
            } catch {}
            onUpdate(seed);
          });
          return;
        }

        const list: Vehicle[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Vehicle;
          const normalized = normalizeVehicleData({
            ...data,
            id: docSnap.id || data.id,
          });
          if (!PERMANENTLY_DELETED_VEHICLE_IDS.has(normalized.id)) {
            list.push(normalized);
          }
        });

        // Save fresh data into local cache
        try {
          localStorage.setItem(VEHICLES_KEY, JSON.stringify(list));
        } catch {}

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: list }));
        }

        onUpdate(list);
      },
      (error) => {
        // Fallback to local cache if network is reconnecting
        console.warn('[Firestore] Vehicles sync notice:', error?.message || error);
        onUpdate(getVehicles());
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('[Firestore] Real-time vehicles subscription setup fallback:', e);
    onUpdate(getVehicles());
    return () => {};
  }
}

/**
 * Fetches all vehicles from Cloud Firestore (with fallback to local storage cache).
 */
export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    const vehiclesCol = collection(db, 'vehicles');
    const snapshot = await getDocs(vehiclesCol);

    if (snapshot.empty) {
      await seedInitialVehiclesIfEmpty(0);
      return getVehicles();
    }

    const list: Vehicle[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Vehicle;
      const normalized = normalizeVehicleData({
        ...data,
        id: docSnap.id || data.id,
      });
      if (!PERMANENTLY_DELETED_VEHICLE_IDS.has(normalized.id)) {
        list.push(normalized);
      }
    });

    try {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(list));
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: list }));
    }

    return list;
  } catch (error) {
    console.warn('[Firestore] Error fetching vehicles, using local cache:', error);
    return getVehicles();
  }
}

/**
 * Fast targeted fetch for a single vehicle by slug or ID directly from Firestore.
 * Prioritizes opening a direct vehicle link in milliseconds without needing to read the entire catalogue first.
 */
export async function fetchSingleVehicle(identifier: string): Promise<Vehicle | null> {
  if (!identifier) return null;
  const clean = decodeURIComponent(identifier).toLowerCase().trim().replace(/^\/vehicles\/?/, '').replace(/\/$/, '');
  if (!clean) return null;

  // 1. Instant check from local in-memory/localStorage cache
  const cachedList = getVehicles();
  const cachedMatch = findVehicleBySlugOrId(cachedList, clean);
  if (cachedMatch) {
    return cachedMatch;
  }

  // 2. Direct Firestore single document lookup by document ID
  try {
    const docRef = doc(db, 'vehicles', clean);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Vehicle;
      const normalized = normalizeVehicleData({
        ...data,
        id: docSnap.id || data.id,
      });
      if (!PERMANENTLY_DELETED_VEHICLE_IDS.has(normalized.id)) {
        // Update local cache
        const updated = [normalized, ...cachedList.filter(v => v.id !== normalized.id)];
        try {
          localStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
        } catch {}
        return normalized;
      }
    }
  } catch (e) {
    console.warn('[Firestore] Direct doc get error, falling back to query:', e);
  }

  // 3. Fallback: fetch full list if slug differs from Firestore ID
  try {
    const all = await fetchVehicles();
    return findVehicleBySlugOrId(all, clean) || null;
  } catch {
    return null;
  }
}

/**
 * Preloads the primary HD vehicle image in the browser <head> using high priority link prefetching.
 */
export function preloadPrimaryImage(rawUrl: string | undefined | null): void {
  if (!rawUrl || typeof document === 'undefined') return;
  const url = getImageUrl(rawUrl);
  if (!url) return;

  // Check if link already exists
  const existing = document.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`);
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
  }

  // Also prime the browser Image cache object
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

/**
 * Extracts initial vehicle slug or ID synchronously from current browser URL.
 */
export function getInitialVehicleRoute(): { slugOrId: string | null; qualify: boolean } {
  if (typeof window === 'undefined') return { slugOrId: null, qualify: false };
  const searchParams = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;
  const hash = window.location.hash;

  let initialSlugOrId: string | null = null;
  if (pathname.startsWith('/vehicles/')) {
    initialSlugOrId = pathname.replace(/^\/vehicles\/?/, '');
  } else if (searchParams.get('vehicle')) {
    initialSlugOrId = searchParams.get('vehicle');
  } else if (searchParams.get('v')) {
    initialSlugOrId = searchParams.get('v');
  } else if (hash.startsWith('#/vehicles/')) {
    initialSlugOrId = hash.replace(/^#\/vehicles\/?/, '');
  }

  const qualify = searchParams.get('qualify') === '1' || searchParams.get('qualify') === 'true';
  return { slugOrId: initialSlugOrId, qualify };
}

/**
 * Gets cached vehicles from localStorage or fallback seed data.
 */
export function getVehicles(): Vehicle[] {
  const normalizedSeed = INITIAL_VEHICLES
    .map(normalizeVehicleData)
    .filter(v => !PERMANENTLY_DELETED_VEHICLE_IDS.has(v.id));

  try {
    const data = localStorage.getItem(VEHICLES_KEY);
    if (!data) {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalizedSeed));
      return normalizedSeed;
    }
    const parsed = JSON.parse(data) as Vehicle[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalizedSeed));
      return normalizedSeed;
    }
    return parsed
      .map(normalizeVehicleData)
      .filter(v => !PERMANENTLY_DELETED_VEHICLE_IDS.has(v.id));
  } catch (e) {
    return normalizedSeed;
  }
}

// ============================================================================
// FIREBASE STORAGE IMAGE UPLOADS
// ============================================================================

/**
 * Client-side fast image optimizer:
 * Uses fast asynchronous decoding (createImageBitmap or ObjectURL) and high-fidelity canvas downscaling (max 2560px, JPEG 0.92)
 * to convert multi-megabyte camera photos into crisp, ultra-high-definition web images in milliseconds without quality degradation or blurring.
 */
export async function compressImageFile(file: File, maxWidth = 2560, maxHeight = 2560, quality = 0.92): Promise<Blob | File> {
  // If already reasonable size (< 1.5MB) and standard web format, skip canvas re-encoding to preserve 100% original pixel data
  if (file.size <= 1500 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp' || file.type === 'image/png')) {
    return file;
  }

  // Fast path: createImageBitmap (runs asynchronously off main UI thread)
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(file);
      let { width, height } = bitmap;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return file;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
      return blob && blob.size < file.size ? blob : file;
    } catch {
      // fallback to Image element below if createImageBitmap encounters unsupported format
    }
  }

  // Fallback path: URL.createObjectURL (avoids heavy readAsDataURL memory allocations)
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

/**
 * Uploads a local File or Blob directly to Firebase Storage and returns its permanent CDN download URL.
 */
export async function uploadVehicleImageFile(file: File | Blob, vehicleId: string, index: number): Promise<string> {
  try {
    const optimized = file instanceof File ? await compressImageFile(file) : file;
    const cleanId = (vehicleId || 'car').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `vehicles/${cleanId}/img_${index + 1}_${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    const snapshot = await uploadBytes(storageRef, optimized, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('[Firebase Storage] Image upload error:', error);
    throw new Error(`Failed to upload image ${index + 1} to Firebase Storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Uploads a base64 Data URL string to Firebase Storage and returns its permanent CDN download URL.
 */
export async function uploadVehicleImageDataUrl(dataUrl: string, vehicleId: string, index: number): Promise<string> {
  try {
    const cleanId = (vehicleId || 'car').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `vehicles/${cleanId}/img_${index + 1}_${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    const snapshot = await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('[Firebase Storage] DataURL upload error:', error);
    throw new Error(`Failed to upload image ${index + 1} to Firebase Storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Universal vehicle image processor: converts local files or data URLs to permanent Firebase Storage URLs,
 * or normalizes remote CDN links.
 */
export async function uploadVehicleImage(source: File | Blob | string, vehicleId: string, index: number): Promise<string> {
  if (!source) return '';

  if (source instanceof File || source instanceof Blob) {
    return uploadVehicleImageFile(source, vehicleId, index);
  }

  if (typeof source === 'string') {
    if (source.startsWith('data:image/')) {
      return uploadVehicleImageDataUrl(source, vehicleId, index);
    }
    return normalizeImageInput(source);
  }

  return '';
}

/**
 * Saves a single vehicle directly into Cloud Firestore and verifies the write on the server.
 * Returns the confirmed Vehicle object.
 */
export async function saveVehicleToFirestore(vehicle: Vehicle): Promise<Vehicle> {
  const normalized = normalizeVehicleData(vehicle);
  try {
    const docRef = doc(db, 'vehicles', normalized.id);
    await setDoc(docRef, normalized);

    // Verify document write directly on Firestore
    const verifySnap = await getDoc(docRef);
    if (!verifySnap.exists()) {
      throw new Error(`Firestore document write verification failed for vehicle ${normalized.id}`);
    }

    const confirmedData = normalizeVehicleData({
      ...verifySnap.data() as Vehicle,
      id: verifySnap.id
    });

    // Update local cache immediately
    const current = getVehicles().filter(v => v.id !== confirmedData.id);
    current.unshift(confirmedData);
    try {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(current));
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: current }));
    }

    return confirmedData;
  } catch (error) {
    console.error('[Firestore] Save Vehicle Error:', error);
    handleFirestoreError(error, OperationType.WRITE, `vehicles/${normalized.id}`);
  }
}

/**
 * Creates a brand-new vehicle in Cloud Firestore.
 */
export async function createVehicle(vehicle: Vehicle): Promise<Vehicle> {
  return saveVehicleToFirestore(vehicle);
}

/**
 * Updates an existing vehicle in Cloud Firestore.
 */
export async function updateVehicle(vehicleId: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  const currentVehicles = getVehicles();
  const existing = currentVehicles.find(v => v.id === vehicleId);
  const merged: Vehicle = normalizeVehicleData({
    ...(existing || { id: vehicleId, make: '', model: '', year: 2020, price: 0, mileage: 0, transmission: 'Automatic', fuelType: 'Petrol', bodyType: 'SUV', location: 'Lagos', dealership: 'Jite Premium Sourcing', images: [], description: '', engine: '', color: '', condition: 'Foreign Used', isFeatured: true }),
    ...updates,
    id: vehicleId,
    updatedAt: new Date().toISOString()
  });

  return saveVehicleToFirestore(merged);
}

/**
 * Publishes a vehicle (sets status: 'Active' in Firestore).
 */
export async function publishVehicle(vehicleId: string): Promise<Vehicle> {
  return updateVehicle(vehicleId, { status: 'Active' });
}

/**
 * Unpublishes a vehicle (sets status: 'Inactive' in Firestore).
 */
export async function unpublishVehicle(vehicleId: string): Promise<Vehicle> {
  return updateVehicle(vehicleId, { status: 'Inactive' });
}

/**
 * Deletes a single vehicle directly from Cloud Firestore.
 */
export async function deleteVehicleFromFirestore(id: string): Promise<void> {
  PERMANENTLY_DELETED_VEHICLE_IDS.add(id);
  try {
    const docRef = doc(db, 'vehicles', id);
    await deleteDoc(docRef);

    const current = getVehicles().filter(v => v.id !== id);
    try {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(current));
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: current }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
  }
}

/**
 * Resets all vehicles in Cloud Firestore back to default curated inventory.
 */
export async function resetFirestoreVehiclesToDefault(): Promise<void> {
  try {
    // 1. Delete all existing documents in vehicles collection
    const snapshot = await getDocs(collection(db, 'vehicles'));
    const deleteBatch = writeBatch(db);
    snapshot.forEach((d) => {
      deleteBatch.delete(d.ref);
    });
    await deleteBatch.commit();

    // 2. Repopulate with initial vehicles
    const addBatch = writeBatch(db);
    INITIAL_VEHICLES.map(normalizeVehicleData).forEach((v) => {
      const docRef = doc(db, 'vehicles', v.id);
      addBatch.set(docRef, v);
    });
    await addBatch.commit();

    localStorage.removeItem(VEHICLES_KEY);
  } catch (error) {
    console.error('[Firestore] Failed to reset default vehicles:', error);
  }
}

/**
 * Synchronizes an array of vehicles to Firestore and LocalStorage (backward compatible).
 */
export function saveVehicles(vehicles: Vehicle[]): void {
  const normalized = vehicles
    .map(normalizeVehicleData)
    .filter(v => !PERMANENTLY_DELETED_VEHICLE_IDS.has(v.id));

  try {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalized));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: normalized }));
  }

  // Batch save to Firestore
  try {
    const batch = writeBatch(db);
    normalized.forEach((v) => {
      const docRef = doc(db, 'vehicles', v.id);
      batch.set(docRef, v);
    });
    batch.commit().catch((err) => {
      console.warn('[Firestore] Batch save background error:', err);
    });
  } catch (err) {
    console.warn('[Firestore] Error initiating batch save:', err);
  }
}

/**
 * Permanently deletes a vehicle (backward compatible).
 */
export function deleteVehicle(id: string): void {
  deleteVehicleFromFirestore(id).catch(() => {});
  const current = getVehicles().filter(v => v.id !== id);
  try {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(current));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: current }));
  }
}

// ============================================================================
// LEADS & INQUIRIES FIRESTORE INTEGRATION
// ============================================================================

/**
 * Subscribes in real-time to the Cloud Firestore `leads` collection.
 */
export function subscribeToLeads(onUpdate: (leads: Lead[]) => void): () => void {
  try {
    const leadsCol = collection(db, 'leads');
    const unsubscribe = onSnapshot(
      leadsCol,
      (snapshot) => {
        const list: Lead[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Lead);
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        try {
          localStorage.setItem(LEADS_KEY, JSON.stringify(list));
        } catch {}
        onUpdate(list);
      },
      (error) => {
        console.warn('[Firestore] Leads sync notice:', error?.message || error);
        onUpdate(getLeads());
      }
    );
    return unsubscribe;
  } catch (e) {
    onUpdate(getLeads());
    return () => {};
  }
}

/**
 * Fetches all leads from Cloud Firestore.
 */
export async function fetchLeads(): Promise<Lead[]> {
  try {
    const snapshot = await getDocs(collection(db, 'leads'));
    const list: Lead[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ ...docSnap.data(), id: docSnap.id } as Lead);
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    try {
      localStorage.setItem(LEADS_KEY, JSON.stringify(list));
    } catch {}
    return list;
  } catch (error) {
    return getLeads();
  }
}

/**
 * Gets leads from localStorage cache.
 */
export function getLeads(): Lead[] {
  try {
    const data = localStorage.getItem(LEADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new lead to Cloud Firestore.
 */
export function saveLead(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead {
  const newLead: Lead = {
    ...lead,
    id: 'lead_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };

  const current = getLeads();
  current.unshift(newLead);
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(current));
  } catch {}

  // Write to Cloud Firestore
  setDoc(doc(db, 'leads', newLead.id), newLead).catch((err) => {
    console.warn('[Firestore] Error saving lead to Firestore:', err);
  });

  return newLead;
}

/**
 * Updates a lead in Cloud Firestore.
 */
export function updateLead(leadId: string, updates: Partial<Lead>): Lead[] {
  const current = getLeads();
  const updated = current.map(l => l.id === leadId ? { ...l, ...updates } : l);
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(updated));
  } catch {}

  // Update in Cloud Firestore
  updateDoc(doc(db, 'leads', leadId), updates).catch((err) => {
    console.warn('[Firestore] Error updating lead in Firestore:', err);
  });

  return updated;
}

/**
 * Subscribes in real-time to the Cloud Firestore `inquiries` collection.
 */
export function subscribeToInquiries(onUpdate: (inquiries: Inquiry[]) => void): () => void {
  try {
    const inqCol = collection(db, 'inquiries');
    const unsubscribe = onSnapshot(
      inqCol,
      (snapshot) => {
        const list: Inquiry[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Inquiry);
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        try {
          localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
        } catch {}
        onUpdate(list);
      },
      (error) => {
        console.warn('[Firestore] Inquiries sync notice:', error?.message || error);
        onUpdate(getInquiries());
      }
    );
    return unsubscribe;
  } catch (e) {
    onUpdate(getInquiries());
    return () => {};
  }
}

/**
 * Fetches inquiries from Cloud Firestore.
 */
export async function fetchInquiries(): Promise<Inquiry[]> {
  try {
    const snapshot = await getDocs(collection(db, 'inquiries'));
    const list: Inquiry[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ ...docSnap.data(), id: docSnap.id } as Inquiry);
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    try {
      localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
    } catch {}
    return list;
  } catch (error) {
    return getInquiries();
  }
}

/**
 * Gets inquiries from localStorage cache.
 */
export function getInquiries(): Inquiry[] {
  try {
    const data = localStorage.getItem(INQUIRIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new inquiry to Cloud Firestore.
 */
export function saveInquiry(inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'status'>): Inquiry {
  const newInquiry: Inquiry = {
    ...inquiry,
    id: 'inq_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };

  const current = getInquiries();
  current.unshift(newInquiry);
  try {
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(current));
  } catch {}

  // Write to Cloud Firestore
  setDoc(doc(db, 'inquiries', newInquiry.id), newInquiry).catch((err) => {
    console.warn('[Firestore] Error saving inquiry to Firestore:', err);
  });

  return newInquiry;
}

/**
 * Updates an inquiry in Cloud Firestore.
 */
export function updateInquiry(inquiryId: string, updates: Partial<Inquiry>): Inquiry[] {
  const current = getInquiries();
  const updated = current.map(i => i.id === inquiryId ? { ...i, ...updates } : i);
  try {
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));
  } catch {}

  // Update in Cloud Firestore
  updateDoc(doc(db, 'inquiries', inquiryId), updates).catch((err) => {
    console.warn('[Firestore] Error updating inquiry in Firestore:', err);
  });

  return updated;
}

// ============================================================================
// CENTRAL BUSINESS SETTINGS FIRESTORE INTEGRATION
// ============================================================================

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: 'Jite Auto Deals',
  brandTagline: 'Vehicle Consultant in Nigeria | Find, Source & Navigate',
  consultantName: 'Tobor Jite',
  phoneDisplay: '08180823197',
  phoneCallUrl: 'tel:+2348180823197',
  whatsAppNumber: '2348180823197',
  email: 'toborcars2026@gmail.com',
  address: 'Lagos, Nigeria (Serving Clients Nationwide)',
  instagramUrl: 'https://instagram.com/jiteautodeals',
  tikTokUrl: 'https://tiktok.com/@jiteautodeals',
  facebookUrl: 'https://facebook.com/jiteautodeals',
  homepageCtaText: 'Talk to a Vehicle Consultant',
  footerText: '© 2026 Jite Auto Deals. All rights reserved. Registered automotive sourcing consultancy in Nigeria.',
  updatedAt: new Date().toISOString(),
};

/**
 * Gets cached business settings or defaults.
 */
export function getBusinessSettings(): BusinessSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_BUSINESS_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_BUSINESS_SETTINGS;
}

/**
 * Fetches the central business settings from Cloud Firestore (`settings/business`).
 */
export async function fetchBusinessSettings(): Promise<BusinessSettings> {
  try {
    const docRef = doc(db, 'settings', 'business');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { ...DEFAULT_BUSINESS_SETTINGS, ...docSnap.data() } as BusinessSettings;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      } catch {}
      return data;
    } else {
      // Seed default settings to Firestore if not present
      await setDoc(docRef, DEFAULT_BUSINESS_SETTINGS);
      return DEFAULT_BUSINESS_SETTINGS;
    }
  } catch (error) {
    console.warn('[Firestore] Error fetching business settings:', error);
    return getBusinessSettings();
  }
}

/**
 * Real-time subscription to central business settings from Cloud Firestore.
 */
export function subscribeToBusinessSettings(onUpdate: (settings: BusinessSettings) => void): () => void {
  try {
    const docRef = doc(db, 'settings', 'business');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { ...DEFAULT_BUSINESS_SETTINGS, ...docSnap.data() } as BusinessSettings;
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
          } catch {}
          onUpdate(data);
        } else {
          // Initialize doc if missing
          setDoc(docRef, DEFAULT_BUSINESS_SETTINGS).catch(() => {});
          onUpdate(DEFAULT_BUSINESS_SETTINGS);
        }
      },
      (error) => {
        console.warn('[Firestore] Settings sync notice:', error?.message || error);
        onUpdate(getBusinessSettings());
      }
    );
    return unsubscribe;
  } catch (e) {
    onUpdate(getBusinessSettings());
    return () => {};
  }
}

/**
 * Saves updated business settings directly to Cloud Firestore.
 */
export async function saveBusinessSettingsToFirestore(settings: Partial<BusinessSettings>): Promise<BusinessSettings> {
  const current = getBusinessSettings();
  const updated: BusinessSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {}

  try {
    const docRef = doc(db, 'settings', 'business');
    await setDoc(docRef, updated, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/business');
    throw error;
  }

  return updated;
}

// ============================================================================
// DIRECT VEHICLE QUICK-UPDATE HELPERS (FIRESTORE FIRST)
// ============================================================================

/**
 * Updates a vehicle's status (Available, Reserved, Sold, Hidden) in Firestore.
 */
export async function saveVehicleStatus(vehicleId: string, status: VehicleStatus): Promise<void> {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicleId}`);
    throw err;
  }
}

/**
 * Updates a vehicle's price directly in Firestore.
 */
export async function saveVehiclePrice(vehicleId: string, newPrice: number): Promise<void> {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, {
      price: Number(newPrice) || 0,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicleId}`);
    throw err;
  }
}

/**
 * Updates a vehicle's featured flag directly in Firestore.
 */
export async function saveVehicleFeatured(vehicleId: string, isFeatured: boolean): Promise<void> {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(docRef, {
      isFeatured,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicleId}`);
    throw err;
  }
}

/**
 * Updates a vehicle's homepage slideshow flag and order directly in Firestore.
 */
export async function saveVehicleSlideshow(vehicleId: string, inSlideshow: boolean, slideshowOrder?: number): Promise<void> {
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    const updates: any = {
      inSlideshow,
      updatedAt: new Date().toISOString()
    };
    if (typeof slideshowOrder === 'number') {
      updates.slideshowOrder = slideshowOrder;
    }
    await updateDoc(docRef, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vehicles/${vehicleId}`);
    throw err;
  }
}

/**
 * Updates lead status in Firestore.
 */
export async function saveLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  try {
    const docRef = doc(db, 'leads', leadId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `leads/${leadId}`);
    throw err;
  }
}

/**
 * Updates inquiry status in Firestore.
 */
export async function saveInquiryStatus(inquiryId: string, status: LeadStatus): Promise<void> {
  try {
    const docRef = doc(db, 'inquiries', inquiryId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `inquiries/${inquiryId}`);
    throw err;
  }
}

// ============================================================================
// OFFICIAL CONTACT CONFIGURATION & HELPER UTILITIES
// ============================================================================

export const CONTACT_CONFIG = {
  phoneDisplay: '08180823197',
  phoneCallUrl: 'tel:+2348180823197',
  whatsAppNumber: '2348180823197',
  whatsAppBaseUrl: 'https://wa.me/2348180823197',
};

export const OFFICIAL_PHONE = '+2348180823197';
export const OFFICIAL_PHONE_DISPLAY = '0818 082 3197';
export const OFFICIAL_PHONE_CALL_URL = 'tel:+2348180823197';
export const OFFICIAL_WHATSAPP_NUMBER = '2348180823197';
export const OFFICIAL_WHATSAPP_URL = 'https://wa.me/2348180823197';

/**
 * Robustly formats any raw phone string into a valid international tel: link.
 * Handles Nigerian local numbers (e.g. 08180823197 -> tel:+2348180823197),
 * international numbers (e.g. 2348180823197 -> tel:+2348180823197),
 * and existing tel: protocol links.
 */
export function formatPhoneForTel(rawPhone?: string): string {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    try {
      const settings = getBusinessSettings();
      if (settings?.phoneCallUrl && settings.phoneCallUrl.startsWith('tel:')) {
        return settings.phoneCallUrl;
      }
      rawPhone = settings?.phoneDisplay || OFFICIAL_PHONE_DISPLAY;
    } catch {
      return OFFICIAL_PHONE_CALL_URL;
    }
  }

  const clean = rawPhone.trim();
  if (clean.startsWith('tel:')) {
    // Ensure tel link is clean of spaces or special formatting
    const numPart = clean.replace(/^tel:/, '').replace(/[^0-9+]/g, '');
    return `tel:${numPart}`;
  }

  const digits = clean.replace(/\D/g, '');
  if (!digits) {
    return OFFICIAL_PHONE_CALL_URL;
  }

  if (clean.startsWith('+')) {
    return `tel:+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `tel:+234${digits.slice(1)}`;
  }

  if (digits.startsWith('234')) {
    return `tel:+${digits}`;
  }

  if (digits.length === 10) {
    return `tel:+234${digits}`;
  }

  return `tel:+${digits}`;
}

/**
 * Formats a phone number for user-friendly, legible display.
 * E.g. "08180823197" -> "0818 082 3197" or "+2348180823197" -> "+234 818 082 3197"
 */
export function formatPhoneForDisplay(rawPhone?: string): string {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    try {
      const settings = getBusinessSettings();
      rawPhone = settings?.phoneDisplay || '0818 082 3197';
    } catch {
      return '0818 082 3197';
    }
  }

  const clean = rawPhone.trim().replace(/^tel:/, '');
  const digits = clean.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 13 && digits.startsWith('234')) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  if (digits.length === 10) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  return clean;
}

/**
 * Authoritative helper to get the latest business phone number for display.
 */
export function getBusinessPhoneDisplay(customSettings?: BusinessSettings): string {
  if (customSettings?.phoneDisplay) {
    return formatPhoneForDisplay(customSettings.phoneDisplay);
  }
  try {
    const settings = getBusinessSettings();
    return formatPhoneForDisplay(settings.phoneDisplay);
  } catch {
    return OFFICIAL_PHONE_DISPLAY;
  }
}

/**
 * Authoritative helper to get the latest business phone call URL (tel:+234...).
 */
export function getBusinessPhoneCallUrl(customSettings?: BusinessSettings): string {
  if (customSettings?.phoneCallUrl) {
    return formatPhoneForTel(customSettings.phoneCallUrl);
  }
  if (customSettings?.phoneDisplay) {
    return formatPhoneForTel(customSettings.phoneDisplay);
  }
  try {
    const settings = getBusinessSettings();
    if (settings.phoneCallUrl) return formatPhoneForTel(settings.phoneCallUrl);
    if (settings.phoneDisplay) return formatPhoneForTel(settings.phoneDisplay);
  } catch {}
  return OFFICIAL_PHONE_CALL_URL;
}

/**
 * Generates an official WhatsApp chat URL, defaulting dynamically to the central business settings.
 */
export function getWhatsAppLink(message?: string, customPhone?: string): string {
  let targetPhone = customPhone;
  if (!targetPhone) {
    try {
      const settings = getBusinessSettings();
      targetPhone = settings.whatsAppNumber || OFFICIAL_WHATSAPP_NUMBER;
    } catch {
      targetPhone = OFFICIAL_WHATSAPP_NUMBER;
    }
  }

  const cleanPhone = (targetPhone || OFFICIAL_WHATSAPP_NUMBER).replace(/\D/g, '');
  if (!message || !message.trim()) {
    return `https://wa.me/${cleanPhone}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message.trim())}`;
}

/**
 * Returns a tel: link for making a direct phone call.
 */
export function getPhoneCallUrl(customPhone?: string): string {
  if (customPhone) {
    return formatPhoneForTel(customPhone);
  }
  return getBusinessPhoneCallUrl();
}

export function handlePhoneCall(customPhone?: string): void {
  const url = getPhoneCallUrl(customPhone);
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}


export function getGeneralConsultationMessage(): string {
  return `Hello Jite Auto Deals! I'm interested in finding a quality vehicle. I'd love to consult with a vehicle specialist to compare my options based on my budget.`;
}

export function getVehicleInquiryMessage(vehicle: Vehicle): string {
  return `Hello Jite Auto Deals! I am interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} priced at ${formatCurrency(vehicle.price)} located in ${vehicle.location}. Please let me know its availability and next steps!`;
}

export function getLeadQualificationMessage(
  vehicle: Vehicle | string,
  budget: number,
  paymentMethod: string,
  readyToBuy: string,
  name: string,
  phone?: string
): string {
  if (typeof vehicle === 'string') {
    return (
      `*NEW VEHICLE INQUIRY* 🚗✨\n` +
      `Hello Jite Auto Deals! I qualified my acquisition request on your website. Here are my details:\n\n` +
      `👤 *BUYER INFORMATION:*\n` +
      `• *Full Name:* ${name}\n` +
      (phone ? `• *Phone Number:* ${phone}\n` : '') +
      `\n🚗 *SELECTED VEHICLE:*\n` +
      `• *Model:* ${vehicle}\n\n` +
      `💳 *BUYER CRITERIA:*\n` +
      `• *Target Budget:* ${formatCurrency(budget)}\n` +
      `• *Payment Method:* ${paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n` +
      `• *Purchase Timeline:* ${readyToBuy}\n\n` +
      `Please review my request and connect me with a verified specialist to proceed with inspection and acquisition!`
    );
  }

  return (
    `*NEW VEHICLE ACQUISITION INQUIRY* 🚗✨\n` +
    `Hello Jite Auto Deals! I just completed the "Get This Car" inquiry on your website for a catalog vehicle.\n\n` +
    `📋 *SELECTED VEHICLE DETAILS:*\n` +
    `• *Car:* ${vehicle.year} ${vehicle.make} ${vehicle.model}\n` +
    `• *Listed Price:* ${formatCurrency(vehicle.price)}\n` +
    `• *Condition:* ${vehicle.condition}\n` +
    `• *Color:* ${vehicle.color}\n` +
    `• *Transmission:* ${vehicle.transmission}\n` +
    `• *Location:* ${vehicle.location}\n\n` +
    `👤 *BUYER INFORMATION:*\n` +
    `• *Full Name:* ${name}\n` +
    `• *Phone Number:* ${phone || 'Not provided'}\n\n` +
    `💳 *BUYER SOURCING CRITERIA:*\n` +
    `• *Target Budget:* ${formatCurrency(budget)}\n` +
    `• *Payment Method:* ${paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n` +
    `• *Purchase Timeline:* ${readyToBuy}\n\n` +
    `Please confirm vehicle availability and guide me on the next steps for purchase/inspection!`
  );
}

export function getHelpMeFindCarMessage(lead: {
  name: string;
  phone: string;
  vehicleType?: string;
  brand?: string;
  model?: string;
  budget: number;
  location?: string;
  paymentMethod: string;
  requirements?: string;
}): string {
  return (
    `*VEHICLE CONSULTATION REQUEST (Find My Car)* 🚗\n` +
    `Hello Jite Auto Deals! I would like help finding a vehicle with the following details:\n\n` +
    `👤 *Name:* ${lead.name}\n` +
    `📞 *Phone:* ${lead.phone}\n` +
    (lead.vehicleType ? `🚘 *Body Type:* ${lead.vehicleType}\n` : '') +
    (lead.brand ? `🏷️ *Preferred Brand:* ${lead.brand}\n` : '') +
    (lead.model ? `📋 *Preferred Model:* ${lead.model}\n` : '') +
    `💰 *Budget:* ${formatCurrency(lead.budget)}\n` +
    (lead.location ? `📍 *Location:* ${lead.location}\n` : '') +
    `💳 *Purchase Preference:* ${lead.paymentMethod === 'Financing' ? 'Vehicle Finance' : 'Outright Purchase'}\n` +
    (lead.requirements ? `📝 *Notes/Requirements:* ${lead.requirements}\n` : '') +
    `\nPlease let me know suitable options from your sourcing network!`
  );
}

export function getSourceCarMessage(data: {
  name: string;
  phone: string;
  sourceUrl?: string;
  vehicleDetails: string;
  message?: string;
}): string {
  return (
    `*VEHICLE SOURCING REQUEST (Found a Car Elsewhere)* 🔍\n` +
    `Hello Jite Auto Deals! I found a vehicle elsewhere and would like to speak with a consultant about sourcing and verifying it.\n\n` +
    `👤 *Name:* ${data.name}\n` +
    `📞 *Phone:* ${data.phone}\n` +
    (data.sourceUrl ? `🔗 *Listing Link:* ${data.sourceUrl}\n` : '') +
    `🚗 *Vehicle Details:* ${data.vehicleDetails}\n` +
    (data.message ? `💬 *Additional Message:* ${data.message}\n` : '') +
    `\nPlease review this request and let me know the available sourcing options.`
  );
}

/**
 * Returns vehicles curated for the homepage slideshow.
 * Defaults to vehicles flagged with `inSlideshow` or top featured vehicles.
 */
export function getSlideshowVehicles(vehicles: Vehicle[]): Vehicle[] {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return [];
  const activeVehicles = vehicles.filter(v => isVehicleActive(v) && v.images && v.images.length > 0);
  
  const explicitlyInSlideshow = activeVehicles
    .filter(v => v.inSlideshow)
    .sort((a, b) => (a.slideshowOrder || 0) - (b.slideshowOrder || 0));

  if (explicitlyInSlideshow.length >= 3) {
    return explicitlyInSlideshow;
  }

  // Fallback: mix with featured vehicles
  const featured = activeVehicles.filter(v => v.isFeatured && !v.inSlideshow);
  const combined = [...explicitlyInSlideshow, ...featured, ...activeVehicles];
  
  // Deduplicate by ID
  const seen = new Set<string>();
  const result: Vehicle[] = [];
  for (const v of combined) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      result.push(v);
    }
    if (result.length >= 8) break;
  }
  return result;
}

