import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/schedule`,
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

export const scheduleService = {
  getEvents: async () => {
    const response = await api.get('/');
    return response.data;
  },

  createEvent: async (eventData: {
    title: string;
    date: string;
    timeString: string;
    hour: number;
    duration: number;
    room: string;
    color: string;
  }) => {
    const response = await api.post('/', eventData);
    return response.data;
  },

  deleteEvent: async (id: string) => {
    const response = await api.delete(`/${id}`);
    return response.data;
  },
};
export type CalendarEventBackend = {
  id: string;
  userId: string;
  title: string;
  date: string;
  timeString: string;
  hour: number;
  duration: number;
  room: string;
  color: string;
};
