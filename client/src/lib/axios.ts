import axios from 'axios';
import { getApiBaseUrl } from '../services/api';

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
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
