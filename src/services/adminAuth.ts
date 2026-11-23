import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  verifyBeforeUpdateEmail,
  linkWithCredential,
  linkWithPopup,
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
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { AdminProfile } from '../types';
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

const UNIFORM_LOGIN_ERROR = 'Sign-in failed. Please verify your credentials and try again.';

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let label: PasswordStrengthResult['label'] = 'Too weak';

  if (password.length >= 14 && passed === 5) {
    score = 4;
    label = 'Very strong';
  } else if (checks.length && passed >= 4) {
    score = 3;
    label = 'Strong';
  } else if (password.length >= 8 && passed >= 3) {
    score = 2;
    label = 'Fair';
  } else if (password.length > 0) {
    score = 1;
    label = 'Weak';
  }

  const isValid = checks.length && checks.upper && checks.lower && checks.number && checks.symbol;
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
    // Graceful fallback
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
        error: data.error || 'Unable to verify administrator session.',
        code: data.code,
      };
    }

    return {
      authorized: true,
      uid: data.uid,
      email: data.email,
      emailVerified: Boolean(data.emailVerified),
      role: data.role === 'owner' ? 'owner' : 'admin',
      signInProvider: data.signInProvider,
      bootstrapped: Boolean(data.bootstrapped),
    };
  } catch (err: any) {
    return {
      authorized: false,
      error: err?.message || 'Verification failed.',
    };
  }
}

/**
 * Ensures the signed-in admin has an authoritative record in /admins/{uid} and locks bootstrap if missing.
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

    const payload: AdminProfile = {
      uid: user.uid,
      email: user.email || existing?.email || '',
      displayName: overrides?.displayName ?? existing?.displayName ?? user.displayName ?? 'Primary Administrator',
      role: overrides?.role ?? existing?.role ?? 'owner',
      authMethods: providerList.length > 0 ? providerList : existing?.authMethods || ['password'],
      active: existing?.active !== false,
      inactivityTimeoutMinutes: overrides?.inactivityTimeoutMinutes ?? existing?.inactivityTimeoutMinutes ?? 30,
      lastLoginAt: nowIso,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(adminRef, payload, { merge: true });

    // Ensure bootstrap lock document exists in Firestore
    const bootstrapRef = doc(db, 'settings', 'admin_bootstrap');
    const bootstrapSnap = await getDoc(bootstrapRef);
    if (!bootstrapSnap.exists()) {
      await setDoc(bootstrapRef, {
        setupCompleted: true,
        setupCompletedAt: nowIso,
        primaryAdminUid: user.uid,
        updatedAt: nowIso,
      });
    }

    return payload;
  } catch (err) {
    console.warn('[Admin Profile Sync Notice]:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Standard Email + Password Sign-In (Zero OTPs, Zero Enumerating Errors).
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
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const verify = await verifyCurrentAdminSession(cred.user);

    if (!verify.authorized) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: verify.code || 'ACCESS_DENIED',
        error: UNIFORM_LOGIN_ERROR,
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
    const fbCode = err?.code || '';

    if (fbCode === 'auth/operation-not-allowed') {
      return {
        success: false,
        code: 'auth/operation-not-allowed',
        error:
          'Email/Password sign-in is not yet enabled in Firebase Authentication Console. Enable "Email/Password" under Authentication > Sign-in method, or sign in with Google and link a password.',
      };
    }

    if (fbCode === 'auth/too-many-requests') {
      return {
        success: false,
        code: fbCode,
        error: 'Too many failed attempts detected. Please wait a few minutes or reset your password.',
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
      code: fbCode || 'AUTH_FAILED',
      error: UNIFORM_LOGIN_ERROR,
    };
  }
}

/**
 * Verified Google Sign-In for Administrator Access (Zero hardcoded email leakage).
 */
