import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, AuthUser } from '@/types/auth';

interface AuthStateExtended extends AuthState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthStateExtended = {
  user: localStorage.getItem('pv_user') ? JSON.parse(localStorage.getItem('pv_user')!) : null,
  token: localStorage.getItem('pv_token'),
  isAuthenticated: !!localStorage.getItem('pv_token'),
  isAuthLoading: false,
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
      state.error = null;
      localStorage.setItem('pv_token', action.payload.token);
      localStorage.setItem('pv_user', JSON.stringify(action.payload.user));
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.isAuthLoading = action.payload;
      state.isLoading = action.payload;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
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
      state.error = null;
      localStorage.removeItem('pv_token');
      localStorage.removeItem('pv_user');
    },
  },
});

export const { setCredentials, setAuthLoading, setUser, setLoading, setError, clearError, logout } = authSlice.actions;
export default authSlice.reducer;
