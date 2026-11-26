import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AdminAuditLogEntry } from '../types';
import { getActiveAdminBearerToken } from './adminAuth';

export interface RecordAuditInput {
  action: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
  authMethod?: string;
}

/**
 * Writes an immutable administrator security or operational audit event to Firestore
 * when a Firebase Admin user is active. Skips silently in standalone server auth mode.
 */
export async function recordAdminAuditLog(input: RecordAuditInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'admin_audit_logs'), {
      action: input.action.slice(0, 100),
      actorUid: user.uid,
      actorEmail: user.email || '',
      status: input.status,
      details: input.details.slice(0, 500),
      authMethod: input.authMethod || user.providerData?.[0]?.providerId || 'unknown',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[Admin Audit Log Notice]:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Fetches server security logs and (when Firebase Auth is active) Firestore audit logs.
 */
export async function fetchAdminAuditLogs(maxEntries = 50): Promise<AdminAuditLogEntry[]> {
  const results: AdminAuditLogEntry[] = [];

  if (auth.currentUser) {
    try {
      const q = query(
        collection(db, 'admin_audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(maxEntries)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        let isoTime = new Date().toISOString();
        if (data.timestamp instanceof Timestamp) {
          isoTime = data.timestamp.toDate().toISOString();
        } else if (typeof data.timestamp === 'string') {
          isoTime = data.timestamp;
        }

        results.push({
          id: docSnap.id,
          action: String(data.action || 'ADMIN_EVENT'),
          actorUid: String(data.actorUid || ''),
          actorEmail: typeof data.actorEmail === 'string' ? data.actorEmail : undefined,
          status: (data.status as AdminAuditLogEntry['status']) || 'success',
          details: String(data.details || ''),
          authMethod: typeof data.authMethod === 'string' ? data.authMethod : undefined,
          timestamp: isoTime,
          source: 'firestore',
        });
      });
    } catch {
      // Non-blocking fallback
    }
  }

  try {
    const token = await getActiveAdminBearerToken();
    if (token) {
      const res = await fetch('/api/admin-auth?action=security-events', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          data.events.forEach((ev: any) => {
            results.push({
              id: String(ev.id || `sec_${Math.random().toString(36).slice(2)}`),
              action: String(ev.action || 'SECURITY_EVENT'),
              actorUid: String(ev.ipTag || 'network'),
              actorEmail: typeof ev.actorEmailMasked === 'string' ? ev.actorEmailMasked : undefined,
              status: (ev.status as AdminAuditLogEntry['status']) || 'warning',
              details: String(ev.details || ''),
              authMethod: 'server-security',
              timestamp: String(ev.timestamp || new Date().toISOString()),
              source: 'security-server',
            });
          });
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
