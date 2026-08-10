import axios from 'axios';
import { getApiBaseUrl } from './api';

const API_URL = getApiBaseUrl();

// Landing-page service hits the unauthenticated /public endpoints. No JWT
// header, no 401 interceptor — this service must work on the public landing
// route where the user has not (yet) signed in.
const api = axios.create({
  baseURL: `${API_URL}/public`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface PublicHackathon {
  id: string;
  name: string;
  dateRange: string;
  status: string;
  url: string | null;
  description: string | null;
}

export interface PublicLeetCodeContest {
  id: string;
  name: string;
  time: string;
  status: string;
  url: string | null;
  description: string | null;
}

export const landingService = {
  getHackathons: async (): Promise<PublicHackathon[]> => {
    const response = await api.get('/hackathons');
    return response.data;
  },
  getLeetCodeContests: async (): Promise<PublicLeetCodeContest[]> => {
    const response = await api.get('/leetcode-contests');
    return response.data;
  },
};