import { api } from './api';

export interface CapstoneProblem {
  id: string;
  organizationId: string;
  title: string;
  problemText: string;
  domain?: string | null;
  difficulty?: string | null;
  technologies: string[];
  isActive: boolean;
  createdAt: string;
  stats?: {
    selectionsCount: number;
    submittedCount: number;
    completedCount: number;
    avgScore: number | null;
  };
}

export interface CapstoneSelectionItem {
  id: string;
  userId: string;
  projectId: string;
  problemId?: string | null;
  selectedAt: string;
  dueAt: string;
  submittedAt?: string | null;
  githubUrl?: string | null;
  status: 'CLAIMED' | 'SUBMITTED' | 'MCQ_READY' | 'COMPLETED' | 'EXPIRED';
  githubAnalysis?: any;
  codeAnalysis?: any;
  mcqScore?: number | null;
  totalQuestions: number;
  completedAt?: string | null;
  problem?: CapstoneProblem | null;
  project?: {
    id: string;
    name: string;
    domain?: string | null;
    status: string;
  } | null;
}

export interface CapstoneMcqQuestionClient {
  id: string;
  index: number;
  question: string;
  options: string[];
  topic?: string;
  difficulty?: string;
}

export interface CapstoneMcqResponse {
  selectionId: string;
  projectName: string;
  totalQuestions: number;
  questions: CapstoneMcqQuestionClient[];
}

export interface CapstoneMcqSubmitResult {
  success: boolean;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
}

export interface CapstoneAdminStats {
  totalProblems: number;
  activeProblems: number;
  totalSelections: number;
  completedCount: number;
  avgScore: number;
}

export interface CreateCapstoneProblemDto {
  title: string;
  problemText: string;
  domain?: string;
  difficulty?: string;
  technologies?: string[];
  isActive?: boolean;
}

export const capstoneService = {
  getProblems: async (params?: { domain?: string; difficulty?: string }) => {
    const { data } = await api.get<CapstoneProblem[]>('/capstone/problems', { params });
    return data;
  },

  createProblem: async (payload: CreateCapstoneProblemDto) => {
    const { data } = await api.post<CapstoneProblem>('/capstone/problems', payload);
    return data;
  },

  updateProblem: async (id: string, payload: Partial<CreateCapstoneProblemDto>) => {
    const { data } = await api.patch<CapstoneProblem>(`/capstone/problems/${id}`, payload);
    return data;
  },

  deleteProblem: async (id: string) => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/capstone/problems/${id}`);
    return data;
  },

  getAdminStats: async () => {
    const { data } = await api.get<CapstoneAdminStats>('/capstone/admin/stats');
    return data;
  },

  claimProblem: async (problemId: string, approachText?: string) => {
    const { data } = await api.post<{ selection: CapstoneSelectionItem; project: any }>(
      `/capstone/${problemId}/claim`,
      { approachText }
    );
    return data;
  },

  getMySelections: async () => {
    const { data } = await api.get<CapstoneSelectionItem[]>('/capstone/my');
    return data;
  },

  submitGithub: async (selectionId: string, githubUrl: string, bypassTimeCheck = false) => {
    const { data } = await api.post<{ success: boolean; status: string; questionsCount: number }>(
      `/capstone/${selectionId}/submit-github`,
      { githubUrl, bypassTimeCheck }
    );
    return data;
  },

  getMcq: async (selectionId: string) => {
    const { data } = await api.get<CapstoneMcqResponse>(`/capstone/${selectionId}/mcq`);
    return data;
  },

  submitMcq: async (
    selectionId: string,
    answers: { questionId: string; selectedOption: number }[]
  ) => {
    const { data } = await api.post<CapstoneMcqSubmitResult>(
      `/capstone/${selectionId}/mcq/submit`,
      { answers }
    );
    return data;
  },
};