export async function signInAdminWithGoogle(): Promise<{
  success: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
  code?: string;
  unauthorizedDomain?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);

    const verify = await verifyCurrentAdminSession(cred.user);
    if (!verify.authorized) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: 'ACCESS_DENIED',
        error: 'Access denied. This account is not authorized for administration.',
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
    await signOut(auth).catch(() => {});

    const fbCode = err?.code || '';
    const isUnauthorizedDomain =
      fbCode === 'auth/unauthorized-domain' ||
      (typeof err?.message === 'string' && err.message.includes('auth/unauthorized-domain'));

    if (isUnauthorizedDomain) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      return {
        success: false,
        code: 'auth/unauthorized-domain',
        unauthorizedDomain: currentHost,
        error: `Google Sign-In blocked for domain "${currentHost}". Add this hostname to Firebase Authentication > Settings > Authorized domains, or sign in with Email & Password.`,
      };
    }

    if (fbCode === 'auth/popup-closed-by-user' || fbCode === 'auth/cancelled-popup-request') {
      return {
        success: false,
        code: fbCode,
        error: 'Google sign-in window was closed before completing authentication.',
      };
    }

    return {
      success: false,
      code: fbCode,
      error: err?.message || 'Google sign-in could not be completed.',
    };
  }
}

/**
 * Sends a Firebase password reset link without disclosing whether the address exists.
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
    // Only surface config errors like operation-not-allowed; absorb user-not-found to avoid enumeration
    if (err?.code === 'auth/operation-not-allowed') {
      return {
        success: false,
        message: 'Email/Password sign-in must be enabled in Firebase Console to send reset emails.',
      };
    }
  }

  return {
    success: true,
    message:
      'If an authorized administrator account corresponds to that email address, password reset instructions have been sent.',
  };
}

/**
 * Controlled One-Time Initial Administrator Setup.
 */
export async function completeFirstTimeSetup(params: {
  fullName: string;
  email: string;
  password: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  needsEmailVerification?: boolean;
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
    return { success: false, error: 'Please enter the administrator full name.' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  const strength = evaluatePasswordStrength(password);
  if (!strength.isValid) {
    return {
      success: false,
      error:
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.',
    };
  }

  try {
    let user: User;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      user = cred.user;
    } catch (createErr: any) {
      if (createErr?.code === 'auth/email-already-in-use') {
        const signInCred = await signInWithEmailAndPassword(auth, email, password);
        user = signInCred.user;
      } else if (createErr?.code === 'auth/operation-not-allowed') {
        return {
          success: false,
          code: 'auth/operation-not-allowed',
          error:
            'Firebase Email/Password authentication is currently disabled in your Firebase project. Enable Email/Password in Firebase Console or complete initial setup using Google verification below.',
        };
      } else {
        throw createErr;
      }
    }

    if (user.displayName !== fullName) {
      await updateProfile(user, { displayName: fullName }).catch(() => {});
    }

    const idToken = await user.getIdToken(true);
    const res = await fetch('/api/admin-auth?action=bootstrap-complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(setupSecret ? { 'x-admin-setup-secret': setupSecret } : {}),
      },
      body: JSON.stringify({ idToken, setupSecret }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      if (!user.emailVerified && data.code === 'BOOTSTRAP_UNAUTHORIZED') {
        await sendEmailVerification(user).catch(() => {});
        return {
          success: false,
          needsEmailVerification: true,
          user,
          code: 'NEEDS_EMAIL_VERIFICATION',
          error:
            'A verification link has been sent to your email address. Verify your email, then click "Complete Verification" below.',
        };
      }

      await signOut(auth).catch(() => {});
      return {
        success: false,
        code: data.code,
        error: data.error || 'Could not authorize initial administrator setup.',
      };
    }

    const profile = await syncAdminProfileInFirestore(user, { displayName: fullName, role: 'owner' });
    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: `Initial administrator account "${fullName}" configured.`,
      authMethod: 'password',
    });

    return { success: true, user, profile };
  } catch (err: any) {
    return {
      success: false,
      code: err?.code,
      error: err?.message || 'Failed to complete initial administrator setup.',
    };
  }
}

