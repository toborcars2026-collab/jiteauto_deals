import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
  linkWithCredential,
  linkWithPopup,
  unlink,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  authPersistenceReady,
  db,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
} from '../firebase';
import { isSupabaseClientConfigured } from '../lib/supabase';
import { AdminInvite, AdminProfile, SecurityDiagnosticStatus } from '../types';
import { recordAdminAuditLog } from './adminAudit';

export interface AdminBootstrapStatus {
  bootstrapped: boolean;
  configured?: boolean;
  backend?: 'server-credentials' | 'firebase';
  supabaseConfigured?: boolean;
  envManaged?: boolean;
  envOverridden?: boolean;
  setupSecretRequired: boolean;
  firebaseAuthConfigured: boolean;
  passwordLoginAvailable?: boolean;
}

export interface ServerAdminSession {
  token: string;
  expiresAt: number;
  firebaseIdToken?: string;
  firebaseRefreshToken?: string;
  firebaseExpiresAt?: number;
  profile: AdminProfile;
}

export interface AdminVerificationResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  role?: 'owner' | 'admin';
  invited?: boolean;
  signInProvider?: string;
  bootstrapped?: boolean;
  authMode?: 'server-credentials' | 'google-firebase';
  error?: string;
  code?: string;
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  isValid: boolean;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export const AUTH_MESSAGES = {
  SETUP_CREATED: 'Congratulations! Your administrator account has been created successfully.',
  SETUP_READY_BANNER:
    'Congratulations! Your Jite Auto Deals Administrator Account has been successfully configured. Your administration dashboard is now ready.',
  LOGIN_WELCOME: 'Welcome back! Your Jite Auto Deals dashboard is ready.',
  INVALID_PASSWORD: 'The email or password you entered is incorrect. Please try again.',
  UNAUTHORIZED_ACCOUNT: 'This account does not have administrator access.',
  AUTH_CONFIG_ISSUE:
    'Authentication is not fully configured. Please check the administrator security configuration.',
  NETWORK_ISSUE: 'Connection interrupted. Please check your internet connection and try again.',
} as const;

const LAST_ACTIVITY_KEY = 'jite_admin_last_activity_ms';
const TIMEOUT_MINUTES_KEY = 'jite_admin_timeout_min';
const CONFIG_ALERT_SESSION_KEY = 'jite_admin_auth_config_alert';

// In-memory Bearer session for Email/Password auth (never stored in localStorage/sessionStorage)
let activeServerSession: ServerAdminSession | null = null;
let inflightRefreshPromise: Promise<string | null> | null = null;

export function getCurrentServerAdminSession(): ServerAdminSession | null {
  if (!activeServerSession) return null;
  const maxExp = Math.max(
    activeServerSession.expiresAt || 0,
    activeServerSession.firebaseExpiresAt || 0
  );
  if (Date.now() >= maxExp && !activeServerSession.firebaseRefreshToken) {
    activeServerSession = null;
    return null;
  }
  return activeServerSession;
}

async function refreshServerTokenIfNeeded(): Promise<string | null> {
  const srv = activeServerSession;
  if (!srv) return null;

  const bufferMs = 4 * 60 * 1000;

  if (
    srv.firebaseIdToken &&
    (!srv.firebaseExpiresAt || Date.now() < srv.firebaseExpiresAt - bufferMs)
  ) {
    return srv.firebaseIdToken;
  }

  if (!srv.firebaseRefreshToken) {
    return srv.firebaseIdToken || srv.token || null;
  }

  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  inflightRefreshPromise = (async () => {
    try {
      const res = await fetch('/api/admin-auth?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: srv.firebaseRefreshToken,
          provider: 'firebase',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.firebaseIdToken && activeServerSession) {
        activeServerSession = {
          ...activeServerSession,
          token: data.token || activeServerSession.token,
          expiresAt: Number(data.expiresAt) || activeServerSession.expiresAt,
          firebaseIdToken: String(data.firebaseIdToken),
          firebaseRefreshToken: String(
            data.firebaseRefreshToken || activeServerSession.firebaseRefreshToken
          ),
          firebaseExpiresAt: Number(data.firebaseExpiresAt) || Date.now() + 55 * 60 * 1000,
        };
        return activeServerSession.firebaseIdToken || null;
      }
    } catch {
      // Non-blocking fallback
    } finally {
      inflightRefreshPromise = null;
    }
    return activeServerSession?.firebaseIdToken || activeServerSession?.token || null;
  })();

  return inflightRefreshPromise;
}

export async function getActiveAdminBearerToken(): Promise<string | null> {
  const srv = getCurrentServerAdminSession();
  if (srv) {
    if (srv.firebaseIdToken || srv.firebaseRefreshToken) {
      const refreshed = await refreshServerTokenIfNeeded();
      if (refreshed) return refreshed;
    }
    if (srv.token) {
      return srv.token;
    }
  }
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }
  return null;
}

function isRunningInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function touchAdminActivity(timeoutMinutes?: number): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    if (typeof timeoutMinutes === 'number' && timeoutMinutes >= 5) {
      window.localStorage.setItem(TIMEOUT_MINUTES_KEY, String(timeoutMinutes));
    }
  } catch {
    // Ignore storage failures in strict private browsers
  }
}

