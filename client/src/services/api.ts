import axios, { AxiosInstance } from 'axios';

const PUBLIC_BASE_PATH = '/verse';

export const resolveOrigin = (type: 'api' | 'backend' | 'socket' = 'api') => {
  if (type === 'api' && import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (type === 'backend' && import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (type === 'socket' && import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;

  // In production (e.g. deployed container behind reverse proxy), use same-origin
  if (import.meta.env.PROD) {
    if (type === 'api') return `${PUBLIC_BASE_PATH}/api`;
    if (type === 'backend') return PUBLIC_BASE_PATH;
    return typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  }

  // Development fallback
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  if (type === 'api') return `http://${host}:4000/api`;
  return `http://${host}:4000`;
};

export const getApiBaseUrl = () => resolveOrigin('api');
export const getBackendHostUrl = () => resolveOrigin('backend');
export const getSocketUrl = () => resolveOrigin('socket');

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
          if (hadToken && !window.location.pathname.includes(`${PUBLIC_BASE_PATH}/login`) && window.location.pathname !== `${PUBLIC_BASE_PATH}/`) {
            window.location.href = `${PUBLIC_BASE_PATH}/login`;
          }
        }
      }
      return Promise.reject(error);
    }
  );
}

// Apply it to the main api client
add401Interceptor(api);
