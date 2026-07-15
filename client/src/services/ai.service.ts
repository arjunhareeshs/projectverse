import axios from 'axios';
import { add401Interceptor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: `${API_URL}/ai`,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pv_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

add401Interceptor(api);

export type AiStreamEvent =
  | { event: 'text.delta'; text: string }
  | { event: 'tool.call'; tool: string; args: Record<string, unknown> }
  | { event: 'tool.result'; tool: string; result: unknown }
  | { event: 'tool.progress'; step_type: string; target: string; status: 'running' | 'done' | 'failed' }
  | { event: 'nav.to'; route: string; params?: Record<string, string> }
  | { event: 'panel.open'; panel: string; context?: Record<string, unknown> }
  | { event: 'state.refresh'; type: string }
  | { event: 'done' }
  | { event: 'error'; detail: string };

export const aiService = {
  // Simple single-shot query — used by Project Designer and simple contexts
  query: async (prompt: string, conversationId?: string) => {
    const response = await api.post('/query', { prompt, conversationId });
    return response.data;
  },

  // Full streaming agent chat — calls the real LangGraph agent with tools
  stream: (
    prompt: string,
    sessionId: string | undefined,
    onEvent: (event: AiStreamEvent) => void,
    signal?: AbortSignal
  ): void => {
    const token = localStorage.getItem('pv_token');
    const baseUrl = API_URL;

    fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt, sessionId }),
      signal,
    }).then(async (res) => {
      if (!res.ok) {
        onEvent({ event: 'error', detail: `HTTP ${res.status}: ${res.statusText}` });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onEvent({ event: 'error', detail: 'No response body' });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const processBuffer = () => {
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            switch (eventType) {
              case 'text.delta':
                onEvent({ event: 'text.delta', text: data.text ?? '' });
                break;
              case 'tool.call':
                onEvent({ event: 'tool.call', tool: data.tool, args: data.args ?? {} });
                break;
              case 'tool.result':
                onEvent({ event: 'tool.result', tool: data.tool, result: data.result });
                break;
              case 'tool.progress':
                onEvent({ event: 'tool.progress', step_type: data.step_type ?? '', target: data.target ?? '', status: data.status ?? 'running' });
                break;
              case 'nav.to':
                onEvent({ event: 'nav.to', route: data.route ?? data.section, params: data.params });
                break;
              case 'panel.open':
                onEvent({ event: 'panel.open', panel: data.panel, context: data.context });
                break;
              case 'state.refresh':
                onEvent({ event: 'state.refresh', type: data.type ?? '' });
                break;
              case 'done':
                onEvent({ event: 'done' });
                break;
              case 'error':
                onEvent({ event: 'error', detail: data.detail ?? 'Unknown error' });
                break;
            }
          } catch {
            // Malformed JSON — ignore
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            processBuffer(); // flush any remaining buffer — 'done' SSE frame already fired via processBuffer
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          onEvent({ event: 'error', detail: err?.message ?? 'Stream error' });
        }
      }
    }).catch((err) => {
      if (err?.name !== 'AbortError') {
        onEvent({ event: 'error', detail: err?.message ?? 'Failed to connect' });
      }
    });
  },
};
