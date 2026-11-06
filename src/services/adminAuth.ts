import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';

export interface AdminAuthStatus {
  bootstrapped: boolean;
  authorizedEmailHint: string | null;
  emailDeliveryConfigured: boolean;
  authenticated: boolean;
  email: string | null;
  role: string | null;
  updatedAt: string | null;
}

export interface AdminLoginResult {
  success: boolean;
  error?: string;
  code?: string;
  step?: 'otp_required' | 'authenticated';
  preAuthToken?: string;
  emailMasked?: string;
  resendIn?: number;
  expiresIn?: number;
  token?: string;
  role?: string;
  email?: string;
  emailDelivered?: boolean;
  emailDeliveryError?: string | null;
  devTestCode?: string;
}

/**
 * Checks server authentication status:
 * - Whether initial one-time bootstrap has been completed
 * - Masked authorized email hint
 * - Whether transactional email provider is configured
 * - Whether current client has an active authenticated session
 */
export async function getAdminAuthStatus(): Promise<AdminAuthStatus> {
  try {
    const res = await fetch('/api/admin-auth?action=status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return {
        bootstrapped: Boolean(data.bootstrapped),
        authorizedEmailHint: data.authorizedEmailHint || null,
        emailDeliveryConfigured: Boolean(data.emailDeliveryConfigured),
        authenticated: Boolean(data.authenticated),
        email: data.email || null,
        role: data.role || null,
        updatedAt: data.updatedAt || null,
      };
    }
    return {
      bootstrapped: false,
      authorizedEmailHint: null,
      emailDeliveryConfigured: false,
      authenticated: false,
      email: null,
      role: null,
      updatedAt: null,
    };
  } catch {
    return {
      bootstrapped: false,
      authorizedEmailHint: null,
      emailDeliveryConfigured: false,
      authenticated: false,
      email: null,
      role: null,
      updatedAt: null,
    };
  }
}

/**
 * Initial One-Time Administrator Setup (Bootstrap)
 * Can only be executed once. Once completed, permanently locked.
 */
export async function bootstrapAdmin(payload: {
  email: string;
  password?: string;
  confirmPassword?: string;
  googleUid?: string;
  setupSecret?: string;
}): Promise<{ success: boolean; error?: string; token?: string; email?: string; code?: string }> {
  try {
    const res = await fetch('/api/admin-auth?action=bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.setupSecret ? { 'x-admin-setup-secret': payload.setupSecret } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to complete initial administrator setup.',
        code: data.code,
      };
    }

    return {
      success: true,
      token: data.token,
      email: data.email,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during administrator setup.',
    };
  }
}

/**
 * Initial Setup Option A: Authenticate Google Account for Initial Setup
 * Retrieves authenticated Google credentials before the owner confirms permanent administrator association.
 */
export async function triggerGoogleAuthForSetup(): Promise<{
  success: boolean;
  email?: string;
  uid?: string;
  idToken?: string;
  error?: string;
  code?: string;
  unauthorizedDomain?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    if (!user || !user.email) {
      return {
        success: false,
        error: 'Unable to retrieve authenticated Google account email.',
      };
    }

    const idToken = await user.getIdToken();
    return {
      success: true,
      email: user.email,
      uid: user.uid,
      idToken,
    };
  } catch (err: any) {
    const isUnauthorizedDomain =
      err?.code === 'auth/unauthorized-domain' ||
      (typeof err?.message === 'string' && err.message.includes('auth/unauthorized-domain'));

    if (isUnauthorizedDomain) {
      const currentHost =
        typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'jiteautodeals.vercel.app';
      return {
        success: false,
        code: 'auth/unauthorized-domain',
        unauthorizedDomain: currentHost,
        error: `Firebase: Error (auth/unauthorized-domain). The domain "${currentHost}" is not yet added in Firebase Authentication Authorized Domains.`,
      };
    }

    return {
      success: false,
      code: err?.code,
      error: err?.message || 'Google authentication was cancelled or interrupted.',
    };
  }
}

/**
 * Initial Setup Option A: Confirm and Establish Administrator Account with Google
 */