export function isAdminSessionTimedOut(fallbackMinutes = 30): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const rawLast = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!rawLast) return false;
    const lastMs = Number(rawLast);
    if (!Number.isFinite(lastMs) || lastMs <= 0) return false;
    const storedTimeout = Number(window.localStorage.getItem(TIMEOUT_MINUTES_KEY));
    const effectiveMinutes =
      Number.isFinite(storedTimeout) && storedTimeout >= 5 ? storedTimeout : fallbackMinutes;
    return Date.now() - lastMs >= Math.max(5, effectiveMinutes) * 60 * 1000;
  } catch {
    return false;
  }
}

export function clearAdminActivityState(): void {
  activeServerSession = null;
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LAST_ACTIVITY_KEY);
    window.localStorage.removeItem(TIMEOUT_MINUTES_KEY);
    window.sessionStorage.removeItem(CONFIG_ALERT_SESSION_KEY);
  } catch {
    // Ignore
  }
}

function recordSessionConfigAlert(note: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CONFIG_ALERT_SESSION_KEY, note);
    }
  } catch {
    // Ignore
  }
}

export function mapFirebaseAuthError(
  err: any,
  context: 'login' | 'setup' | 'link' | 'reset' = 'login'
): {
  code: string;
  message: string;
} {
  const code = String(err?.code || '');
  const rawMsg = String(err?.message || '');

  if (code === 'auth/network-request-failed' || rawMsg.toLowerCase().includes('failed to fetch')) {
    return { code: code || 'NETWORK_ERROR', message: AUTH_MESSAGES.NETWORK_ISSUE };
  }

  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    const providerHint =
      context === 'link' || rawMsg.toLowerCase().includes('google')
        ? 'Enable Google sign-in in Firebase Console > Authentication > Sign-in method.'
        : 'Enable this sign-in provider in Firebase Console > Authentication > Sign-in method.';
    recordSessionConfigAlert(providerHint);
    return {
      code,
      message: `${AUTH_MESSAGES.AUTH_CONFIG_ISSUE} ${providerHint}`,
    };
  }

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    const domainHint = `Add "${host}" under Firebase Console > Authentication > Settings > Authorized domains.`;
    recordSessionConfigAlert(domainHint);
    return {
      code: 'auth/unauthorized-domain',
      message: `${AUTH_MESSAGES.AUTH_CONFIG_ISSUE} ${domainHint}`,
    };
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      code,
      message: AUTH_MESSAGES.INVALID_PASSWORD,
    };
  }

  if (code === 'auth/user-mismatch') {
    return {
      code,
      message:
        'The selected Google account does not match your currently signed-in administrator account.',
    };
  }

  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
    return {
      code,
      message: 'This Google account is already registered to another user profile.',
    };
  }

  if (code === 'auth/provider-already-linked') {
    return {
      code,
      message: 'This authentication method is already linked to your administrator account.',
    };
  }

  if (code === 'auth/requires-recent-login') {
    return {
      code,
      message: 'For your security, please sign in again before modifying credentials.',
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      code,
      message: 'Too many authentication attempts detected. Please wait a few minutes before trying again.',
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      message: 'Sign-in window was closed before finishing authentication.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      message:
        'Your browser blocked the authentication popup window. Allow popups for this site or try again.',
    };
  }

  return {
    code: code || 'AUTH_ERROR',
    message: rawMsg || 'Authentication could not be completed. Please try again.',
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const classCount = [checks.upper, checks.lower, checks.number, checks.symbol].filter(Boolean).length;
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let label: PasswordStrengthResult['label'] = 'Too weak';

  if (password.length >= 14 && classCount >= 3) {
    score = 4;
    label = 'Very strong';
  } else if (checks.length && classCount >= 3) {
    score = 3;
    label = 'Strong';
  } else if (password.length >= 8 && classCount >= 2) {
    score = 2;
    label = 'Fair';
  } else if (password.length > 0) {
    score = 1;
    label = 'Weak';
  }

  const isValid = checks.length && classCount >= 3;
  return { score, label, isValid, checks };
}

/**
 * Queries ONLY the backend standalone auth service (zero Firestore reads).
 */
