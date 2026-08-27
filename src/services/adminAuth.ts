import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut as firebaseSignOut,
  ActionCodeSettings
} from 'firebase/auth';
import { auth } from '../firebase';

const TOKEN_KEY = 'jite_admin_session_token';
const ADMIN_EMAIL_KEY = 'jite_admin_cached_email';

export interface AdminAuthResult {
  success: boolean;
  email?: string;
  error?: string;
}

export interface AdminStatus {
  isInitialized: boolean;
  adminEmail: string | null;
}

/**
 * Maps Firebase Auth error codes to precise, truthful human-readable error messages.
 * Never falsely reports internet or network errors unless an actual network failure occurred.
 */
export function getFirebaseAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  const message = error?.message || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/user-not-found':
      return 'No administrator account was found with these credentials.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please reset your password or try again later.';
    case 'auth/network-request-failed':
      return 'Unable to connect to the authentication service. Please check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Administrator email/password authentication is currently disabled in Firebase. Please enable Email/Password provider in the Firebase Console.';
    case 'auth/configuration-not-found':
      return 'Administrator authentication is currently unavailable. Please check the Firebase Authentication configuration.';
    case 'auth/unauthorized-domain':
      return 'This domain is not in the Firebase Authentication Authorized Domains list. Please add it in the Firebase Console.';
    case 'auth/timeout':
      return 'The authentication service is taking too long to respond. Please try again.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please sign in again and retry.';
    case 'auth/expired-action-code':
      return 'The password reset link has expired. Please request a new password reset email.';
    case 'auth/invalid-action-code':
      return 'The password reset link is invalid or has already been used. Please request a new one.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters with a combination of letters and numbers.';
    default:
      if (message && !message.includes('Firebase:')) {
        return message;
      }
      return 'Authentication failed. Please verify your credentials and try again.';
  }
}

/**
 * Helper to wrap any async operation with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err: any = new Error('The authentication service is taking too long to respond. Please try again.');
      err.code = 'auth/timeout';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Checks whether administrator account is ready.
 */
export async function getAdminStatus(): Promise<AdminStatus> {
  // Check if active Firebase user exists
  if (auth.currentUser?.email) {
    return {
      isInitialized: true,
      adminEmail: auth.currentUser.email
    };
  }

  // Non-blocking server check
  try {
    const res = await fetch('/api/admin/auth/status', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        isInitialized: Boolean(data.isInitialized),
        adminEmail: data.adminEmail || null
      };
    }
  } catch (err) {
    // Non-blocking
  }
  return { isInitialized: true, adminEmail: null };
}

/**
 * Authenticates the administrator fast and reliably via Firebase Authentication.
 */
export async function authenticateAdmin(email: string, password: string): Promise<AdminAuthResult> {
  const cleanEmail = email.trim();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter both your administrator email and password.' };
  }

  // 1. Primary: Direct Firebase Authentication Client SDK
  try {
    const userCred = await withTimeout(signInWithEmailAndPassword(auth, cleanEmail, password), 12000);
    if (userCred.user) {
      const confirmedEmail = userCred.user.email || cleanEmail;
      localStorage.setItem(ADMIN_EMAIL_KEY, confirmedEmail);

      // Background session sync for any server proxy endpoints (non-blocking)
      fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ email: cleanEmail, password })
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        }
      }).catch(() => {});

      return { success: true, email: confirmedEmail };
    }
  } catch (firebaseErr: any) {
    const code = firebaseErr?.code;
    console.warn('[Firebase Auth Login Attempt]:', code || firebaseErr?.message);

    // If it's a definite credentials error or domain error, report the precise reason immediately
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email' ||
      code === 'auth/user-disabled' ||
      code === 'auth/too-many-requests' ||
      code === 'auth/unauthorized-domain' ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/timeout'
    ) {
      // If user not found on Firebase, try server fallback just in case account was created in server store
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        try {
          const res = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ email: cleanEmail, password })
          });
          const data = await res.json();
          if (res.ok && data.success && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(ADMIN_EMAIL_KEY, cleanEmail);
            return { success: true, email: data.user?.email || cleanEmail };
          }
        } catch {
          // Fall through to precise message
        }
      }

      return {
        success: false,
        error: getFirebaseAuthErrorMessage(firebaseErr)
      };
    }

    // 2. Fallback attempt via Server Gateway for network recovery
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(ADMIN_EMAIL_KEY, cleanEmail);
        return { success: true, email: data.user?.email || cleanEmail };
      } else {
        return {
          success: false,
          error: data.error || getFirebaseAuthErrorMessage(firebaseErr)
        };
      }
    } catch (serverErr: any) {
      return {
        success: false,
        error: getFirebaseAuthErrorMessage(firebaseErr)
      };
    }
  }

  return {
    success: false,
    error: 'Authentication failed. Please verify your credentials and try again.'
  };
}

