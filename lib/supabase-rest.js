/**
 * Server-side Supabase REST, Auth, Storage, and Schema Mapping Helpers.
 *
 * Placed outside /api/ intentionally so it does not consume a Vercel Serverless Function slot.
 * NEVER import this module from browser code — it reads SUPABASE_SERVICE_ROLE_KEY from process.env.
 */

function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return (
    /^MY_[A-Z0-9_]+$/i.test(trimmed) ||
    /^your[-_]/i.test(trimmed) ||
    /^https?:\/\/your-project/i.test(trimmed)
  );
}

export function loadSupabaseServerConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const rawAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rawBucket =
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.VITE_SUPABASE_STORAGE_BUCKET ||
    'vehicle-images';

  const url = isPlaceholder(rawUrl) ? '' : rawUrl.trim().replace(/\/+$/, '');
  const anonKey = isPlaceholder(rawAnonKey) ? '' : rawAnonKey.trim();
  const serviceRoleKey = isPlaceholder(rawServiceKey) ? '' : rawServiceKey.trim();
  const storageBucket = (rawBucket || 'vehicle-images').trim() || 'vehicle-images';

  return {
    url,
    anonKey,
    serviceRoleKey,
    storageBucket,
  };
}

export function isSupabaseServerConfigured() {
  const cfg = loadSupabaseServerConfig();
  return Boolean(cfg.url && (cfg.serviceRoleKey || cfg.anonKey));
}

export function hasSupabaseServiceRole() {
  const cfg = loadSupabaseServerConfig();
  return Boolean(cfg.url && cfg.serviceRoleKey);
}

function getPrivilegedHeaders(extraHeaders = {}, accessTokenOverride = '') {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url) {
    throw new Error('SUPABASE_URL is not configured.');
  }
  const apiKey = cfg.serviceRoleKey || cfg.anonKey;
  if (!apiKey) {
    throw new Error('Supabase API key is not configured.');
  }
  const bearer = cfg.serviceRoleKey || accessTokenOverride || cfg.anonKey;
  return {
    apikey: apiKey,
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

function getPublicOrUserHeaders(accessToken = '', extraHeaders = {}) {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey) {
    throw new Error('Supabase URL or anon key is not configured.');
  }
  return {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken || apiKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

export async function supabaseRest(
  tableAndQuery,
  { method = 'GET', body = undefined, headers = {}, accessToken = '', useServiceRole = true } = {}
) {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url) throw new Error('SUPABASE_URL is not configured.');

  const cleanPath = String(tableAndQuery || '').replace(/^\/+/, '');
  const url = `${cfg.url}/rest/v1/${cleanPath}`;
  const reqHeaders = useServiceRole
    ? getPrivilegedHeaders(headers, accessToken)
    : getPublicOrUserHeaders(accessToken, headers);

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;
  const text = await res.text().catch(() => '');
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && (parsed.message || parsed.error_description || parsed.error)) ||
      `Supabase REST ${method} ${cleanPath} failed (${res.status})`;
    const err = new Error(String(msg));
    err.status = res.status;
    err.details = parsed;
    throw err;
  }

  return parsed;
}

// ============================================================================
// SUPABASE AUTH REST HELPERS
// ============================================================================

export async function supabaseAuthSignIn(email, password) {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey) throw new Error('Supabase Auth is not configured.');

  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: String(email || '').trim(),
      password: String(password || ''),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token || !data?.user?.id) {
    const code = data?.error_code || data?.error || data?.msg || 'INVALID_CREDENTIALS';
    const err = new Error(String(data?.error_description || data?.msg || code));
    err.code = String(code);
    err.status = res.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    user: data.user,
  };
}

export async function supabaseAuthRefreshToken(refreshToken) {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey) throw new Error('Supabase Auth is not configured.');

  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: String(refreshToken || '').trim() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token || !data?.user?.id) {
    const err = new Error(String(data?.error_description || data?.msg || 'Session refresh failed.'));
    err.status = res.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    user: data.user,
  };
}

export async function supabaseAuthGetUser(accessToken) {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey || !accessToken) return null;

  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user && user.id ? user : null;
}

export async function supabaseAuthUpdateSelf(accessToken, payload) {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey || !accessToken) throw new Error('Missing Supabase Auth user token.');

  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(String(data?.msg || data?.error_description || data?.error || 'Account update failed.'));
    err.status = res.status;
    err.code = data?.error_code || '';
    throw err;
  }
  return data;
}

