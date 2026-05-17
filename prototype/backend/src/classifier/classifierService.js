/* ============================================================================
   Classifier Service
   ----------------------------------------------------------------------------
   Stage 3A: deterministic archetype resolution before the Game Brief LLM call.

   Decision hierarchy (no new LLM call in 3A):
     user > MCQ > LLM (reserved) > heuristic

   Source is split:
     - source            : how the archetype was chosen
     - dimensionSource   : how the dimension was chosen
   This avoids the contradiction "user gave only dimension; archetype still
   came from heuristic" — the response now describes both decisions.

   Diverges from assetResolutionService.classifyGameType: that runs on the
   post-LLM brief (using brief.genre + context). This runs pre-LLM on the raw
   prompt + MCQ answers; it cannot read brief fields that don't exist yet.
   ========================================================================= */

const {
  ARCHETYPES,
  getArchetypeProfile,
  isKnownArchetypeId,
  normalizeDimension
} = require('./archetypeProfiles');
const { matchKeywordRule, detectDimensionHint } = require('./keywordRules');

const DEFAULT_BY_DIMENSION = Object.freeze({
  '2D': 'platformer_2d',
  '3D': 'third_person_3d',
  hybrid: 'hybrid_2_5d'
});

function classifyArchetype({ rawPrompt = '', mcqAnswers = {}, dimension = null, gameType = null } = {}) {
  const warnings = [];

  // L0 — normalize.
  const userDimension = normalizeDimension(dimension);
  const promptText = String(rawPrompt || '');

  // L1 — user-supplied dimension wins.
  let resolvedDimension = '';
  let dimensionSource = 'default';
  if (userDimension) {
    resolvedDimension = userDimension;
    dimensionSource = 'user';
  }

  // MCQ archetype direct match (rare but supported): a user MCQ option that
  // names an archetype verbatim wins archetype-selection even before keywords.
  const mcqArchetype = extractMcqArchetype(mcqAnswers);

  // L2 — MCQ-implied dimension (only if user didn't lock).
  let mcqDimensionWarning = null;
  if (!resolvedDimension) {
    const mcqDim = extractMcqDimension(mcqAnswers);
    if (mcqDim.dimension) {
      resolvedDimension = mcqDim.dimension;
      dimensionSource = 'mcq';
      if (mcqDim.conflict) mcqDimensionWarning = mcqDim.conflict;
    }
  }

  // Dimension hint inside rawPrompt — only used if neither user nor MCQ locked
  // the dimension yet. Words like "3D mario" should pick up 3D here.
  if (!resolvedDimension) {
    const promptDim = detectDimensionHint(promptText);
    if (promptDim) {
      resolvedDimension = promptDim;
      dimensionSource = 'heuristic';
    }
  }

  // L3 — keyword pass on raw prompt.
  const keywordMatch = matchKeywordRule(promptText);

  // L4 + L5 — choose archetype id.
  let archetypeId = null;
  let archetypeSource = 'heuristic';
  let confidenceScore = 0.4;
  let reasoning = '';

  if (mcqArchetype) {
    archetypeId = mcqArchetype;
    archetypeSource = 'mcq';
    confidenceScore = 0.85;
    reasoning = `MCQ answer named archetype "${archetypeId}".`;
  } else if (gameType && isKnownArchetypeId(gameType)) {
    archetypeId = gameType;
    archetypeSource = 'user';
    confidenceScore = 1.0;
    reasoning = `User gameType named archetype "${archetypeId}".`;
  } else if (keywordMatch) {
    archetypeId = keywordMatch.archetypeId;
    archetypeSource = 'heuristic';
    confidenceScore = 0.7;
    reasoning = `Keyword "${keywordMatch.label}" matched archetype "${archetypeId}".`;
  } else {
    // Fallback — by dimension (or 2D default if no dimension either).
    const fallbackDim = resolvedDimension || '2D';
    archetypeId = DEFAULT_BY_DIMENSION[fallbackDim];
    archetypeSource = 'heuristic';
    confidenceScore = 0.4;
    if (!resolvedDimension) {
      resolvedDimension = '2D';
      dimensionSource = 'default';
    }
    if (!promptText.trim()) {
      warnings.push('no signal — empty prompt; using dimension default');
    } else {
      warnings.push('no keyword match — using dimension default');
    }
    reasoning = `No keyword match; defaulted to "${archetypeId}" for dimension ${fallbackDim}.`;
  }

  // If we still have no dimension, pick one from the chosen archetype.
  if (!resolvedDimension) {
    const profile = getArchetypeProfile(archetypeId);
    resolvedDimension = profile?.dimension || '2D';
    dimensionSource = dimensionSource === 'default' ? 'default' : 'heuristic';
  }

  // L4 — projection when dimension is locked.
  const projected = projectArchetypeOntoDimension(archetypeId, resolvedDimension);
  if (projected.archetypeId !== archetypeId) {
    if (projected.warning) warnings.push(projected.warning);
    archetypeId = projected.archetypeId;
    if (archetypeSource === 'heuristic') confidenceScore = 0.55;
  } else if (projected.warning) {
    warnings.push(projected.warning);
  }

  if (mcqDimensionWarning) warnings.push(mcqDimensionWarning);

  const archetypeProfile = getArchetypeProfile(archetypeId);
  if (!archetypeProfile) {
    // Defensive — should never hit because projection guarantees a valid id.
    const fallback = DEFAULT_BY_DIMENSION[resolvedDimension] || 'platformer_2d';
    return {
      dimension: resolvedDimension,
      archetype: fallback,
      archetypeProfile: getArchetypeProfile(fallback),
      confidenceScore: 0.4,
      reasoningShort: 'Unknown archetype id; fell back to dimension default.',
      source: 'heuristic',
      dimensionSource,
      warnings: [...warnings, `unknown archetype id, fell back to "${fallback}"`]
    };
  }

  return {
    dimension: resolvedDimension,
    archetype: archetypeId,
    archetypeProfile,
    confidenceScore,
    reasoningShort: reasoning,
    source: archetypeSource,
    dimensionSource,
    warnings
  };
}

