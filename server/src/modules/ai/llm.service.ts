import { z } from 'zod';
import { getCurrentUserId } from '../../middleware/userContext';
import { providerConfigService } from './providerConfig.service';
import { ProviderFactory } from './providers/provider.factory';
import { isFallbackEligible, ChatMessage } from './providers/provider.interface';
import { AIProvider } from '@prisma/client';

export type { ChatMessage };

export interface LlmOptions<T = any> {
  temperature?: number;
  retries?: number;
  schema?: z.ZodType<T>;
  feature?: string;
  /** Max completion tokens. Raise this for detailed explanations. */
  maxTokens?: number;
  /** Explicit userId override if executing outside Express request context */
  userId?: string;
}

export interface LlmResult<T> {
  data: T;
  degraded: boolean;
  providerUsed?: 'GROQ' | 'NVIDIA' | 'DEV_SERVER_FALLBACK';
}

function resolveUserId(options?: LlmOptions): string | undefined {
  return options?.userId || getCurrentUserId();
}

/**
 * Sanitizes external API error before logging to ensure no API keys or
 * authorization headers are ever leaked in log files.
 */
function sanitizeErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  const status = err.response?.status;
  const statusText = err.response?.statusText || '';
  const message = err.message || '';
  const providerMsg = err.response?.data?.error?.message || '';

  return `[Status ${status || 'N/A'}] ${statusText} - ${message} ${providerMsg ? `(${providerMsg})` : ''}`.trim();
}

/**
 * Executes a plain conversational chat with:
 * 1. Groq as PRIMARY (User's own key)
 * 2. NVIDIA NIM as FALLBACK (User's own key)
 * 3. Graceful degradation to fallback text if unconfigured or exhausted
 */
export async function chat(
  messages: ChatMessage[],
  fallback: string,
  options?: LlmOptions,
): Promise<string> {
  const userId = resolveUserId(options);

  // 1. Try Groq (Primary)
  let groqKey: string | null = null;
  if (userId) {
    groqKey = await providerConfigService.getDecryptedKeyForUser(userId, AIProvider.GROQ);
  }
  // Server-level dev fallback key if user key is unset
  if (!groqKey && process.env.GROQ_API_KEY?.trim()) {
    groqKey = process.env.GROQ_API_KEY.trim();
  }

  if (groqKey) {
    try {
      const groqProvider = ProviderFactory.getProvider('GROQ');
      const result = await groqProvider.chat(groqKey, messages, options);

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.GROQ,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          latencyMs: result.latencyMs,
          status: 'SUCCESS',
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.GROQ, { isSuccess: true });
      }

      return result.content || fallback;
    } catch (groqErr: any) {
      console.warn(
        `[LLM Router] Groq (Primary) failed${options?.feature ? ` [${options.feature}]` : ''}:`,
        sanitizeErrorMessage(groqErr),
      );

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.GROQ,
          status: 'FAILURE',
          errorCode: String(groqErr.response?.status || groqErr.code || 'GROQ_ERROR'),
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.GROQ, {
          isSuccess: false,
          errorCode: String(groqErr.response?.status || 'GROQ_ERROR'),
        });
      }

      // Check if eligible for fallback to NVIDIA
      if (!isFallbackEligible(groqErr)) {
        return fallback;
      }
    }
  }

  // 2. Try NVIDIA NIM (Fallback)
  let nvidiaKey: string | null = null;
  if (userId) {
    nvidiaKey = await providerConfigService.getDecryptedKeyForUser(userId, AIProvider.NVIDIA);
  }
  if (!nvidiaKey && process.env.NVIDIA_API_KEY?.trim()) {
    nvidiaKey = process.env.NVIDIA_API_KEY.trim();
  }

  if (nvidiaKey) {
    try {
      const nvidiaProvider = ProviderFactory.getProvider('NVIDIA');
      const result = await nvidiaProvider.chat(nvidiaKey, messages, options);

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.NVIDIA,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          latencyMs: result.latencyMs,
          status: 'FALLBACK',
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.NVIDIA, { isSuccess: true });
      }

      return result.content || fallback;
    } catch (nvidiaErr: any) {
      console.warn(
        `[LLM Router] NVIDIA NIM (Fallback) failed${options?.feature ? ` [${options.feature}]` : ''}:`,
        sanitizeErrorMessage(nvidiaErr),
      );

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.NVIDIA,
          status: 'FAILURE',
          errorCode: String(nvidiaErr.response?.status || nvidiaErr.code || 'NVIDIA_ERROR'),
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.NVIDIA, {
          isSuccess: false,
          errorCode: String(nvidiaErr.response?.status || 'NVIDIA_ERROR'),
        });
      }
    }
  }

  return fallback;
}

