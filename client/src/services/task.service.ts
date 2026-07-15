import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/tasks`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pv_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

add401Interceptor(api);

export const taskService = {
  getOrgTasks: async () => {
    const response = await api.get('/org');
    return response.data;
  },
  getProjectTasks: async (projectId: string) => {
    const response = await api.get(`/project/${projectId}`);
    return response.data;
  },
  updateTaskStatus: async (taskId: string, status: string) => {
    const response = await api.patch(`/${taskId}/status`, { status });
    return response.data;
  },
  createTask: async (taskData: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    assigneeId?: string;
    dueDate?: string;
  }) => {
    const response = await api.post('/', taskData);
    return response.data;
  },
};
