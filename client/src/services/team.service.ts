import { api } from './api';

export const teamService = {
  getTeams: async () => {
    const res = await api.get('/teams');
    return res.data;
  },
  getTeamById: async (id: string) => {
    const res = await api.get(`/teams/${id}`);
    return res.data;
  },
  getTeamStats: async (id: string) => {
    const res = await api.get(`/teams/${id}/stats`);
    return res.data;
  },
  createTeam: async (data: any) => {
    const res = await api.post('/teams', data);
    return res.data;
  },
  updateTeam: async (id: string, data: any) => {
    const res = await api.patch(`/teams/${id}`, data);
    return res.data;
  },
  addMember: async (id: string, userId: string, roleLabel: string) => {
    const res = await api.post(`/teams/${id}/members`, { userId, roleLabel });
    return res.data;
  },
  removeMember: async (id: string, userId: string) => {
    const res = await api.delete(`/teams/${id}/members/${userId}`);
    return res.data;
  },
  leaveTeam: async (id: string, userId: string) => {
    const res = await api.delete(`/teams/${id}/members/${userId}`);
    return res.data;
  },
  searchCandidates: async (q: string) => {
    const res = await api.get('/teams/candidates', { params: { q } });
    return res.data;
  },
  getCoordinationMetrics: async (id: string) => {
    const res = await api.get(`/teams/${id}/coordination`);
    return res.data;
  },
  getAIInsights: async (id: string) => {
    const res = await api.post(`/teams/${id}/insights`);
    return res.data;
  },

  // Invites & join requests
  getInvites: async (id: string) => {
    const res = await api.get(`/teams/${id}/invites`);
    return res.data;
  },
  inviteMember: async (id: string, data: { email: string; roleLabel?: string; message?: string }) => {
    const res = await api.post(`/teams/${id}/invites`, data);
    return res.data;
  },
  requestToJoin: async (id: string) => {
    const res = await api.post(`/teams/${id}/join`);
    return res.data;
  },
  acceptInvite: async (id: string, inviteId: string) => {
    const res = await api.post(`/teams/${id}/invites/${inviteId}/accept`);
    return res.data;
  },
  declineInvite: async (id: string, inviteId: string) => {
    const res = await api.post(`/teams/${id}/invites/${inviteId}/decline`);
    return res.data;
  },

  // Chat
  getMessages: async (id: string) => {
    const res = await api.get(`/teams/${id}/messages`);
    return res.data;
  },
  sendMessage: async (id: string, message: string) => {
    const res = await api.post(`/teams/${id}/messages`, { message });
    return res.data;
  },

  // Tasks (Kanban)
  getTeamTasks: async (id: string) => {
    const res = await api.get(`/teams/${id}/tasks`);
    return res.data;
  },
  createTeamTask: async (id: string, data: any) => {
    const res = await api.post(`/teams/${id}/tasks`, data);
    return res.data;
  },
  updateTaskStatus: async (id: string, taskId: string, status: string) => {
    const res = await api.patch(`/teams/${id}/tasks/${taskId}/status`, { status });
    return res.data;
  },

  // Projects
  getTeamProjects: async (id: string) => {
    const res = await api.get(`/teams/${id}/projects`);
    return res.data;
  },
  createTeamProject: async (id: string, data: any) => {
    const res = await api.post(`/teams/${id}/projects`, data);
    return res.data;
  },

  // Activity
  getTeamActivity: async (id: string) => {
    const res = await api.get(`/teams/${id}/activity`);
    return res.data;
  },

  // Progress
  getTeamProgress: async (id: string) => {
    const res = await api.get(`/teams/${id}/progress`);
    return res.data;
  },

  // Cross-domain collaboration
  getCollaborations: async (id: string) => {
    const res = await api.get(`/teams/${id}/collaborations`);
    return res.data;
  },
  createCollaboration: async (id: string, data: { toTeamId: string; projectName?: string; message?: string }) => {
    const res = await api.post(`/teams/${id}/collaborations`, data);
    return res.data;
  },
  acceptCollaboration: async (collabId: string) => {
    const res = await api.post(`/teams/collaborations/${collabId}/accept`);
    return res.data;
  },
  declineCollaboration: async (collabId: string) => {
    const res = await api.post(`/teams/collaborations/${collabId}/decline`);
    return res.data;
  },
};
