const config = require('../config/env');
const {
  getAssetById,
  getAssetsByIds,
  getRegistryIndex
} = require('./assetRegistryService');

const ROLE_TAXONOMY = [
  'player',
  'enemy',
  'hazard',
  'collectible',
  'terrain',
  'platform',
  'environment',
  'prop',
  'ui',
  'vfx',
  'audio'
];

const MAX_SELECTED_ASSETS = 12;
const SUBSTITUTE_THRESHOLD = 0.35;
const GAMEPLAY_ROLES = new Set(['player', 'enemy', 'hazard', 'collectible', 'terrain', 'platform', 'environment', 'prop']);

function resolveAssetsForBrief(input) {
  return resolveAssetsForBriefWithRegistry(input, getRegistryIndex());
}

function resolveAssetsForBriefWithRegistry({
  prompt,
  answers = {},
  gameType,
  dimension,
  brief,
  selectedAssetIds = [],
  debug = false,
  strictMissing
}, registryIndex) {
  const startedAt = nowMs();
  const runtimeTarget = runtimeTargetForBrief(brief, dimension);
  const targetEngine = runtimeTarget.primaryEngine;
  const context = buildContextText({ prompt, answers, gameType, dimension, brief });
  const intent = detectAssetIntent({ prompt, brief, context });
  const requirements = buildAssetRequirements({ brief, context, runtimeTarget, intent });
  const queryPlan = buildQueryPlan({
    prompt,
    brief,
    context,
    runtimeTarget,
    intent,
    requirements,
    selectedAssetIds,
    strictMissing,
    registryIndex
  });
  const selectedAssets = [];
  const substitutions = [];
  const missingAssets = [];
  const usedIds = new Set();
  const debugRequirements = [];
  let evaluatedAssetCount = 0;
  let candidateAssetCount = 0;

  for (const requirement of requirements) {
    let candidateResult = buildBoundedCandidates({
      requirement,
      queryPlan,
      registryIndex,
      selectedAssetIds,
      usedIds
    });
    candidateAssetCount += candidateResult.candidateIds.length;

    let scored = [];
    for (const id of candidateResult.candidateIds) {
      if (usedIds.has(id)) continue;
      const asset = registryIndex.indexes.byId.get(id);
      if (!asset || !isRuntimeUsableAsset(asset) || !isAssetUsableForRequirement(asset, requirement)) continue;
      const entry = scoreAssetForRequirement(asset, requirement, context, queryPlan, selectedAssetIds.length > 0);
      if (entry.score > 0) scored.push(entry);
    }

    if (scored.length === 0 && selectedAssetIds.length === 0) {
      candidateResult = buildBroadCandidates({
        requirement,
        queryPlan,
        registryIndex,
        usedIds,
        previousFilters: candidateResult.attemptedFilters
      });
      candidateAssetCount += candidateResult.candidateIds.length;
      scored = [];
      for (const id of candidateResult.candidateIds) {
        if (usedIds.has(id)) continue;
        const asset = registryIndex.indexes.byId.get(id);
        if (!asset || !isRuntimeUsableAsset(asset) || !isAssetUsableForRequirement(asset, requirement)) continue;
        const entry = scoreAssetForRequirement(asset, requirement, context, queryPlan, false);
        if (entry.score > 0) scored.push(entry);
      }
    }

    evaluatedAssetCount += scored.length;
    scored.sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
    const shortlist = maybeRerankShortlist(scored.slice(0, queryPlan.shortlistPerRole), requirement, queryPlan);
    const picks = [];

    for (const entry of shortlist) {
      if (picks.length >= requirement.quantity) break;
      const confidenceScore = confidenceFromScore(entry.score);
      if (confidenceScore < SUBSTITUTE_THRESHOLD) continue;
      if (queryPlan.strictMissing && confidenceScore < queryPlan.strictMissingThreshold) continue;
      picks.push({ ...entry, confidenceScore });
      usedIds.add(entry.asset.id);
    }

    const selected = picks.filter((entry) => entry.confidenceScore >= queryPlan.strictMissingThreshold);
    const substitutes = picks.filter((entry) => entry.confidenceScore < queryPlan.strictMissingThreshold);

    for (const entry of selected) {
      selectedAssets.push(publicResolvedAsset(entry.asset, requirement, entry.confidenceScore, reasonFor(entry, requirement, false), debug ? entry.breakdown : null));
    }

    for (const entry of substitutes) {
      const resolved = publicResolvedAsset(entry.asset, requirement, entry.confidenceScore, reasonFor(entry, requirement, true), debug ? entry.breakdown : null);
      selectedAssets.push(resolved);
      substitutions.push({
        requirementId: requirement.id,
        role: requirement.role,
        requested: requirement.description,
        selectedAssetId: entry.asset.id,
        confidenceScore: entry.confidenceScore,
        reason: resolved.reason
      });
    }

    const unresolvedCount = requirement.quantity - picks.length;
    if (unresolvedCount > 0) {
      missingAssets.push(missingForRequirement({
        requirement,
        count: unresolvedCount,
        queryPlan,
        candidateResult,
        topScore: scored[0]?.score || 0,
        targetEngine
      }));
    }

    if (debug) {
      debugRequirements.push({
        requirementId: requirement.id,
        role: requirement.role,
        searchedPacks: candidateResult.searchedPacks,
        attemptedFilters: candidateResult.attemptedFilters,
        candidateCount: candidateResult.candidateIds.length,
        evaluatedCount: scored.length,
        topCandidates: scored.slice(0, Math.min(5, scored.length)).map((entry) => ({
          id: entry.asset.id,
          pack: entry.asset.packId,
          type: entry.asset.type,
          category: entry.asset.category,
          score: entry.score,
          confidenceScore: confidenceFromScore(entry.score),
          breakdown: entry.breakdown
        }))
      });
    }
  }

  const selectedAssetIdsForManifest = selectedAssets
    .slice(0, MAX_SELECTED_ASSETS)
    .map((asset) => asset.id);
  const durationMs = Math.round(nowMs() - startedAt);

  const response = {
    requirements,
    selectedAssets: selectedAssets.slice(0, MAX_SELECTED_ASSETS),
    substitutions,
    missingAssets,
    runtimeAssetManifest: buildRuntimeAssetManifest(selectedAssetIdsForManifest, targetEngine),
    meta: {
      agent: 'asset-resolver',
      strategy: 'deterministic-registry-ranking',
      targetEngine,
      runtimeTarget: runtimeTarget.runtimeTarget,
      primaryEngine: runtimeTarget.primaryEngine,
      assetEngines: runtimeTarget.assetEngines,
      registryCandidateCount: registryIndex.totalAssets,
      totalAssets: registryIndex.totalAssets,
      candidateAssets: candidateAssetCount,
      evaluatedAssets: evaluatedAssetCount,
      intent: intent.kind,
      llmRerankerUsed: false,
      durationMs
    }
  };

  if (debug) {
    response.debug = {
      queryPlan,
      includedPacks: queryPlan.includedPacks,
      excludedPacks: queryPlan.excludedPacks,
      candidateCounts: debugRequirements,
      missingAssets,
      llmReranker: {
        enabled: queryPlan.llmRerankEnabled,
        used: false,
        reason: queryPlan.llmRerankEnabled ? 'Prepared but not invoked in synchronous v1 resolver.' : 'disabled'
      },
      performance: {
        durationMs,
        totalAssets: registryIndex.totalAssets,
        candidateAssets: candidateAssetCount,
        evaluatedAssets: evaluatedAssetCount
      }
    };
  }

  return response;
}