export async function getAdminAuthStatus(): Promise<AdminBootstrapStatus> {
  const clientSbConfigured = isSupabaseClientConfigured();
  try {
    const res = await fetch('/api/admin-auth?action=status', {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const configured = Boolean(data.configured ?? data.bootstrapped);
      const backend: 'server-credentials' | 'firebase' =
        data.backend === 'firebase' ? 'firebase' : 'server-credentials';
      return {
        bootstrapped: configured,
        configured,
        backend,
        supabaseConfigured: Boolean(data.supabaseConfigured ?? clientSbConfigured),
        envManaged: Boolean(data.envManaged),
        envOverridden: Boolean(data.envOverridden),
        setupSecretRequired: Boolean(data.setupSecretRequired),
        firebaseAuthConfigured: Boolean(data.firebaseAuthConfigured ?? true),
        passwordLoginAvailable:
          typeof data.passwordLoginAvailable === 'boolean'
            ? data.passwordLoginAvailable
            : Boolean(data.envManaged || data.configured),
      };
    }
  } catch {
    // Graceful network fallback
  }

  return {
    bootstrapped: false,
    configured: false,
    backend: 'server-credentials',
    supabaseConfigured: clientSbConfigured,
    envManaged: false,
    envOverridden: false,
    setupSecretRequired: false,
    firebaseAuthConfigured: true,
    passwordLoginAvailable: false,
  };
}

/**
 * Verifies a signed-in Firebase Google user against backend RS256 verification + Firestore registry.
 * (Not called for standalone Email + Password sign-in.)
 */
export async function verifyCurrentAdminSession(user: User): Promise<AdminVerificationResult> {
  try {
    const idToken = await user.getIdToken(true);
    const res = await fetch('/api/admin-auth?action=verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        authorized: false,
        error: AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT,
        code: data.code,
      };
    }

    return {
      authorized: true,
      uid: data.uid,
      email: data.email,
      emailVerified: Boolean(data.emailVerified),
      role: data.role === 'owner' ? 'owner' : 'admin',
      invited: Boolean(data.invited),
      signInProvider: data.signInProvider,
      authMode: data.authMode || 'google-firebase',
      bootstrapped: true,
    };
  } catch (err: any) {
    return {
      authorized: false,
      error: err?.message?.toLowerCase().includes('fetch')
        ? AUTH_MESSAGES.NETWORK_ISSUE
        : err?.message || 'Verification failed.',
    };
  }
}

/**
 * Synchronizes an optional Google-authenticated administrator profile in Firestore.
 */
export async function syncAdminProfileInFirestore(
  user: User,
  overrides?: Partial<Pick<AdminProfile, 'displayName' | 'role' | 'inactivityTimeoutMinutes'>>
): Promise<AdminProfile | null> {
  if (!user) return null;
  const nowIso = new Date().toISOString();
  const providerList = Array.from(new Set(user.providerData.map((p) => p.providerId).filter(Boolean)));

  try {
    const adminRef = doc(db, 'admins', user.uid);
    const existingSnap = await getDoc(adminRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as Partial<AdminProfile>) : null;

    let resolvedRole: 'owner' | 'admin' = overrides?.role ?? (existing?.role === 'owner' ? 'owner' : 'admin');
    let resolvedDisplayName =
      overrides?.displayName ?? existing?.displayName ?? user.displayName ?? 'Administrator';

    if (!existing && user.email && user.emailVerified) {
      try {
        const inviteRef = doc(db, 'admin_invites', user.email.trim().toLowerCase());
        const inviteSnap = await getDoc(inviteRef);
        if (inviteSnap.exists()) {
          const inviteData = inviteSnap.data() as Partial<AdminInvite>;
          resolvedRole = 'admin';
          if (inviteData.displayName && !overrides?.displayName) {
            resolvedDisplayName = inviteData.displayName;
          }
        }
      } catch {
        // Ignore
      }
    }

    const payload: AdminProfile = {
      uid: user.uid,
      email: user.email || existing?.email || '',
      displayName: resolvedDisplayName,
      role: resolvedRole,
      authMethods: providerList.length > 0 ? providerList : existing?.authMethods || ['google.com'],
      active: existing?.active !== false,
      inactivityTimeoutMinutes:
        overrides?.inactivityTimeoutMinutes ?? existing?.inactivityTimeoutMinutes ?? 30,
      lastLoginAt: nowIso,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      authMode: 'google-firebase',
    };

    await setDoc(adminRef, payload, { merge: true });
    touchAdminActivity(payload.inactivityTimeoutMinutes);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
  }
}

async function executeAtomicBootstrapClaim(user: User, fullName: string): Promise<AdminProfile> {
  const nowIso = new Date().toISOString();
  const providerList = Array.from(new Set(user.providerData.map((p) => p.providerId).filter(Boolean)));
  const profile: AdminProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: fullName.trim() || user.displayName || 'Primary Administrator',
    role: 'owner',
    authMethods: providerList.length > 0 ? providerList : ['google.com'],
    active: true,
    inactivityTimeoutMinutes: 30,
    lastLoginAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    authMode: 'google-firebase',
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'admin_bootstrap'), {
      setupCompleted: true,
      setupCompletedAt: nowIso,
      updatedAt: nowIso,
    });
    batch.set(doc(db, 'admins', user.uid), profile);
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
  }

  touchAdminActivity(profile.inactivityTimeoutMinutes);
  return profile;
}

export async function checkPendingGoogleRedirect(): Promise<{
  handled: boolean;
  success: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
}> {
  try {
    await authPersistenceReady;
    const result = await getRedirectResult(auth);
    if (!result || !result.user) {
      return { handled: false, success: false };
    }

    const verify = await verifyCurrentAdminSession(result.user);
    if (!verify.authorized) {
      await signOut(auth).catch(() => {});
      return {
        handled: true,
        success: false,
        error: verify.error || AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT,
      };
    }

    const profile = await syncAdminProfileInFirestore(result.user);
    await recordAdminAuditLog({
      action: 'LOGIN_SUCCESS',
      status: 'success',
      details: 'Administrator completed Google redirect sign-in.',
      authMethod: 'google.com',
    });

    return { handled: true, success: true, user: result.user, profile };
  } catch (err: any) {
    const mapped = mapFirebaseAuthError(err, 'login');
    return { handled: true, success: false, error: mapped.message };
  }
}

