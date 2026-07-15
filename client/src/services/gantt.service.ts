import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: `${API_URL}/tasks` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pv_token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

add401Interceptor(api);

export interface GanttTask {
  id: string;
  title: string;
  category: string | null;
  status: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  projectId: string;
  description: string | null;
  assignee: { id: string; fullName: string; email: string } | null;
  project: { id: string; name: string } | null;
}

export const ganttService = {
  getTasks: async (): Promise<GanttTask[]> => {
    const res = await api.get('/gantt');
    return res.data;
  },

  createTask: async (data: {
    projectId: string;
    title: string;
    category: string;
    status: string;
    startDate: string;
    dueDate: string;
    progress: number;
    assigneeId?: string;
    description?: string;
  }): Promise<GanttTask> => {
    const res = await api.post('/gantt', data);
    return res.data;
  },

  updateTask: async (taskId: string, data: Partial<{
    title: string;
    category: string;
    status: string;
    startDate: string;
    dueDate: string;
    progress: number;
    assigneeId: string;
  }>): Promise<GanttTask> => {
    const res = await api.patch(`/gantt/${taskId}`, data);
    return res.data;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await api.delete(`/gantt/${taskId}`);
  },
};