export async function supabaseSendPasswordReset(email, redirectTo = '') {
  const cfg = loadSupabaseServerConfig();
  const apiKey = cfg.anonKey || cfg.serviceRoleKey;
  if (!cfg.url || !apiKey) throw new Error('Supabase Auth is not configured.');

  const qs = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const res = await fetch(`${cfg.url}/auth/v1/recover${qs}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: String(email || '').trim() }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(String(data?.msg || data?.error_description || 'Password reset request failed.'));
    err.status = res.status;
    throw err;
  }
  return { email: String(email || '').trim() };
}

export async function supabaseAdminCreateUser({
  email,
  password,
  emailConfirm = true,
  userMetadata = {},
  appMetadata = {},
}) {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin user creation.');
  }

  const res = await fetch(`${cfg.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: String(email || '').trim(),
      password: String(password || ''),
      email_confirm: emailConfirm,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    const err = new Error(String(data?.msg || data?.error_description || data?.error || 'Failed to create Supabase user.'));
    err.status = res.status;
    err.code = data?.error_code || '';
    throw err;
  }
  return data;
}

export async function supabaseAdminUpdateUser(userId, updates) {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin user updates.');
  }

  const res = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(String(data?.msg || data?.error_description || data?.error || 'Failed to update Supabase user.'));
    err.status = res.status;
    err.code = data?.error_code || '';
    throw err;
  }
  return data;
}

// ============================================================================
// SUPABASE STORAGE REST HELPERS (vehicle-images bucket)
// ============================================================================

function encodeStoragePath(objectPath) {
  return String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export function getSupabasePublicObjectUrl(objectPath, bucketOverride = '') {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url) return '';
  const bucket = bucketOverride || cfg.storageBucket || 'vehicle-images';
  return `${cfg.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(objectPath)}`;
}

export function extractSupabaseStoragePathFromUrl(urlStr, expectedBucket = '') {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    const u = new URL(urlStr);
    const marker = '/storage/v1/object/public/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return '';
    const remainder = u.pathname.slice(idx + marker.length);
    const slashIdx = remainder.indexOf('/');
    if (slashIdx <= 0) return '';
    const bucket = decodeURIComponent(remainder.slice(0, slashIdx));
    if (expectedBucket && bucket !== expectedBucket) return '';
    return decodeURIComponent(remainder.slice(slashIdx + 1));
  } catch {
    return '';
  }
}

export async function supabaseStorageCreateSignedUploadUrl(objectPath, bucketOverride = '') {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to issue signed upload URLs.');
  }
  const bucket = bucketOverride || cfg.storageBucket || 'vehicle-images';
  const encodedPath = encodeStoragePath(objectPath);

  const res = await fetch(
    `${cfg.url}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify({}),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    throw new Error(String(data?.message || data?.error || `Failed to create signed upload URL (${res.status})`));
  }

  const signedUrl = data.url.startsWith('http')
    ? data.url
    : `${cfg.url}/storage/v1${data.url.startsWith('/') ? '' : '/'}${data.url}`;

  return {
    bucket,
    path: objectPath,
    token: data.token || '',
    signedUrl,
    publicUrl: getSupabasePublicObjectUrl(objectPath, bucket),
  };
}

export async function supabaseStorageUploadBuffer(
  objectPath,
  buffer,
  contentType = 'image/jpeg',
  bucketOverride = ''
) {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server storage upload.');
  }
  const bucket = bucketOverride || cfg.storageBucket || 'vehicle-images';
  const encodedPath = encodeStoragePath(objectPath);

  const res = await fetch(
    `${cfg.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type': contentType || 'image/jpeg',
        'x-upsert': 'true',
        'cache-control': '31536000',
      },
      body: buffer,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message || data?.error || `Supabase Storage upload failed (${res.status})`));
  }

  return {
    bucket,
    path: objectPath,
    publicUrl: getSupabasePublicObjectUrl(objectPath, bucket),
  };
}