/**
 * Standalone Server Email + Password Sign-In.
 * ZERO integration with Firestore (/admins, /settings/admin_bootstrap) or Firebase Auth.
 */
export async function signInAdminWithEmailPassword(
  email: string,
  password: string
): Promise<{
  success: boolean;
  serverSession?: ServerAdminSession;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
}> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return { success: false, error: 'Please enter both your email address and password.' };
  }

  try {
    const res = await fetch('/api/admin-auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.token || !data.admin) {
      return {
        success: false,
        code: data.code || 'INVALID_CREDENTIALS',
        error: data.error || AUTH_MESSAGES.INVALID_PASSWORD,
      };
    }

    const nowIso = new Date().toISOString();
    const profile: AdminProfile = {
      uid: String(data.admin.uid || 'server_admin_owner'),
      email: String(data.admin.email || trimmedEmail),
      displayName: String(data.admin.displayName || 'Primary Administrator'),
      role: data.admin.role === 'admin' ? 'admin' : 'owner',
      authMethods: ['password'],
      active: true,
      inactivityTimeoutMinutes: Number(data.admin.inactivityTimeoutMinutes) || 30,
      lastLoginAt: data.admin.lastLoginAt || nowIso,
      createdAt: data.admin.createdAt,
      updatedAt: data.admin.updatedAt,
      authMode: 'server-credentials',
      firebaseSynced: Boolean(data.admin.firebaseSynced),
      envManaged: Boolean(data.admin.envManaged),
    };

    const session: ServerAdminSession = {
      token: String(data.token),
      expiresAt: Number(data.expiresAt) || Date.now() + 8 * 60 * 60 * 1000,
      firebaseIdToken: data.firebaseIdToken ? String(data.firebaseIdToken) : undefined,
      firebaseRefreshToken: data.firebaseRefreshToken ? String(data.firebaseRefreshToken) : undefined,
      firebaseExpiresAt: data.firebaseExpiresAt ? Number(data.firebaseExpiresAt) : undefined,
      profile,
    };

    activeServerSession = session;
    touchAdminActivity(profile.inactivityTimeoutMinutes);

    return {
      success: true,
      serverSession: session,
      profile,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      error: err?.message?.toLowerCase().includes('fetch')
        ? AUTH_MESSAGES.NETWORK_ISSUE
        : err?.message || 'Unable to verify credentials right now.',
    };
  }
}

/**
 * Optional Google Sign-In (secondary authentication method via Firebase + Firestore).
 */
export async function signInAdminWithGoogle(): Promise<{
  success: boolean;
  redirecting?: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
}> {
  try {
    await authPersistenceReady;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const cred = await signInWithPopup(auth, provider);
    const verify = await verifyCurrentAdminSession(cred.user);

    if (!verify.authorized) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: 'ACCESS_DENIED',
        error: verify.error || AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT,
      };
    }

    const profile = await syncAdminProfileInFirestore(cred.user);
    await recordAdminAuditLog({
      action: 'LOGIN_SUCCESS',
      status: 'success',
      details: 'Administrator signed in with verified Google account.',
      authMethod: 'google.com',
    });

    return { success: true, user: cred.user, profile };
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked' && !isRunningInsideIframe()) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
        return { success: false, redirecting: true };
      } catch {
        // Fall through
      }
    }

    await signOut(auth).catch(() => {});
    const mapped = mapFirebaseAuthError(err, 'login');
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

/**
 * Provides clear recovery guidance for standalone server credentials (no Firebase Auth email lookup).
 */
export async function sendAdminPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
    };
  }

  try {
    const res = await fetch('/api/admin-auth?action=password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message:
          data.message ||
          `A password reset link has been sent to ${trimmed}. Check your inbox to reset your password.`,
      };
    }
    if (data?.error) {
      return { success: false, message: data.error };
    }
  } catch {
    // Fall through to Firebase Web SDK attempt
  }

  if (auth.currentUser) {
    try {
      await sendPasswordResetEmail(auth, trimmed);
      return {
        success: true,
        message: 'A password reset link has been sent to your email address.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: mapFirebaseAuthError(err, 'reset').message,
      };
    }
  }

  return {
    success: false,
    message: AUTH_MESSAGES.NETWORK_ISSUE,
  };
}

/**
 * One-Time Initial Administrator Email + Password Setup on Standalone Backend Server.
 * ZERO Firestore dependency.
 */
