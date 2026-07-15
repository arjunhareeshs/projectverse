import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/notifications`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pv_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

add401Interceptor(api);

export const notificationService = {
  getNotifications: async () => {
    const response = await api.get('/');
    return response.data;
  },

  markRead: async (id: string) => {
    const response = await api.patch(`/${id}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.post('/read-all');
    return response.data;
  },

  createMockNotification: async (title?: string, body?: string) => {
    const response = await api.post('/mock', { title, body });
    return response.data;
  },
};
export default notificationService;