export async function supabaseStorageDeleteObjects(objectPaths = [], bucketOverride = '') {
  const cfg = loadSupabaseServerConfig();
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to delete Supabase Storage objects.');
  }
  const cleanPaths = (Array.isArray(objectPaths) ? objectPaths : [])
    .map((p) => String(p || '').replace(/^\/+/, '').trim())
    .filter(Boolean);
  if (cleanPaths.length === 0) return { deleted: [] };

  const bucket = bucketOverride || cfg.storageBucket || 'vehicle-images';
  const res = await fetch(`${cfg.url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: cleanPaths }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message || data?.error || `Supabase Storage delete failed (${res.status})`));
  }
  return { deleted: cleanPaths, response: data };
}

// ============================================================================
// SCHEMA MAPPERS (Supabase PostgreSQL snake_case <-> Frontend camelCase)
// ============================================================================

export function computeBaseVehicleSlug(v) {
  if (!v) return '';
  if (typeof v.slug === 'string' && v.slug.trim()) {
    return v.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  const raw = `${v.year || ''}-${v.make || ''}-${v.model || ''}`;
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || String(v.id || '').toLowerCase()
  );
}

export function mapVehicleRowToApp(row, linkedImageRows = []) {
  if (!row || typeof row !== 'object') return null;

  const sortedImgRows = Array.isArray(linkedImageRows)
    ? [...linkedImageRows].sort((a, b) => (a.position || 0) - (b.position || 0))
    : [];

  const rowImages = Array.isArray(row.images) ? row.images.filter((u) => typeof u === 'string' && u.trim()) : [];
  const mergedImages =
    rowImages.length > 0
      ? rowImages
      : sortedImgRows.map((img) => img.secure_url).filter((u) => typeof u === 'string' && u.trim());

  let imageMetadata = Array.isArray(row.image_metadata) ? row.image_metadata : [];
  if (imageMetadata.length === 0 && sortedImgRows.length > 0) {
    imageMetadata = sortedImgRows.map((img, idx) => ({
      vehicleId: img.vehicle_id || row.id,
      publicId: img.public_id || img.storage_path || '',
      storageBucket: img.storage_bucket || undefined,
      storagePath: img.storage_path || undefined,
      secureUrl: img.secure_url,
      position: img.position || idx + 1,
      isCover: Boolean(img.is_cover || idx === 0),
      uploadedAt: img.uploaded_at || row.updated_at || new Date().toISOString(),
      ...(typeof img.width === 'number' ? { width: img.width } : {}),
      ...(typeof img.height === 'number' ? { height: img.height } : {}),
      ...(typeof img.bytes === 'number' ? { bytes: img.bytes } : {}),
      ...(img.format ? { format: img.format } : {}),
      ...(img.angle_tag ? { angleTag: img.angle_tag } : {}),
    }));
  }

  return {
    id: String(row.id),
    slug: row.slug || undefined,
    make: String(row.make || ''),
    model: String(row.model || ''),
    year: Number(row.year) || 2020,
    price: Number(row.price) || 0,
    ...(typeof row.mileage === 'number' && row.mileage > 0 ? { mileage: Number(row.mileage) } : {}),
    transmission: row.transmission || 'Automatic',
    fuelType: row.fuel_type || 'Petrol',
    bodyType: row.body_type || 'SUV',
    location: row.location || '',
    ...(row.dealership ? { dealership: row.dealership } : {}),
    ...(row.duty_status ? { dutyStatus: row.duty_status } : {}),
    ...(Array.isArray(row.key_features) && row.key_features.length > 0 ? { keyFeatures: row.key_features } : {}),
    images: mergedImages,
    ...(imageMetadata.length > 0 ? { imageMetadata } : {}),
    description: row.description || '',
    ...(row.engine ? { engine: row.engine } : {}),
    color: row.color || '',
    condition: row.condition || 'Foreign Used',
    isFeatured: row.is_featured !== false,
    inSlideshow: Boolean(row.in_slideshow),
    slideshowOrder: Number(row.slideshow_order) || 0,
    status: row.status || 'Available',
    ...(row.model_3d_url ? { model3dUrl: row.model_3d_url } : {}),
    ...(Array.isArray(row.frames_360) && row.frames_360.length > 0 ? { frames360: row.frames_360 } : {}),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function mapAppVehicleToRow(vehicle) {
  const nowIso = new Date().toISOString();
  const cleanImages = Array.isArray(vehicle.images)
    ? vehicle.images.filter((u) => typeof u === 'string' && u.trim())
    : [];
  const cleanMeta = Array.isArray(vehicle.imageMetadata) ? vehicle.imageMetadata : [];

  return {
    id: String(vehicle.id).trim(),
    slug: computeBaseVehicleSlug(vehicle) || null,
    make: String(vehicle.make || '').trim() || 'Vehicle',
    model: String(vehicle.model || '').trim() || 'Model',
    year: Math.min(2100, Math.max(1970, Number(vehicle.year) || 2020)),
    price: Math.max(0, Number(vehicle.price) || 0),
    mileage:
      typeof vehicle.mileage === 'number' && Number.isFinite(vehicle.mileage) && vehicle.mileage >= 0
        ? Math.round(vehicle.mileage)
        : null,
    transmission: vehicle.transmission ? String(vehicle.transmission) : 'Automatic',
    fuel_type: vehicle.fuelType ? String(vehicle.fuelType) : 'Petrol',
    body_type: vehicle.bodyType ? String(vehicle.bodyType) : 'SUV',
    location: vehicle.location ? String(vehicle.location) : '',
    dealership: vehicle.dealership ? String(vehicle.dealership) : null,
    duty_status: vehicle.dutyStatus ? String(vehicle.dutyStatus) : null,
    key_features: Array.isArray(vehicle.keyFeatures) ? vehicle.keyFeatures : [],
    images: cleanImages,
    image_metadata: cleanMeta,
    description: vehicle.description ? String(vehicle.description) : '',
    engine: vehicle.engine ? String(vehicle.engine) : null,
    color: vehicle.color ? String(vehicle.color) : '',
    condition: vehicle.condition ? String(vehicle.condition) : 'Foreign Used',
    is_featured: vehicle.isFeatured !== false,
    in_slideshow: Boolean(vehicle.inSlideshow),
    slideshow_order: Number.isFinite(Number(vehicle.slideshowOrder)) ? Math.round(Number(vehicle.slideshowOrder)) : 0,
    status: vehicle.status || 'Available',
    model_3d_url: vehicle.model3dUrl ? String(vehicle.model3dUrl) : null,
    frames_360: Array.isArray(vehicle.frames360) ? vehicle.frames360 : [],
    created_at: vehicle.createdAt || nowIso,
    updated_at: vehicle.updatedAt || nowIso,
  };
}

export function buildVehicleImageRows(vehicle) {
  const cfg = loadSupabaseServerConfig();
  const imgs = Array.isArray(vehicle?.images)
    ? vehicle.images.filter((u) => typeof u === 'string' && u.trim())
    : [];
  const metaList = Array.isArray(vehicle?.imageMetadata) ? vehicle.imageMetadata : [];
  const metaByUrl = new Map();
  for (const m of metaList) {
    if (m && typeof m.secureUrl === 'string' && m.secureUrl.trim()) {
      metaByUrl.set(m.secureUrl.trim(), m);
    }
  }

  const seenUrls = new Set();
  const rows = [];
  imgs.forEach((rawUrl) => {
    const url = rawUrl.trim();
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);

    const meta = metaByUrl.get(url);
    const extractedStoragePath = extractSupabaseStoragePathFromUrl(url);
    rows.push({
      vehicle_id: String(vehicle.id).trim(),
      storage_bucket:
        meta?.storageBucket || (extractedStoragePath ? cfg.storageBucket : null),
      storage_path: meta?.storagePath || extractedStoragePath || null,
      public_id: meta?.publicId || extractedStoragePath || null,
      secure_url: url,
      position: rows.length + 1,
      is_cover: rows.length === 0,
      width: typeof meta?.width === 'number' ? Math.round(meta.width) : null,
      height: typeof meta?.height === 'number' ? Math.round(meta.height) : null,
      bytes: typeof meta?.bytes === 'number' ? Math.round(meta.bytes) : null,
      format: meta?.format || null,
      angle_tag: meta?.angleTag || null,
      uploaded_at: meta?.uploadedAt || new Date().toISOString(),
    });
  });

  return rows;
}

export function mapEnquiryRowToApp(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: String(row.id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    vehicleType: String(row.vehicle_type || ''),
    budget: Number(row.budget) || 0,
    brand: String(row.brand || ''),
    ...(row.model ? { model: row.model } : {}),
    ...(row.location ? { location: row.location } : {}),
    paymentMethod: row.payment_method || 'Cash',
    ...(row.requirements ? { requirements: row.requirements } : {}),
    type: row.type || 'find_car',
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.source_image ? { sourceImage: row.source_image } : {}),
    createdAt: row.created_at || new Date().toISOString(),
    status: row.status || 'New',
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.ai_summary ? { aiSummary: row.ai_summary } : {}),
    ...(row.whatsapp_handoff ? { whatsappHandoff: Boolean(row.whatsapp_handoff) } : {}),
  };
}

export function mapAppLeadToEnquiryRow(lead) {
  const nowIso = new Date().toISOString();
  return {
    id: String(lead.id).trim(),
    name: String(lead.name || '').trim().slice(0, 160),
    phone: String(lead.phone || '').trim().slice(0, 40),
    vehicle_type: lead.vehicleType ? String(lead.vehicleType) : '',
    budget: Math.max(0, Number(lead.budget) || 0),
    brand: lead.brand ? String(lead.brand) : '',
    model: lead.model ? String(lead.model) : null,
    location: lead.location ? String(lead.location) : null,
    payment_method: lead.paymentMethod ? String(lead.paymentMethod) : 'Cash',
    requirements: lead.requirements ? String(lead.requirements) : null,
    type: lead.type || 'find_car',
    source_url: lead.sourceUrl ? String(lead.sourceUrl) : null,
    source_image: lead.sourceImage ? String(lead.sourceImage) : null,
    status: lead.status || 'New',
    notes: lead.notes ? String(lead.notes) : null,
    source: lead.source ? String(lead.source) : null,
    ai_summary: lead.aiSummary ? String(lead.aiSummary) : null,
    whatsapp_handoff: Boolean(lead.whatsappHandoff),
    created_at: lead.createdAt || nowIso,
    updated_at: lead.updatedAt || nowIso,
  };
}

export function mapBookingRowToApp(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: String(row.id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    vehicleId: String(row.vehicle_id || ''),
    vehicleName: String(row.vehicle_name || ''),
    ...(typeof row.vehicle_price === 'number' || row.vehicle_price !== null
      ? { vehiclePrice: Number(row.vehicle_price) || 0 }
      : {}),
    ...(row.vehicle_location ? { vehicleLocation: row.vehicle_location } : {}),
    ...(typeof row.budget === 'number' || row.budget !== null ? { budget: Number(row.budget) || 0 } : {}),
    ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
    ...(row.ready_to_buy ? { readyToBuy: row.ready_to_buy } : {}),
    ...(row.preferred_contact ? { preferredContact: row.preferred_contact } : {}),
    ...(row.message ? { message: row.message } : {}),
    ...(row.preferred_date ? { preferredDate: row.preferred_date } : {}),
    ...(row.preferred_time ? { preferredTime: row.preferred_time } : {}),
    ...(row.type ? { type: row.type } : {}),
    createdAt: row.created_at || new Date().toISOString(),
    status: row.status || 'New',
  };
}

export function mapAppInquiryToBookingRow(inq) {
  const nowIso = new Date().toISOString();
  return {
    id: String(inq.id).trim(),
    name: String(inq.name || '').trim().slice(0, 160),
    phone: String(inq.phone || '').trim().slice(0, 40),
    vehicle_id: inq.vehicleId ? String(inq.vehicleId).trim() : null,
    vehicle_name: inq.vehicleName ? String(inq.vehicleName) : '',
    vehicle_price:
      inq.vehiclePrice !== undefined && inq.vehiclePrice !== null ? Number(inq.vehiclePrice) || 0 : null,
    vehicle_location: inq.vehicleLocation ? String(inq.vehicleLocation) : null,
    budget: inq.budget !== undefined && inq.budget !== null ? Number(inq.budget) || 0 : null,
    payment_method: inq.paymentMethod ? String(inq.paymentMethod) : null,
    ready_to_buy: inq.readyToBuy ? String(inq.readyToBuy) : null,
    preferred_contact: inq.preferredContact ? String(inq.preferredContact) : 'WhatsApp',
    message: inq.message ? String(inq.message) : null,
    preferred_date: inq.preferredDate ? String(inq.preferredDate) : null,
    preferred_time: inq.preferredTime ? String(inq.preferredTime) : null,
    type: inq.type || 'inspection',
    status: inq.status || 'New',
    created_at: inq.createdAt || nowIso,
    updated_at: inq.updatedAt || nowIso,
  };
}
