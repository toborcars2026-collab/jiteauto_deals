import { Vehicle } from './types';
import { getVehicleSlug, getImageUrl, decodeUnicodeEscapes, formatCurrency } from './utils';

export interface PageMetadata {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  siteName: string;
  locale: string;
  twitterCard: 'summary_large_image' | 'summary';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  canonicalUrl: string;
  keywords?: string;
  vehicle?: Vehicle | null;
}

export const DEFAULT_BRAND_IMAGE = 'https://i.ibb.co/3LhGjDm/IMG-20260824-WA0035.jpg';
export const DEFAULT_SITE_NAME = 'Jite Auto Deals';
export const DEFAULT_LOCALE = 'en_NG';
export const DEFAULT_BASE_URL = 'https://jiteautodeals-sable.vercel.app';

/**
 * Generates dynamic Open Graph and Twitter metadata for an individual vehicle listing.
 */
export function generateVehicleMetadata(
  vehicle: Vehicle,
  baseUrl = DEFAULT_BASE_URL,
  requestUrl?: string
): PageMetadata {
  const cleanBase = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const slug = getVehicleSlug(vehicle);
  const formattedPrice = formatCurrency(vehicle.price || 0);

  // Exact vehicle name and price in title
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${formattedPrice} | Jite Auto Deals`;

  // Rich, informative vehicle description for preview cards
  const condition = vehicle.condition || 'Foreign Used (Tokunbo)';
  const location = vehicle.location || 'Abuja / Lagos';
  const transmission = vehicle.transmission || 'Automatic';
  
  let rawDesc = decodeUnicodeEscapes(vehicle.description || '')
    .replace(/🚘|📋|✨|⭐|🇧🇪|🇳🇬|📍|💰|🛋️|🪵|📱|🎛️|🔑|❄️|⚙️|☕|📅|🩶|🖤|🤍|📑|☀️|🔧/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract first meaningful sentences from description
  const cleanSnippet = rawDesc.length > 120 ? `${rawDesc.slice(0, 120)}...` : rawDesc;

  const description = `${vehicle.year} ${vehicle.make} ${vehicle.model} available in ${location}, Nigeria. Listed Price: ${formattedPrice} • Condition: ${condition} • Transmission: ${transmission}.${cleanSnippet ? ` ${cleanSnippet}` : ''} Verified & inspected by Tobor Jite.`;

  // Exact main vehicle image (or fallback to high-res brand banner if missing)
  const rawImage = vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : '';
  const image = getImageUrl(rawImage) || DEFAULT_BRAND_IMAGE;

  // Canonical vehicle page URL
  const canonicalUrl = `${cleanBase}/vehicles/${encodeURIComponent(slug)}`;
  const displayUrl = requestUrl || canonicalUrl;

  return {
    title,
    description,
    image,
    url: displayUrl,
    type: 'website',
    siteName: DEFAULT_SITE_NAME,
    locale: DEFAULT_LOCALE,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    canonicalUrl,
    keywords: `${vehicle.year} ${vehicle.make} ${vehicle.model}, buy ${vehicle.make} ${vehicle.model} Nigeria, ${vehicle.make} for sale ${location}, ${condition} cars Nigeria, Jite Auto Deals`,
    vehicle,
  };
}

/**
 * Generates Open Graph and Twitter metadata for public non-vehicle pages.
 */
export function generateTabMetadata(
  tab: string,
  baseUrl = DEFAULT_BASE_URL,
  requestUrl?: string
): PageMetadata {
  const cleanBase = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const cleanTab = (tab || 'home').toLowerCase().replace(/^\/+/, '');

  switch (cleanTab) {
    case 'browse':
    case 'inventory':
    case 'catalog':
    case 'cars': {
      const title = 'Verified Vehicle Catalog & Inventory | Jite Auto Deals';
      const description = 'Browse inspected, duty-paid foreign used (Tokunbo) and verified Nigerian used vehicles in Lagos and Abuja. Sourced and vetted by Jite Auto Deals.';
      const url = requestUrl || `${cleanBase}/browse`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/browse`,
        keywords: 'buy car Nigeria, foreign used cars Lagos, Tokunbo cars Abuja, verified vehicle catalog, Toyota, Mercedes-Benz, Lexus, Jite Auto Deals',
      };
    }

    case 'find-car':
    case 'find-my-car': {
      const title = 'Find My Car | Custom Vehicle Specification Finder - Jite Auto Deals';
      const description = 'Specify your exact vehicle brand, model, target budget, and condition. We source verified vehicles directly across Lagos and Abuja.';
      const url = requestUrl || `${cleanBase}/find-car`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/find-car`,
        keywords: 'vehicle finder Nigeria, car sourcing request Lagos Abuja, custom vehicle inspection, Jite Auto Deals',
      };
    }

    case 'source-car':
    case 'source-a-car': {
      const title = 'Source a Car | External Listing Verification - Jite Auto Deals';
      const description = 'Found a car online or at another dealership? Send us the link or details for complete verification, duty check, and physical pre-purchase inspection.';
      const url = requestUrl || `${cleanBase}/source-car`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/source-car`,
        keywords: 'car verification Nigeria, pre-purchase car inspection Lagos, customs duty verification, Tobor Jite, Jite Auto Deals',
      };
    }

    case 'how-it-works': {
      const title = 'How It Works & Vehicle Finance | Jite Auto Deals';
      const description = 'Learn how our personalized vehicle sourcing, pre-purchase inspection, and auto finance partnership programs work in Nigeria.';
      const url = requestUrl || `${cleanBase}/how-it-works`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/how-it-works`,
        keywords: 'car financing Nigeria, vehicle purchase process, car inspection steps, Jite Auto Deals',
      };
    }

    case 'about': {
      const title = 'About Tobor Jite | Jite Auto Deals - Vehicle Consultant';
      const description = 'Meet Tobor Jite, dedicated vehicle consultant and sourcing specialist in Nigeria helping individuals and corporate clients buy quality cars with total confidence.';
      const url = requestUrl || `${cleanBase}/about`;
      return {
        title,
        description,
        image: 'https://i.ibb.co/3LhGjDm/IMG-20260824-WA0035.jpg',
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: 'https://i.ibb.co/3LhGjDm/IMG-20260824-WA0035.jpg',
        canonicalUrl: `${cleanBase}/about`,
        keywords: 'Tobor Jite, vehicle consultant Nigeria, automotive sourcing consultant Lagos Abuja, Jite Auto Deals founder',
      };
    }

    case 'admin': {
      const title = 'Admin Portal | Jite Auto Deals';
      const description = 'Secure administration management portal for Jite Auto Deals inventory, leads, and inquiries.';
      const url = requestUrl || `${cleanBase}/admin`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/admin`,
      };
    }

    case 'home':
    default: {
      const title = 'Jite Auto Deals | Trusted Vehicle Consultant';
      const description = 'Connect with trusted car companies and verified dealerships in Nigeria. Find quality vehicles, get expert guidance, and buy with confidence.';
      const url = requestUrl || `${cleanBase}/`;
      return {
        title,
        description,
        image: DEFAULT_BRAND_IMAGE,
        url,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: DEFAULT_BRAND_IMAGE,
        canonicalUrl: `${cleanBase}/`,
        keywords: 'Jite Auto Deals, vehicle consultant Nigeria, car dealer Lagos, car dealer Abuja, buy foreign used cars Nigeria, buy Tokunbo cars, Toyota, Mercedes-Benz, Lexus, Honda, vehicle inspection Nigeria',
      };
    }
  }
}

