/* ============================================================================
   AI Provider Service
   ----------------------------------------------------------------------------
   Uses the official OpenAI SDK against either OpenAI directly or OpenRouter's
   OpenAI-compatible Chat Completions endpoint.
   ========================================================================= */

const OpenAI = require('openai');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');
const { ServiceUnavailableError, ExternalAPIError } = require('../utils/errors');
const { compressForLLM } = require('./promptOptimizer');

let client = null;
const responseCache = new Map();

function getClient() {
  if (!config.ai.realEnabled) {
    throw new ServiceUnavailableError(config.ai.providerLabel, 'OPENROUTER_API_KEY is not configured');
  }

  if (!client) {
    const clientOptions = { apiKey: config.ai.apiKey };

    clientOptions.baseURL = config.ai.baseURL;
    clientOptions.defaultHeaders = {
      'HTTP-Referer': config.ai.openrouter.appUrl,
      'X-OpenRouter-Title': config.ai.openrouter.appTitle
    };

    client = new OpenAI(clientOptions);
  }

  return client;
}

function stripCodeFences(text) {
  if (!text) return text;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  return cleaned.trim();
}

function extractJSON(text) {
  const cleaned = stripCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {/* try fallback */}

  const firstBrace = cleaned.search(/[{[]/);
  if (firstBrace === -1) throw new Error('No JSON object/array found in response');

  const open = cleaned[firstBrace];
  const close = open === '{' ? '}' : ']';
  const lastBrace = cleaned.lastIndexOf(close);
  if (lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Malformed JSON in response');
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function resolveModel(model) {
  return config.ai.supportedModels.includes(model) ? model : config.ai.defaultModel;
}

async function generateJSON({ prompt, systemPrompt, model, generationConfig = {}, cacheKey = null, allowCache = true }) {
  const modelName = resolveModel(model);
  const start = Date.now();
  const ai = getClient();
  const optimizedPrompt = compressForLLM(prompt);
  const optimizedSystem = compressForLLM(systemPrompt || '', Math.max(1000, Math.floor(config.ai.maxInputChars / 2)));
  const request = {
    model: modelName,
    messages: buildMessages({ systemPrompt: optimizedSystem.text, prompt: optimizedPrompt.text }),
    response_format: { type: 'json_object' }
  };
  applyGenerationConfig(request, generationConfig, 'json');

  const effectiveCacheKey = allowCache ? buildCacheKey(cacheKey || request) : null;
  const cached = effectiveCacheKey ? getCached(effectiveCacheKey) : null;
  if (cached) {
    return {
      ...cached,
      durationMs: Date.now() - start,
      cached: true,
      tokenOptimization: {
        promptCompressed: optimizedPrompt.compressed,
        systemCompressed: optimizedSystem.compressed,
        promptChars: optimizedPrompt.sentChars,
        originalPromptChars: optimizedPrompt.originalChars
      }
    };
  }

  let result;
  try {
    result = await Promise.race([
      ai.chat.completions.create(request),
      timeout(config.ai.generationTimeoutMs, `${config.ai.providerLabel} request timeout`)
    ]);
  } catch (err) {
    logger.error({ err: err.message, provider: config.ai.provider, model: modelName }, 'AI API call failed');
    throw new ExternalAPIError(config.ai.providerLabel, err.message);
  }

  const raw = extractOutputText(result);
  const durationMs = Date.now() - start;
  if (!raw) throw new ExternalAPIError(config.ai.providerLabel, 'Empty response');

  let json = await parseOrRepairJSON({
    raw,
    ai,
    request,
    modelName,
    systemPrompt: optimizedSystem.text,
    originalPrompt: optimizedPrompt.text
  });

  const response = {
    json,
    raw,
    model: result.model || modelName,
    durationMs,
    provider: config.ai.provider,
    cached: false,
    tokenOptimization: {
      promptCompressed: optimizedPrompt.compressed,
      systemCompressed: optimizedSystem.compressed,
      promptChars: optimizedPrompt.sentChars,
      originalPromptChars: optimizedPrompt.originalChars
    }
  };
  if (effectiveCacheKey) {
    setCached(effectiveCacheKey, { ...response, durationMs: 0 });
  }
  return response;
}

async function generateText({ prompt, systemPrompt, model, generationConfig = {} }) {
  const modelName = resolveModel(model);
  const start = Date.now();
  const ai = getClient();
  const optimizedPrompt = compressForLLM(prompt);
  const optimizedSystem = compressForLLM(systemPrompt || '', Math.max(1000, Math.floor(config.ai.maxInputChars / 2)));
  const request = {
    model: modelName,
    messages: buildMessages({ systemPrompt: optimizedSystem.text, prompt: optimizedPrompt.text })
  };
  applyGenerationConfig(request, generationConfig, 'text');

  try {
    const result = await Promise.race([
      ai.chat.completions.create(request),
      timeout(config.ai.generationTimeoutMs, `${config.ai.providerLabel} request timeout`)
    ]);
    return {
      text: extractOutputText(result),
      model: result.model || modelName,
      durationMs: Date.now() - start,
      provider: config.ai.provider
    };
  } catch (err) {
    logger.error({ err: err.message, provider: config.ai.provider, model: modelName }, 'AI text generation failed');
    throw new ExternalAPIError(config.ai.providerLabel, err.message);
  }
}

function buildMessages({ systemPrompt, prompt }) {
  return [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: prompt }
  ];
}

async function parseOrRepairJSON({ raw, ai, request, modelName, systemPrompt, originalPrompt }) {
  try {
    return extractJSON(raw);
  } catch (err) {
    logger.warn({ raw: raw.substring(0, 500), err: err.message }, 'Failed to parse AI JSON, retrying once with repair prompt');
  }

  const repairRequest = {
    ...request,
    messages: buildMessages({
      systemPrompt,
      prompt: [
        originalPrompt,
        '',
        'The previous model response was invalid JSON.',
        'Repair it into exactly one valid JSON object that satisfies the original task.',
        'Return JSON only. No markdown, no prose.',
        '',
        'INVALID RESPONSE:',
        raw.slice(0, config.ai.maxInputChars)
      ].join('\n')
    })
  };

  let repaired;
  try {
    repaired = await Promise.race([
      ai.chat.completions.create(repairRequest),
      timeout(config.ai.generationTimeoutMs, `${config.ai.providerLabel} JSON repair timeout`)
    ]);
  } catch (err) {
    throw new ExternalAPIError(config.ai.providerLabel, `Invalid JSON response and repair failed: ${err.message}`);
  }

  const repairedRaw = extractOutputText(repaired);
  try {
    return extractJSON(repairedRaw);
  } catch (err) {
    logger.warn({ raw: repairedRaw.substring(0, 500), err: err.message, model: modelName }, 'Failed to parse repaired AI JSON');
    throw new ExternalAPIError(config.ai.providerLabel, `Invalid JSON response after repair: ${err.message}`);
  }
}

function applyGenerationConfig(request, generationConfig, mode) {
  if (typeof generationConfig.temperature === 'number') request.temperature = generationConfig.temperature;

  const defaultMax = mode === 'json'
    ? config.ai.maxJsonOutputTokens
    : config.ai.maxTextOutputTokens;
  const requestedMax = typeof generationConfig.maxOutputTokens === 'number'
    ? generationConfig.maxOutputTokens
    : typeof generationConfig.max_output_tokens === 'number'
      ? generationConfig.max_output_tokens
      : defaultMax;

  request.max_tokens = Math.min(requestedMax, config.ai.hardMaxOutputTokens);
}

function extractOutputText(response) {
  const choice = response?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? '';
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part?.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return String(content || '').trim();
}

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

function buildCacheKey(value) {
  if (!config.ai.cacheTtlMs) return null;
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function getCached(key) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  if (!key || !config.ai.cacheTtlMs) return;
  responseCache.set(key, { value, expiresAt: Date.now() + config.ai.cacheTtlMs });
}

function clearCache() {
  responseCache.clear();
}

module.exports = { generateJSON, generateText, extractJSON, clearCache };
