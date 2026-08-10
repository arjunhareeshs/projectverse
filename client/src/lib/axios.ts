import axios from 'axios';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:4000/api`;
};

export const apiClient = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  timeout: 15000,
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Phase 1 boundary: full refresh flow is implemented in Phase 2.
    return Promise.reject(error);
  },
);