/**
 * Reloads Firebase user after clicking verification email and finalizes bootstrap.
 */
export async function finalizeVerificationAndBootstrap(params: {
  fullName: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  user?: User;
  profile?: AdminProfile | null;
  error?: string;
}> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'Active setup session expired. Please submit the setup form again.' };
  }

  try {
    await user.reload();
    const idToken = await user.getIdToken(true);
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
      return {
        success: false,
        error: data.error || 'Email verification has not yet completed or account lacks owner permissions.',
      };
    }

    const profile = await syncAdminProfileInFirestore(user, {
      displayName: params.fullName.trim() || user.displayName || 'Primary Administrator',
      role: 'owner',
    });
    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: 'Initial administrator email verified and setup finalized.',
      authMethod: 'password',
    });
    return { success: true, user, profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification check failed.' };
  }
}

/**
 * Google-based One-Time Initial Administrator Setup (same UID can then link password).
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
    const profile = await syncAdminProfileInFirestore(cred.user, { displayName, role: 'owner' });
    await recordAdminAuditLog({
      action: 'BOOTSTRAP_COMPLETED',
      status: 'success',
      details: `Initial administrator account "${displayName}" configured via Google.`,
      authMethod: 'google.com',
    });

    return { success: true, user: cred.user, profile };
  } catch (err: any) {
    await signOut(auth).catch(() => {});
    return {
      success: false,
      code: err?.code,
      error: err?.message || 'Google setup failed.',
    };
  }
}

/**
 * Reauthenticates the currently signed-in administrator before sensitive credential updates.
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
    provider.setCustomParameters({ prompt: 'select_account' });
    await reauthenticateWithPopup(user, provider);
    return;
  }

  if (!currentPassword) {
    throw new Error('Please enter your current password to verify identity.');
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
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.',
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
      error:
        err?.code === 'auth/provider-already-linked'
          ? 'Email/Password sign-in is already linked to this account.'
          : err?.code === 'auth/operation-not-allowed'
          ? 'Enable Email/Password sign-in in Firebase Console Authentication settings to link a password.'
          : err?.message || 'Failed to link password login method.',
    };
  }
}

/**
 * Links Google Sign-In onto the current Email/Password-authenticated Admin UID.
 */
export async function linkGoogleToCurrentAdmin(): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: 'You must be signed in first.' };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await linkWithPopup(user, provider);
    await syncAdminProfileInFirestore(user);
    await recordAdminAuditLog({
      action: 'GOOGLE_CREDENTIAL_LINKED',
      status: 'success',
      details: 'Google sign-in method linked to administrator UID.',
      authMethod: 'google.com',
    });
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to link Google sign-in.',
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
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.',
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
      error:
        err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'Current password verification failed.'
          : err?.message || 'Unable to update administrator password.',
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
      error: err?.message || 'Unable to initiate email update. Please verify your identity and try again.',
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
 * Registers or updates an authorized administrator by Firebase Auth UID.
 */
export async function registerAuthorizedAdmin(input: {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin';
}): Promise<{ success: boolean; error?: string }> {
  const cleanUid = input.uid.trim();
  const cleanEmail = input.email.trim();
  const cleanName = input.displayName.trim();

  if (!cleanUid || cleanUid.length < 6) {
    return { success: false, error: 'Valid Firebase Authentication UID is required.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Valid administrator email address is required.' };
  }

  try {
    const nowIso = new Date().toISOString();
    await setDoc(
      doc(db, 'admins', cleanUid),
      {
        uid: cleanUid,
        email: cleanEmail,
        displayName: cleanName || 'Administrator',
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to register administrator record.' };
  }
}

/**
 * Activates or revokes an authorized administrator account (cannot revoke own active session).
 */
export async function setAuthorizedAdminActive(
  targetUid: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    return { success: false, error: 'Active session required.' };
  }
  if (targetUid === currentUid && !active) {
    return { success: false, error: 'You cannot revoke your own currently active administrator account.' };
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
 * Explicitly logs out administrator and records audit trail.
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
