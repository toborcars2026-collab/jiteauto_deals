import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
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
 * Checks whether the master administrator has been initialized.
 */
export async function getAdminStatus(): Promise<AdminStatus> {
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
    console.warn('[Admin Status Check Error]:', err);
  }
  return { isInitialized: true, adminEmail: null };
}

/**
 * Authenticates the administrator on fresh dashboard entry.
 */
export async function authenticateAdmin(email: string, password: string): Promise<AdminAuthResult> {
  const cleanEmail = email.trim();

  // 1. First attempt: Firebase Authentication Client SDK
  try {
    const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    if (userCred.user) {
      return { success: true, email: userCred.user.email || cleanEmail };
    }
  } catch (firebaseErr: any) {
    const code = firebaseErr?.code;
    console.warn('[Firebase Client Auth Notice]:', code || firebaseErr?.message);
  }

  // 2. Server-Side Secure Authentication Gateway
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
      return { success: true, email: data.user?.email || cleanEmail };
    } else {
      return {
        success: false,
        error: data.error || 'Invalid administrator email or password.'
      };
    }
  } catch (serverErr: any) {
    return {
      success: false,
      error: 'Network connection failed. Please check your internet connection.'
    };
  }
}

/**
 * Initializes the first administrator account.
 */
export async function setupFirstAdmin(email: string, password: string): Promise<AdminAuthResult> {
  const cleanEmail = email.trim();

  // 1. Attempt Firebase Authentication Client SDK
  try {
    await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (firebaseErr: any) {
    console.warn('[Firebase Auth Register Notice]:', firebaseErr?.code || firebaseErr?.message);
  }

  // 2. Provision and secure on server gateway
  try {
    const res = await fetch('/api/admin/auth/setup', {
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
      return { success: true, email: data.user?.email || cleanEmail };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to initialize administrator account.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'Failed to connect to authentication service.'
    };
  }
}

/**
 * Changes administrator password securely.
 */
export async function changeAdminPassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  let firebaseSuccess = false;

  // If Firebase currentUser exists, update in Firebase Auth
  if (auth.currentUser && auth.currentUser.email) {
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      firebaseSuccess = true;
    } catch (err: any) {
      console.warn('[Firebase Auth Password Change Notice]:', err?.code || err?.message);
    }
  }

  // Update on server authentication gateway
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

    if (firebaseSuccess) {
      return { success: true };
    }

    return {
      success: false,
      error: data.error || 'Failed to change password. Please verify your current password.'
    };
  } catch (err: any) {
    if (firebaseSuccess) {
      return { success: true };
    }
    return {
      success: false,
      error: 'Network connection failed while updating password.'
    };
  }
}

/**
 * Dispatches a password reset email/link.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim();

  // Try Firebase Client
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    console.warn('[Firebase Password Reset Notice]:', err?.code || err?.message);
  }

  // Server endpoint
  try {
    await fetch('/api/admin/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
  } catch {
    // Ignore
  }

  return {
    success: true,
    message: 'If an administrator account exists for this email, password reset instructions have been dispatched.'
  };
}

/**
 * Signs out the administrator and invalidates session.
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
