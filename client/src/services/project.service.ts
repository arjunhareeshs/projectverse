import axios from 'axios';
import { add401Interceptor, getApiBaseUrl, getAuthToken } from './api';

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: `${API_URL}/projects`,
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

add401Interceptor(api);

/** Mirrors the server DTO in server/src/modules/projects/project.service.ts */
export type ProjectStatusLabel =
  | 'Planned'
  | 'Pending Approval'
  | 'In Progress'
  | 'In Review'
  | 'On Hold'
  | 'Completed';

export interface MyProjectItem {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  category: string | null;
  status: string;
  statusLabel: ProjectStatusLabel;
  team: { id: string; name: string; color: string | null; memberCount: number } | null;
  isCollaboration: boolean;
  progress: {
    percentage: number;
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    overdueTasks: number;
  };
  lastActivityAt: string;
}

export interface MyProjectsResponse {
  projects: MyProjectItem[];
  summary: { total: number; inProgress: number; completed: number; onHold: number };
}

export const projectService = {
  /** Projects the authenticated user actually participates in. Authorized server-side. */
  getMyProjects: async (): Promise<MyProjectsResponse> => {
    const response = await api.get<MyProjectsResponse>('/my');
    return response.data;
  },
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
