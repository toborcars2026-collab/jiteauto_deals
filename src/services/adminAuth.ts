import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
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
import { AdminInvite, AdminProfile, SecurityDiagnosticStatus } from '../types';
import { recordAdminAuditLog } from './adminAudit';

export interface AdminBootstrapStatus {
  bootstrapped: boolean;
  setupSecretRequired: boolean;
  firebaseAuthConfigured: boolean;
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
  INVALID_PASSWORD: 'The password you entered is incorrect. Please try again.',
  UNAUTHORIZED_ACCOUNT: 'This account does not have administrator access.',
  AUTH_CONFIG_ISSUE:
    'Authentication is not fully configured. Please check the administrator security configuration.',
  NETWORK_ISSUE: 'Connection interrupted. Please check your internet connection and try again.',
} as const;

const LAST_ACTIVITY_KEY = 'jite_admin_last_activity_ms';
const TIMEOUT_MINUTES_KEY = 'jite_admin_timeout_min';
const CONFIG_ALERT_SESSION_KEY = 'jite_admin_auth_config_alert';

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

export function mapFirebaseAuthError(err: any, context: 'login' | 'setup' | 'link' | 'reset' = 'login'): {
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
        ? 'Enable Google and Email/Password providers in Firebase Console > Authentication > Sign-in method.'
        : 'Enable Email/Password sign-in in Firebase Console > Authentication > Sign-in method.';
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

  if (code === 'auth/user-not-found') {
    return {
      code,
      message:
        context === 'login'
          ? 'No administrator account was found with that email address. Double-check the email or verify setup.'
          : AUTH_MESSAGES.INVALID_PASSWORD,
    };
  }

  if (code === 'auth/user-mismatch') {
    return {
      code,
      message:
        'The selected Google account does not match your currently signed-in administrator account. Please choose the Google account matching your current session.',
    };
  }

  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
    return {
      code,
      message:
        context === 'link'
          ? 'This Google account is already registered to another user profile. Sign out and sign in with that Google account if it is already authorized, or choose another Google account.'
          : 'An account with this email address already exists. Sign in with your password or reset it if needed.',
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
      message: 'For your security, please re-confirm your current password or sign in again before modifying credentials.',
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
        'Your browser blocked the authentication popup window. Allow popups for this site or try Sign in again.',
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

export async function getAdminAuthStatus(): Promise<AdminBootstrapStatus> {
  try {
    const res = await fetch('/api/admin-auth?action=status', {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        bootstrapped: Boolean(data.bootstrapped),
        setupSecretRequired: Boolean(data.setupSecretRequired),
        firebaseAuthConfigured: Boolean(data.firebaseAuthConfigured ?? true),
      };
    }
  } catch {
    // Check Firestore bootstrap lock directly as resilient fallback if API unreachable
  }

  try {
    const bootstrapSnap = await getDoc(doc(db, 'settings', 'admin_bootstrap'));
    if (bootstrapSnap.exists() && bootstrapSnap.data()?.setupCompleted === true) {
      return {
        bootstrapped: true,
        setupSecretRequired: false,
        firebaseAuthConfigured: true,
      };
    }
  } catch {
    // Ignore
  }

  return {
    bootstrapped: false,
    setupSecretRequired: false,
    firebaseAuthConfigured: true,
  };
}

async function reportFailedAttemptToServer(emailHint?: string): Promise<{ rateLimited?: boolean; waitSeconds?: number }> {
  try {
    const res = await fetch('/api/admin-auth?action=record-security-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailHint: emailHint || '' }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      rateLimited: res.status === 429 || Boolean(data.rateLimited),
      waitSeconds: data.waitSeconds,
    };
  } catch {
    return {};
  }
}

/**
 * Verifies a signed-in Firebase user against the backend RS256 certificate check + Firestore rules.
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
        error:
          data.code === 'RATE_LIMITED'
            ? data.error
            : AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT,
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
      bootstrapped: Boolean(data.bootstrapped),
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
 * Synchronizes the verified administrator profile in /admins/{uid} and redeems verified email invites cleanly.
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

    // Check invite metadata when first redeeming a pre-authorized email invite
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
        // Ignore if no invite doc
      }
    }

    const payload: AdminProfile = {
      uid: user.uid,
      email: user.email || existing?.email || '',
      displayName: resolvedDisplayName,
      role: resolvedRole,
      authMethods: providerList.length > 0 ? providerList : existing?.authMethods || ['password'],
      active: existing?.active !== false,
      inactivityTimeoutMinutes:
        overrides?.inactivityTimeoutMinutes ?? existing?.inactivityTimeoutMinutes ?? 30,
      lastLoginAt: nowIso,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(adminRef, payload, { merge: true });
    touchAdminActivity(payload.inactivityTimeoutMinutes);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
  }
}

/**
 * Atomic one-time initial owner claim in Firestore (writes /settings/admin_bootstrap + /admins/{uid} together)
 * and finalizes server bootstrap lock.
 */
async function executeAtomicBootstrapClaim(user: User, fullName: string): Promise<AdminProfile> {
  const nowIso = new Date().toISOString();
  const providerList = Array.from(new Set(user.providerData.map((p) => p.providerId).filter(Boolean)));
  const profile: AdminProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: fullName.trim() || user.displayName || 'Primary Administrator',
    role: 'owner',
    authMethods: providerList.length > 0 ? providerList : ['password'],
    active: true,
    inactivityTimeoutMinutes: 30,
    lastLoginAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
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

  // Finalize server-side lock after batch succeeds
  try {
    const freshToken = await user.getIdToken(true);
    await fetch('/api/admin-auth?action=bootstrap-finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshToken}`,
      },
      body: JSON.stringify({ idToken: freshToken }),
    });
  } catch {
    // Non-blocking since Firestore lock document is already committed
  }

  touchAdminActivity(profile.inactivityTimeoutMinutes);
  return profile;
}

