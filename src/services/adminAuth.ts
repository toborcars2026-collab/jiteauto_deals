const TOKEN_KEY = 'jite_admin_session_token';

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  role?: string;
  needsSetup?: boolean;
}

export interface AdminAuthStatus {
  isSetup: boolean;
  mode: string;
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Checks whether administrator first-time password setup has already been completed.
 */
export async function checkAdminAuthStatus(): Promise<AdminAuthStatus> {
  try {
    const res = await fetch('/api/admin/auth/status', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      return {
        isSetup: Boolean(data.isSetup),
        mode: data.mode || 'password_only'
      };
    }
    return { isSetup: true, mode: 'password_only' };
  } catch (err) {
    return { isSetup: true, mode: 'password_only' };
  }
}

/**
 * Performs first-time administrator password configuration.
 */
export async function setupFirstTimeAdmin(password: string, confirmPassword: string): Promise<AdminAuthResult> {
  if (!password || !password.trim()) {
    return {
      success: false,
      error: 'Please enter a password.'
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters long.'
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      error: 'Passwords do not match.'
    };
  }

  try {
    const res = await fetch('/api/admin/auth/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      credentials: 'include',
      body: JSON.stringify({ password, confirmPassword })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      return {
        success: true,
        role: data.role || 'admin'
      };
    }

    return {
      success: false,
      error: data.error || 'Failed to setup administrator password.'
    };
  } catch (err: any) {
    console.error('[Admin Setup Error]:', err);
    return {
      success: false,
      error: 'Unable to connect to authentication server. Please try again.'
    };
  }
}

/**
 * Authenticates the administrator using server-side password verification.
 * Zero client-side credential exposure.
 */
export async function authenticateAdmin(password: string): Promise<AdminAuthResult> {
  if (!password || !password.trim()) {
    return {
      success: false,
      error: 'Please enter the administrator password.'
    };
  }

  try {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      credentials: 'include',
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      return {
        success: true,
        role: data.role || 'admin'
      };
    }

    return {
      success: false,
      needsSetup: Boolean(data.needsSetup),
      error: data.error || 'Incorrect administrator password. Please try again.'
    };
  } catch (err: any) {
    console.error('[Admin Login Error]:', err);
    return {
      success: false,
      error: 'Incorrect administrator password. Please try again.'
    };
  }
}

/**
 * Verifies if the current administrator session is valid.
 */
export async function verifyAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/auth/verify', {
      method: 'GET',
      headers: getAdminAuthHeaders(),
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data.authenticated);
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Changes administrator password securely via server-side cryptographic update.
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!currentPassword || !newPassword) {
    return {
      success: false,
      error: 'Both current password and new password are required.'
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      error: 'New password must be at least 8 characters long.'
    };
  }

  try {
    const res = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Administrator password updated successfully.'
      };
    }

    return {
      success: false,
      error: data.error || 'Failed to update administrator password.'
    };
  } catch (err: any) {
    console.error('[Admin Change Password Error]:', err);
    return {
      success: false,
      error: 'Unable to connect to server to update password. Please try again.'
    };
  }
}

/**
 * Signs out administrator and destroys active session server-side.
 */
export async function logoutAdminSession(): Promise<void> {
  const token = getAdminToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }

  try {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      credentials: 'include'
    });
  } catch (err) {
    // Non-blocking
  }
}