/**
 * JSON-mode completion returning direct data.
 */
export async function chatJSON<T>(
  messages: ChatMessage[],
  fallback: T,
  options?: LlmOptions<T>,
): Promise<T> {
  const result = await chatJSONWithMeta(messages, fallback, options);
  return result.data;
}

/**
 * JSON-mode completion returning explicit degradation metadata.
 */
export async function chatJSONWithMeta<T>(
  messages: ChatMessage[],
  fallback: T,
  options?: LlmOptions<T>,
): Promise<LlmResult<T>> {
  const userId = resolveUserId(options);

  // 1. Try Groq (Primary)
  let groqKey: string | null = null;
  if (userId) {
    groqKey = await providerConfigService.getDecryptedKeyForUser(userId, AIProvider.GROQ);
  }
  if (!groqKey && process.env.GROQ_API_KEY?.trim()) {
    groqKey = process.env.GROQ_API_KEY.trim();
  }

  if (groqKey) {
    try {
      const groqProvider = ProviderFactory.getProvider('GROQ');
      const result = await groqProvider.chatJSON<T>(groqKey, messages, fallback, options);

      if (result.parsed && result.parsed !== fallback) {
        if (userId) {
          providerConfigService.recordUsage({
            userId,
            provider: AIProvider.GROQ,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            latencyMs: result.latencyMs,
            status: 'SUCCESS',
          });
          providerConfigService.updateProviderStatus(userId, AIProvider.GROQ, { isSuccess: true });
        }

        return { data: result.parsed, degraded: false, providerUsed: 'GROQ' };
      }
    } catch (groqErr: any) {
      console.warn(
        `[LLM Router] Groq (Primary) chatJSON failed${options?.feature ? ` [${options.feature}]` : ''}:`,
        sanitizeErrorMessage(groqErr),
      );

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.GROQ,
          status: 'FAILURE',
          errorCode: String(groqErr.response?.status || groqErr.code || 'GROQ_ERROR'),
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.GROQ, {
          isSuccess: false,
          errorCode: String(groqErr.response?.status || 'GROQ_ERROR'),
        });
      }

      if (!isFallbackEligible(groqErr)) {
        return { data: fallback, degraded: true };
      }
    }
  }

  // 2. Try NVIDIA NIM (Fallback)
  let nvidiaKey: string | null = null;
  if (userId) {
    nvidiaKey = await providerConfigService.getDecryptedKeyForUser(userId, AIProvider.NVIDIA);
  }
  if (!nvidiaKey && process.env.NVIDIA_API_KEY?.trim()) {
    nvidiaKey = process.env.NVIDIA_API_KEY.trim();
  }

  if (nvidiaKey) {
    try {
      const nvidiaProvider = ProviderFactory.getProvider('NVIDIA');
      const result = await nvidiaProvider.chatJSON<T>(nvidiaKey, messages, fallback, options);

      if (result.parsed && result.parsed !== fallback) {
        if (userId) {
          providerConfigService.recordUsage({
            userId,
            provider: AIProvider.NVIDIA,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            latencyMs: result.latencyMs,
            status: 'FALLBACK',
          });
          providerConfigService.updateProviderStatus(userId, AIProvider.NVIDIA, { isSuccess: true });
        }

        return { data: result.parsed, degraded: false, providerUsed: 'NVIDIA' };
      }
    } catch (nvidiaErr: any) {
      console.warn(
        `[LLM Router] NVIDIA NIM (Fallback) chatJSON failed${options?.feature ? ` [${options.feature}]` : ''}:`,
        sanitizeErrorMessage(nvidiaErr),
      );

      if (userId) {
        providerConfigService.recordUsage({
          userId,
          provider: AIProvider.NVIDIA,
          status: 'FAILURE',
          errorCode: String(nvidiaErr.response?.status || nvidiaErr.code || 'NVIDIA_ERROR'),
        });
        providerConfigService.updateProviderStatus(userId, AIProvider.NVIDIA, {
          isSuccess: false,
          errorCode: String(nvidiaErr.response?.status || 'NVIDIA_ERROR'),
        });
      }
    }
  }

  return { data: fallback, degraded: true };
}

/**
 * Checks whether AI features are potentially ready to be used (either user is authenticated or server keys exist).
 * Fully synchronous for backwards-compatibility with existing callers.
 */
export function isLlmConfigured(): boolean {
  const userId = getCurrentUserId();
  return Boolean(userId || process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY);
}
