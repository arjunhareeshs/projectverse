import { api } from './api';
import {
  ProjectCategory,
  ProjectLogState,
  DailyLogEntry,
  ExecutionDocContent,
  EvaluationReportContent,
  MentorStatus,
  FeatureAllocationItem,
  ProjectPhaseItem,
} from '../types/projectLog';

export const lifecycleService = {
  startCatalogSession: async (category: ProjectCategory) => {
    const res = await api.post('/projects/catalog/session/start', { category });
    return res.data;
  },

  saveIntake: async (
    projectId: string,
    data: {
      step: 'members' | 'duration' | 'technologies';
      members?: string[];
      memberUserIds?: string[];
      months?: number;
      startDate?: string;
      technologies?: string[];
    }
  ) => {
    const payload: any = { ...data };
    if (data.step === 'members') {
      payload.memberUserIds = data.memberUserIds ?? data.members ?? [];
    }
    const res = await api.post(`/lifecycle/${projectId}/intake`, payload);
    return res.data;
  },

  checkDuration: async (projectId: string, category: ProjectCategory, months: number) => {
    const res = await api.post(`/lifecycle/${projectId}/intake/duration-check`, {
      category,
      months,
    });
    return res.data;
  },

  suggestMembers: async (projectId: string) => {
    const res = await api.post(`/lifecycle/${projectId}/intake/suggest-members`);
    return res.data;
  },

  getLogState: async (projectId: string): Promise<ProjectLogState> => {
    const res = await api.get(`/lifecycle/${projectId}/log-state`);
    return res.data;
  },

  getEvents: async (projectId: string, params?: { page?: number; limit?: number }) => {
    const res = await api.get(`/lifecycle/${projectId}/events`, { params });
    return res.data;
  },

  generateDocument: async (projectId: string): Promise<{ doc: ExecutionDocContent; fallback?: boolean }> => {
    const res = await api.post(`/lifecycle/${projectId}/document/generate`);
    return res.data;
  },

  getDocument: async (projectId: string, version?: number): Promise<{ doc: ExecutionDocContent; version: number; allVersions?: number[] } | null> => {
    try {
      const res = await api.get(`/lifecycle/${projectId}/document`, { params: version ? { version } : undefined });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  saveDocument: async (
    projectId: string,
    doc: ExecutionDocContent
  ): Promise<{ doc: ExecutionDocContent; version: number; message: string }> => {
    const res = await api.put(`/lifecycle/${projectId}/document`, { doc });
    return res.data;
  },

  downloadDocument: async (projectId: string, format: 'md' | 'pdf') => {
    const response = await api.get(`/lifecycle/${projectId}/document/download`, {
      params: { format },
      responseType: 'blob',
    });
    
    const blob = new Blob([response.data], {
      type: format === 'pdf' ? 'application/pdf' : 'text/markdown',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `execution-document.${format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  saveDailyLog: async (
    projectId: string,
    data: { workDone: string; hoursSpent?: number; blockers?: string; evidenceUrls?: string[] }
  ): Promise<DailyLogEntry> => {
    const res = await api.post(`/lifecycle/${projectId}/daily-log`, data);
    return res.data;
  },

  getDailyLogs: async (
    projectId: string,
    params?: { from?: string; to?: string; userId?: string }
  ): Promise<DailyLogEntry[]> => {
    const res = await api.get(`/lifecycle/${projectId}/daily-logs`, { params });
    return res.data;
  },

  runEvaluation: async (projectId: string) => {
    const res = await api.post(`/lifecycle/${projectId}/evaluation/run`);
    return res.data;
  },

  getEvaluations: async (projectId: string): Promise<Array<{
    id: string;
    cycle: number;
    periodStart: string;
    periodEnd: string;
    overallScore: number;
    authenticityScore: number;
    plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: string;
  }>> => {
    const res = await api.get(`/lifecycle/${projectId}/evaluations`);
    return res.data;
  },

  getEvaluationReport: async (projectId: string, reportId: string): Promise<EvaluationReportContent> => {
    const res = await api.get(`/lifecycle/${projectId}/evaluations/${reportId}`);
    return res.data;
  },

  getMentorStatus: async (projectId: string): Promise<MentorStatus> => {
    const res = await api.get(`/lifecycle/${projectId}/mentor/status`);
    return res.data;
  },

  askMentor: async (projectId: string, question: string): Promise<{ answer: string; available?: boolean }> => {
    const res = await api.post(`/lifecycle/${projectId}/mentor/ask`, { question });
    return res.data;
  },

  uploadAsset: async (file: File): Promise<{ success: boolean; url: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/lifecycle/upload-asset', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getFeatures: async (
    projectId: string
  ): Promise<{ features: FeatureAllocationItem[]; totalPoints: number; capPoints: number }> => {
    const res = await api.get(`/lifecycle/${projectId}/features`);
    return res.data;
  },

  addFeature: async (
    projectId: string,
    data: { name: string; description: string; implementationMethod: string }
  ): Promise<{ feature: FeatureAllocationItem; budgetClamped: boolean; duplicateOfFeatureId: string | null }> => {
    const res = await api.post(`/lifecycle/${projectId}/features`, data);
    return res.data;
  },

  updateFeature: async (
    projectId: string,
    featureId: string,
    data: { name?: string; description?: string; implementationMethod?: string }
  ): Promise<{ feature: FeatureAllocationItem; budgetClamped: boolean; duplicateOfFeatureId: string | null }> => {
    const res = await api.patch(`/lifecycle/${projectId}/features/${featureId}`, data);
    return res.data;
  },

  removeFeature: async (projectId: string, featureId: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/lifecycle/${projectId}/features/${featureId}`);
    return res.data;
  },

  getPhases: async (projectId: string): Promise<{ phases: ProjectPhaseItem[] }> => {
    const res = await api.get(`/lifecycle/${projectId}/phases`);
    return res.data;
  },

  updatePhase: async (
    projectId: string,
    phaseId: string,
    data: { title?: string; expectedDeliverables?: string; weekTarget?: number; points?: number; reason?: string }
  ): Promise<{ phase: ProjectPhaseItem }> => {
    const res = await api.patch(`/lifecycle/${projectId}/phases/${phaseId}`, data);
    return res.data;
  },

  submitPhase: async (
    projectId: string,
    phaseId: string,
    data: { submissionNote: string; evidenceUrls?: string[] }
  ): Promise<{ submission: any; phaseStatus: string }> => {
    const res = await api.post(`/lifecycle/${projectId}/phases/${phaseId}/submit`, data);
    return res.data;
  },

  reviewPhase: async (
    projectId: string,
    phaseId: string,
    data: { decision: 'APPROVED' | 'CHANGES_REQUESTED'; reviewNote?: string }
  ): Promise<{ success: boolean; status: string; splits?: Array<{ userId: string; points: number }> }> => {
    const res = await api.post(`/lifecycle/${projectId}/phases/${phaseId}/review`, data);
    return res.data;
  },
};
