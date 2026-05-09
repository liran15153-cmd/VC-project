/* ============================================================================
   Prompt Optimizer
   ----------------------------------------------------------------------------
   Small, explicit token-saving helpers. This is intentionally conservative:
   avoid huge histories, strip duplicate whitespace, and keep the newest context.
   ========================================================================= */

const config = require('../config/env');

function minimizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compressForLLM(text, maxChars = config.ai.maxInputChars) {
  const minimized = minimizeText(text);
  if (minimized.length <= maxChars) {
    return { text: minimized, compressed: false, originalChars: minimized.length, sentChars: minimized.length };
  }

  const headSize = Math.floor(maxChars * 0.35);
  const tailSize = maxChars - headSize - 180;
  const head = minimized.slice(0, headSize).trim();
  const tail = minimized.slice(-tailSize).trim();
  const omitted = minimized.length - head.length - tail.length;
  const compressed = [
    head,
    '',
    `[Context compressed: ${omitted} characters omitted. Preserve the user's latest explicit requirements below.]`,
    '',
    tail
  ].join('\n');

  return {
    text: compressed,
    compressed: true,
    originalChars: minimized.length,
    sentChars: compressed.length
  };
}

function summarizeHistory(messages = [], maxChars = config.ai.maxInputChars) {
  const useful = messages
    .filter((msg) => msg && msg.role && msg.content)
    .map((msg) => `${msg.role}: ${minimizeText(msg.content)}`)
    .join('\n');
  return compressForLLM(useful, maxChars);
}

module.exports = {
  minimizeText,
  compressForLLM,
  summarizeHistory
};