/**
 * Picks up any mobile redirect sign-in or linking result on page mount.
 */
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
 * Standard Email + Password Sign-In.
 */
export async function signInAdminWithEmailPassword(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
}> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return { success: false, error: 'Please enter both your email address and password.' };
  }

  try {
    await authPersistenceReady;
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const verify = await verifyCurrentAdminSession(cred.user);

    if (!verify.authorized) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: verify.code || 'ACCESS_DENIED',
        error: AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT,
      };
    }

    const profile = await syncAdminProfileInFirestore(cred.user);
    await recordAdminAuditLog({
      action: 'LOGIN_SUCCESS',
      status: 'success',
      details: 'Administrator signed in with Email and Password.',
      authMethod: 'password',
    });

    return { success: true, user: cred.user, profile };
  } catch (err: any) {
    const mapped = mapFirebaseAuthError(err, 'login');

    if (
      mapped.code === 'auth/operation-not-allowed' ||
      mapped.code === 'NETWORK_ERROR' ||
      mapped.code === 'auth/network-request-failed'
    ) {
      return {
        success: false,
        code: mapped.code,
        error: mapped.message,
      };
    }

    const rate = await reportFailedAttemptToServer(trimmedEmail);
    if (rate.rateLimited) {
      return {
        success: false,
        code: 'RATE_LIMITED',
        error: `Too many failed attempts. Please wait ${rate.waitSeconds || 300} seconds before trying again.`,
      };
    }

    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

/**
 * Verified Google Sign-In with mobile popup fallback support.
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
    // On mobile top-level browsers where popup is blocked, seamlessly use redirect sign-in
    if (err?.code === 'auth/popup-blocked' && !isRunningInsideIframe()) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
        return { success: false, redirecting: true };
      } catch {
        // Fall through to mapped message
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
 * Sends a Firebase password reset link without disclosing account enumeration details.
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
    await sendPasswordResetEmail(auth, trimmed);
  } catch (err: any) {
    const mapped = mapFirebaseAuthError(err, 'reset');
    if (
      mapped.code === 'auth/operation-not-allowed' ||
      mapped.code === 'NETWORK_ERROR' ||
      mapped.code === 'auth/network-request-failed'
    ) {
      return {
        success: false,
        message: mapped.message,
      };
    }
  }

  return {
    success: true,
    message:
      'If an administrator account matches that email address, a password reset link has been sent to your inbox.',
  };
}

/**
 * Controlled One-Time Initial Administrator Setup with User-Chosen Email & Password.
 * Zero hardcoded emails. Locks permanently via atomic Firestore writeBatch + backend check.
 */
export async function completeFirstTimeSetup(params: {
  fullName: string;
  email: string;
  password: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  user?: User;
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
    await authPersistenceReady;
    let user: User;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      user = cred.user;
    } catch (createErr: any) {
      if (createErr?.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email, password);
          user = signInCred.user;
        } catch (signInErr: any) {
          const mappedSignIn = mapFirebaseAuthError(signInErr, 'login');
          return {
            success: false,
            code: mappedSignIn.code,
            error:
              'An account with this email already exists. Enter that account’s existing password or use Google below if that account is linked to Google.',
          };
        }
      } else {
        const mappedCreate = mapFirebaseAuthError(createErr, 'setup');
        return {
          success: false,
          code: mappedCreate.code,
          error: mappedCreate.message,
        };
      }
    }

    if (user.displayName !== fullName) {
      await updateProfile(user, { displayName: fullName }).catch(() => {});
    }

    const idToken = await user.getIdToken(true);
    const preflightRes = await fetch('/api/admin-auth?action=bootstrap-complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(setupSecret ? { 'x-admin-setup-secret': setupSecret } : {}),
      },
      body: JSON.stringify({ idToken, setupSecret }),
    });

    const preflightData = await preflightRes.json().catch(() => ({}));
    if (!preflightRes.ok || !preflightData.success) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: preflightData.code,
        error: preflightData.error || 'Could not authorize initial administrator setup.',
      };
    }

    const profile = await executeAtomicBootstrapClaim(user, fullName);

    // Non-blocking verification email hint so user can verify their inbox anytime
    if (!user.emailVerified) {
      sendEmailVerification(user).catch(() => {});
    }

    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: `Initial administrator account "${fullName}" configured.`,
      authMethod: 'password',
    });

    return { success: true, user, profile };
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

