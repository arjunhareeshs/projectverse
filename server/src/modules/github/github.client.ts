import axios from 'axios';
import axiosRetry from 'axios-retry';
import { logger } from '../../shared/logger';

const CORE_BASE_URL = 'https://api.github.com';

const coreClient = axios.create({
  baseURL: CORE_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ProjectVerse-Github-Analytics',
  },
  validateStatus: (status) => status < 500,
});

axiosRetry(coreClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) return Number(retryAfter) * 1000;
    return axiosRetry.exponentialDelay(retryCount);
  },
  retryCondition: (error) => {
    const status = error.response?.status;
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      status === 403 ||
      status === 429 ||
      status === 502 ||
      status === 503
    );
  },
});

// Unauthenticated GitHub REST calls share a 60 requests/hour budget per IP.
// Serialize calls through a tiny queue so a single repo analysis (~6-8 calls)
// never bursts past what the budget can absorb, and concurrent analyses queue up
// rather than racing each other into a 403.
class RateGate {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const result = await task();
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs));
      return result;
    });
    // Keep the chain alive even if this task rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }
}

// Core REST API: 60 req/hour unauthenticated ≈ 1 per 60s to stay safely inside budget.
const coreGate = new RateGate(1100);
// Search API: separate, stricter 10 req/min unauthenticated budget.
const searchGate = new RateGate(6500);

export interface GithubRequestOptions {
  params?: Record<string, unknown>;
}

async function coreGet<T = any>(path: string, options: GithubRequestOptions = {}): Promise<{
  data: T;
  headers: Record<string, string>;
  status: number;
}> {
  return coreGate.schedule(async () => {
    const res = await coreClient.get(path, { params: options.params });
    if (res.status === 404) {
      const err: any = new Error('GitHub resource not found');
      err.code = 'GITHUB_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    if (res.status === 403 || res.status === 429) {
      logger.warn('GitHub API rate limit hit', { path, status: res.status });
      const err: any = new Error('GitHub API rate limit exceeded');
      err.code = 'GITHUB_RATE_LIMITED';
      err.status = res.status;
      throw err;
    }
    if (res.status >= 400) {
      const err: any = new Error(`GitHub API error ${res.status}`);
      err.code = 'GITHUB_API_ERROR';
      err.status = res.status;
      throw err;
    }
    return { data: res.data, headers: res.headers as Record<string, string>, status: res.status };
  });
}

/** HEAD-checks whether a file exists at the repo root (or given path). Never throws on 404. */
async function fileExists(owner: string, repo: string, filePath: string): Promise<boolean> {
  try {
    const res = await coreGate.schedule(() =>
      coreClient.get(`/repos/${owner}/${repo}/contents/${filePath}`),
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Extracts the "last page" number from a GitHub Link header — a cheap 1-call way to get a total count. */
function countFromLinkHeader(headers: Record<string, string>, fallbackLength: number): number {
  const link = headers?.link;
  if (!link) return fallbackLength;
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (!match || !match[1]) return fallbackLength;
  return Number(match[1]);
}

/** Counts items via the Link-header trick: request page 1 with per_page=1, read the last-page number. */
async function countViaPagination(path: string): Promise<number> {
  const { data, headers } = await coreGet<any[]>(path, { params: { per_page: 1, page: 1 } });
  return countFromLinkHeader(headers, Array.isArray(data) ? data.length : 0);
}

/** Uses the Search API for counts GitHub doesn't expose directly (closed issues, PR states). */
async function searchCount(query: string): Promise<number> {
  return searchGate.schedule(async () => {
    const res = await coreClient.get('/search/issues', { params: { q: query, per_page: 1 } });
    if (res.status === 403 || res.status === 429) {
      logger.warn('GitHub Search API rate limit hit', { query });
      return 0;
    }
    if (res.status >= 400) return 0;
    return res.data?.total_count ?? 0;
  });
}

export const githubClient = {
  coreGet,
  fileExists,
  countViaPagination,
  searchCount,
};