function extractMcqDimension(mcqAnswers) {
  if (!mcqAnswers || typeof mcqAnswers !== 'object') return { dimension: '', conflict: null };
  const entries = Object.entries(mcqAnswers).filter(([, value]) => typeof value === 'string' && value.trim());

  const hits = [];
  const keyHintRe = /dim|perspective|view|space|world/i;

  for (const [key, value] of entries) {
    const hint = detectDimensionHint(value);
    if (hint) hits.push({ source: 'value', key, value, hint });
    if (keyHintRe.test(key)) {
      const keyHint = detectDimensionHint(value);
      if (keyHint && !hits.some((h) => h.key === key && h.source === 'value')) {
        hits.push({ source: 'key', key, value, hint: keyHint });
      }
    }
  }

  if (!hits.length) return { dimension: '', conflict: null };
  const first = hits[0].hint;
  const conflict = hits.some((h) => h.hint && h.hint !== first)
    ? `MCQ answers conflict on dimension; using first match "${first}"`
    : null;
  return { dimension: first, conflict };
}

function extractMcqArchetype(mcqAnswers) {
  if (!mcqAnswers || typeof mcqAnswers !== 'object') return null;
  for (const value of Object.values(mcqAnswers)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (isKnownArchetypeId(trimmed)) return trimmed;
  }
  return null;
}

function projectArchetypeOntoDimension(archetypeId, resolvedDimension) {
  const profile = getArchetypeProfile(archetypeId);
  if (!profile) return { archetypeId, warning: null };
  if (profile.dimensionLock === 'any') return { archetypeId, warning: null };
  if (profile.dimensionLock === resolvedDimension) return { archetypeId, warning: null };

  // Explicit projection table.
  const projections = {
    platformer_2d: { '3D': 'platformer_3d', hybrid: 'hybrid_2_5d' },
    platformer_3d: { '2D': 'platformer_2d', hybrid: 'hybrid_2_5d' },
    top_down_2d: { '3D': 'top_down_3d', hybrid: 'top_down_3d' },
    top_down_3d: { '2D': 'top_down_2d', hybrid: 'top_down_2d' },
    third_person_3d: { '2D': 'top_down_2d', hybrid: 'hybrid_2_5d' },
    first_person_3d: { '2D': 'top_down_2d', hybrid: 'third_person_3d' },
    vehicle_3d: { '2D': 'top_down_2d', hybrid: 'top_down_3d' },
    on_rails_shooter: { '2D': 'top_down_2d', hybrid: 'third_person_3d' },
    hybrid_2_5d: { '2D': 'platformer_2d', '3D': 'third_person_3d' }
  };

  const target = projections[archetypeId]?.[resolvedDimension];
  if (!target) {
    return {
      archetypeId,
      warning: `archetype "${archetypeId}" does not project onto dimension "${resolvedDimension}"; kept as-is`
    };
  }

  return {
    archetypeId: target,
    warning: `keyword suggested "${archetypeId}" but dimension was locked to ${resolvedDimension}; projected to "${target}"`
  };
}

module.exports = {
  classifyArchetype,
  ARCHETYPES,
  getArchetypeProfile,
  // exported for tests
  extractMcqDimension,
  extractMcqArchetype,
  projectArchetypeOntoDimension
};