export async function completeFirstTimeSetup(params: {
  fullName: string;
  email: string;
  password: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  serverSession?: ServerAdminSession;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
}> {
  const fullName = params.fullName.trim();
  const email = params.email.trim();
  const password = params.password;
  const setupSecret = params.setupSecret?.trim();

  if (!fullName || fullName.length < 2) {
    return { success: false, error: 'Please enter your administrator full name.' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  const strength = evaluatePasswordStrength(password);
  if (!strength.isValid) {
    return {
      success: false,
      error:
        'Password must be at least 10 characters and combine at least 3 of: uppercase, lowercase, numbers, or symbols.',
    };
  }

  try {
    const res = await fetch('/api/admin-auth?action=setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(setupSecret ? { 'x-admin-setup-secret': setupSecret } : {}),
      },
      body: JSON.stringify({ fullName, email, password, setupSecret }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.token || !data.admin) {
      return {
        success: false,
        code: data.code,
        error: data.error || 'Could not configure administrator credentials.',
      };
    }

    const nowIso = new Date().toISOString();
    const profile: AdminProfile = {
      uid: String(data.admin.uid || 'server_admin_owner'),
      email: String(data.admin.email || email),
      displayName: String(data.admin.displayName || fullName),
      role: 'owner',
      authMethods: ['password'],
      active: true,
      inactivityTimeoutMinutes: Number(data.admin.inactivityTimeoutMinutes) || 30,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      authMode: 'server-credentials',
      envManaged: Boolean(data.admin.envManaged),
    };

    const session: ServerAdminSession = {
      token: String(data.token),
      expiresAt: Number(data.expiresAt) || Date.now() + 8 * 60 * 60 * 1000,
      profile,
    };

    activeServerSession = session;
    touchAdminActivity(profile.inactivityTimeoutMinutes);

    return { success: true, serverSession: session, profile };
  } catch (err: any) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      error: err?.message?.toLowerCase().includes('fetch')
        ? AUTH_MESSAGES.NETWORK_ISSUE
        : err?.message || 'Setup failed due to a connection error.',
    };
  }
}

/**
 * Optional Google-based setup (secondary).
 */
export async function completeGoogleBootstrap(params: {
  fullName?: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
}> {
  try {
    await authPersistenceReady;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);

    const displayName = params.fullName?.trim() || cred.user.displayName || 'Primary Administrator';
    const profile = await executeAtomicBootstrapClaim(cred.user, displayName);

    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: `Administrator account "${displayName}" signed in via Google.`,
      authMethod: 'google.com',
    });

    return { success: true, user: cred.user, profile };
  } catch (err: any) {
    await signOut(auth).catch(() => {});
    const mapped = mapFirebaseAuthError(err, 'setup');
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

async function reauthenticateCurrentAdmin(currentPassword?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Active administrator session required.');
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const hasGoogleProvider = user.providerData.some((p) => p.providerId === 'google.com');

  if (hasPasswordProvider && currentPassword && user.email) {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    return;
  }

  if (hasGoogleProvider) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      ...(user.email ? { login_hint: user.email } : {}),
    });
    await reauthenticateWithPopup(user, provider);
    return;
  }

  if (!currentPassword) {
    const err: any = new Error('Please enter your current password to verify your identity.');
    err.code = 'auth/requires-recent-login';
    throw err;
  }

  if (user.email) {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  }
}

export async function linkEmailPasswordToCurrentAdmin(
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'You must be signed in with a valid email account.' };
  }

  const strength = evaluatePasswordStrength(password);
  if (!strength.isValid) {
    return {
      success: false,
      error:
        'Password must be at least 10 characters and combine at least 3 of: uppercase, lowercase, numbers, or symbols.',
    };
  }

  try {
    await reauthenticateCurrentAdmin();
    const cred = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, cred);
    await syncAdminProfileInFirestore(user);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'link').message,
    };
  }
}

export async function linkGoogleToCurrentAdmin(
  currentPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Google account linking is only available for Google/Firebase sessions.' };
  }

  const alreadyHasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  if (alreadyHasGoogle) {
    return { success: false, error: 'A Google account is already linked to this administrator account.' };
  }

  try {
    if (currentPassword && user.email) {
      const emailCred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, emailCred);
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      ...(user.email ? { login_hint: user.email } : {}),
    });

    await linkWithPopup(user, provider);
    await user.reload();
    await syncAdminProfileInFirestore(user);
    return { success: true };
  } catch (err: any) {
    const mapped = mapFirebaseAuthError(err, 'link');
    return {
      success: false,
      error: mapped.message,
    };
  }
}

export async function unlinkGoogleFromCurrentAdmin(
  currentPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'You must be signed in first.' };
  }

  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPassword) {
    return {
      success: false,
      error: 'Configure an Email & Password login before unlinking Google so you never lose access.',
    };
  }

  try {
    await reauthenticateCurrentAdmin(currentPassword);
    await unlink(user, 'google.com');
    await user.reload();
    await syncAdminProfileInFirestore(user);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'link').message,
    };
  }
}

/**
 * Updates administrator password cleanly on server store (standalone mode) or Firebase Auth (Google mode).
 */
