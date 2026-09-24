import { api } from './api';

const base = '/developer/observability';

export const observabilityService = {
  getRequestOverview: async (days = 1) => {
    const { data } = await api.get(`${base}/requests/overview`, { params: { days } });
    return data;
  },
  getRequestsByRoute: async (days = 1) => {
    const { data } = await api.get(`${base}/requests/by-route`, { params: { days } });
    return data;
  },
  getRequestTimeseries: async (hours = 24) => {
    const { data } = await api.get(`${base}/requests/timeseries`, { params: { hours } });
    return data;
  },
  getStatusDistribution: async (days = 1) => {
    const { data } = await api.get(`${base}/requests/status-distribution`, { params: { days } });
    return data;
  },
  getErrorTimeseries: async (days = 1) => {
    const { data } = await api.get(`${base}/errors/timeseries`, { params: { days } });
    return data;
  },
  getRecentRequests: async (limit = 100) => {
    const { data } = await api.get(`${base}/requests/recent`, { params: { limit } });
    return data;
  },
  getMetrics: async (hours = 6, instance?: string) => {
    const { data } = await api.get(`${base}/metrics`, { params: { hours, instance } });
    return data;
  },
  getBackendErrors: async (limit = 100) => {
    const { data } = await api.get(`${base}/errors/backend`, { params: { limit } });
    return data;
  },
  getClientErrors: async (limit = 100) => {
    const { data } = await api.get(`${base}/errors/client`, { params: { limit } });
    return data;
  },
};
