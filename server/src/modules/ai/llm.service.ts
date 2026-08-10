import axios from 'axios';
import { z } from 'zod';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LlmOptions<T = any> {
  temperature?: number;
  retries?: number;
  schema?: z.ZodType<T>;
  feature?: string;
  /** Max completion tokens. Raise this for responses that must carry a
   *  detailed, student-readable explanation rather than a terse verdict. */
  maxTokens?: number;
}

export interface LlmResult<T> {
  data: T;
  degraded: boolean;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function groqEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0);
}

async function callGroq(
  messages: ChatMessage[],
  jsonMode: boolean,
  options?: LlmOptions,
): Promise<string> {
  const temperature = options?.temperature ?? 0.4;
  const maxRetries = options?.retries ?? 1;

  let attempt = 0;
  let lastError: any;

  while (attempt <= maxRetries) {
    try {
      const res = await axios.post(
        GROQ_URL,
        {
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages,
          temperature,
          max_tokens: options?.maxTokens ?? 1024,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY?.trim()}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );
      return res.data?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      // Do NOT retry 400 Bad Request (prompt syntax/token error)
      if (status === 400 || attempt >= maxRetries) {
        throw err;
      }
      // Retry 429 / 5xx / Network timeouts with backoff + jitter
      attempt++;
      const backoffMs = 100 * attempt + Math.floor(Math.random() * 50);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * Plain conversational completion. Falls back to a canned response if no
 * GROQ_API_KEY is configured or the call fails, so the feature degrades
 * gracefully instead of breaking the flow.
 */
export async function chat(
  messages: ChatMessage[],
  fallback: string,
  options?: LlmOptions,
): Promise<string> {
  if (!groqEnabled()) return fallback;
  try {
    const out = await callGroq(messages, false, options);
    return out || fallback;
  } catch (err: any) {
    console.error(`Groq chat error${options?.feature ? ` [${options.feature}]` : ''}:`, err.message);
    return fallback;
  }
}

/**
 * JSON-mode completion with optional Zod schema validation.
 * Falls back to `fallback` when no key is configured, the call fails,
 * response isn't valid JSON, or schema validation fails.
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
  if (!groqEnabled()) return { data: fallback, degraded: true };
  try {
    const out = await callGroq(messages, true, options);
    if (!out) return { data: fallback, degraded: true };

    const parsedJson = JSON.parse(out);

    if (options?.schema) {
      const validated = options.schema.safeParse(parsedJson);
      if (!validated.success) {
        console.warn(
          `chatJSON schema miss${options.feature ? ` [${options.feature}]` : ''}:`,
          validated.error.message,
        );
        return { data: fallback, degraded: true };
      }
      return { data: validated.data, degraded: false };
    }

    return { data: parsedJson as T, degraded: false };
  } catch (err: any) {
    console.error(`Groq chatJSON error${options?.feature ? ` [${options.feature}]` : ''}:`, err.message);
    return { data: fallback, degraded: true };
  }
}

export function isLlmConfigured(): boolean {
  return groqEnabled();
}
