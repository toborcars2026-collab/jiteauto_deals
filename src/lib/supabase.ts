import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function isPlaceholder(val: unknown): boolean {
  if (typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return (
    /^MY_[A-Z0-9_]+$/i.test(trimmed) ||
    /^your[-_]/i.test(trimmed) ||
    /^https?:\/\/your-project/i.test(trimmed)
  );
}

const rawSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
const rawStorageBucket = (import.meta as any).env?.VITE_SUPABASE_STORAGE_BUCKET;

export const SUPABASE_URL = isPlaceholder(rawSupabaseUrl)
  ? ''
  : String(rawSupabaseUrl).trim().replace(/\/+$/, '');

export const SUPABASE_ANON_KEY = isPlaceholder(rawSupabaseAnonKey)
  ? ''
  : String(rawSupabaseAnonKey).trim();

export const SUPABASE_STORAGE_BUCKET =
  !isPlaceholder(rawStorageBucket) && String(rawStorageBucket).trim()
    ? String(rawStorageBucket).trim()
    : 'vehicle-images';

export function isSupabaseClientConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseStorageBucket(): string {
  return SUPABASE_STORAGE_BUCKET;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseClientConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });
  }
  return cachedClient;
}

export async function setSupabaseClientSession(
  accessToken?: string | null,
  refreshToken?: string | null
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !accessToken) return;
  try {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || accessToken,
    });
  } catch {
    // Non-blocking: admin writes also route through verified backend API endpoints
  }
}

export async function clearSupabaseClientSession(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // Non-blocking
  }
}
