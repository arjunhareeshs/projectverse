import { api } from './api';

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  googleLogin: async (credential: string) => {
    const response = await api.post('/auth/google', { credential });
    return response.data;
  },
  register: async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
  updateGithubUsername: async (githubUsername: string | null) => {
    const response = await api.patch('/auth/github-username', { githubUsername });
    return response.data;
  },
};
