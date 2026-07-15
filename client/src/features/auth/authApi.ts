import { apiClient } from '@/lib/axios';

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}