/**
 * Universal route resolver that parses URL path and queries and finds the matching page or vehicle.
 */
export function resolveRouteMetadata(
  urlOrPath: string,
  vehicles: Vehicle[],
  customBaseUrl?: string
): PageMetadata {
  let parsedUrl: URL;
  const baseUrl = customBaseUrl || DEFAULT_BASE_URL;

  try {
    parsedUrl = new URL(urlOrPath, baseUrl);
  } catch {
    parsedUrl = new URL(`/${urlOrPath.replace(/^\/+/, '')}`, baseUrl);
  }

  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // 1. Check for Vehicle Route in Path: /vehicles/:slug or /car/:slug or /v/:slug
  let vehicleIdentifier: string | null = null;
  if (pathname.startsWith('/vehicles/')) {
    vehicleIdentifier = pathname.replace(/^\/vehicles\/?/, '');
  } else if (pathname.startsWith('/car/')) {
    vehicleIdentifier = pathname.replace(/^\/car\/?/, '');
  } else if (pathname.startsWith('/v/')) {
    vehicleIdentifier = pathname.replace(/^\/v\/?/, '');
  }

  // 2. Check for Vehicle Route in Query: ?vehicle=:slug or ?v=:slug
  if (!vehicleIdentifier) {
    vehicleIdentifier = searchParams.get('vehicle') || searchParams.get('v');
  }

  // If a vehicle identifier was extracted, search the active catalogue
  if (vehicleIdentifier) {
    const cleanId = decodeURIComponent(vehicleIdentifier).toLowerCase().trim().replace(/\/+$/, '');
    
    // Search exact ID, exact slug, or normalized alphanumeric
    const matched = vehicles.find((v) => {
      if (!v) return false;
      const vId = (v.id || '').toLowerCase().trim();
      if (vId === cleanId) return true;

      const slug = getVehicleSlug(v);
      if (slug === cleanId) return true;

      const cleanSlugNoDash = slug.replace(/[^a-z0-9]/g, '');
      const cleanIdNoDash = cleanId.replace(/[^a-z0-9]/g, '');
      if (cleanSlugNoDash === cleanIdNoDash && cleanSlugNoDash.length > 3) return true;

      const modelAlpha = (v.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const makeAlpha = (v.make || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (modelAlpha && makeAlpha && cleanIdNoDash.includes(modelAlpha) && cleanIdNoDash.includes(makeAlpha)) {
        return true;
      }

      return false;
    });

    if (matched) {
      return generateVehicleMetadata(matched, baseUrl, parsedUrl.toString());
    }
  }

  // 3. Check for specific page paths or ?tab= query
  const tabQuery = searchParams.get('tab');
  if (tabQuery) {
    return generateTabMetadata(tabQuery, baseUrl, parsedUrl.toString());
  }

  const cleanPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  if (cleanPath) {
    return generateTabMetadata(cleanPath, baseUrl, parsedUrl.toString());
  }

  // 4. Default: Homepage
  return generateTabMetadata('home', baseUrl, parsedUrl.toString());
}

/**
 * Injects Open Graph, Twitter, and canonical metadata tags cleanly into the HTML head,
 * eliminating duplicates or stale tags.
 */
export function injectMetadataIntoHtml(html: string, meta: PageMetadata): string {
  if (!html) return html;

  // Escape HTML entities in text fields to prevent broken tags
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
  const safeUrl = escapeAttr(meta.url);
  const safeCanonical = escapeAttr(meta.canonicalUrl || meta.url);
  const safeSiteName = escapeAttr(meta.siteName || DEFAULT_SITE_NAME);
  const safeLocale = escapeAttr(meta.locale || DEFAULT_LOCALE);
  const safeKeywords = meta.keywords ? escapeAttr(meta.keywords) : '';

  // Generate comprehensive Open Graph, Twitter, and SEO tags
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
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="${meta.twitterCard || 'summary_large_image'}" />
    <meta name="twitter:url" content="${safeUrl}" />
    <meta name="twitter:title" content="${escapeAttr(meta.twitterTitle || meta.title)}" />
    <meta name="twitter:description" content="${escapeAttr(meta.twitterDescription || meta.description)}" />
    <meta name="twitter:image" content="${escapeAttr(meta.twitterImage || meta.image)}" />
    <meta name="twitter:image:alt" content="${safeTitle}" />`;

  // Remove existing title, canonical, and conflicting og/twitter tags in the HTML
  let cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']title["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']keywords["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, '');

  // Inject the new meta tags right after <head>
  if (cleaned.includes('<head>')) {
    return cleaned.replace('<head>', `<head>${newMetaBlock}`);
  }
  if (cleaned.includes('<head ')) {
    return cleaned.replace(/<head[^>]*>/, `$&${newMetaBlock}`);
  }

  // Fallback: place before closing head
  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', `${newMetaBlock}\n  </head>`);
  }

  return `${newMetaBlock}\n${cleaned}`;
}

/**
 * Synchronizes client-side DOM meta tags when navigating dynamically in the browser SPA.
 */
export function updateClientMeta(meta: PageMetadata): void {
  if (typeof document === 'undefined') return;

  // 1. Update Title
  document.title = meta.title;

  const setOrCreateMeta = (selector: string, attrName: string, attrValue: string, content: string) => {
    let el = document.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // 2. Standard Meta Tags
  setOrCreateMeta('meta[name="title"]', 'name', 'title', meta.title);
  setOrCreateMeta('meta[name="description"]', 'name', 'description', meta.description);

  // 3. Open Graph Tags
  setOrCreateMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setOrCreateMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setOrCreateMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
  setOrCreateMeta('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', meta.image);
  setOrCreateMeta('meta[property="og:url"]', 'property', 'og:url', meta.url);
  setOrCreateMeta('meta[property="og:type"]', 'property', 'og:type', meta.type || 'website');
  setOrCreateMeta('meta[property="og:site_name"]', 'property', 'og:site_name', meta.siteName || DEFAULT_SITE_NAME);
  setOrCreateMeta('meta[property="og:locale"]', 'property', 'og:locale', meta.locale || DEFAULT_LOCALE);

  // 4. Twitter Tags
  setOrCreateMeta('meta[name="twitter:card"]', 'name', 'twitter:card', meta.twitterCard || 'summary_large_image');
  setOrCreateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.twitterTitle || meta.title);
  setOrCreateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.twitterDescription || meta.description);
  setOrCreateMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.twitterImage || meta.image);
  setOrCreateMeta('meta[name="twitter:url"]', 'name', 'twitter:url', meta.url);

  // 5. Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonicalUrl || meta.url);
}
