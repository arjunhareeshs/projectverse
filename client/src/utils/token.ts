/**
 * Universal Token Accessor
 * Checks sessionStorage first (active session), with fallback to localStorage.
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('pv_token') || localStorage.getItem('pv_token') || null;
  } catch {
    return null;
  }
};

export const setAuthSession = (token: string, user?: any) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('pv_token', token);
    if (user) {
      sessionStorage.setItem('pv_user', JSON.stringify(user));
    }
  } catch {
    // ignore
  }
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('pv_token');
    sessionStorage.removeItem('pv_user');
    localStorage.removeItem('pv_token');
    localStorage.removeItem('pv_user');
    localStorage.removeItem('token');
  } catch {
    // ignore
  }
};
