import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL,
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
