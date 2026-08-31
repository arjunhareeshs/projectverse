import { api } from './api';

export interface UserAIProviderDTO {
  provider: 'GROQ' | 'NVIDIA';
  configured: boolean;
  enabled: boolean;
  maskedKey?: string;
  lastValidatedAt?: string | null;
  lastUsedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorAt?: string | null;
}

export interface AIProvidersResponse {
  providers: UserAIProviderDTO[];
}

export const aiProviderService = {
  async getProviders(): Promise<AIProvidersResponse> {
    const res = await api.get<AIProvidersResponse>('/ai/providers');
    return res.data;
  },

  async saveProvider(provider: 'GROQ' | 'NVIDIA', apiKey: string): Promise<UserAIProviderDTO> {
    const res = await api.put<UserAIProviderDTO>(`/ai/providers/${provider}`, { apiKey });
    return res.data;
  },

  async deleteProvider(provider: 'GROQ' | 'NVIDIA'): Promise<{ success: boolean; message: string }> {
    const res = await api.delete<{ success: boolean; message: string }>(`/ai/providers/${provider}`);
    return res.data;
  },

  async validateProvider(provider: 'GROQ' | 'NVIDIA', apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const res = await api.post<{ valid: boolean; error?: string }>(`/ai/providers/${provider}/validate`, { apiKey });
    return res.data;
  },
};
