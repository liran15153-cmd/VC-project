/* ============================================================================
   Environment Configuration & Validation
   ========================================================================= */

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENROUTER_MODELS = [
  'openai/gpt-5.1'
];

const PLACEHOLDER_KEYS = new Set([
  '',
  'replace-with-your-openrouter-api-key',
  'your-openrouter-api-key'
]);

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  TRUST_PROXY: envBoolean.default(false),

  CORS_ORIGINS: z.string().default('*'),

  AI_MODE: z.enum(['mock', 'real', 'hybrid']).default('real'),
  AI_FALLBACK_ENABLED: envBoolean.default(true),
  AI_TOOL_CALLING_ENABLED: envBoolean.default(true),
  AI_MAX_JSON_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(60000).default(12000),
  AI_MAX_TEXT_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(60000).default(4000),
  AI_HARD_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(60000).default(20000),
  AI_MAX_INPUT_CHARS: z.coerce.number().int().min(1000).max(50000).default(8000),
  AI_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300000),
  AI_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(90000),
  ASSET_MAX_PACKS_TO_SEARCH: z.coerce.number().int().min(1).max(200).default(8),
  ASSET_MAX_CANDIDATES_BEFORE_SCORING: z.coerce.number().int().min(10).max(5000).default(240),
  ASSET_SHORTLIST_PER_ROLE: z.coerce.number().int().min(1).max(50).default(12),
  ASSET_STRICT_MISSING_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  ASSET_AI_RERANK_ENABLED: envBoolean.default(false),
  ASSET_AI_RERANK_MAX_CANDIDATES: z.coerce.number().int().min(5).max(15).default(10),
  ASSET_AI_RERANK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

  OPENROUTER_API_KEY: z.string().min(10, 'OPENROUTER_API_KEY is required and must be valid').optional(),
  OPENROUTER_MODEL: z.string().min(1).optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1).default('openai/gpt-5.1'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_URL: z.string().url().default('http://localhost:5173'),
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

const openrouterApiKey = normalizeApiKey(parsed.OPENROUTER_API_KEY);
const selectedProvider = 'openrouter';
const selectedApiKey = openrouterApiKey;
const selectedDefaultModel = parsed.OPENROUTER_MODEL || parsed.OPENROUTER_DEFAULT_MODEL;
const selectedSupportedModels = OPENROUTER_MODELS.includes(selectedDefaultModel)
  ? OPENROUTER_MODELS
  : [selectedDefaultModel, ...OPENROUTER_MODELS];
const selectedLabel = 'OpenRouter';

if (parsed.AI_MODE !== 'mock' && !selectedApiKey) {
  console.warn('\nOPENROUTER_API_KEY is not set - real AI endpoints will return 503 or use fallback where allowed');
  console.warn('Add OPENROUTER_API_KEY to prototype/backend/.env and restart the backend\n');
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
    mode: parsed.AI_MODE,
    provider: selectedProvider,
    providerLabel: selectedLabel,
    apiKey: selectedApiKey,
    baseURL: parsed.OPENROUTER_BASE_URL,
    defaultModel: selectedDefaultModel,
    supportedModels: selectedSupportedModels,
    enabled: parsed.AI_MODE === 'mock' || !!selectedApiKey,
    realEnabled: !!selectedApiKey,
    fallbackEnabled: parsed.AI_FALLBACK_ENABLED,
    toolCallingEnabled: parsed.AI_TOOL_CALLING_ENABLED,
    maxJsonOutputTokens: parsed.AI_MAX_JSON_OUTPUT_TOKENS,
    maxTextOutputTokens: parsed.AI_MAX_TEXT_OUTPUT_TOKENS,
    hardMaxOutputTokens: parsed.AI_HARD_MAX_OUTPUT_TOKENS,
    maxInputChars: parsed.AI_MAX_INPUT_CHARS,
    cacheTtlMs: parsed.AI_CACHE_TTL_MS,
    generationTimeoutMs: parsed.AI_GENERATION_TIMEOUT_MS,
    openrouter: {
      appUrl: parsed.OPENROUTER_APP_URL,
      appTitle: parsed.OPENROUTER_APP_TITLE
    }
  },
  openai: { enabled: false, supportedModels: [] },
  openrouter: {
    apiKey: openrouterApiKey,
    defaultModel: selectedDefaultModel,
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
  assets: {
    maxPacksToSearch: parsed.ASSET_MAX_PACKS_TO_SEARCH,
    maxCandidatesBeforeScoring: parsed.ASSET_MAX_CANDIDATES_BEFORE_SCORING,
    shortlistPerRole: parsed.ASSET_SHORTLIST_PER_ROLE,
    strictMissingThreshold: parsed.ASSET_STRICT_MISSING_THRESHOLD,
    aiRerankEnabled: parsed.ASSET_AI_RERANK_ENABLED,
    aiRerankMaxCandidates: parsed.ASSET_AI_RERANK_MAX_CANDIDATES,
    aiRerankTimeoutMs: parsed.ASSET_AI_RERANK_TIMEOUT_MS
  },
  SUPPORTED_MODELS: selectedSupportedModels,
  OPENROUTER_MODELS
};