export async function changeAdminPassword(params: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string; message?: string; profile?: AdminProfile }> {
  const strength = evaluatePasswordStrength(params.newPassword);
  if (!strength.isValid) {
    return {
      success: false,
      error:
        'Password must be at least 10 characters and combine at least 3 of: uppercase, lowercase, numbers, or symbols.',
    };
  }

  const srv = getCurrentServerAdminSession();
  if (srv) {
    try {
      const bearer = await getActiveAdminBearerToken();
      const res = await fetch('/api/admin-auth?action=update-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: params.currentPassword || '',
          newPassword: params.newPassword,
          firebaseRefreshToken: srv.firebaseRefreshToken || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not update password.' };
      }

      const updatedProfile: AdminProfile = {
        ...srv.profile,
        uid: data.admin?.uid || srv.profile.uid,
        email: data.admin?.email || srv.profile.email,
        displayName: data.admin?.displayName || srv.profile.displayName,
        authMode: 'server-credentials',
        firebaseSynced: Boolean(data.admin?.firebaseSynced ?? srv.profile.firebaseSynced),
        envManaged: false,
        updatedAt: data.admin?.updatedAt || new Date().toISOString(),
      };
      activeServerSession = {
        token: data.token || srv.token,
        expiresAt: Number(data.expiresAt) || srv.expiresAt,
        firebaseIdToken: data.firebaseIdToken || srv.firebaseIdToken,
        firebaseRefreshToken: data.firebaseRefreshToken || srv.firebaseRefreshToken,
        firebaseExpiresAt: Number(data.firebaseExpiresAt) || srv.firebaseExpiresAt,
        profile: updatedProfile,
      };
      return {
        success: true,
        profile: updatedProfile,
        message: 'Administrator password updated and synced across your live site and workspace.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update password.' };
    }
  }

  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    const linkRes = await linkEmailPasswordToCurrentAdmin(params.newPassword);
    return {
      success: linkRes.success,
      error: linkRes.error,
      message: linkRes.success ? 'Email & Password login enabled.' : undefined,
    };
  }

  try {
    await reauthenticateCurrentAdmin(params.currentPassword);
    await updatePassword(user, params.newPassword);
    await setDoc(
      doc(db, 'settings', 'admin_bootstrap'),
      {
        setupCompleted: true,
        primaryAdminUid: user.uid,
        dashboardOverride: true,
        passwordUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});
    await recordAdminAuditLog({
      action: 'PASSWORD_CHANGED',
      status: 'success',
      details: 'Administrator password updated and synced globally.',
      authMethod: 'password',
    });
    return {
      success: true,
      message: 'Administrator password updated and synced across your live site and workspace.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'login').message,
    };
  }
}

/**
 * Updates administrator email cleanly on Firebase Auth + Cloud Firestore.
 */
export async function changeAdminEmail(params: {
  currentPassword?: string;
  newEmail: string;
}): Promise<{ success: boolean; error?: string; message?: string; profile?: AdminProfile }> {
  const trimmed = params.newEmail.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Please enter a valid new email address.' };
  }

  const srv = getCurrentServerAdminSession();
  if (srv) {
    if (srv.profile.email.toLowerCase() === trimmed.toLowerCase()) {
      return { success: false, error: 'New email address must differ from the current email.' };
    }
    try {
      const bearer = await getActiveAdminBearerToken();
      const res = await fetch('/api/admin-auth?action=update-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: params.currentPassword || '',
          newEmail: trimmed,
          firebaseRefreshToken: srv.firebaseRefreshToken || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not update administrator email.' };
      }

      const updatedProfile: AdminProfile = {
        ...srv.profile,
        uid: data.admin?.uid || srv.profile.uid,
        email: data.admin?.email || trimmed,
        displayName: data.admin?.displayName || srv.profile.displayName,
        authMode: 'server-credentials',
        firebaseSynced: Boolean(data.admin?.firebaseSynced ?? srv.profile.firebaseSynced),
        envManaged: false,
        updatedAt: data.admin?.updatedAt || new Date().toISOString(),
      };
      activeServerSession = {
        token: data.token || srv.token,
        expiresAt: Number(data.expiresAt) || srv.expiresAt,
        firebaseIdToken: data.firebaseIdToken || srv.firebaseIdToken,
        firebaseRefreshToken: data.firebaseRefreshToken || srv.firebaseRefreshToken,
        firebaseExpiresAt: Number(data.firebaseExpiresAt) || srv.firebaseExpiresAt,
        profile: updatedProfile,
      };
      return {
        success: true,
        profile: updatedProfile,
        message: `Administrator login email updated to ${updatedProfile.email}.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update administrator email.' };
    }
  }

  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }
  if (user.email?.toLowerCase() === trimmed.toLowerCase()) {
    return { success: false, error: 'New email address must differ from the current email.' };
  }

  try {
    await reauthenticateCurrentAdmin(params.currentPassword);
    await verifyBeforeUpdateEmail(user, trimmed);
    return {
      success: true,
      message: `A verification link has been sent to ${trimmed}. Click the link in that inbox to finalize updating your email.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'login').message,
    };
  }
}

