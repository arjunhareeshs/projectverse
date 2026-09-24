import fs from 'node:fs';
import path from 'node:path';
import { config, parse } from 'dotenv';
import { z } from 'zod';

// Precedence (highest first): real process env (Docker/compose) > server/.env > root .env.
// Paths resolve the same from src/config and dist/config.
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');
const preset = new Set(Object.keys(process.env));

config({ path: rootEnvPath, quiet: true });
if (fs.existsSync(serverEnvPath)) {
  for (const [key, value] of Object.entries(parse(fs.readFileSync(serverEnvPath)))) {
    if (!preset.has(key)) process.env[key] = value;
  }
}

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SERVER_PORT: z.coerce.number().default(4000),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:7333'),
    REDIS_URL: optionalString,
    RUN_SCHEDULER: z.enum(['true', 'false']).default('false'),
    // Number of reverse proxies in front of Express (edge nginx = 1; add 1 per extra proxy such as a host nginx).
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(20),
    JWT_REFRESH_SECRET: z.string().min(20),
    JWT_ACCESS_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    GOOGLE_CLIENT_ID: optionalString,

    // AI providers — server-level keys are only a fallback; users bring their own keys.
    GROQ_API_KEY: optionalString,
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    NVIDIA_API_KEY: optionalString,
    NVIDIA_MODEL: z.string().default('meta/llama-3.3-70b-instruct'),
    AI_API_KEY_ENCRYPTION_KEY: optionalString,
    AI_SERVICE_URL: z.string().default('http://localhost:8000'),

    GITHUB_TOKEN: optionalString,
    OVERLAP_THRESHOLD: z.coerce.number().default(0.62),
    INSIGHTS_MAX_PAIRS: z.coerce.number().int().default(5000),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && (!e.AI_API_KEY_ENCRYPTION_KEY || e.AI_API_KEY_ENCRYPTION_KEY.length < 32)) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_API_KEY_ENCRYPTION_KEY'],
        message: 'Required in production (min 32 chars) — it encrypts users\' stored AI keys',
      });
    }
  });

export const env = envSchema.parse(process.env);
