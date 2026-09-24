import { api } from './api';

const base = '/developer/ai-observability';

export const aiObservabilityService = {
  getOverview: async (days = 30) => {
    const { data } = await api.get(`${base}/overview`, { params: { days } });
    return data;
  },

  getTimeseries: async (days = 30, bucket: 'hour' | 'day' = 'day') => {
    const { data } = await api.get(`${base}/timeseries`, { params: { days, bucket } });
    return data;
  },

  getUsersByUsage: async (days = 30, limit = 50) => {
    const { data } = await api.get(`${base}/users`, { params: { days, limit } });
    return data;
  },

  getRecentLogs: async (limit = 100) => {
    const { data } = await api.get(`${base}/logs`, { params: { limit } });
    return data;
  },

  getSystemLogs: async (params: { limit?: number; level?: 'INFO' | 'WARN' | 'ERROR'; source?: string } = {}) => {
    const { data } = await api.get(`${base}/system-logs`, { params });
    return data;
  },

  getProviderHealth: async () => {
    const { data } = await api.get(`${base}/provider-health`);
    return data;
  },
};
