import axios from 'axios';
import {
  ChatMessage,
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
} from './provider.interface';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider implements LLMProvider {
  readonly providerName = 'GROQ' as const;

  private getModel(): string {
    return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async chat(
    apiKey: string,
    messages: ChatMessage[],
    options?: ProviderCallOptions,
  ): Promise<ProviderCallResult<string>> {
    const startTime = Date.now();
    const temperature = options?.temperature ?? 0.4;
    const model = this.getModel();

    const res = await axios.post(
      GROQ_URL,
      {
        model,
        messages,
        temperature,
        max_tokens: options?.maxTokens ?? 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      },
    );

    const latencyMs = Date.now() - startTime;
    const content = res.data?.choices?.[0]?.message?.content || '';
    const usage = res.data?.usage;

    return {
      content,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      model: res.data?.model || model,
      latencyMs,
    };
  }

  async chatJSON<T>(
    apiKey: string,
    messages: ChatMessage[],
    fallback: T,
    options?: ProviderCallOptions<T>,
  ): Promise<ProviderCallResult<T>> {
    const startTime = Date.now();
    const temperature = options?.temperature ?? 0.4;
    const model = this.getModel();

    const res = await axios.post(
      GROQ_URL,
      {
        model,
        messages,
        temperature,
        max_tokens: options?.maxTokens ?? 1024,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      },
    );

    const latencyMs = Date.now() - startTime;
    const rawContent = res.data?.choices?.[0]?.message?.content || '';
    const usage = res.data?.usage;

    let parsed: T = fallback;
    try {
      const json = JSON.parse(rawContent);
      if (options?.schema) {
        const validated = options.schema.safeParse(json);
        if (validated.success) {
          parsed = validated.data;
        } else {
          console.warn(`[GroqProvider] Schema validation missed${options.feature ? ` [${options.feature}]` : ''}`);
          parsed = fallback;
        }
      } else {
        parsed = json as T;
      }
    } catch {
      parsed = fallback;
    }

    return {
      content: rawContent,
      parsed,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      model: res.data?.model || model,
      latencyMs,
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || apiKey.trim().length < 8) {
      return { valid: false, error: 'Groq API key is invalid or too short' };
    }

    try {
      await axios.post(
        GROQ_URL,
        {
          model: this.getModel(),
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      return { valid: true };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return { valid: false, error: 'Authentication failed. Please check your Groq API key.' };
      }
      if (status === 429) {
        return { valid: false, error: 'Groq rate limit or quota exceeded for this key.' };
      }
      return {
        valid: false,
        error: err.response?.data?.error?.message || 'Unable to verify Groq API key with server.',
      };
    }
  }
}
