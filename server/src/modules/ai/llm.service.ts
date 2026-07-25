import axios from 'axios';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function groqEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroq(messages: ChatMessage[], jsonMode: boolean): Promise<string> {
  const res = await axios.post(
    GROQ_URL,
    {
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.4,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );
  return res.data?.choices?.[0]?.message?.content || '';
}

/**
 * Plain conversational completion. Falls back to a canned response if no
 * GROQ_API_KEY is configured or the call fails, so the feature degrades
 * gracefully instead of breaking the flow.
 */
export async function chat(messages: ChatMessage[], fallback: string): Promise<string> {
  if (!groqEnabled()) return fallback;
  try {
    const out = await callGroq(messages, false);
    return out || fallback;
  } catch (err: any) {
    console.error('Groq chat error:', err.message);
    return fallback;
  }
}

/**
 * JSON-mode completion. Falls back to `fallback` (already an object) when no
 * key is configured, the call fails, or the response isn't valid JSON.
 */
export async function chatJSON<T>(messages: ChatMessage[], fallback: T): Promise<T> {
  if (!groqEnabled()) return fallback;
  try {
    const out = await callGroq(messages, true);
    if (!out) return fallback;
    return JSON.parse(out) as T;
  } catch (err: any) {
    console.error('Groq chatJSON error:', err.message);
    return fallback;
  }
}

export function isLlmConfigured(): boolean {
  return groqEnabled();
}
