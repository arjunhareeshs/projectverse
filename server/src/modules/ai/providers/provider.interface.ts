import { z } from 'zod';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ProviderCallOptions<T = any> {
  temperature?: number;
  retries?: number;
  schema?: z.ZodType<T>;
  feature?: string;
  maxTokens?: number;
}

export interface ProviderCallResult<T = string> {
  content: string;
  parsed?: T;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model: string;
  latencyMs: number;
}

export interface LLMProvider {
  readonly providerName: 'GROQ' | 'NVIDIA';

  /**
   * Plain text completion
   */
  chat(apiKey: string, messages: ChatMessage[], options?: ProviderCallOptions): Promise<ProviderCallResult<string>>;

  /**
   * JSON mode completion
   */
  chatJSON<T>(apiKey: string, messages: ChatMessage[], fallback: T, options?: ProviderCallOptions<T>): Promise<ProviderCallResult<T>>;

  /**
   * Validates an API key with a minimal verification request
   */
  validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Determines whether an error is eligible for automated provider fallback.
 * Eligible: 401 Unauthorized (invalid/revoked key), 429 Rate Limit / Quota Exceeded,
 * 408 Request Timeout, 500/502/503/504 Service Unavailable/Bad Gateway,
 * and network connection errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, timeout).
 */
export function isFallbackEligible(error: any): boolean {
  if (!error) return false;

  const status = error.response?.status || error.status;
  if (status) {
    if ([401, 403, 408, 429, 500, 502, 503, 504].includes(status)) {
      return true;
    }
    // 400 Bad Request (malformed prompt, validation error) is NOT fallback eligible
    if (status === 400) {
      return false;
    }
  }

  const code = error.code || '';
  if (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ERR_BAD_RESPONSE' ||
    code === 'ECONNABORTED'
  ) {
    return true;
  }

  if (error.message && (error.message.includes('timeout') || error.message.includes('Network Error'))) {
    return true;
  }

  return false;
}
