import { api } from './api';

// ─── Admin Service ────────────────────────────────────────────────────────────

export const adminService = {

  // Stats
  getStats: async () => {
    const { data } = await api.get('/admin/stats');
    return data;
  },

  // Students
  getStudents: async (page = 1, limit = 50) => {
    const { data } = await api.get(`/admin/students?page=${page}&limit=${limit}`);
    return data;
  },

  createStudent: async (payload: {
    fullName: string;
    studentId: string;
    email: string;
    domain: string;
    teamId?: string;
    year?: string;
  }) => {
    const { data } = await api.post('/admin/students', payload);
    return data;
  },

  bulkUploadStudents: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/admin/students/bulk', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Teams
  getTeams: async (page = 1, limit = 50) => {
    const { data } = await api.get(`/admin/teams?page=${page}&limit=${limit}`);
    return data;
  },

  createTeam: async (payload: {
    name: string;
    domain: string;
    problemStatement: string;
    projectTitle: string;
    status: string;
    leadEmail?: string;
  }) => {
    const { data } = await api.post('/admin/teams', payload);
    return data;
  },

  bulkUploadTeams: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/admin/teams/bulk', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Achievements
  getAchievements: async (page = 1, limit = 50) => {
    const { data } = await api.get(`/admin/achievements?page=${page}&limit=${limit}`);
    return data;
  },

  createAchievement: async (payload: {
    title: string;
    description: string;
    type: string;
    recipientId?: string;
    teamId?: string;
    points: number;
    date: string;
  }) => {
    const { data } = await api.post('/admin/achievements', payload);
    return data;
  },

  bulkUploadAchievements: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/admin/achievements/bulk', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Trends
  getTeamTrends: async () => {
    const { data } = await api.get('/admin/trends/teams');
    return data;
  },

  getStudentTrends: async () => {
    const { data } = await api.get('/admin/trends/students');
    return data;
  },

  // Chat
  getChatSessions: async () => {
    const { data } = await api.get('/admin/chat/sessions');
    return data;
  },

  getChatHistory: async () => {
    const { data } = await api.get('/admin/chat/history');
    return data;
  },

  saveChat: async (payload: { prompt: string; response: string; sessionId: string }) => {
    const { data } = await api.post('/admin/chat', payload);
    return data;
  },

  generateChat: async (payload: { prompt: string; sessionId: string }) => {
    const { data } = await api.post('/admin/chat/generate', payload);
    return data;
  },

  searchContext: async (query: string) => {
    const { data } = await api.get(`/admin/chat/search?q=${encodeURIComponent(query)}`);
    return data;
  },

  getTeamDetail: async (id: string) => {
    const { data } = await api.get(`/admin/chat/teams/${id}`);
    return data;
  },

  getStudentDetail: async (id: string) => {
    const { data } = await api.get(`/admin/chat/students/${id}`);
    return data;
  },
};
