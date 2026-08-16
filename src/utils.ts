import { Vehicle, Lead, Inquiry } from './types';
import { INITIAL_VEHICLES } from './data';

// LocalStorage Keys
const VEHICLES_KEY = 'jite_vehicles_v3';
const LEADS_KEY = 'jite_leads_v1';
const INQUIRIES_KEY = 'jite_inquiries_v1';

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
 * Uses query parameter `?vehicle=slug` on custom hosting (or path fallback)
 * to ensure 100% reliability across Vercel, static CDNs, and custom domains without 404 errors.
 */
export function getVehicleShareUrl(vehicle: Vehicle): string {
  if (!vehicle) return '';
  const slug = getVehicleSlug(vehicle);
  
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    // Query parameter is universally supported on static hosts without server rewrites
    return `${origin}/?vehicle=${encodeURIComponent(slug)}`;
  }
  
  return `https://jiteautodeals-sable.vercel.app/?vehicle=${encodeURIComponent(slug)}`;
}

/**
 * Gets the clean SEO path format for vehicle links (when server rewrite is configured)
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

// Intelligently format large NGN portfolio value (e.g. ₦850M+, ₦1.5B+, ₦2.3T+)
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
    const val = (Math.floor((totalNGN / 1_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}M+`;
  }
  if (totalNGN >= 1_000) {
    const val = (Math.floor((totalNGN / 1_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}K+`;
  }
  return formatCurrency(totalNGN);
}

/**
 * Decodes all forms of Unicode escape sequences (\uXXXX, \u{XXXXX}, \UXXXXXXXX, \xXX, &#x...;, &#...;)
 * into real, properly rendered Unicode emoji and text characters.
 * Preserves original line breaks, bullet points, and existing UTF-8 characters without double-decoding.
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

  // 4. Hex escape \xB0 (degree symbol, etc.)
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

  // 8. Convert literal \n or \r\n to real newlines if present as escaped character sequences
  res = res.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  return res;
}

/**
 * Normalizes vehicle data by decoding all text fields and descriptions.
 */
export function normalizeVehicleData(vehicle: Vehicle): Vehicle {
  if (!vehicle) return vehicle;
  return {
    ...vehicle,
    make: decodeUnicodeEscapes(vehicle.make),
    model: decodeUnicodeEscapes(vehicle.model),
    dealership: decodeUnicodeEscapes(vehicle.dealership),
    engine: decodeUnicodeEscapes(vehicle.engine),
    color: decodeUnicodeEscapes(vehicle.color),
    condition: decodeUnicodeEscapes(vehicle.condition) as any,
    location: decodeUnicodeEscapes(vehicle.location),
    description: decodeUnicodeEscapes(vehicle.description),
  };
}

// Map of known ImgBB page codes to 100% full original resolution direct CDN URLs
const KNOWN_IMGBB_MAP: Record<string, string> = {
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

// Async helper to resolve ImgBB og:image direct CDN links dynamically via server API
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

// Async fetch vehicles from server with fallback to localStorage
export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch('/api/vehicles?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalizedServer = data.map(normalizeVehicleData);
        const normalizedSeed = INITIAL_VEHICLES.map(normalizeVehicleData);
        
        // Merge any newly introduced INITIAL_VEHICLES that may not be in server response
        const serverIds = new Set(normalizedServer.map(v => v.id));
        const missingSeed = normalizedSeed.filter(v => !serverIds.has(v.id));
        const finalMerged = missingSeed.length > 0 ? [...missingSeed, ...normalizedServer] : normalizedServer;

        try {
          localStorage.removeItem('jite_vehicles_v1');
          localStorage.removeItem('jite_vehicles_v2');
          localStorage.setItem(VEHICLES_KEY, JSON.stringify(finalMerged));
        } catch {}

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: finalMerged }));
        }
        return finalMerged;
      }
    }
  } catch (e) {
    console.warn('Could not fetch vehicles from server, using local storage cache:', e);
  }
  return getVehicles();
}