export async function updateAdminProfileSettings(params: {
  displayName: string;
  inactivityTimeoutMinutes: number;
}): Promise<{ success: boolean; profile?: AdminProfile | null; error?: string }> {
  const cleanName = params.displayName.trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Administrator display name must be at least 2 characters.' };
  }

  const srv = getCurrentServerAdminSession();
  if (srv) {
    try {
      const bearer = await getActiveAdminBearerToken();
      const res = await fetch('/api/admin-auth?action=update-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({
          fullName: cleanName,
          inactivityTimeoutMinutes: params.inactivityTimeoutMinutes,
          firebaseRefreshToken: srv.firebaseRefreshToken || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not save preferences.' };
      }

      const updatedProfile: AdminProfile = {
        ...srv.profile,
        uid: data.admin?.uid || srv.profile.uid,
        displayName: cleanName,
        inactivityTimeoutMinutes: params.inactivityTimeoutMinutes,
        updatedAt: data.admin?.updatedAt || new Date().toISOString(),
      };
      activeServerSession = {
        token: data.token || srv.token,
        expiresAt: Number(data.expiresAt) || srv.expiresAt,
        firebaseIdToken: data.firebaseIdToken || srv.firebaseIdToken,
        firebaseRefreshToken: data.firebaseRefreshToken || srv.firebaseRefreshToken,
        firebaseExpiresAt: Number(data.firebaseExpiresAt) || srv.firebaseExpiresAt,
        profile: updatedProfile,
      };
      touchAdminActivity(params.inactivityTimeoutMinutes);
      return { success: true, profile: updatedProfile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update profile settings.' };
    }
  }

  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }

  try {
    await updateProfile(user, { displayName: cleanName });
    const profile = await syncAdminProfileInFirestore(user, {
      displayName: cleanName,
      inactivityTimeoutMinutes: params.inactivityTimeoutMinutes,
    });
    return { success: true, profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update profile settings.' };
  }
}

export async function listAuthorizedAdmins(): Promise<AdminProfile[]> {
  if (!auth.currentUser) {
    const token = await getActiveAdminBearerToken();
    const srv = getCurrentServerAdminSession();
    if (token) {
      try {
        const res = await fetch('/api/admin-auth?action=access-registry', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.admins) && data.admins.length > 0) {
            return data.admins;
          }
        }
      } catch {
        // Fallback below
      }
    }
    return srv ? [srv.profile] : [];
  }

  try {
    const snap = await getDocs(collection(db, 'admins'));
    const list: AdminProfile[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        uid: d.id,
        email: String(data.email || ''),
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        role: data.role === 'owner' ? 'owner' : 'admin',
        authMethods: Array.isArray(data.authMethods) ? data.authMethods : [],
        active: data.active !== false,
        inactivityTimeoutMinutes:
          typeof data.inactivityTimeoutMinutes === 'number' ? data.inactivityTimeoutMinutes : 30,
        lastLoginAt: typeof data.lastLoginAt === 'string' ? data.lastLoginAt : undefined,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      });
    });
    return list;
  } catch {
    return [];
  }
}

export async function listAdminInvites(): Promise<AdminInvite[]> {
  if (!auth.currentUser) {
    const token = await getActiveAdminBearerToken();
    if (token) {
      try {
        const res = await fetch('/api/admin-auth?action=access-registry', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.invites)) {
            return data.invites;
          }
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  try {
    const snap = await getDocs(collection(db, 'admin_invites'));
    const list: AdminInvite[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        email: String(data.email || d.id),
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        role: 'admin',
        active: data.active !== false,
        invitedByUid: typeof data.invitedByUid === 'string' ? data.invitedByUid : undefined,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      });
    });
    return list;
  } catch {
    return [];
  }
}

