/**
 * Isolated check of server/src/modules/ai/llm.service.ts against the live
 * Groq API, independent of the HTTP server. Confirms the configured
 * GROQ_API_KEY actually authenticates and returns a real completion, and
 * that chatJSON() round-trips structured output correctly.
 *
 * Run with: npx tsx tests/project-selection-chat/llm-direct.ts
 */
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

import { chat, chatJSON, isLlmConfigured } from '../../src/modules/ai/llm.service';

async function main() {
  console.log('GROQ_API_KEY configured:', isLlmConfigured());
  console.log('GROQ_MODEL:', process.env.GROQ_MODEL);

  if (!isLlmConfigured()) {
    console.log('\nNo GROQ_API_KEY found in server/.env — fallback path will be used, not a real LLM call.');
    process.exit(1);
  }

  console.log('\n--- chat() ---');
  const reply = await chat(
    [{ role: 'user', content: 'Reply with exactly one word: PONG' }],
    'FALLBACK_TRIGGERED',
  );
  console.log('Reply:', reply);
  if (reply === 'FALLBACK_TRIGGERED') {
    console.error('FAIL: fell back instead of calling Groq — check API key / network.');
    process.exit(1);
  }

  console.log('\n--- chatJSON() ---');
  const json = await chatJSON<{ answer: string; number: number }>(
    [
      {
        role: 'system',
        content: 'Respond only with JSON: {"answer": string, "number": number}',
      },
      { role: 'user', content: 'answer should be "hello", number should be 42' },
    ],
    { answer: 'FALLBACK', number: -1 },
  );
  console.log('Parsed JSON:', json);
  if (json.answer === 'FALLBACK') {
    console.error('FAIL: fell back instead of getting real JSON from Groq.');
    process.exit(1);
  }

  console.log('\nAll direct LLM checks passed.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