export async function bootstrapWithGoogleAdmin(payload: {
  email: string;
  uid: string;
  idToken?: string;
  setupSecret?: string;
}): Promise<{ success: boolean; error?: string; token?: string; email?: string; code?: string }> {
  try {
    const res = await fetch('/api/admin-auth?action=bootstrap-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.setupSecret ? { 'x-admin-setup-secret': payload.setupSecret } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to complete Google administrator setup.',
        code: data.code,
      };
    }

    return {
      success: true,
      token: data.token,
      email: data.email,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during Google administrator setup.',
    };
  }
}

/**
 * Initial Setup Option B: Request Verification OTP for Email & Password Setup
 */
export async function requestBootstrapOtp(payload: {
  email: string;
  password: string;
  confirmPassword: string;
  setupSecret?: string;
}): Promise<{
  success: boolean;
  step?: string;
  tempSetupToken?: string;
  maskedEmail?: string;
  resendIn?: number;
  expiresIn?: number;
  emailDelivered?: boolean;
  emailDeliveryError?: string | null;
  devTestCode?: string;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch('/api/admin-auth?action=bootstrap-request-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.setupSecret ? { 'x-admin-setup-secret': payload.setupSecret } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to initiate email verification.',
        code: data.code,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error requesting setup OTP.',
    };
  }
}

/**
 * Initial Setup Option B: Verify OTP Code and Activate Administrator Account
 */
export async function verifyBootstrapOtp(payload: {
  tempSetupToken: string;
  code: string;
}): Promise<{ success: boolean; error?: string; token?: string; email?: string; code?: string; attemptsRemaining?: number }> {
  try {
    const res = await fetch('/api/admin-auth?action=bootstrap-verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Verification failed. Please check the code and try again.',
        code: data.code,
        attemptsRemaining: data.attemptsRemaining,
      };
    }

    return {
      success: true,
      token: data.token,
      email: data.email,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error verifying setup code.',
    };
  }
}

/**
 * Initial Setup Option B: Resend Setup OTP Code
 */
export async function resendBootstrapOtp(tempSetupToken: string): Promise<{
  success: boolean;
  message?: string;
  resendIn?: number;
  emailDelivered?: boolean;
  devTestCode?: string;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch('/api/admin-auth?action=bootstrap-resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempSetupToken }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to resend setup verification code.',
        code: data.code,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error resending setup code.',
    };
  }
}

/**
 * Secure Server-Side Account Recovery Procedure
 * Resets administrator provisioning when authorized with ADMIN_RECOVERY_SECRET.
 */
export async function recoverAdminSetup(recoverySecret: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch('/api/admin-auth?action=recover-setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-recovery-secret': recoverySecret,
      },
      body: JSON.stringify({ recoverySecret }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Recovery failed. Please check your recovery secret.',
        code: data.code,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during recovery.',
    };
  }
}

/**
 * Continue with Google Authentication
 * 1. Opens Google secure authentication popup
 * 2. Authenticates account with Firebase Auth
 * 3. Sends credentials to trusted backend for strict single-authorized-admin authorization
 * 4. If account doesn't match: immediately signs out and displays "ACCESS DENIED"
 */
export async function signInWithGoogleAdmin(): Promise<{
  success: boolean;
  error?: string;
  email?: string;
  code?: string;
  unauthorizedDomain?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    if (!user || !user.email) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: 'Unable to retrieve authenticated Google account email.',
      };
    }

    const idToken = await user.getIdToken();

    // Verify against trusted server authorization
    const res = await fetch('/api/admin-auth?action=google-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        uid: user.uid,
        idToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Must revoke client-side session immediately
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error:
          data.error ||
          'ACCESS DENIED. This Google account is not authorised to access the Jite Auto Deals Administration System.',
        code: data.code,
      };
    }

    return {
      success: true,
      email: data.email || user.email,
    };
  } catch (err: any) {
    await signOut(auth).catch(() => {});

    // Inspect specifically for Firebase auth/unauthorized-domain error
    const isUnauthorizedDomain =
      err?.code === 'auth/unauthorized-domain' ||
      (typeof err?.message === 'string' && err.message.includes('auth/unauthorized-domain'));

    if (isUnauthorizedDomain) {
      const currentHost =
        typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'jiteautodeals.vercel.app';

      return {
        success: false,
        code: 'auth/unauthorized-domain',
        unauthorizedDomain: currentHost,
        error: `Firebase: Error (auth/unauthorized-domain). The current domain "${currentHost}" is not yet added to Firebase Authentication Authorized Domains for project "gen-lang-client-0327661147".`,
      };
    }

    return {
      success: false,
      code: err?.code,
      error: err?.message || 'Google authentication was cancelled or interrupted.',
    };
  }
}

