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
 * Universal resilient fetcher that supports both modular /api/admin/auth/* and /api/admin-auth?action=*
 */
async function callAdminApi(
  action: 'status' | 'setup' | 'login' | 'verify' | 'change-password' | 'logout' | 'reset',
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const isGet = (options.method || 'GET').toUpperCase() === 'GET';
  const primaryUrl = `/api/admin/auth/${action}`;
  const fallbackUrl = `/api/admin-auth?action=${action}`;

  const defaultHeaders = isGet
    ? { 'Cache-Control': 'no-cache' }
    : getAdminAuthHeaders();

  const mergedOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  try {
    let res = await fetch(primaryUrl, mergedOptions);
    
    // If endpoint is 404/502/503 or returns HTML error, try fallback
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && (res.status === 404 || res.status === 502 || res.status === 503 || !contentType.includes('application/json'))) {
      try {
        const fallbackRes = await fetch(fallbackUrl, mergedOptions);
        if (fallbackRes.ok || fallbackRes.status < 500) {
          res = fallbackRes;
        }
      } catch (fallbackErr) {
        // Stick with original res
      }
    }

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = { error: res.statusText || 'Unable to parse server response.' };
    }

    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (netErr: any) {
    // Attempt fallback upon direct network error
    try {
      const fallbackRes = await fetch(fallbackUrl, mergedOptions);
      let data: any = {};
      try {
        data = await fallbackRes.json();
      } catch {
        data = { error: fallbackRes.statusText || 'Unable to parse server response.' };
      }
      return {
        ok: fallbackRes.ok,
        status: fallbackRes.status,
        data
      };
    } catch (finalErr) {
      console.error(`[AdminAuth API Error on action "${action}"]:`, finalErr);
      return {
        ok: false,
        status: 0,
        data: { error: 'Unable to connect to authentication server. Please verify your internet connection.' }
      };
    }
  }
}

/**
 * Checks whether administrator first-time password setup has already been completed.
 */
export async function checkAdminAuthStatus(): Promise<AdminAuthStatus> {
  try {
    const result = await callAdminApi('status', { method: 'GET' });
    if (result.ok && result.data) {
      return {
        isSetup: Boolean(result.data.isSetup),
        mode: result.data.mode || 'password_only'
      };
    }
    return { isSetup: false, mode: 'password_only' };
  } catch (err) {
    return { isSetup: false, mode: 'password_only' };
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
    const result = await callAdminApi('setup', {
      method: 'POST',
      body: JSON.stringify({ password, confirmPassword })
    });

    if (result.ok && result.data.success) {
      if (result.data.token && typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, result.data.token);
      }
      return {
        success: true,
        role: result.data.role || 'admin'
      };
    }

    return {
      success: false,
      error: result.data.error || 'Failed to setup administrator password.'
    };
  } catch (err: any) {
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
    const result = await callAdminApi('login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });

    if (result.ok && result.data.success) {
      if (result.data.token && typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, result.data.token);
      }
      return {
        success: true,
        role: result.data.role || 'admin'
      };
    }

    return {
      success: false,
      needsSetup: Boolean(result.data.needsSetup),
      error: result.data.error || 'Incorrect administrator password. Please try again.'
    };
  } catch (err: any) {
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
    const result = await callAdminApi('verify', { method: 'GET' });
    if (result.ok && result.data) {
      return Boolean(result.data.authenticated);
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
    const result = await callAdminApi('change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    if (result.ok && result.data.success) {
      return {
        success: true,
        message: result.data.message || 'Administrator password updated successfully.'
      };
    }

    return {
      success: false,
      error: result.data.error || 'Failed to update administrator password.'
    };
  } catch (err: any) {
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
    await callAdminApi('logout', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Resets administrator authentication state (returns system to First-Time Setup).
 * Requires active admin session or secret resetKey.
 */
export async function resetAdminSetup(resetKey?: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const result = await callAdminApi('reset', {
      method: 'POST',
      body: JSON.stringify({ resetKey })
    });

    if (result.ok && result.data.success) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
      return { success: true, message: result.data.message };
    }
    return { success: false, error: result.data.error || 'Failed to reset admin setup.' };
  } catch (err: any) {
    return { success: false, error: 'Unable to connect to server.' };
  }
}