export async function registerAuthorizedAdmin(input: {
  uid?: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin';
}): Promise<{ success: boolean; error?: string; mode?: 'uid' | 'invite' }> {
  const cleanUid = (input.uid || '').trim();
  const cleanEmail = input.email.trim();
  const cleanName = input.displayName.trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Valid administrator email address is required.' };
  }
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Administrator full name is required.' };
  }

  if (!auth.currentUser) {
    const token = await getActiveAdminBearerToken();
    if (!token) {
      return { success: false, error: 'Active administrator session required.' };
    }
    try {
      const res = await fetch('/api/admin-auth?action=authorize-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: cleanUid || undefined,
          email: cleanEmail,
          displayName: cleanName,
          role: input.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Unable to authorize administrator.' };
      }
      return { success: true, mode: data.mode };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error authorizing administrator.' };
    }
  }

  try {
    const nowIso = new Date().toISOString();

    if (cleanUid) {
      if (cleanUid.length < 6) {
        return { success: false, error: 'Provided Firebase Auth UID appears too short.' };
      }
      await setDoc(
        doc(db, 'admins', cleanUid),
        {
          uid: cleanUid,
          email: cleanEmail,
          displayName: cleanName,
          role: input.role,
          active: true,
          authMethods: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      return { success: true, mode: 'uid' };
    }

    const emailLower = cleanEmail.toLowerCase();
    await setDoc(
      doc(db, 'admin_invites', emailLower),
      {
        email: cleanEmail,
        displayName: cleanName,
        role: 'admin',
        active: true,
        invitedByUid: auth.currentUser?.uid || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    return { success: true, mode: 'invite' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to authorize administrator record.' };
  }
}

export async function removeAdminInvite(email: string): Promise<{ success: boolean; error?: string }> {
  if (!auth.currentUser) {
    const token = await getActiveAdminBearerToken();
    if (!token) return { success: false, error: 'Active administrator session required.' };
    try {
      const res = await fetch('/api/admin-auth?action=remove-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.success
        ? { success: true }
        : { success: false, error: data.error || 'Failed to remove invitation.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove invitation.' };
    }
  }

  try {
    await deleteDoc(doc(db, 'admin_invites', email.trim().toLowerCase()));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove administrator invitation.' };
  }
}

export async function setAuthorizedAdminActive(
  targetUid: string,
  active: boolean,
  targetRole?: 'owner' | 'admin'
): Promise<{ success: boolean; error?: string }> {
  if (!auth.currentUser) {
    const srv = getCurrentServerAdminSession();
    const token = await getActiveAdminBearerToken();
    if (!token || !srv) {
      return { success: false, error: 'Active administrator session required.' };
    }
    try {
      const res = await fetch('/api/admin-auth?action=toggle-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: targetUid, active, role: targetRole }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.success
        ? { success: true }
        : { success: false, error: data.error || 'Failed to update administrator status.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update administrator status.' };
    }
  }

  const currentUid = auth.currentUser.uid;
  if (targetUid === currentUid && !active) {
    return { success: false, error: 'You cannot revoke your own currently active administrator account.' };
  }
  if (targetRole === 'owner' && !active) {
    return {
      success: false,
      error: 'Primary owner accounts are protected and cannot be revoked or removed.',
    };
  }

  try {
    await updateDoc(doc(db, 'admins', targetUid), {
      active,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update administrator status.' };
  }
}

export async function runSecurityDiagnostics(): Promise<SecurityDiagnosticStatus> {
  const srv = getCurrentServerAdminSession();
  const user = auth.currentUser;
  const warnings: string[] = [];

  let databaseConnected = false;
  let databaseSummary = '';

  if (isSupabaseClientConfigured()) {
    try {
      const dbRes = await fetch('/api/vehicles', { method: 'GET', cache: 'no-store' });
      databaseConnected = dbRes.ok;
      databaseSummary = databaseConnected
        ? 'Supabase PostgreSQL reachable and synchronized across live storefront & admin.'
        : `Database endpoint returned HTTP ${dbRes.status}.`;
    } catch {
      databaseConnected = false;
      databaseSummary = 'Unable to reach database backend API cleanly.';
    }
  } else {
    databaseConnected = await testFirestoreConnection();
    databaseSummary = databaseConnected
      ? 'Database reachable and synchronized.'
      : 'Unable to reach Cloud Firestore server cleanly.';
  }

  const token = await getActiveAdminBearerToken();

  let authorizationOk = false;
  let authorizationSummary: string = AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT;
  let firebaseSynced = Boolean(user || srv?.firebaseIdToken);

  if (token) {
    try {
      const diagRes = await fetch('/api/admin-auth?action=diagnostics', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        authorizationOk = Boolean(diagData.success);
        firebaseSynced = Boolean(diagData.firebaseSynced ?? firebaseSynced);
        authorizationSummary = diagData.envManaged
          ? 'Authenticated via server environment variables (ADMIN_EMAIL / ADMIN_PASSWORD).'
          : firebaseSynced
          ? 'Dashboard credentials & Cloud Firestore admin permissions verified globally.'
          : 'Server administrator session verified cleanly.';
      } else {
        authorizationSummary = `Backend verification returned HTTP ${diagRes.status}.`;
      }
    } catch {
      authorizationSummary = 'Could not reach backend authorization endpoint.';
    }
  }

  const authMode: 'server-credentials' | 'google-firebase' =
    srv ? 'server-credentials' : 'google-firebase';

  const firebaseAuthOk = srv ? true : Boolean(user);
  const firebaseAuthSummary = srv
    ? 'Email & Password authenticated via server credentials.'
    : user
    ? 'Authenticated via Google Sign-In.'
    : 'No active administrator session.';

  return {
    checkedAt: new Date().toISOString(),
    authMode,
    firebaseAuthOk,
    firebaseAuthSummary,
    databaseConnected,
    databaseSummary,
    authorizationOk,
    authorizationSummary,
    warnings,
  };
}

export async function logoutAdminSession(reason: 'manual' | 'timeout' = 'manual'): Promise<void> {
  await recordAdminAuditLog({
    action: reason === 'timeout' ? 'SESSION_TIMEOUT' : 'LOGOUT',
    status: reason === 'timeout' ? 'warning' : 'success',
    details:
      reason === 'timeout'
        ? 'Administrator session ended automatically due to inactivity timeout.'
        : 'Administrator signed out explicitly.',
  }).catch(() => {});

  clearAdminActivityState();

  try {
    await fetch('/api/admin-auth?action=logout', {
      method: 'POST',
    });
  } catch {
    // ignore
  }

  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}
