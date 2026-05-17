/* ============================================================================
   Classifier Keyword Rules
   ----------------------------------------------------------------------------
   Stage 3A: deterministic, ordered keyword → archetype rules.
   Specific patterns come first so they win over generic ones. The classifier
   short-circuits on the first match, so a "tower defense shooter" prompt
   resolves to tower_defense rather than to any shooter archetype.
   No bare "shooter" rule on purpose — its qualifiers (first person / on rails
   / top down / twin stick) carry the actual archetype signal.
   ========================================================================= */

const KEYWORD_RULES = Object.freeze([
  { regex: /\b(first[- ]person|fps|1st[- ]person)\b/i, archetypeId: 'first_person_3d', label: 'first-person' },
  { regex: /\b(tower[- ]?defen[cs]e|td game)\b/i, archetypeId: 'tower_defense', label: 'tower-defense' },
  { regex: /\b(on[- ]rails|rail shooter|rails shooter)\b/i, archetypeId: 'on_rails_shooter', label: 'on-rails' },
  { regex: /\b(racing|kart|driving|car game|drive race)\b/i, archetypeId: 'vehicle_3d', label: 'vehicle' },
  { regex: /\b2\.5d|2 and a half d|side view with 3d/i, archetypeId: 'hybrid_2_5d', label: '2.5D' },
  { regex: /\b(top[- ]?down|twin[- ]?stick|zombie survival)\b/i, archetypeId: 'top_down_2d', label: 'top-down' },
  { regex: /\b(third[- ]person|3rd[- ]person)\b/i, archetypeId: 'third_person_3d', label: 'third-person' },
  { regex: /\b(mario|platformer|side[- ]?scroller|jumper|jump'n run|jump n run)\b/i, archetypeId: 'platformer_2d', label: 'platformer' },
  { regex: /\b(sokoban|match[- ]?3|grid puzzle|block puzzle|tile puzzle|logic puzzle|puzzle game)\b/i, archetypeId: 'grid_logic', label: 'grid-puzzle' },
  { regex: /\b(quiz|trivia|visual novel|menu[- ]heavy|ui[- ]heavy)\b/i, archetypeId: 'ui_heavy', label: 'ui-heavy' }
]);

/**
 * Detect a dimension hint inside free-text. Returns '2D' | '3D' | 'hybrid' | ''.
 * Used to read MCQ answers and to detect a "3D mario" override inside rawPrompt.
 */
function detectDimensionHint(text) {
  const value = String(text || '');
  if (!value) return '';
  if (/\bhybrid\b/i.test(value)) return 'hybrid';
  if (/\b2\.5d\b/i.test(value)) return 'hybrid';
  if (/(^|[^a-z0-9])3[- ]?d(\b|$)/i.test(value)) return '3D';
  if (/(^|[^a-z0-9])2[- ]?d(\b|$)/i.test(value)) return '2D';
  if (/\bthree[- ]?d\b/i.test(value)) return '3D';
  if (/\btwo[- ]?d\b/i.test(value)) return '2D';
  return '';
}

/**
 * Run keyword rules against the raw prompt; return the first matching rule
 * (with archetype id + label) or null.
 */
function matchKeywordRule(rawPrompt) {
  const text = String(rawPrompt || '');
  if (!text.trim()) return null;
  for (const rule of KEYWORD_RULES) {
    if (rule.regex.test(text)) {
      return { archetypeId: rule.archetypeId, label: rule.label };
    }
  }
  return null;
}

module.exports = {
  KEYWORD_RULES,
  matchKeywordRule,
  detectDimensionHint
};