/**
 * Step 1: Email and Password Authentication
 * Uses Firebase Authentication email/password when configured, verified against backend master record.
 * Then initiates dispatch of 6-digit OTP code to the registered email.
 */
export async function loginWithEmailPassword(email: string, password: string): Promise<AdminLoginResult> {
  try {
    let firebaseIdToken: string | undefined;

    // Attempt Firebase Authentication email/password sign-in first
    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (userCred.user) {
        firebaseIdToken = await userCred.user.getIdToken();
      }
    } catch (fbErr: any) {
      // If Firebase Auth Email/Password provider is disabled in Firebase console (auth/operation-not-allowed)
      // or user was initialized before Firebase Auth user record, the backend will verify using PBKDF2 hash
      console.warn('[Firebase Auth email/password note]:', fbErr?.code || fbErr?.message);
    }

    const res = await fetch('/api/admin-auth?action=email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, idToken: firebaseIdToken }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect email address or password. Please try again.',
        code: data.code,
        emailDelivered: data.emailDelivered,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during authentication. Please try again.',
    };
  }
}

/**
 * Step 2: Verify 6-digit Email One-Time Verification Code (OTP)
 */
export async function verifyEmailOtp(preAuthToken: string, code: string): Promise<AdminLoginResult> {
  try {
    const res = await fetch('/api/admin-auth?action=verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preAuthToken, code }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect verification code. Please check your email.',
        code: data.code,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to verify code. Please try again.',
    };
  }
}

/**
 * Resend Email One-Time Verification Code (OTP)
 */
export async function resendEmailOtp(preAuthToken: string): Promise<{
  success: boolean;
  error?: string;
  resendIn?: number;
  message?: string;
  emailDelivered?: boolean;
  emailDeliveryError?: string | null;
  devTestCode?: string;
}> {
  try {
    const res = await fetch('/api/admin-auth?action=resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preAuthToken }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to resend verification code.',
      };
    }

    return {
      success: true,
      message: data.message || 'Verification code resent successfully.',
      resendIn: data.resendIn || 60,
      emailDelivered: data.emailDelivered,
      emailDeliveryError: data.emailDeliveryError,
      devTestCode: data.devTestCode,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while resending verification code.',
    };
  }
}

/**
 * Authenticates administrator using master password.
 */
export async function authenticateAdmin(password: string): Promise<{ success: boolean; error?: string; role?: string; token?: string }> {
  try {
    const res = await fetch('/api/admin-auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Incorrect administrator password. Please try again.',
      };
    }

    if (typeof window !== 'undefined' && data.token) {
      sessionStorage.setItem('jite_admin_session_active', data.token);
      localStorage.setItem('jite_admin_session_active', data.token);
    }

    return {
      success: true,
      role: data.role || 'admin',
      token: data.token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during authentication. Please try again.',
    };
  }
}

/**
 * Verifies if an active, unexpired administrator session is present
 */
export async function verifyAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin-auth?action=verify', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data.authenticated);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Signs out administrator from both server and Firebase Auth
 */
export async function logoutAdminSession(): Promise<void> {
  try {
    await fetch('/api/admin-auth?action=logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {}

  try {
    await signOut(auth);
  } catch {}
}

/**
 * Changes administrator password (requires active session)
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/admin-auth?action=change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to update administrator password.',
      };
    }

    return {
      success: true,
      message: data.message || 'Administrator password changed successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while updating password.',
    };
  }
}