function buildRuntimeAssetManifest(assetIds, targetEngine) {
  return {
    engine: targetEngine || 'any',
    assets: assetIds
      .map(getAssetById)
      .filter(Boolean)
      .map((asset) => ({
        key: asset.id,
        type: runtimeManifestType(asset),
        url: asset.publicPath
      }))
  };
}

function detectAssetIntent({ prompt, brief, context }) {
  const assetNeeds = (brief.assetPlan?.assetsToGenerate || []).join(' ');
  const source = normalize([prompt, brief.title, brief.genre, brief.oneSentencePitch, assetNeeds, brief.assetPlan?.visualStyle].join(' '));
  const explicitOnly = matchesAny(source, ['ui only', 'audio only', 'controls only', 'tilemap only', 'model only', 'environment only', 'character only']);
  const hasGameplayComposition = matchesAny(source, ['3d', 'three', 'world', 'gameplay', 'platformer', 'runner', 'collectible', 'hazard', 'rapier']);
  const explicitControlsOnly = matchesAny(source, ['mobile controls only', 'controls only', 'touch controls only']);
  const explicitUiOnly = matchesAny(source, ['ui only', 'hud only', 'menu only', 'interface only', 'ui kit']);

  if (matchesAny(source, ['mobile controls only', 'add mobile controls', 'touch controls only', 'joystick', 'dpad']) && !matchesAny(source, ['full game', 'complete game']) && (explicitControlsOnly || !hasGameplayComposition)) {
    return { kind: 'mobile-controls-only', roles: ['ui'], reason: 'Mobile controls request should only create control UI requirements.' };
  }
  if (explicitUiOnly || (explicitOnly && matchesAny(source, ['ui', 'hud', 'menu', 'interface']) && !hasGameplayComposition)) {
    return { kind: 'ui-only', roles: ['ui'], reason: 'UI-only request should not create gameplay requirements.' };
  }
  if ((explicitOnly && matchesAny(source, ['audio', 'music', 'sfx', 'sound'])) || matchesAny(source, ['audio pack', 'sfx only'])) {
    return { kind: 'audio-only', roles: ['audio'], reason: 'Audio-only request should not create visual requirements.' };
  }
  if ((explicitOnly && matchesAny(source, ['tilemap', 'tileset', 'terrain'])) || matchesAny(source, ['tilemap-first', 'tilemap only'])) {
    return { kind: 'tilemap-only', roles: ['environment', 'terrain'], reason: 'Tilemap request should focus on map and terrain assets.' };
  }
  if (explicitOnly && matchesAny(source, ['3d model', 'model', 'glb', 'gltf'])) {
    return { kind: '3d-model-only', roles: ['player', 'environment', 'prop'], reason: '3D model request should focus on GLB/GLTF assets.' };
  }
  if (explicitOnly && matchesAny(source, ['environment', 'background', 'world'])) {
    return { kind: 'environment-only', roles: ['environment', 'terrain'], reason: 'Environment-only request should not create character requirements.' };
  }
  if (explicitOnly && matchesAny(source, ['character', 'player', 'enemy'])) {
    return { kind: 'character-only', roles: ['player', 'enemy'], reason: 'Character-only request should focus on character assets.' };
  }

  return { kind: 'full-game', roles: [], reason: 'Full game brief needs gameplay, environment, and support assets.' };
}

