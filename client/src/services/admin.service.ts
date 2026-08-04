import { api } from './api';

// ─── Admin & Insights Service ──────────────────────────────────────────────────

export const adminService = {
  // Stats & Ingest
  getStats: async () => {
    const { data } = await api.get('/admin/stats');
    return data;
  },

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

  // ── Insights Endpoints ──────────────────────────────────────────────────────

  getTopTeams: async (limit = 5) => {
    const { data } = await api.get(`/admin/top-teams?limit=${limit}`);
    return data;
  },

  getTopStudents: async (limit = 5) => {
    const { data } = await api.get(`/admin/top-students?limit=${limit}`);
    return data;
  },

  getOverlaps: async (params?: { status?: string; domain?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.domain) query.append('domain', params.domain);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    const { data } = await api.get(`/admin/overlaps?${query.toString()}`);
    return data;
  },

  getOverlapById: async (id: string) => {
    const { data } = await api.get(`/admin/overlaps/${id}`);
    return data;
  },

  updateOverlapStatus: async (id: string, payload: { status: string; reviewNote?: string }) => {
    const { data } = await api.patch(`/admin/overlaps/${id}`, payload);
    return data;
  },

  getStandouts: async (params?: { status?: string; verdict?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.verdict) query.append('verdict', params.verdict);
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    const { data } = await api.get(`/admin/standouts?${query.toString()}`);
    return data;
  },

  getStandoutById: async (id: string) => {
    const { data } = await api.get(`/admin/standouts/${id}`);
    return data;
  },

  updateStandoutStatus: async (id: string, payload: { status: string; reviewNote?: string }) => {
    const { data } = await api.patch(`/admin/standouts/${id}`, payload);
    return data;
  },

  recomputeInsights: async (scope?: 'overlap' | 'standout' | 'all') => {
    const { data } = await api.post('/admin/insights/recompute', { scope });
    return data;
  },

  getInsightsStatus: async () => {
    const { data } = await api.get('/admin/insights/status');
    return data;
  },

  // ── Aliased helpers used by new admin pages ──────────────────────────────────

  /** Returns { [domain]: TeamRanking[] } grouped by domain */
  getTopTeamsByDomain: async (limit = 5): Promise<Record<string, any[]>> => {
    const { data } = await api.get(`/admin/top-teams?limit=${limit}`);
    // API returns grouped object directly or an array — normalise both
    if (Array.isArray(data)) {
      const grouped: Record<string, any[]> = {};
      for (const t of data) {
        const d = t.domain || 'Unassigned';
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(t);
      }
      return grouped;
    }
    return data;
  },

  /** Returns { [domain]: StudentRanking[] } grouped by domain */
  getTopStudentsByDomain: async (limit = 5): Promise<Record<string, any[]>> => {
    const { data } = await api.get(`/admin/top-students?limit=${limit}`);
    if (Array.isArray(data)) {
      const grouped: Record<string, any[]> = {};
      for (const s of data) {
        const d = s.domain || s.ssgDomain || 'Unassigned';
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(s);
      }
      return grouped;
    }
    return data;
  },

  /** Returns OverlapFlag[] */
  getOverlapFlags: async (params?: { status?: string; domain?: string }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.domain) query.append('domain', params.domain);
    const { data } = await api.get(`/admin/overlaps?${query.toString()}`);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  /** PATCH a single overlap flag */
  updateOverlapFlag: async (id: string, payload: { status: string; reviewNote?: string }) => {
    const { data } = await api.patch(`/admin/overlaps/${id}`, payload);
    return data;
  },

  /** Returns StandoutProject[] */
  getStandoutProjects: async (params?: { status?: string; verdict?: string }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.verdict) query.append('verdict', params.verdict);
    const { data } = await api.get(`/admin/standouts?${query.toString()}`);
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  /** PATCH a single standout project */
  updateStandoutProject: async (id: string, payload: { status: string; reviewNote?: string }) => {
    const { data } = await api.patch(`/admin/standouts/${id}`, payload);
    return data;
  },
};

