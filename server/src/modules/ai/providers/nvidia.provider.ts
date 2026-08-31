import axios from 'axios';
import {
  ChatMessage,
  LLMProvider,
  ProviderCallOptions,
  ProviderCallResult,
} from './provider.interface';

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export class NvidiaProvider implements LLMProvider {
  readonly providerName = 'NVIDIA' as const;

  private getModel(): string {
    return process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
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
      NVIDIA_URL,
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
        timeout: 30000,
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

    // NVIDIA NIM supports response_format or instruction-guided JSON output
    const res = await axios.post(
      NVIDIA_URL,
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
        timeout: 30000,
      },
    );

    const latencyMs = Date.now() - startTime;
    const rawContent = res.data?.choices?.[0]?.message?.content || '';
    const usage = res.data?.usage;

    let parsed: T = fallback;
    try {
      // Extract json even if wrapped in markdown code fence ```json ... ```
      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const json = JSON.parse(cleaned);
      if (options?.schema) {
        const validated = options.schema.safeParse(json);
        if (validated.success) {
          parsed = validated.data;
        } else {
          console.warn(`[NvidiaProvider] Schema validation missed${options.feature ? ` [${options.feature}]` : ''}`);
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
      return { valid: false, error: 'NVIDIA API key is invalid or too short' };
    }

    try {
      await axios.post(
        NVIDIA_URL,
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
          timeout: 12000,
        },
      );
      return { valid: true };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return { valid: false, error: 'Authentication failed. Please check your NVIDIA API key.' };
      }
      if (status === 429) {
        return { valid: false, error: 'NVIDIA rate limit or quota exceeded for this key.' };
      }
      return {
        valid: false,
        error: err.response?.data?.error?.message || 'Unable to verify NVIDIA API key with server.',
      };
    }
  }
}