function buildAssetRequirements({ brief, context, runtimeTarget, intent }) {
  const is3D = runtimeTarget.primaryEngine === 'three' || intent.kind === '3d-model-only';

  if (intent.kind === 'mobile-controls-only') {
    return assignRequirementIds([
      requirement('ui', 3, ['image', 'spritesheet', 'atlas'], 'Mobile touch controls, joystick, dpad, and buttons', ['mobile', 'controls', 'touch', 'joystick', 'dpad', 'button'], 'high')
    ]);
  }
  if (intent.kind === 'ui-only') {
    return assignRequirementIds([
      requirement('ui', 2, ['image', 'spritesheet', 'atlas'], 'HUD, menu, or interface visuals', ['ui', 'hud', 'menu', 'interface', 'button'], 'high')
    ]);
  }
  if (intent.kind === 'audio-only') {
    return assignRequirementIds([
      requirement('audio', 2, ['audio'], 'Audio cues, sfx, or music loops', ['audio', 'sound', 'sfx', 'music'], 'high')
    ]);
  }
  if (intent.kind === 'tilemap-only') {
    return assignRequirementIds([
      requirement('environment', 1, ['tilemap', 'spritesheet', 'atlas', 'image'], 'Tilemap or map file for the playable space', ['tilemap', 'map', 'dungeon', 'terrain'], 'high'),
      requirement('terrain', 1, ['spritesheet', 'atlas', 'image'], 'Tileset or terrain sheet for the tilemap', ['tileset', 'tilesheet', 'terrain', 'tile'], 'high')
    ]);
  }
  if (intent.kind === 'environment-only') {
    return assignRequirementIds([
      requirement('environment', 1, is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'], 'Environment or background asset', ['environment', 'background', 'world'], 'high'),
      requirement('terrain', 1, is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'], 'Terrain or level-building asset', ['terrain', 'ground', 'tilemap', 'tileset'], 'medium')
    ]);
  }
  if (intent.kind === 'character-only') {
    return assignRequirementIds([
      requirement('player', 1, is3D ? ['gltf'] : ['spritesheet', 'image'], 'Playable character or avatar', ['player', 'character', 'hero'], 'high'),
      requirement('enemy', 1, is3D ? ['gltf'] : ['spritesheet', 'image'], 'Enemy or hostile character', ['enemy', 'character', 'monster'], 'medium')
    ]);
  }
  if (intent.kind === '3d-model-only') {
    return assignRequirementIds([
      requirement('player', 1, ['gltf'], 'Playable 3D model or avatar', ['player', 'character', 'hero', 'model'], 'high'),
      requirement('environment', 1, ['gltf'], '3D environment model or world prop', ['environment', 'world', 'prop', 'model'], 'medium')
    ]);
  }

  const requirements = [
    requirement('player', 1, is3D ? ['gltf'] : ['spritesheet', 'image'], 'Playable character or avatar', ['player', 'character', 'hero'], 'high'),
    requirement('environment', 1, is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'], 'Background or world dressing', ['environment', 'background', 'world', 'tilemap', 'tileset'], 'medium')
  ];

  if (matchesAny(context, ['platform', 'jump', 'runner'])) {
    requirements.push(requirement('platform', is3D ? 3 : 1, is3D ? ['gltf'] : ['spritesheet', 'atlas', 'image'], 'Platform and ground pieces', ['platform', 'ground', 'block', 'terrain', 'tile'], 'high'));
  } else {
    requirements.push(requirement('terrain', is3D ? 2 : 1, is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'], 'Terrain pieces for the playable space', ['terrain', 'ground', 'block', 'tilemap', 'tileset'], 'medium'));
  }

  if (matchesAny(context, ['collect', 'coin', 'crystal', 'repair', 'gem', 'score'])) {
    requirements.push(requirement('collectible', 1, is3D ? ['gltf'] : ['image'], 'Collectible objective item', ['collectible', 'coin', 'crystal', 'gem', 'star'], 'high'));
  }
  if (matchesAny(context, ['hazard', 'avoid', 'trap', 'spike', 'saw', 'danger'])) {
    requirements.push(requirement('hazard', 1, is3D ? ['gltf'] : ['image'], 'Hazard or trap obstacle', ['hazard', 'trap', 'spike', 'saw'], 'high'));
  }
  if (matchesAny(context, ['enemy', 'combat', 'fight', 'attack', 'shoot'])) {
    requirements.push(requirement('enemy', 1, is3D ? ['gltf'] : ['spritesheet', 'image'], 'Enemy or hostile character', ['enemy', 'character', 'monster'], 'medium'));
  }
  if (matchesAny(context, ['hud', 'score', 'lives', 'health', 'menu', 'interface'])) {
    requirements.push(requirement('ui', 1, ['image', 'spritesheet', 'atlas'], 'HUD or UI visual', ['ui', 'hud', 'health', 'score'], 'medium'));
  }
  if (matchesAny(context, ['visual effect', 'vfx', 'particle', 'spark', 'magic', 'explosion', 'muzzle flash'])) {
    requirements.push(requirement('vfx', 1, ['image', 'spritesheet', 'atlas'], 'Small effect visual', ['vfx', 'effect', 'spark', 'magic'], 'low'));
  }
  if (matchesAny(context, ['audio', 'music', 'sound', 'sfx'])) {
    requirements.push(requirement('audio', 1, ['audio'], 'Audio cue or music loop', ['audio', 'music', 'sfx'], 'low'));
  }

  for (const assetNeed of brief.assetPlan?.assetsToGenerate || []) {
    const role = inferRole(assetNeed);
    if (requirements.some((item) => item.role === role)) continue;
    requirements.push(requirement(role, 1, preferredTypesForRole(role, is3D), assetNeed, keywordsForRole(role, assetNeed), 'medium'));
  }

  return assignRequirementIds(requirements);
}

function buildQueryPlan({ prompt, brief, context, runtimeTarget, intent, requirements, selectedAssetIds, strictMissing, registryIndex }) {
  const targetEngine = runtimeTarget.primaryEngine;
  const requiredRoles = [...new Set(requirements.map((requirement) => requirement.role))];
  const dimension = runtimeTarget.runtimeTarget === '3D'
    ? '3D'
    : runtimeTarget.runtimeTarget === 'hybrid'
      ? 'hybrid'
      : '2D';
  const settings = config.assets;
  const strict = typeof strictMissing === 'boolean'
    ? strictMissing
    : selectedAssetIds.length > 0
      ? false
      : true;
  const rankedPacks = rankPacks({
    packSummaries: registryIndex.packSummaries,
    context,
    runtimeTarget,
    dimension,
    requiredRoles,
    intent
  });
  const includedPacks = rankedPacks
    .filter((pack) => pack.score > 0 && !pack.exclude)
    .slice(0, settings.maxPacksToSearch)
    .map((pack) => ({
      packId: pack.packId,
      score: pack.score,
      reasons: pack.reasons
    }));
  const includedPackIds = new Set(includedPacks.map((pack) => pack.packId));
  const excludedPacks = rankedPacks
    .filter((pack) => pack.exclude || !includedPackIds.has(pack.packId))
    .map((pack) => ({
      packId: pack.packId,
      score: pack.score,
      reasons: pack.excludeReasons.length ? pack.excludeReasons : ['Below pack-routing cutoff.']
    }));

  if (includedPacks.length === 0 && registryIndex.packSummaries.length > 0) {
    const fallback = rankedPacks.find((pack) => !pack.exclude) || rankedPacks[0];
    if (fallback) includedPacks.push({ packId: fallback.packId, score: fallback.score, reasons: ['Fallback pack because no routed pack scored above zero.'] });
  }

  return {
    preferredPacks: includedPacks.map((pack) => pack.packId),
    primaryPack: includedPacks[0]?.packId || null,
    packScores: Object.fromEntries(includedPacks.map((pack, index) => [pack.packId, Math.max(0, 36 - index * 8)])),
    excludedPacks,
    includedPacks,
    requiredRoles,
    dimension,
    engine: targetEngine,
    runtimeTarget: runtimeTarget.runtimeTarget,
    primaryEngine: runtimeTarget.primaryEngine,
    assetEngines: runtimeTarget.assetEngines,
    maxCandidatesPerRole: settings.maxCandidatesBeforeScoring,
    maxCandidatesBeforeScoring: settings.maxCandidatesBeforeScoring,
    shortlistPerRole: settings.shortlistPerRole,
    maxPacksToSearch: settings.maxPacksToSearch,
    strictMissing: strict,
    strictMissingThreshold: settings.strictMissingThreshold,
    llmRerankEnabled: settings.aiRerankEnabled,
    llmRerankMaxCandidates: settings.aiRerankMaxCandidates,
    intent: intent.kind,
    intentReason: intent.reason,
    promptText: normalize(prompt || ''),
    style: brief.assetPlan?.visualStyle || '',
    theme: inferTheme(context)
  };
}

function rankPacks({ packSummaries, context, runtimeTarget, dimension, requiredRoles, intent }) {
  const targetEngine = runtimeTarget.primaryEngine;
  return packSummaries.map((pack) => {
    let score = 0;
    const reasons = [];
    const excludeReasons = [];
    const isUiOnly = pack.roles.includes('ui') && !pack.roles.some((role) => GAMEPLAY_ROLES.has(role));
    const isAudioOnly = pack.types.includes('audio') && pack.types.length <= 2 && !pack.types.some((type) => ['image', 'spritesheet', 'gltf', 'tilemap', 'atlas'].includes(type));
    const isTileOnly = pack.roles.some((role) => ['tilemap', 'terrain', 'platform', 'environment'].includes(role)) &&
      !pack.roles.some((role) => ['player', 'enemy', 'collectible', 'hazard', 'ui', 'audio'].includes(role));
    const needsGameplay = requiredRoles.some((role) => GAMEPLAY_ROLES.has(role));
    const needsUi = requiredRoles.includes('ui');
    const needsAudio = requiredRoles.includes('audio');
    const needsTilemap = requiredRoles.some((role) => ['terrain', 'platform', 'environment'].includes(role));

    if (targetEngine === 'phaser' && pack.engines.length && !pack.engines.includes('phaser') && !needsAudio) {
      excludeReasons.push('Skipped because this is a pure 2D/Phaser request and the pack has no Phaser-compatible assets.');
    }
    if (targetEngine === 'three' && runtimeTarget.runtimeTarget !== 'hybrid' && needsGameplay && pack.types.every((type) => type !== 'gltf') && !needsUi && !needsAudio) {
      excludeReasons.push('Skipped because this is a 3D gameplay request and the pack has no GLB/GLTF assets.');
    }
    if (isUiOnly && needsGameplay && !needsUi && intent.kind !== 'mobile-controls-only') {
      excludeReasons.push('Skipped UI-only pack for gameplay asset requirements.');
    }
    if (isAudioOnly && !needsAudio) {
      excludeReasons.push('Skipped audio-only pack for visual asset requirements.');
    }
    if (isTileOnly && !needsTilemap) {
      excludeReasons.push('Skipped tilemap-focused pack because terrain/tilemap is not needed.');
    }

    if (pack.engines.includes(targetEngine)) {
      score += 20;
      reasons.push(`Matches ${targetEngine} runtime.`);
    }
    if (runtimeTarget.runtimeTarget === 'hybrid' && pack.engines.some((engine) => runtimeTarget.assetEngines.includes(engine))) {
      score += 10;
      reasons.push('Matches hybrid mixed runtime asset lane.');
    }
    if (dimension === 'hybrid' || pack.dimension === dimension || pack.dimension === 'hybrid' || pack.dimension === 'any') {
      score += 12;
      reasons.push(`Compatible with ${dimension} dimension.`);
    }

    const roleOverlap = requiredRoles.filter((role) => pack.roles.includes(role) || roleMatchesPackCategory(role, pack.categories));
    if (roleOverlap.length) {
      score += roleOverlap.length * 8;
      reasons.push(`Covers roles: ${roleOverlap.join(', ')}.`);
    }

    const themeHits = [...new Set([pack.packId, ...pack.themes, ...pack.styles].filter((term) => context.includes(normalize(term))))];
    if (themeHits.length) {
      score += Math.min(themeHits.length * 8, 32);
      reasons.push(`Matches context terms: ${themeHits.slice(0, 4).join(', ')}.`);
    }

    const explicit = explicitPackPreference(pack.packId, context, intent.kind);
    if (explicit > 0) {
      score += explicit;
      reasons.push('Explicitly requested or strongly implied by the brief.');
    }

    if (excludeReasons.length) score -= 80;
    return {
      packId: pack.packId,
      score,
      reasons: reasons.length ? reasons : ['No strong pack-level match.'],
      exclude: excludeReasons.length > 0,
      excludeReasons
    };
  }).sort((a, b) => b.score - a.score || a.packId.localeCompare(b.packId));
}

function buildBoundedCandidates({ requirement, queryPlan, registryIndex, selectedAssetIds, usedIds }) {
  const attemptedFilters = [];
  const searchedPacks = selectedAssetIds.length
    ? ['selectedAssetIds']
    : queryPlan.preferredPacks;
  if (selectedAssetIds.length) {
    return {
      candidateIds: getAssetsByIds(selectedAssetIds).map((asset) => asset.id).filter((id) => !usedIds.has(id)),
      searchedPacks,
      attemptedFilters: ['selectedAssetIds']
    };
  }

  const typeSet = unionIndexSets(registryIndex.indexes.byType, preferredTypesForRequirement(requirement));
  attemptedFilters.push(`type:${preferredTypesForRequirement(requirement).join('|')}`);
  attemptedFilters.push(`pack:${queryPlan.preferredPacks.join('|')}`);
  const engineSet = engineSetForRequirement(registryIndex, requirement, queryPlan.engine, queryPlan);
  attemptedFilters.push(`engine:${queryPlan.engine}`);
  const dimensionSet = dimensionSetForRequirement(registryIndex, requirement, queryPlan.dimension);
  attemptedFilters.push(`dimension:${queryPlan.dimension}`);
  const roleSet = roleSetForRequirement(registryIndex, requirement);
  attemptedFilters.push(`role:${requirement.role}`);

  let candidateIds = collectPerPackCandidates({
    packIds: queryPlan.preferredPacks,
    registryIndex,
    sets: [engineSet, dimensionSet, typeSet, roleSet],
    maxCandidates: queryPlan.maxCandidatesBeforeScoring * 2
  });
  if (candidateIds.length < requirement.quantity) {
    candidateIds = collectPerPackCandidates({
      packIds: queryPlan.preferredPacks,
      registryIndex,
      sets: [engineSet, dimensionSet, typeSet],
      maxCandidates: queryPlan.maxCandidatesBeforeScoring * 2
    });
    attemptedFilters.push('relaxed:role');
  }
  if (candidateIds.length < requirement.quantity && requirement.role !== 'audio') {
    candidateIds = collectPerPackCandidates({
      packIds: queryPlan.preferredPacks,
      registryIndex,
      sets: [engineSet, typeSet],
      maxCandidates: queryPlan.maxCandidatesBeforeScoring * 2
    });
    attemptedFilters.push('relaxed:dimension');
  }

  const ranked = candidateIds
    .filter((id) => !usedIds.has(id))
    .map((id) => registryIndex.indexes.byId.get(id))
    .filter(Boolean)
    .map((asset) => ({ id: asset.id, preScore: preScoreCandidate(asset, requirement, queryPlan) }))
    .filter((entry) => entry.preScore > -40)
    .sort((a, b) => b.preScore - a.preScore || a.id.localeCompare(b.id))
    .slice(0, queryPlan.maxCandidatesBeforeScoring)
    .map((entry) => entry.id);

  return { candidateIds: ranked, searchedPacks, attemptedFilters };
}

function buildBroadCandidates({ requirement, queryPlan, registryIndex, usedIds, previousFilters }) {
  const typeSet = unionIndexSets(registryIndex.indexes.byType, preferredTypesForRequirement(requirement));
  const engineSet = engineSetForRequirement(registryIndex, requirement, queryPlan.engine);
  const dimensionSet = dimensionSetForRequirement(registryIndex, requirement, queryPlan.dimension);
  const candidateIds = collectPerPackCandidates({
    packIds: queryPlan.preferredPacks,
    registryIndex,
    sets: [engineSet, dimensionSet, typeSet],
    maxCandidates: queryPlan.maxCandidatesBeforeScoring
  }).filter((id) => !usedIds.has(id));

  return {
    candidateIds,
    searchedPacks: queryPlan.preferredPacks,
    attemptedFilters: [...previousFilters, 'broad-fallback:type+engine+dimension']
  };
}

function collectPerPackCandidates({ packIds, registryIndex, sets, maxCandidates }) {
  const ids = [];
  const seen = new Set();
  const perPackLimit = Math.max(20, Math.ceil(maxCandidates / Math.max(1, packIds.length)));

  for (const packId of packIds) {
    const packSet = registryIndex.indexes.byPack.get(normalize(packId));
    if (!packSet) continue;
    let collectedFromPack = 0;
    for (const id of packSet) {
      if (seen.has(id)) continue;
      if (!sets.every((set) => set.has(id))) continue;
      const asset = registryIndex.indexes.byId.get(id);
      if (!asset || !isRuntimeUsableAsset(asset)) continue;
      seen.add(id);
      ids.push(id);
      collectedFromPack += 1;
      if (ids.length >= maxCandidates) return ids;
      if (collectedFromPack >= perPackLimit) break;
    }
  }

  return ids;
}

function scoreAssetForRequirement(asset, requirement, context, queryPlan, allowReferenceAssets = false) {
  const breakdown = {};
  let score = 0;

  addScore(breakdown, 'engine', engineScore(asset, requirement, queryPlan));
  addScore(breakdown, 'dimension', dimensionScore(asset.assetDimension, queryPlan.dimension, requirement));
  addScore(breakdown, 'type', typeScore(asset, requirement));
  addScore(breakdown, 'role', roleScore(asset, requirement));
  addScore(breakdown, 'pack', packScore(asset, queryPlan, context));
  addScore(breakdown, 'context', contextScore(asset, requirement, context, queryPlan));
  addScore(breakdown, 'quality', qualityScore(asset));
  addScore(breakdown, 'penalties', penaltyScore(asset, requirement, queryPlan, allowReferenceAssets));

  for (const value of Object.values(breakdown)) score += value;
  return { asset, score, breakdown };
}

function preScoreCandidate(asset, requirement, queryPlan) {
  let score = 0;
  if (queryPlan.preferredPacks.includes(asset.packId)) score += 20;
  if (engineMatchesRequirement(asset, requirement, queryPlan)) score += 12;
  if (preferredTypesForRequirement(requirement).includes(asset.normalizedType)) score += 12;
  if (asset.normalizedRoleHints.includes(requirement.role)) score += 16;
  if (roleMatchesCategory(requirement.role, asset.normalizedCategory)) score += 10;
  if (GAMEPLAY_ROLES.has(requirement.role) && asset.normalizedCategory === 'ui') score -= 40;
  if (requirement.role !== 'audio' && asset.normalizedType === 'audio') score -= 50;
  for (const keyword of requirement.keywords || []) {
    if (asset.searchText.includes(normalize(keyword))) score += 4;
  }
  return score;
}

function confidenceFromScore(score) {
  if (score >= 170) return Math.min(1, Number((0.97 + ((score - 170) / 30) * 0.03).toFixed(2)));
  if (score >= 150) return Number((0.9 + ((score - 150) / 20) * 0.06).toFixed(2));
  if (score >= 120) return Number((0.75 + ((score - 120) / 30) * 0.14).toFixed(2));
  if (score >= 85) return Number((0.55 + ((score - 85) / 35) * 0.19).toFixed(2));
  if (score >= 55) return Number((0.35 + ((score - 55) / 30) * 0.19).toFixed(2));
  return Math.max(0, Number((score / 160).toFixed(2)));
}

function publicResolvedAsset(asset, requirement, confidenceScore, reason, scoreBreakdown = null) {
  const resolved = {
    id: asset.id,
    role: requirement.role,
    requirementId: requirement.id,
    name: asset.name,
    type: asset.type,
    format: asset.format,
    category: asset.category,
    subcategory: asset.subcategory,
    tags: asset.tags || [],
    engineCompatibility: asset.engineCompatibility || [],
    publicPath: asset.publicPath,
    source: asset.source,
    pack: asset.pack || asset.packId,
    sourcePack: asset.sourcePack,
    sourceRelativePath: asset.sourceRelativePath,
    roleHints: asset.roleHints || [],
    variant: asset.variant,
    scale: asset.scale,
    atlasImage: asset.atlasImage,
    license: asset.license,
    fileSize: asset.fileSize,
    confidenceScore,
    reason
  };
  if (scoreBreakdown) resolved.scoreBreakdown = scoreBreakdown;
  return resolved;
}

function missingForRequirement({ requirement, count, queryPlan, candidateResult, topScore, targetEngine }) {
  return {
    requirementId: requirement.id,
    role: requirement.role,
    count,
    description: requirement.description,
    searchedPacks: candidateResult.searchedPacks,
    attemptedFilters: candidateResult.attemptedFilters,
    allowedFallback: fallbackForRequirement(requirement, targetEngine),
    suggestedFallback: fallbackForRequirement(requirement, targetEngine),
    generationHint: generationHintForRequirement(requirement, queryPlan),
    reason: shortReason(`No ${requirement.role} asset passed the strict confidence threshold; best raw score was ${topScore}.`)
  };
}

function reasonFor(entry, requirement, isSubstitution) {
  const type = runtimeAssetType(entry.asset);
  if (isSubstitution) return shortReason(`Closest available ${type} for ${requirement.role} role.`);
  if (entry.asset.packId) return shortReason(`Matches ${type} ${requirement.role} role in ${entry.asset.packId}.`);
  return shortReason(`Matches ${type} ${requirement.role} role and registry tags.`);
}

function maybeRerankShortlist(shortlist) {
  return shortlist;
}

function isAssetUsableForRequirement(asset, requirement) {
  const type = asset.normalizedType || normalize(asset.type);
  const preferredTypes = preferredTypesForRequirement(requirement);
  if (preferredTypes.includes('gltf') && !['ui', 'vfx', 'audio'].includes(requirement.role)) return type === 'gltf';
  if (requirement.role === 'audio') return type === 'audio';
  if (requirement.role === 'ui' || requirement.role === 'vfx') return ['image', 'spritesheet', 'atlas'].includes(type);
  if (requirement.role === 'environment' || requirement.role === 'terrain') {
    return preferredTypes.includes(type) || ['image', 'spritesheet', 'atlas', 'tilemap'].includes(type);
  }
  if (requirement.role === 'platform') {
    return preferredTypes.includes(type) || ['image', 'spritesheet', 'atlas'].includes(type);
  }
  return preferredTypes.includes(type) || ['image', 'spritesheet'].includes(type);
}

function isRuntimeUsableAsset(asset) {
  if (!asset?.id || !asset.publicPath) return false;
  const type = asset.normalizedType || normalize(asset.type);
  const format = normalize(asset.format);
  if (type === 'gltf') return format === 'glb' || format === 'gltf';
  return ['image', 'spritesheet', 'atlas', 'tilemap', 'audio'].includes(type);
}

function targetEngineForBrief(brief, dimension) {
  return runtimeTargetForBrief(brief, dimension).primaryEngine;
}

function runtimeTargetForBrief(brief, dimension) {
  const requested = normalize(dimension || brief.dimension);
  if (requested === '2d') return {
    runtimeTarget: '2D',
    primaryEngine: 'phaser',
    assetEngines: ['phaser']
  };
  if (requested === '3d') return {
    runtimeTarget: '3D',
    primaryEngine: 'three',
    assetEngines: ['three']
  };
  if (requested === 'hybrid') return {
    runtimeTarget: 'hybrid',
    primaryEngine: 'three',
    assetEngines: ['three', 'phaser']
  };
  const text = normalize([dimension, brief.dimension, brief.runtimePlan?.threeRole, brief.runtimePlan?.phaserRole].join(' '));
  if (text.includes('2d') && !text.includes('3d')) return {
    runtimeTarget: '2D',
    primaryEngine: 'phaser',
    assetEngines: ['phaser']
  };
  return {
    runtimeTarget: '3D',
    primaryEngine: 'three',
    assetEngines: ['three']
  };
}

function buildContextText({ prompt, answers, gameType, dimension, brief }) {
  return normalize([
    prompt,
    JSON.stringify(answers || {}),
    gameType,
    dimension,
    brief.title,
    brief.oneSentencePitch,
    brief.playerFantasy,
    brief.genre,
    brief.dimension,
    brief.coreLoop?.join(' '),
    brief.keyMechanics?.join(' '),
    brief.controls?.primary,
    brief.controls?.mobile,
    brief.runtimePlan?.phaserRole,
    brief.runtimePlan?.threeRole,
    brief.runtimePlan?.rapierRole,
    brief.runtimePlan?.systems?.join(' '),
    brief.assetPlan?.existingAssetsToUse?.join(' '),
    brief.assetPlan?.assetsToGenerate?.join(' '),
    brief.assetPlan?.visualStyle
  ].filter(Boolean).join(' '));
}

function requirement(role, quantity, preferredTypes, description, keywords, priority) {
  return { role, quantity, preferredTypes, description, keywords, priority };
}

function assignRequirementIds(requirements) {
  return requirements.map((item, index) => ({ ...item, id: `${item.role}-${index + 1}` }));
}

function preferredTypesForRequirement(requirement) {
  return (requirement.preferredTypes || []).map(normalize);
}

function preferredTypesForRole(role, is3D) {
  if (role === 'ui' || role === 'vfx') return ['image', 'spritesheet', 'atlas'];
  if (role === 'audio') return ['audio'];
  return is3D ? ['gltf'] : ['spritesheet', 'image'];
}

function keywordsForRole(role, text) {
  return [role, ...normalize(text).split(/\s+/).filter(Boolean).slice(0, 8)];
}

function inferRole(text) {
  const normalized = normalize(text);
  for (const role of ROLE_TAXONOMY) {
    if (normalized.includes(role)) return role;
  }
  if (matchesAny(normalized, ['coin', 'crystal', 'gem', 'star', 'collect'])) return 'collectible';
  if (matchesAny(normalized, ['spike', 'trap', 'saw', 'hazard'])) return 'hazard';
  if (matchesAny(normalized, ['platform'])) return 'platform';
  if (matchesAny(normalized, ['ground', 'terrain', 'tile', 'block', 'tilemap', 'tileset'])) return 'terrain';
  if (matchesAny(normalized, ['hud', 'button', 'health', 'score', 'joystick', 'dpad', 'controls'])) return 'ui';
  if (matchesAny(normalized, ['sound', 'music', 'sfx', 'audio'])) return 'audio';
  return 'prop';
}

function engineSetForRequirement(registryIndex, requirement, engine, queryPlan = null) {
  if (requirement.role === 'audio' || requirement.role === 'ui' || requirement.role === 'vfx') {
    return unionSets([
      registryIndex.indexes.byEngine.get('phaser') || new Set(),
      registryIndex.indexes.byEngine.get('three') || new Set(),
      registryIndex.indexes.byEngine.get('godot') || new Set()
    ]);
  }
  if (queryPlan?.runtimeTarget === 'hybrid') {
    return unionIndexSets(registryIndex.indexes.byEngine, queryPlan.assetEngines);
  }
  return registryIndex.indexes.byEngine.get(engine) || new Set();
}

function dimensionSetForRequirement(registryIndex, requirement, dimension) {
  if (requirement.role === 'audio' || requirement.role === 'ui' || requirement.role === 'vfx') {
    return unionIndexSets(registryIndex.indexes.byDimension, ['any', '2D', 'hybrid']);
  }
  if (dimension === 'hybrid') return unionIndexSets(registryIndex.indexes.byDimension, ['hybrid', '3D', 'any']);
  return unionIndexSets(registryIndex.indexes.byDimension, [dimension, 'any', 'hybrid']);
}

function roleSetForRequirement(registryIndex, requirement) {
  const sets = [];
  const roleSet = registryIndex.indexes.byRole.get(requirement.role);
  if (roleSet) sets.push(roleSet);
  for (const category of categoriesForRole(requirement.role)) {
    const categorySet = registryIndex.indexes.byCategory.get(category);
    if (categorySet) sets.push(categorySet);
  }
  for (const keyword of requirement.keywords || []) {
    const tagSet = registryIndex.indexes.byTag.get(normalize(keyword));
    if (tagSet) sets.push(tagSet);
  }
  return sets.length ? unionSets(sets) : new Set(registryIndex.indexes.byId.keys());
}

function unionIndexSets(index, keys) {
  return unionSets((keys || []).map((key) => index.get(normalize(key))).filter(Boolean));
}

function unionSets(sets) {
  const result = new Set();
  for (const set of sets) {
    for (const id of set) result.add(id);
  }
  return result;
}

function limitedIntersection(sets, limit) {
  const usable = sets.filter((set) => set && set.size > 0).sort((a, b) => a.size - b.size);
  if (!usable.length) return [];
  const [smallest, ...rest] = usable;
  const ids = [];
  for (const id of smallest) {
    if (rest.every((set) => set.has(id))) {
      ids.push(id);
      if (ids.length >= limit) break;
    }
  }
  return ids;
}

function dimensionScore(assetDimension, requestedDimension, requirement) {
  if (requirement.role === 'audio' || requirement.role === 'ui' || requirement.role === 'vfx') return 6;
  if (assetDimension === requestedDimension) return 12;
  if (assetDimension === 'any') return 5;
  if (assetDimension === 'hybrid') return 8;
  if (requestedDimension === 'hybrid' && assetDimension === '3D') return 10;
  return -24;
}

function engineMatchesRequirement(asset, requirement, queryPlan) {
  if (requirement.role === 'audio') return true;
  if (queryPlan.runtimeTarget === 'hybrid' && (requirement.role === 'ui' || requirement.role === 'vfx')) {
    return asset.normalizedEngines.includes('phaser') || asset.normalizedEngines.includes('three');
  }
  if (queryPlan.runtimeTarget === 'hybrid') {
    return asset.normalizedEngines.includes('three');
  }
  return asset.normalizedEngines.includes(queryPlan.primaryEngine || queryPlan.engine);
}

function engineScore(asset, requirement, queryPlan) {
  if (engineMatchesRequirement(asset, requirement, queryPlan)) return 18;
  if (requirement.role === 'audio') return 8;
  if ((requirement.role === 'ui' || requirement.role === 'vfx') && asset.normalizedEngines.includes('phaser')) return 12;
  return -24;
}

function typeScore(asset, requirement) {
  const type = asset.normalizedType;
  const preferredTypes = preferredTypesForRequirement(requirement);
  if (preferredTypes.includes(type)) return type === 'gltf' && normalize(asset.format) === 'glb' ? 22 : 18;
  if (requirement.role === 'environment' && ['tilemap', 'spritesheet', 'atlas', 'image'].includes(type)) return 8;
  if (requirement.role === 'ui' && ['image', 'spritesheet', 'atlas'].includes(type)) return 8;
  return -28;
}

function roleScore(asset, requirement) {
  let score = 0;
  if (asset.normalizedRoleHints.includes(requirement.role)) score += 24;
  if (roleMatchesCategory(requirement.role, asset.normalizedCategory)) score += 12;
  if (roleMatchesAssetName(requirement.role, asset.searchText)) score += 6;
  if (isTileRole(requirement.role) && asset.normalizedRoleHints.some((hint) => ['tilemap', 'tileset', 'terrain'].includes(hint))) score += 10;
  if (requirement.role === 'ui' && asset.normalizedRoleHints.includes('controls')) score += 10;
  return score || -10;
}

function packScore(asset, queryPlan, context) {
  let score = 0;
  if (queryPlan.preferredPacks.includes(asset.packId)) score += queryPlan.packScores[asset.packId] || 8;
  if (context.includes(asset.packId.replace(/-/g, ' '))) score += 10;
  if (queryPlan.intent === 'mobile-controls-only' && asset.packId.includes('mobile-controls')) score += 18;
  if (queryPlan.intent === 'tilemap-only' && asset.packId.includes('roguelike')) score += 28;
  if (queryPlan.intent !== 'mobile-controls-only' && asset.packId.includes('mobile-controls') && GAMEPLAY_ROLES.has(queryPlan.requiredRoles[0])) score -= 18;
  return score;
}

function contextScore(asset, requirement, context) {
  let score = 0;
  const hitTerms = new Set();
  for (const keyword of requirement.keywords || []) {
    const normalized = normalize(keyword);
    if (normalized && asset.searchText.includes(normalized)) hitTerms.add(normalized);
  }
  for (const tag of asset.normalizedTags || []) {
    if (tag && context.includes(tag)) hitTerms.add(tag);
  }
  score += Math.min(hitTerms.size * 4, 20);
  if (requirement.role === 'ui' && matchesAny(context, ['mobile', 'touch', 'controls', 'joystick', 'dpad', 'button']) && asset.normalizedRoleHints.includes('controls')) score += 12;
  if (matchesAny(context, ['roguelike', 'rpg', 'dungeon']) && matchesAny(asset.searchText, ['roguelike', 'rpg', 'dungeon', 'tilemap', 'tileset'])) score += 12;
  if (matchesAny(context, ['desert', 'shooter']) && matchesAny(asset.searchText, ['desert', 'shooter', 'enemy', 'players', 'weapons'])) score += 12;
  return score;
}

function qualityScore(asset) {
  let score = 0;
  if (asset.license && normalize(asset.license) !== 'unknown') score += 3;
  if (asset.hash) score += 2;
  if (asset.dimensions?.width && asset.dimensions?.height) score += 2;
  return score;
}

function penaltyScore(asset, requirement, queryPlan, allowReferenceAssets) {
  let penalty = 0;
  if (GAMEPLAY_ROLES.has(requirement.role) && asset.normalizedCategory === 'ui') penalty -= 45;
  if (requirement.role !== 'audio' && asset.normalizedType === 'audio') penalty -= 60;
  if (requirement.role !== 'ui' && asset.packId.includes('mobile-controls')) penalty -= 40;
  if (queryPlan.primaryEngine === 'three' && requirement.role !== 'ui' && requirement.role !== 'audio' && asset.normalizedType !== 'gltf') penalty -= 80;
  if (!allowReferenceAssets && isReferenceOnlyAsset(asset)) penalty -= 80;
  return penalty;
}

function addScore(breakdown, key, value) {
  breakdown[key] = value;
}

function fallbackForRequirement(requirement, targetEngine) {
  if (requirement.role === 'audio') return 'silent gameplay';
  if (targetEngine === 'three') return 'primitive mesh';
  return 'procedural placeholder';
}

function generationHintForRequirement(requirement, queryPlan) {
  return `Generate a ${queryPlan.dimension} ${requirement.role} asset for ${queryPlan.engine} matching: ${(requirement.keywords || []).slice(0, 6).join(', ')}.`;
}

function runtimeAssetType(asset) {
  const type = asset.normalizedType || normalize(asset.type);
  if (type === 'gltf') return '3D model';
  if (type === 'spritesheet') return 'spritesheet';
  if (type === 'atlas') return 'atlas';
  if (type === 'tilemap') return 'tilemap';
  if (type === 'audio') return 'audio';
  return 'image';
}

function runtimeManifestType(asset) {
  const type = asset.normalizedType || normalize(asset.type);
  if (type === 'gltf') return 'gltf';
  if (type === 'spritesheet') return 'spritesheet';
  if (type === 'atlas') return 'atlas';
  if (type === 'tilemap') return 'tilemap';
  if (type === 'audio') return 'audio';
  return 'image';
}

function categoriesForRole(role) {
  const matches = {
    player: ['character'],
    enemy: ['character', 'hazard'],
    hazard: ['hazard'],
    collectible: ['collectible'],
    terrain: ['environment'],
    platform: ['environment'],
    environment: ['environment'],
    prop: ['environment', 'misc', 'prop'],
    ui: ['ui'],
    vfx: ['misc'],
    audio: ['audio']
  };
  return matches[role] || [];
}

function roleMatchesCategory(role, category) {
  return categoriesForRole(role).includes(category);
}

function roleMatchesPackCategory(role, categories) {
  return categoriesForRole(role).some((category) => categories.includes(category));
}

function roleMatchesAssetName(role, haystack) {
  const termsByRole = {
    player: ['character', 'player', 'hero'],
    enemy: ['enemy', 'monster', 'character'],
    hazard: ['spike', 'saw', 'trap', 'bomb'],
    collectible: ['coin', 'crystal', 'gem', 'star', 'jewel', 'heart', 'key'],
    terrain: ['block', 'ground', 'grass', 'snow', 'stone', 'tilemap', 'tileset'],
    platform: ['platform', 'block', 'ground'],
    environment: ['tree', 'grass', 'rock', 'flower', 'background', 'tilemap'],
    prop: ['crate', 'barrel', 'sign', 'door', 'weapon', 'projectile'],
    ui: ['bar', 'paper', 'avatar', 'ribbon', 'button', 'joystick', 'dpad'],
    vfx: ['spark', 'effect', 'magic'],
    audio: ['audio', 'music', 'sfx', 'sound']
  };
  return (termsByRole[role] || []).some((term) => haystack.includes(term));
}

function isTileRole(role) {
  return ['environment', 'terrain', 'platform'].includes(role);
}

function isReferenceOnlyAsset(asset) {
  const rel = normalize(asset.sourceRelativePath || asset.publicPath || asset.id);
  const type = asset.normalizedType || normalize(asset.type);
  return ['image', 'spritesheet'].includes(type) && /(^|\/)[^/]*(preview|sample)[^/]*\.(png|jpg|jpeg|webp|gif|svg)$/.test(rel);
}

function explicitPackPreference(packId, context, intent) {
  if (context.includes('desert shooter') && packId.includes('desert-shooter')) return 48;
  if (matchesAny(context, ['roguelike', 'rpg', 'dungeon']) && packId.includes('roguelike')) return 48;
  if (matchesAny(context, ['mobile controls', 'touch controls', 'joystick', 'dpad']) && packId.includes('mobile-controls')) return 52;
  if (matchesAny(context, ['new platformer pack']) && packId.includes('new-platformer')) return 48;
  if (matchesAny(context, ['platformer']) && packId.includes('platformer') && intent !== 'mobile-controls-only') return 28;
  if (matchesAny(context, ['3d', 'glb', 'gltf']) && packId.includes('platformer-kit')) return 32;
  return 0;
}

function inferTheme(context) {
  const themes = ['platformer', 'desert', 'shooter', 'roguelike', 'rpg', 'dungeon', 'mobile', 'garden', 'forest', 'sci-fi', 'fantasy'];
  return themes.find((theme) => context.includes(theme)) || null;
}

function shortReason(reason) {
  const sentence = String(reason || '').split(/[.!?]/)[0].trim();
  return `${sentence.slice(0, 139)}.`;
}

function matchesAny(text, terms) {
  return terms.some((term) => text.includes(normalize(term)));
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

module.exports = {
  ROLE_TAXONOMY,
  buildAssetRequirements,
  buildQueryPlan,
  detectAssetIntent,
  resolveAssetsForBrief,
  resolveAssetsForBriefWithRegistry,
  runtimeTargetForBrief,
  targetEngineForBrief
};