/**
 * Optional Google-based One-Time Initial Administrator Setup.
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
    const idToken = await cred.user.getIdToken(true);

    const res = await fetch('/api/admin-auth?action=bootstrap-complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(params.setupSecret ? { 'x-admin-setup-secret': params.setupSecret } : {}),
      },
      body: JSON.stringify({ idToken, setupSecret: params.setupSecret }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: data.code,
        error: data.error || 'Setup authorization failed for this Google account.',
      };
    }

    const displayName = params.fullName?.trim() || cred.user.displayName || 'Primary Administrator';
    const profile = await executeAtomicBootstrapClaim(cred.user, displayName);

    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: `Initial administrator account "${displayName}" configured via Google.`,
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

/**
 * Safely reauthenticates the active administrator without causing unnecessary auth/user-mismatch errors.
 */
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

/**
 * Links an Email/Password login method onto the current Google-authenticated Admin UID.
 */
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
    await recordAdminAuditLog({
      action: 'PASSWORD_CREDENTIAL_LINKED',
      status: 'success',
      details: 'Email and Password login method linked to administrator UID.',
      authMethod: 'password',
    });
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'link').message,
    };
  }
}

/**
 * Safely links a Google Sign-In account onto the current Email/Password-authenticated Admin UID.
 * Prevents duplicate accounts and resolves auth/user-mismatch & recent-login requirements cleanly.
 */
export async function linkGoogleToCurrentAdmin(
  currentPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'You must be signed in first.' };
  }

  const alreadyHasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  if (alreadyHasGoogle) {
    return { success: false, error: 'A Google account is already linked to this administrator account.' };
  }

  try {
    // If password is provided, verify identity upfront so recent-login check succeeds seamlessly
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

    await recordAdminAuditLog({
      action: 'GOOGLE_CREDENTIAL_LINKED',
      status: 'success',
      details: `Google sign-in linked cleanly to administrator account (${user.email || user.uid}).`,
      authMethod: 'google.com',
    });

    return { success: true };
  } catch (err: any) {
    const mapped = mapFirebaseAuthError(err, 'link');
    return {
      success: false,
      error: mapped.message,
    };
  }
}

/**
 * Safely unlinks Google Sign-In ONLY if Email/Password login remains active (never locks admin out).
 */
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

    await recordAdminAuditLog({
      action: 'GOOGLE_CREDENTIAL_UNLINKED',
      status: 'warning',
      details: 'Google sign-in unlinked from administrator account.',
      authMethod: 'password',
    });

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'link').message,
    };
  }
}

