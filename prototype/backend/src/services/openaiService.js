/* ============================================================================
   AI Provider Service
   ----------------------------------------------------------------------------
   Uses the official OpenAI SDK against either OpenAI directly or OpenRouter's
   OpenAI-compatible Chat Completions endpoint.
   ========================================================================= */

const OpenAI = require('openai');
const config = require('../config/env');
const logger = require('../utils/logger');
const { ServiceUnavailableError, ExternalAPIError } = require('../utils/errors');
const { GENERATION } = require('../config/constants');

let client = null;
let clientProvider = null;

function getClient() {
  if (!config.ai.enabled) {
    const keyName = config.ai.provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
    throw new ServiceUnavailableError(config.ai.providerLabel, `${keyName} is not configured`);
  }

  if (!client || clientProvider !== config.ai.provider) {
    const clientOptions = { apiKey: config.ai.apiKey };

    if (config.ai.baseURL) {
      clientOptions.baseURL = config.ai.baseURL;
    }

    if (config.ai.provider === 'openrouter') {
      clientOptions.defaultHeaders = {
        'HTTP-Referer': config.ai.openrouter.appUrl,
        'X-OpenRouter-Title': config.ai.openrouter.appTitle
      };
    }

    client = new OpenAI(clientOptions);
    clientProvider = config.ai.provider;
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

async function generateJSON({ prompt, systemPrompt, model, generationConfig = {} }) {
  const modelName = model || config.ai.defaultModel;
  const start = Date.now();
  const ai = getClient();
  const request = {
    model: modelName,
    messages: buildMessages({ systemPrompt, prompt }),
    response_format: { type: 'json_object' }
  };
  applyGenerationConfig(request, generationConfig, 'json');

  let result;
  try {
    result = await Promise.race([
      ai.chat.completions.create(request),
      timeout(GENERATION.GENERATION_TIMEOUT_MS, `${config.ai.providerLabel} request timeout`)
    ]);
  } catch (err) {
    logger.error({ err: err.message, provider: config.ai.provider, model: modelName }, 'AI API call failed');
    throw new ExternalAPIError(config.ai.providerLabel, err.message);
  }

  const raw = extractOutputText(result);
  const durationMs = Date.now() - start;
  if (!raw) throw new ExternalAPIError(config.ai.providerLabel, 'Empty response');

  let json;
  try {
    json = extractJSON(raw);
  } catch (err) {
    logger.warn({ raw: raw.substring(0, 500), err: err.message }, 'Failed to parse AI JSON');
    throw new ExternalAPIError(config.ai.providerLabel, `Invalid JSON response: ${err.message}`);
  }

  return { json, raw, model: result.model || modelName, durationMs, provider: config.ai.provider };
}

async function generateText({ prompt, systemPrompt, model, generationConfig = {} }) {
  const modelName = model || config.ai.defaultModel;
  const start = Date.now();
  const ai = getClient();
  const request = {
    model: modelName,
    messages: buildMessages({ systemPrompt, prompt })
  };
  applyGenerationConfig(request, generationConfig, 'text');

  try {
    const result = await Promise.race([
      ai.chat.completions.create(request),
      timeout(GENERATION.GENERATION_TIMEOUT_MS, `${config.ai.providerLabel} request timeout`)
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

module.exports = { generateJSON, generateText, extractJSON };
