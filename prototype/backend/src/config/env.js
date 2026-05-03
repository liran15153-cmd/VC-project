/* ============================================================================
   Environment Configuration & Validation
   ========================================================================= */

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENAI_MODELS = [
  'gpt-5',
  'gpt-5.5',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-4.1'
];

const OPENROUTER_MODELS = [
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-4.1',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'google/gemma-3-27b-it',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct',
  'qwen/qwen3-coder:free'
];

const PLACEHOLDER_KEYS = new Set([
  '',
  'replace-with-your-openai-api-key',
  'replace-with-your-openrouter-api-key',
  'your-openai-api-key',
  'your-openrouter-api-key'
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  TRUST_PROXY: z.coerce.boolean().default(false),

  CORS_ORIGINS: z.string().default('*'),

  AI_PROVIDER: z.enum(['openai', 'openrouter']).optional(),
  AI_FALLBACK_ENABLED: z.coerce.boolean().default(true),
  AI_MAX_JSON_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(60000).default(12000),
  AI_MAX_TEXT_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(60000).default(4000),
  AI_HARD_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(60000).default(20000),

  OPENAI_API_KEY: z.string().min(10, 'OPENAI_API_KEY is required and must be valid').optional(),
  OPENAI_DEFAULT_MODEL: z.string().min(1).default('gpt-5'),

  OPENROUTER_API_KEY: z.string().min(10, 'OPENROUTER_API_KEY is required and must be valid').optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1).default('openai/gpt-5-mini'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_URL: z.string().url().default('http://localhost:5174'),
  OPENROUTER_APP_TITLE: z.string().min(1).default('Gaming Vibe Coding'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  RATE_LIMIT_GENERATION: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_OPENAI: z.coerce.number().int().min(1).optional(),
  RATE_LIMIT_DEFAULT: z.coerce.number().int().min(1).default(30),

  BODY_LIMIT: z.string().default('1mb')
});

let parsed;
try {
  parsed = envSchema.parse(process.env);
} catch (err) {
  console.error('\nInvalid environment configuration:');
  if (err instanceof z.ZodError) {
    err.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
  } else {
    console.error(err);
  }
  console.error('\nCheck your .env file (copy from .env.example)\n');
  process.exit(1);
}

if (parsed.NODE_ENV === 'production' && parsed.CORS_ORIGINS === '*') {
  console.error('\nCORS_ORIGINS cannot be "*" in production. Set an explicit comma-separated allow-list.\n');
  process.exit(1);
}

const corsOrigins = parsed.CORS_ORIGINS === '*'
  ? '*'
  : parsed.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

function normalizeApiKey(value) {
  const trimmed = (value || '').trim();
  return PLACEHOLDER_KEYS.has(trimmed) ? undefined : trimmed;
}

const openaiApiKey = normalizeApiKey(parsed.OPENAI_API_KEY);
const openrouterApiKey = normalizeApiKey(parsed.OPENROUTER_API_KEY);
const selectedProvider = parsed.AI_PROVIDER || (openrouterApiKey ? 'openrouter' : 'openai');
const selectedApiKey = selectedProvider === 'openrouter' ? openrouterApiKey : openaiApiKey;
const selectedDefaultModel = selectedProvider === 'openrouter'
  ? parsed.OPENROUTER_DEFAULT_MODEL
  : parsed.OPENAI_DEFAULT_MODEL;
const selectedSupportedModels = selectedProvider === 'openrouter' ? OPENROUTER_MODELS : OPENAI_MODELS;
const selectedLabel = selectedProvider === 'openrouter' ? 'OpenRouter' : 'OpenAI';

if (!selectedApiKey) {
  const keyName = selectedProvider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
  console.warn(`\n${keyName} is not set - AI endpoints will return 503`);
  console.warn(`Add ${keyName} to prototype/backend/.env and restart the backend\n`);
}

module.exports = {
  env: parsed.NODE_ENV,
  isDev: parsed.NODE_ENV === 'development',
  isProd: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  port: parsed.PORT,
  host: parsed.HOST,
  trustProxy: parsed.TRUST_PROXY,
  cors: { origins: corsOrigins },
  ai: {
    provider: selectedProvider,
    providerLabel: selectedLabel,
    apiKey: selectedApiKey,
    baseURL: selectedProvider === 'openrouter' ? parsed.OPENROUTER_BASE_URL : undefined,
    defaultModel: selectedDefaultModel,
    supportedModels: selectedSupportedModels,
    enabled: !!selectedApiKey,
    fallbackEnabled: parsed.AI_FALLBACK_ENABLED,
    maxJsonOutputTokens: parsed.AI_MAX_JSON_OUTPUT_TOKENS,
    maxTextOutputTokens: parsed.AI_MAX_TEXT_OUTPUT_TOKENS,
    hardMaxOutputTokens: parsed.AI_HARD_MAX_OUTPUT_TOKENS,
    openrouter: {
      appUrl: parsed.OPENROUTER_APP_URL,
      appTitle: parsed.OPENROUTER_APP_TITLE
    }
  },
  openai: {
    apiKey: openaiApiKey,
    defaultModel: parsed.OPENAI_DEFAULT_MODEL,
    supportedModels: OPENAI_MODELS,
    enabled: !!openaiApiKey,
    fallbackEnabled: parsed.AI_FALLBACK_ENABLED
  },
  openrouter: {
    apiKey: openrouterApiKey,
    defaultModel: parsed.OPENROUTER_DEFAULT_MODEL,
    baseURL: parsed.OPENROUTER_BASE_URL,
    supportedModels: OPENROUTER_MODELS,
    enabled: !!openrouterApiKey,
    appUrl: parsed.OPENROUTER_APP_URL,
    appTitle: parsed.OPENROUTER_APP_TITLE
  },
  logging: { level: parsed.LOG_LEVEL },
  rateLimits: {
    generation: parsed.RATE_LIMIT_GENERATION,
    openai: parsed.RATE_LIMIT_OPENAI || 10,
    default: parsed.RATE_LIMIT_DEFAULT
  },
  bodyLimit: parsed.BODY_LIMIT,
  SUPPORTED_MODELS: selectedSupportedModels,
  OPENAI_MODELS,
  OPENROUTER_MODELS
};
