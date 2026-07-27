import { api } from './api';
import { AdminAiAskResponse } from '../types/projectLog';

export const adminAiService = {
  ask: async (
    question: string,
    opts?: { sessionId?: string; pinnedTeamId?: string; pinnedStudentId?: string },
  ): Promise<AdminAiAskResponse> => {
    const res = await api.post('/admin/ai/ask', { question, ...opts });
    return res.data;
  },
};
