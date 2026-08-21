import axios, { AxiosInstance } from 'axios';

export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:4000/api`;
};

export const getBackendHostUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:4000`;
};

import { getAuthToken, clearAuthSession } from '../utils/token';

export { getAuthToken, clearAuthSession };

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function add401Interceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        const isAuthEndpoint =
          error.config?.url?.includes('/auth/login') ||
          error.config?.url?.includes('/auth/register') ||
          error.config?.url?.includes('/auth/google');
        if (!isAuthEndpoint) {
          const hadToken = !!getAuthToken();
          clearAuthSession();
          if (hadToken && !window.location.pathname.includes('/login') && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
}

// Apply it to the main api client
add401Interceptor(api);
