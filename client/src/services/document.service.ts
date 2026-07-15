import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/documents`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pv_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

add401Interceptor(api);

export const documentService = {
  getDocuments: async (projectId?: string) => {
    const params = projectId ? { projectId } : {};
    const response = await api.get('/', { params });
    return response.data;
  },

  createDocument: async (title: string, content?: string, projectId?: string) => {
    const response = await api.post('/', { title, content, projectId });
    return response.data;
  },

  uploadDocument: async (file: File, title?: string, projectId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (projectId) formData.append('projectId', projectId);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteDocument: async (id: string) => {
    const response = await api.delete(`/${id}`);
    return response.data;
  },
};
export default documentService;
