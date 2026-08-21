import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, AuthUser } from '@/types/auth';

// Purge legacy persistent localStorage tokens to guarantee fresh session login
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('pv_token');
    localStorage.removeItem('pv_user');
  } catch {
    // Ignore storage errors
  }
}

interface AuthStateExtended extends AuthState {
  token: string | null;
  isLoading: boolean;
  isVerifyingSession: boolean;
  error: string | null;
}

const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('pv_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('pv_token');
};

const initialToken = getStoredToken();

const initialState: AuthStateExtended = {
  user: getStoredUser(),
  token: initialToken,
  isAuthenticated: !!initialToken,
  isAuthLoading: false,
  isVerifyingSession: !!initialToken, // Verify with backend on boot if token exists
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isVerifyingSession = false;
      state.error = null;
      try {
        sessionStorage.setItem('pv_token', action.payload.token);
        sessionStorage.setItem('pv_user', JSON.stringify(action.payload.user));
      } catch {
        // Handle private browsing or quota limits gracefully
      }
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.isAuthLoading = action.payload;
      state.isLoading = action.payload;
    },
    setVerifyingSession(state, action: PayloadAction<boolean>) {
      state.isVerifyingSession = action.payload;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      state.isVerifyingSession = false;
      if (action.payload) {
        try {
          sessionStorage.setItem('pv_user', JSON.stringify(action.payload));
        } catch {
          // ignore
        }
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError(state) {
      state.error = null;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isVerifyingSession = false;
      state.error = null;
      try {
        sessionStorage.removeItem('pv_token');
        sessionStorage.removeItem('pv_user');
        localStorage.removeItem('pv_token');
        localStorage.removeItem('pv_user');
      } catch {
        // ignore
      }
    },
  },
});

export const {
  setCredentials,
  setAuthLoading,
  setVerifyingSession,
  setUser,
  setLoading,
  setError,
  clearError,
  logout,
} = authSlice.actions;

export default authSlice.reducer;

