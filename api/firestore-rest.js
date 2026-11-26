import fs from 'fs';
import path from 'path';

const DEFAULT_PROJECT_ID = 'gen-lang-client-0327661147';
const DEFAULT_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';

let cachedRuntimeConfig = null;

export function loadFirebaseRuntimeConfig() {
  if (cachedRuntimeConfig) return cachedRuntimeConfig;

  let fileCfg = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) || {};
    }
  } catch {
    // Fallback to environment/defaults
  }

  cachedRuntimeConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || fileCfg.projectId || DEFAULT_PROJECT_ID,
    databaseId:
      process.env.FIRESTORE_DATABASE_ID || fileCfg.firestoreDatabaseId || DEFAULT_DATABASE_ID,
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || fileCfg.apiKey || '',
    authDomain: fileCfg.authDomain || `${DEFAULT_PROJECT_ID}.firebaseapp.com`,
  };
  return cachedRuntimeConfig;
}

export function getFirestoreBaseUrl() {
  const { projectId, databaseId } = loadFirebaseRuntimeConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
}

export function toFirestoreValue(val) {
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { doubleValue: 0 };
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    const values = [];
    for (const item of val) {
      if (item !== undefined) {
        values.push(toFirestoreValue(item));
      }
    }
    return { arrayValue: { values } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj) {
  const fields = {};
  if (!obj || typeof obj !== 'object') return fields;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

export function fromFirestoreValue(val) {
  if (!val || typeof val !== 'object') return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const raw = val.arrayValue?.values;
    return Array.isArray(raw) ? raw.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue?.fields || {});
  }
  return undefined;
}

export function fromFirestoreFields(fields) {
  const out = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const [k, v] of Object.entries(fields)) {
    const converted = fromFirestoreValue(v);
    if (converted !== undefined) {
      out[k] = converted;
    }
  }
  return out;
}

export function firestoreDocToJs(doc) {
  if (!doc || typeof doc !== 'object' || !doc.name) return null;
  const docId = String(doc.name).split('/').pop() || '';
  const data = fromFirestoreFields(doc.fields || {});
  return {
    ...data,
    id: data.id || docId,
    _docId: docId,
  };
}

function encodeDocPath(docPath) {
  return String(docPath)
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export async function firestoreGetDocument(docPath, idToken = '') {
  const baseUrl = getFirestoreBaseUrl();
  const url = `${baseUrl}/${encodeDocPath(docPath)}`;
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Firestore GET ${docPath} failed (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return firestoreDocToJs(json);
}

export async function firestorePatchDocument(docPath, data, idToken, mergeFields = null) {
  const baseUrl = getFirestoreBaseUrl();
  let url = `${baseUrl}/${encodeDocPath(docPath)}`;
  if (Array.isArray(mergeFields) && mergeFields.length > 0) {
    const params = new URLSearchParams();
    for (const field of mergeFields) {
      params.append('updateMask.fieldPaths', field);
    }
    url += `?${params.toString()}`;
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const cleanData = { ...data };
  delete cleanData._docId;

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: toFirestoreFields(cleanData) }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Firestore PATCH ${docPath} failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  return firestoreDocToJs(json);
}

export async function firestoreCreateDocument(collectionId, data, idToken) {
  const baseUrl = getFirestoreBaseUrl();
  const url = `${baseUrl}/${encodeURIComponent(collectionId)}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const cleanData = { ...data };
  delete cleanData._docId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fields: toFirestoreFields(cleanData) }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Firestore CREATE ${collectionId} failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  return firestoreDocToJs(json);
}

export async function firestoreDeleteDocument(docPath, idToken) {
  const baseUrl = getFirestoreBaseUrl();
  const url = `${baseUrl}/${encodeDocPath(docPath)}`;
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url, { method: 'DELETE', headers });
  if (res.status === 404) return { ok: true };
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson?.error?.message || `Firestore DELETE ${docPath} failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return { ok: true };
}

export async function firestoreQueryCollection(
  collectionId,
  { idToken = '', orderByField = '', orderDirection = 'DESCENDING', limitCount = 0 } = {}
) {
  const baseUrl = getFirestoreBaseUrl();
  const url = `${baseUrl}:runQuery`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const run = async (withOrder) => {
    const structuredQuery = {
      from: [{ collectionId }],
    };
    if (withOrder && orderByField) {
      structuredQuery.orderBy = [{ field: { fieldPath: orderByField }, direction: orderDirection }];
    }
    if (limitCount > 0) {
      structuredQuery.limit = limitCount;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Firestore query ${collectionId} failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const rows = await res.json();
    const docs = [];
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row?.document) {
          const parsed = firestoreDocToJs(row.document);
          if (parsed) docs.push(parsed);
        }
      }
    }
    return docs;
  };

  try {
    return await run(Boolean(orderByField));
  } catch (err) {
    if (orderByField && err?.status !== 401 && err?.status !== 403) {
      const fallbackDocs = await run(false);
      return fallbackDocs.sort((a, b) => {
        const va = String(a?.[orderByField] || '');
        const vb = String(b?.[orderByField] || '');
        return orderDirection === 'ASCENDING' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    throw err;
  }
}

// ============================================================================
// FIREBASE IDENTITY TOOLKIT REST HELPERS (SERVER-SIDE AUTH SYNCHRONIZATION)
// ============================================================================

export async function firebaseAuthSignInWithPassword(email, password) {
  const { apiKey } = loadFirebaseRuntimeConfig();
  if (!apiKey) {
    throw new Error('Firebase API key not available.');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(email).trim(),
        password: String(password),
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.idToken) {
    const code = data?.error?.message || 'INVALID_LOGIN_CREDENTIALS';
    const err = new Error(code);
    err.code = code;
    throw err;
  }

  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
    uid: data.localId,
    email: data.email || String(email).trim(),
    displayName: data.displayName || '',
  };
}

export async function firebaseAuthUpdateAccount({ idToken, password, email, displayName }) {
  const { apiKey } = loadFirebaseRuntimeConfig();
  if (!apiKey) throw new Error('Firebase API key not available.');

  const payload = {
    idToken,
    returnSecureToken: true,
  };
  if (password) payload.password = password;
  if (email) payload.email = email;
  if (displayName) payload.displayName = displayName;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.message || 'UPDATE_FAILED';
    const err = new Error(code);
    err.code = code;
    throw err;
  }

  return {
    idToken: data.idToken || idToken,
    refreshToken: data.refreshToken || '',
    expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
    uid: data.localId,
    email: data.email || email || '',
    displayName: data.displayName || displayName || '',
  };
}

export async function firebaseAuthRefreshToken(refreshToken) {
  const { apiKey } = loadFirebaseRuntimeConfig();
  if (!apiKey) throw new Error('Firebase API key not available.');

  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(refreshToken),
      }).toString(),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id_token) {
    const code = data?.error?.message || 'TOKEN_REFRESH_FAILED';
    const err = new Error(code);
    err.code = code;
    throw err;
  }

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    uid: data.user_id,
  };
}

export async function firebaseAuthSendPasswordReset(email) {
  const { apiKey } = loadFirebaseRuntimeConfig();
  if (!apiKey) throw new Error('Firebase API key not available.');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: String(email).trim(),
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.message || 'RESET_FAILED';
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return { email: data.email || email };
}

export async function firebaseAuthLookup(idToken) {
  const { apiKey } = loadFirebaseRuntimeConfig();
  if (!apiKey) throw new Error('Firebase API key not available.');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data?.users) || data.users.length === 0) {
    return null;
  }
  return data.users[0];
}