// Get loaded vehicles from localStorage or seed with automatic seed reconciliation
export function getVehicles(): Vehicle[] {
  try {
    localStorage.removeItem('jite_vehicles_v1');
    localStorage.removeItem('jite_vehicles_v2');
  } catch {
    // ignore
  }
  const normalizedSeed = INITIAL_VEHICLES.map(normalizeVehicleData);
  const data = localStorage.getItem(VEHICLES_KEY);
  if (!data) {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalizedSeed));
    return normalizedSeed;
  }
  try {
    const parsed = JSON.parse(data) as Vehicle[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalizedSeed));
      return normalizedSeed;
    }
    const normalizedParsed = parsed.map(normalizeVehicleData);
    
    // Automatically merge any newly added seed vehicles from INITIAL_VEHICLES that are missing in localStorage
    const existingIds = new Set(normalizedParsed.map(v => v.id));
    const missingSeed = normalizedSeed.filter(v => !existingIds.has(v.id));
    
    if (missingSeed.length > 0) {
      const merged = [...missingSeed, ...normalizedParsed];
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(merged));
      return merged;
    }
    
    return normalizedParsed;
  } catch (e) {
    return normalizedSeed;
  }
}

// Save vehicles to localStorage AND sync to backend server
export function saveVehicles(vehicles: Vehicle[]): void {
  const normalized = vehicles.map(normalizeVehicleData);
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(normalized));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: normalized }));
  }

  // Sync to server asynchronously so all devices see the changes
  fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized)
  }).catch(err => {
    console.error('Failed to sync vehicles to server:', err);
  });
}

// Fetch leads from server
export async function fetchLeads(): Promise<Lead[]> {
  try {
    const res = await fetch('/api/leads?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(LEADS_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // fallback
  }
  return getLeads();
}

// Get leads from localStorage
export function getLeads(): Lead[] {
  const data = localStorage.getItem(LEADS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Save new lead
export function saveLead(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead {
  const leads = getLeads();
  const newLead: Lead = {
    ...lead,
    id: 'lead_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };
  leads.unshift(newLead);
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));

  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leads)
  }).catch(() => {});

  return newLead;
}

// Update lead status/notes
export function updateLead(leadId: string, updates: Partial<Lead>): Lead[] {
  const leads = getLeads();
  const updatedLeads = leads.map(l => l.id === leadId ? { ...l, ...updates } : l);
  localStorage.setItem(LEADS_KEY, JSON.stringify(updatedLeads));

  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedLeads)
  }).catch(() => {});

  return updatedLeads;
}

// Fetch inquiries from server
export async function fetchInquiries(): Promise<Inquiry[]> {
  try {
    const res = await fetch('/api/inquiries?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(INQUIRIES_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // fallback
  }
  return getInquiries();
}

// Get inquiries from localStorage
export function getInquiries(): Inquiry[] {
  const data = localStorage.getItem(INQUIRIES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Save new inquiry
export function saveInquiry(inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'status'>): Inquiry {
  const inquiries = getInquiries();
  const newInquiry: Inquiry = {
    ...inquiry,
    id: 'inq_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };
  inquiries.unshift(newInquiry);
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));

  fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inquiries)
  }).catch(() => {});

  return newInquiry;
}

// Update inquiry status
export function updateInquiry(inquiryId: string, updates: Partial<Inquiry>): Inquiry[] {
  const inquiries = getInquiries();
  const updated = inquiries.map(i => i.id === inquiryId ? { ...i, ...updates } : i);
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));

  fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated)
  }).catch(() => {});

  return updated;
}

// Export prefilled WhatsApp link generator
// Phone Number: 08180823197
// International Format: 2348180823197
const CONSULTANT_PHONE = '2348180823197';

export function getWhatsAppLink(message: string): string {
  return `https://wa.me/${CONSULTANT_PHONE}?text=${encodeURIComponent(message)}`;
}

// Predefined WhatsApp Messages

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

export function getHelpMeFindCarMessage(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): string {
  return (
    `*CUSTOM VEHICLE HUNT REQUEST* 🚗✨\n` +
    `Hello Jite Auto Deals! I need help sourcing a vehicle. Here are my selected preferences:\n\n` +
    `👤 *BUYER INFORMATION:*\n` +
    `• *Full Name:* ${lead.name}\n` +
    `• *Phone Number:* ${lead.phone}\n\n` +
    `🚗 *DESIRED VEHICLE SPECIFICATIONS:*\n` +
    `• *Body Category:* ${lead.vehicleType}\n` +
    `• *Preferred Brand:* ${lead.brand}\n\n` +
    `💳 *ACQUISITION CRITERIA:*\n` +
    `• *Target Budget:* ${formatCurrency(lead.budget)}\n` +
    `• *Payment Strategy:* ${lead.paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n\n` +
    `Please help me find and match a verified vehicle meeting these criteria!`
  );
}