/**
 * Initializes the first administrator account directly in Firebase Authentication.
 */
export async function setupFirstAdmin(email: string, password: string): Promise<AdminAuthResult> {
  const cleanEmail = email.trim();

  // 1. Firebase Authentication Client SDK
  try {
    const userCred = await withTimeout(createUserWithEmailAndPassword(auth, cleanEmail, password), 12000);
    if (userCred.user) {
      const confirmedEmail = userCred.user.email || cleanEmail;
      localStorage.setItem(ADMIN_EMAIL_KEY, confirmedEmail);

      // Server gateway setup (non-blocking)
      fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ email: cleanEmail, password })
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        }
      }).catch(() => {});

      return { success: true, email: confirmedEmail };
    }
  } catch (firebaseErr: any) {
    console.warn('[Firebase Auth Register Notice]:', firebaseErr?.code || firebaseErr?.message);
    return {
      success: false,
      error: getFirebaseAuthErrorMessage(firebaseErr)
    };
  }

  return {
    success: false,
    error: 'Failed to create administrator account.'
  };
}

/**
 * Changes administrator password securely via Firebase Authentication.
 */
export async function changeAdminPassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!oldPassword || !newPassword) {
    return { success: false, error: 'Both current password and new password are required.' };
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }

  let firebaseUpdated = false;

  // 1. Firebase Authentication update
  if (auth.currentUser && auth.currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await withTimeout(reauthenticateWithCredential(auth.currentUser, credential), 10000);
      await withTimeout(updatePassword(auth.currentUser, newPassword), 10000);
      firebaseUpdated = true;
    } catch (err: any) {
      console.warn('[Firebase Auth Password Change Notice]:', err?.code || err?.message);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        return { success: false, error: 'Incorrect current password. Please verify and try again.' };
      }
      if (err?.code === 'auth/weak-password') {
        return { success: false, error: 'New password is too weak. Please use at least 8 characters with letters and numbers.' };
      }
      return { success: false, error: getFirebaseAuthErrorMessage(err) };
    }
  }

  // 2. Server gateway password sync
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }

    if (firebaseUpdated) {
      return { success: true };
    }

    return {
      success: false,
      error: data.error || 'Failed to update password. Please check your current password.'
    };
  } catch (err: any) {
    if (firebaseUpdated) {
      return { success: true };
    }
    return {
      success: false,
      error: 'Unable to connect to authentication service while updating password.'
    };
  }
}

/**
 * Dispatches an official Firebase password reset email.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string; error?: string }> {
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    return {
      success: false,
      message: '',
      error: 'Please enter the administrator email address.'
    };
  }

  const actionCodeSettings: ActionCodeSettings = {
    url: typeof window !== 'undefined' ? `${window.location.origin}/?tab=admin` : 'https://jiteautodeals.com/?tab=admin',
    handleCodeInApp: true
  };

  // Dispatch via Firebase Authentication Client SDK
  try {
    await withTimeout(sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings), 12000);
    return {
      success: true,
      message: 'Password reset email sent. Check your inbox and spam folder.'
    };
  } catch (err: any) {
    console.warn('[Firebase Password Reset Error]:', err?.code || err?.message);
    const mapped = getFirebaseAuthErrorMessage(err);
    return {
      success: false,
      message: '',
      error: mapped
    };
  }
}

/**
 * Verifies a password reset action code from the reset link.
 */
export async function verifyResetCode(oobCode: string): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!oobCode) {
    return {
      success: false,
      error: 'Invalid password reset code.'
    };
  }

  try {
    const email = await withTimeout(verifyPasswordResetCode(auth, oobCode), 10000);
    return {
      success: true,
      email
    };
  } catch (err: any) {
    console.warn('[Firebase Verify Reset Code Notice]:', err?.code || err?.message);
    return {
      success: false,
      error: getFirebaseAuthErrorMessage(err)
    };
  }
}

/**
 * Confirms the new password using the verified action code.
 */
export async function confirmNewPassword(oobCode: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!oobCode || !newPassword) {
    return {
      success: false,
      error: 'Missing required password reset information.'
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      error: 'New password must be at least 8 characters long.'
    };
  }

  try {
    await withTimeout(confirmPasswordReset(auth, oobCode, newPassword), 12000);
    return { success: true };
  } catch (err: any) {
    console.warn('[Firebase Confirm Reset Password Notice]:', err?.code || err?.message);
    return {
      success: false,
      error: getFirebaseAuthErrorMessage(err)
    };
  }
}

/**
 * Signs out the administrator and completely invalidates active session.
 */
export async function logoutAdminSession(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);

  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore
  }

  if (token) {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      // Ignore
    }
  }
}