/**
 * Updates the signed-in administrator's Firebase Authentication password.
 */
export async function changeAdminPassword(params: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }

  const strength = evaluatePasswordStrength(params.newPassword);
  if (!strength.isValid) {
    return {
      success: false,
      error:
        'Password must be at least 10 characters and combine at least 3 of: uppercase, lowercase, numbers, or symbols.',
    };
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    const linkRes = await linkEmailPasswordToCurrentAdmin(params.newPassword);
    return {
      success: linkRes.success,
      error: linkRes.error,
      message: linkRes.success ? 'Email & Password login enabled and password configured.' : undefined,
    };
  }

  try {
    await reauthenticateCurrentAdmin(params.currentPassword);
    await updatePassword(user, params.newPassword);
    await recordAdminAuditLog({
      action: 'PASSWORD_CHANGED',
      status: 'success',
      details: 'Administrator password updated.',
      authMethod: 'password',
    });
    return { success: true, message: 'Administrator password updated successfully.' };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'login').message,
    };
  }
}

/**
 * Updates administrator email using Firebase verifyBeforeUpdateEmail + recent reauthentication.
 */
export async function changeAdminEmail(params: {
  currentPassword?: string;
  newEmail: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }

  const trimmed = params.newEmail.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Please enter a valid new email address.' };
  }
  if (user.email?.toLowerCase() === trimmed.toLowerCase()) {
    return { success: false, error: 'New email address must differ from the current email.' };
  }

  try {
    await reauthenticateCurrentAdmin(params.currentPassword);
    await verifyBeforeUpdateEmail(user, trimmed);
    await recordAdminAuditLog({
      action: 'EMAIL_CHANGE_VERIFICATION_SENT',
      status: 'success',
      details: `Verification link dispatched to update login email to ${trimmed}.`,
    });
    return {
      success: true,
      message: `A verification link has been sent to ${trimmed}. Click the link in that inbox to finalize updating your administrator email.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'login').message,
    };
  }
}

/**
 * Updates profile display name & inactivity auto-timeout preferences.
 */
export async function updateAdminProfileSettings(params: {
  displayName: string;
  inactivityTimeoutMinutes: number;
}): Promise<{ success: boolean; profile?: AdminProfile | null; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active administrator session required.' };
  }

  const cleanName = params.displayName.trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Administrator display name must be at least 2 characters.' };
  }

  try {
    await updateProfile(user, { displayName: cleanName });
    const profile = await syncAdminProfileInFirestore(user, {
      displayName: cleanName,
      inactivityTimeoutMinutes: params.inactivityTimeoutMinutes,
    });
    await recordAdminAuditLog({
      action: 'PROFILE_UPDATED',
      status: 'success',
      details: `Updated administrator profile ("${cleanName}", session timeout ${params.inactivityTimeoutMinutes} min).`,
    });
    return { success: true, profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update profile settings.' };
  }
}

/**
 * Lists authorized administrators from Firestore /admins collection.
 */
export async function listAuthorizedAdmins(): Promise<AdminProfile[]> {
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
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admins');
  }
}

/**
 * Lists email invitations stored in /admin_invites.
 */
export async function listAdminInvites(): Promise<AdminInvite[]> {
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

/**
 * Authorizes an additional administrator either by email invitation or direct Firebase Auth UID.
 */
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
      await recordAdminAuditLog({
        action: 'ADMIN_ACCESS_GRANTED',
        status: 'success',
        details: `Authorized ${input.role} access for ${cleanEmail} (UID: ${cleanUid}).`,
      });
      return { success: true, mode: 'uid' };
    }

    // Email-based authorization invite (redeemed automatically on verified Google sign-in)
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
    await recordAdminAuditLog({
      action: 'ADMIN_INVITE_CREATED',
      status: 'success',
      details: `Authorized email invitation created for ${cleanEmail}.`,
    });
    return { success: true, mode: 'invite' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to authorize administrator record.' };
  }
}

/**
 * Revokes an email invitation cleanly.
 */
export async function removeAdminInvite(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, 'admin_invites', email.trim().toLowerCase()));
    await recordAdminAuditLog({
      action: 'ADMIN_INVITE_REMOVED',
      status: 'warning',
      details: `Removed administrator invitation for ${email}.`,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove administrator invitation.' };
  }
}

/**
 * Activates or revokes an authorized administrator account.
 * Primary owner accounts (role === 'owner') and active self session are strictly protected.
 */
export async function setAuthorizedAdminActive(
  targetUid: string,
  active: boolean,
  targetRole?: 'owner' | 'admin'
): Promise<{ success: boolean; error?: string }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    return { success: false, error: 'Active session required.' };
  }
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
    await recordAdminAuditLog({
      action: active ? 'ADMIN_ACCESS_RESTORED' : 'ADMIN_ACCESS_REVOKED',
      status: active ? 'success' : 'warning',
      details: `${active ? 'Restored' : 'Revoked'} administrator access for UID ${targetUid}.`,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update administrator status.' };
  }
}

/**
 * Runs genuine live diagnostics for Section E (Security Status). Never fabricates green status.
 */
export async function runSecurityDiagnostics(): Promise<SecurityDiagnosticStatus> {
  const user = auth.currentUser;
  const warnings: string[] = [];

  const providers = user?.providerData?.map((p) => p.providerId).filter(Boolean) || [];
  const hasPassword = providers.includes('password');
  const hasGoogle = providers.includes('google.com');

  const firebaseAuthOk = Boolean(user && providers.length > 0);
  const firebaseAuthSummary = user
    ? `Authenticated (${providers.map((p) => (p === 'google.com' ? 'Google' : 'Email/Password')).join(' + ')})`
    : 'No active Firebase Authentication user.';

  if (user && !user.emailVerified) {
    warnings.push('Administrator email address is not yet verified in Firebase Auth.');
  }
  if (user && (!hasPassword || !hasGoogle)) {
    warnings.push(
      hasPassword && !hasGoogle
        ? 'Only Email/Password sign-in is configured. Link a Google account as a secondary sign-in option if desired.'
        : 'Only Google sign-in is configured. Set an Email & Password credential so you always have two recovery paths.'
    );
  }

  try {
    const storedAlert =
      typeof window !== 'undefined' ? window.sessionStorage.getItem(CONFIG_ALERT_SESSION_KEY) : null;
    if (storedAlert) {
      warnings.push(storedAlert);
    }
  } catch {
    // Ignore
  }

  const databaseConnected = await testFirestoreConnection();
  const databaseSummary = databaseConnected
    ? 'Cloud Firestore server reachable and verified.'
    : 'Unable to reach Cloud Firestore server cleanly. Check internet or Firebase configuration.';

  let authorizationOk = false;
  let authorizationSummary: string = AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT;

  if (user) {
    try {
      const idToken = await user.getIdToken();
      const diagRes = await fetch('/api/admin-auth?action=diagnostics', {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        authorizationOk = Boolean(diagData.success);
        authorizationSummary = authorizationOk
          ? `Server RS256 & Firestore Rules verified (${diagData.role === 'owner' ? 'Primary Owner' : 'Administrator'}).`
          : 'Server authorization could not be confirmed.';
        if (!diagData.setupSecretConfigured) {
          warnings.push(
            'Optional: Set ADMIN_SETUP_SECRET in your server environment variables for extra deployment protection.'
          );
        }
      } else {
        authorizationSummary = `Backend verification returned HTTP ${diagRes.status}.`;
      }
    } catch {
      authorizationSummary = 'Could not reach backend authorization endpoint.';
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    firebaseAuthOk,
    firebaseAuthSummary,
    databaseConnected,
    databaseSummary,
    authorizationOk,
    authorizationSummary,
    warnings,
  };
}

/**
 * Explicitly logs out administrator and clears session state cleanly.
 */
export async function logoutAdminSession(reason: 'manual' | 'timeout' = 'manual'): Promise<void> {
  if (auth.currentUser) {
    await recordAdminAuditLog({
      action: reason === 'timeout' ? 'SESSION_TIMEOUT' : 'LOGOUT',
      status: reason === 'timeout' ? 'warning' : 'success',
      details:
        reason === 'timeout'
          ? 'Administrator session ended automatically due to inactivity timeout.'
          : 'Administrator signed out explicitly.',
    });
  }

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
