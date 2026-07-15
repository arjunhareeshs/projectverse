import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: `${API_URL}/dashboard`,
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

export const dashboardService = {
  getKpis: async () => {
    const response = await api.get('/kpis');
    return response.data;
  },
  getInsights: async () => {
    const response = await api.get('/insights');
    return response.data;
  },
  getStreakData: async () => {
    const response = await api.get('/streak');
    return response.data;
  },
  getTeamGrowth: async () => {
    const response = await api.get('/team-growth');
    return response.data;
  },
  getProjectActivity: async () => {
    const response = await api.get('/project-activity');
    return response.data;
  },
  getUpcomingDeadlines: async () => {
    const response = await api.get('/deadlines');
    return response.data;
  },
  getHackathons: async () => {
    const response = await api.get('/hackathons');
    return response.data;
  },
  getLeetCodeContests: async () => {
    const response = await api.get('/leetcode-contests');
    return response.data;
  },
  getRecentActivities: async () => {
    const response = await api.get('/recent-activities');
    return response.data;
  }
};
