import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/projects`,
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

export const projectService = {
  getActiveProjects: async () => {
    const response = await api.get('/active');
    return response.data;
  },
  createProject: async (projectData: {
    name: string;
    description?: string;
    status?: string;
  }) => {
    const response = await api.post('/', projectData);
    return response.data;
  },
};
