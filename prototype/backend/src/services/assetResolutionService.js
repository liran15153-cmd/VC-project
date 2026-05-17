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

// Role-specific semantic signal terms. Positive = strong evidence asset fits this role.
// Negative = the asset's text suggests a different purpose, so penalize it for this role.
const ROLE_PROFILES = {
  player: {
    positive: ['player', 'character', 'hero', 'avatar', 'protagonist'],
    negative: ['background', 'sky', 'parallax', 'tilemap', 'tileset', 'platform', 'tile', 'block', 'menu', 'panel', 'button', 'icon', 'logo', 'particle']
  },
  enemy: {
    positive: ['enemy', 'monster', 'hostile', 'boss', 'foe', 'creature', 'zombie', 'alien', 'goblin', 'slime', 'skeleton', 'orc'],
    negative: ['background', 'sky', 'tilemap', 'tileset', 'platform', 'tile', 'block', 'menu', 'panel', 'button', 'icon', 'logo', 'coin', 'gem']
  },
  hazard: {
    positive: ['spike', 'saw', 'trap', 'hazard', 'rock', 'boulder', 'thorn', 'fire', 'lava', 'bomb', 'obstacle', 'cannon', 'pit'],
    negative: ['background', 'menu', 'panel', 'button', 'icon', 'character', 'hero', 'player', 'coin', 'gem-stone', 'crystal-pickup']
  },
  collectible: {
    positive: ['coin', 'gem', 'crystal', 'jewel', 'star', 'key', 'flower', 'heart', 'orb', 'pickup', 'collectible', 'token', 'bonus', 'powerup'],
    negative: ['background', 'menu', 'panel', 'button', 'character', 'hero', 'enemy', 'spike', 'tilemap', 'platform']
  },
  platform: {
    positive: ['platform', 'block', 'ground', 'floor', 'beam', 'tile'],
    negative: ['background', 'sky', 'parallax', 'character', 'hero', 'enemy', 'menu', 'panel', 'button', 'icon', 'logo', 'coin', 'gem']
  },
  terrain: {
    positive: ['terrain', 'tilemap', 'tileset', 'tile', 'ground', 'floor', 'block', 'grass', 'sand', 'dirt', 'stone'],
    negative: ['character', 'hero', 'enemy', 'menu', 'panel', 'button', 'icon', 'logo']
  },
  environment: {
    positive: ['background', 'world', 'environment', 'scene', 'sky', 'cloud', 'tree', 'forest', 'tilemap'],
    negative: ['character', 'hero', 'enemy', 'menu', 'panel', 'button', 'icon', 'logo']
  },
  ui: {
    positive: ['ui', 'hud', 'button', 'panel', 'menu', 'icon', 'bar', 'meter', 'frame', 'cursor', 'joystick', 'dpad', 'controls'],
    negative: ['character', 'enemy', 'monster', 'platform', 'tilemap', 'terrain', 'background']
  },
  vfx: {
    positive: ['effect', 'spark', 'particle', 'glow', 'magic', 'explosion', 'flash', 'smoke', 'bullet', 'projectile', 'laser'],
    negative: ['character', 'enemy', 'platform', 'menu', 'tilemap']
  },
  prop: {
    positive: ['crate', 'barrel', 'sign', 'door', 'chest', 'lever', 'switch', 'weapon', 'tool'],
    negative: []
  },
  audio: {
    positive: ['audio', 'sfx', 'music', 'sound', 'loop', 'ambient'],
    negative: []
  }
};

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
  const gameTypeInfo = {
    gameType: classifyGameType(brief, context),
    mechanics: detectMechanics(brief, context)
  };
  const requirements = buildAssetRequirements({ brief, context, runtimeTarget, intent, gameTypeInfo });
  const queryPlan = buildQueryPlan({
    prompt,
    brief,
    context,
    runtimeTarget,
    intent,
    gameTypeInfo,
    requirements,
    selectedAssetIds,
    strictMissing,
    registryIndex
  });
  const selectedAssets = [];
  const substitutions = [];
  const missingAssets = [];
  const usedIds = new Set();
  // coherenceState tracks signal from already-picked GAMEPLAY assets only.
  // UI / audio / vfx picks are deliberately excluded so utility packs do not
  // anchor the style or pack-coherence signal for the actual game world.
  const coherenceState = {
    packs: new Set(),
    styleFamilies: new Set(),
    themes: new Set()
  };
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
      const entry = scoreAssetForRequirement(asset, requirement, context, queryPlan, selectedAssetIds.length > 0, coherenceState);
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
        const entry = scoreAssetForRequirement(asset, requirement, context, queryPlan, false, coherenceState);
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
      if (GAMEPLAY_ROLES.has(requirement.role)) {
        if (entry.asset.packId) coherenceState.packs.add(entry.asset.packId);
        for (const style of entry.asset.assetStyles || []) {
          const family = styleFamilyFor(style);
          if (family) coherenceState.styleFamilies.add(family);
        }
        for (const theme of entry.asset.assetThemes || []) coherenceState.themes.add(theme);
      }
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

  const trimmedSelected = selectedAssets.slice(0, MAX_SELECTED_ASSETS);
  const selectedAssetIdsForManifest = trimmedSelected.map((asset) => asset.id);
  const coherenceSummary = computeCoherenceSummary(trimmedSelected, registryIndex);
  const compatibilityWarnings = buildCompatibilityWarnings(coherenceSummary, runtimeTarget);
  const metadataConflicts = findMetadataConflicts(trimmedSelected, registryIndex);
  for (const conflict of metadataConflicts) {
    compatibilityWarnings.push({
      code: `metadata.${conflict.issue}`,
      severity: 'info',
      message: `${conflict.detail} (asset=${conflict.assetId}, role=${conflict.role})`
    });
  }
  const durationMs = Math.round(nowMs() - startedAt);

  const response = {
    requirements,
    selectedAssets: trimmedSelected,
    substitutions,
    missingAssets,
    compatibilityWarnings,
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
      gameType: queryPlan.gameType,
      coherence: coherenceSummary,
      llmReranker: {
        enabled: !!queryPlan.llmRerankEnabled,
        used: false,
        status: queryPlan.llmRerankEnabled ? 'configured-but-deferred' : 'disabled'
      },
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
      metadataConflicts,
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

function buildAssetRequirements({ brief, context, runtimeTarget, intent, gameTypeInfo }) {
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

  const gameType = gameTypeInfo?.gameType ?? classifyGameType(brief, context);
  const mechanics = gameTypeInfo?.mechanics ?? detectMechanics(brief, context);
  const themeKws = genreThemeKeywords(brief);

  const requirements = [];

  // Player is always needed for full-game requests
  requirements.push(requirement(
    'player', 1,
    is3D ? ['gltf'] : ['spritesheet', 'image'],
    describePlayerFor(brief, gameType),
    playerKeywords(brief, gameType, context, themeKws),
    'high'
  ));

  // Platform (for platformers/runners/jump mechanics) or Terrain (everything else)
  const isPlatformerLike = gameType === 'platformer' || gameType === 'runner' || mechanics.has('platform');
  if (isPlatformerLike) {
    const qty2D = gameType === 'platformer' ? 2 : 1;
    const qty3D = gameType === 'platformer' ? 3 : 2;
    requirements.push(requirement(
      'platform',
      is3D ? qty3D : qty2D,
      is3D ? ['gltf'] : ['spritesheet', 'atlas', 'image'],
      'Platform and ground pieces for the level',
      ['platform', 'ground', 'block', 'terrain', 'tile', ...themeKws],
      'high'
    ));
  } else {
    requirements.push(requirement(
      'terrain',
      is3D ? 2 : 1,
      is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'],
      'Terrain pieces for the playable space',
      ['terrain', 'ground', 'block', 'tilemap', 'tileset', ...themeKws],
      'medium'
    ));
  }

  // Environment / background
  requirements.push(requirement(
    'environment', 1,
    is3D ? ['gltf'] : ['tilemap', 'spritesheet', 'atlas', 'image'],
    'Background or world environment asset',
    ['environment', 'background', 'world', 'tilemap', 'tileset', ...themeKws],
    'medium'
  ));

  // Collectible: detected from mechanics or implied by game type
  if (mechanics.has('collectible') || ['platformer', 'runner', 'rpg'].includes(gameType)) {
    requirements.push(requirement(
      'collectible', 1,
      is3D ? ['gltf'] : ['image'],
      collectibleDescFor(context),
      collectibleKeywords(brief, context, themeKws),
      'high'
    ));
  }

  // Hazard: detected from mechanics or always present in runners
  if (mechanics.has('hazard') || gameType === 'runner') {
    requirements.push(requirement(
      'hazard', 1,
      is3D ? ['gltf'] : ['image'],
      hazardDescFor(context),
      hazardKeywords(brief, context, themeKws),
      'high'
    ));
  }

  // Enemy: detected from mechanics or implied by shooter/rpg genre
  if (mechanics.has('enemy') || ['shooter', 'rpg'].includes(gameType)) {
    const enemyQty = ['shooter', 'rpg'].includes(gameType) ? 2 : 1;
    requirements.push(requirement(
      'enemy', enemyQty,
      is3D ? ['gltf'] : ['spritesheet', 'image'],
      'Enemy or hostile character',
      enemyKeywords(brief, context, themeKws),
      'medium'
    ));
  }

  // UI/HUD: detected from mechanics or implied by action genres with progression
  if (mechanics.has('ui') || ['platformer', 'runner', 'shooter', 'rpg'].includes(gameType)) {
    requirements.push(requirement(
      'ui', 1,
      ['image', 'spritesheet', 'atlas'],
      'HUD or UI element for score, health, or timer',
      uiKeywords(context),
      'medium'
    ));
  }

  // VFX: shoot/projectile mechanics or explicit vfx mentions
  if (mechanics.has('vfx') || mechanics.has('projectile')) {
    requirements.push(requirement(
      'vfx', 1,
      ['image', 'spritesheet', 'atlas'],
      'Visual effect or projectile sprite',
      vfxKeywords(context),
      'low'
    ));
  }

  // Audio: only when explicitly mentioned
  if (mechanics.has('audio')) {
    requirements.push(requirement(
      'audio', 1,
      ['audio'],
      'Audio cue or music loop',
      audioKeywords(context),
      'low'
    ));
  }

  // Enrich existing requirements from assetsToGenerate; add new requirement only for uncovered roles
  for (const assetNeed of brief.assetPlan?.assetsToGenerate || []) {
    const role = inferRole(assetNeed);
    const existing = requirements.find((item) => item.role === role);
    if (existing) {
      const extra = keywordsForRole(role, assetNeed).filter((kw) => !existing.keywords.includes(kw));
      existing.keywords = [...existing.keywords, ...extra].slice(0, 16);
    } else {
      requirements.push(requirement(role, 1, preferredTypesForRole(role, is3D), assetNeed, keywordsForRole(role, assetNeed), 'medium'));
    }
  }

  return assignRequirementIds(requirements);
}

function buildQueryPlan({ prompt, brief, context, runtimeTarget, intent, gameTypeInfo, requirements, selectedAssetIds, strictMissing, registryIndex }) {
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

  const gameType = gameTypeInfo?.gameType || classifyGameType(brief, context);
  const mechanicsArr = gameTypeInfo?.mechanics
    ? [...gameTypeInfo.mechanics]
    : [...detectMechanics(brief, context)];

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
    gameType,
    mechanics: mechanicsArr,
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

    // Capacity heuristic: prefer packs that cover several required gameplay
    // roles. Bonus is intentionally modest so a tightly-themed dual-role pack
    // can still beat a sprawling generic one on context. UI/audio are
    // expected to come from specialised packs and are not counted here.
    const gameplayRequiredRoles = requiredRoles.filter((role) => GAMEPLAY_ROLES.has(role));
    if (gameplayRequiredRoles.length >= 2 && needsGameplay) {
      const gameplayCoverage = gameplayRequiredRoles.filter((role) => pack.roles.includes(role) || roleMatchesPackCategory(role, pack.categories)).length;
      const coverageRatio = gameplayCoverage / gameplayRequiredRoles.length;
      if (coverageRatio >= 0.6) {
        score += 8;
        reasons.push(`Covers ${gameplayCoverage}/${gameplayRequiredRoles.length} gameplay roles.`);
      } else if (coverageRatio >= 0.3) {
        score += 3;
      }
      // Mild penalty only for tiny packs that contribute nothing on gameplay
      // and aren't a recognised UI / audio specialist.
      const isUiSpecialist = pack.roles.includes('ui') || pack.categories.includes('ui');
      const isAudioSpecialist = pack.types.includes('audio') && pack.assetCount < 80;
      if (gameplayCoverage === 0 && pack.assetCount < 40 && !isUiSpecialist && !isAudioSpecialist) {
        score -= 6;
      }
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

function scoreAssetForRequirement(asset, requirement, context, queryPlan, allowReferenceAssets = false, coherenceState = null) {
  const breakdown = {};
  let score = 0;

  addScore(breakdown, 'engine', engineScore(asset, requirement, queryPlan));
  addScore(breakdown, 'dimension', dimensionScore(asset.assetDimension, queryPlan.dimension, requirement));
  addScore(breakdown, 'type', typeScore(asset, requirement));
  addScore(breakdown, 'role', roleScore(asset, requirement));
  addScore(breakdown, 'roleSignal', roleSignalScore(asset, requirement));
  addScore(breakdown, 'pack', packScore(asset, queryPlan, context));
  addScore(breakdown, 'context', contextScore(asset, requirement, context, queryPlan));
  addScore(breakdown, 'gameTypeBonus', gameTypeBonusScore(asset, requirement, queryPlan));
  addScore(breakdown, 'coherence', coherenceBonusScore(asset, requirement, coherenceState));
  addScore(breakdown, 'styleClash', styleClashScore(asset, requirement, coherenceState));
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
    dimension: asset.dimension || asset.assetDimension,
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

// LLM reranking is intentionally deferred for the MVP:
//   - the deterministic scorer covers every assets:eval scenario,
//   - reranking would add latency + per-resolve API cost,
//   - and the determinism guarantee we rely on for caching / repro would slip.
// When it's enabled in a future step it should only fire on "close races"
// (top score gap < ~12), reorder no more than `aiRerankMaxCandidates`, and
// require the LLM to return only asset IDs already present in the shortlist.
function maybeRerankShortlist(shortlist, requirement) {
  if (!requirement || requirement.quantity <= 1 || shortlist.length <= 1) return shortlist;
  return diversifyByCategory(shortlist);
}

// Soft diversification: put unique (subcategory, name-stem) entries first while
// preserving their score order, then append duplicates. The top scorer is never
// skipped; this only changes which assets get picked when quantity > 1.
function diversifyByCategory(shortlist) {
  const seen = new Set();
  const primary = [];
  const secondary = [];
  for (const entry of shortlist) {
    const asset = entry.asset;
    const subcat = normalize(asset.normalizedSubcategory || asset.normalizedCategory || '');
    const stem = normalize(asset.name || asset.id).replace(/[\d_-]+\d*$/g, '').trim();
    const fingerprint = `${subcat}::${stem}`;
    if (!seen.has(fingerprint)) {
      primary.push(entry);
      seen.add(fingerprint);
    } else {
      secondary.push(entry);
    }
  }
  return [...primary, ...secondary];
}

function roleSignalScore(asset, requirement) {
  const profile = ROLE_PROFILES[requirement.role];
  if (!profile) return 0;

  const id = normalize(asset.id);
  const name = normalize(asset.name);
  const idName = `${id} ${name}`;
  const subcat = normalize(asset.normalizedSubcategory || '');
  const tags = new Set(asset.normalizedTags || []);
  const roleHints = new Set(asset.normalizedRoleHints || []);

  let positive = 0;
  const hitTerms = new Set();
  for (const term of profile.positive || []) {
    if (idName.includes(term)) { positive += 10; hitTerms.add(term); continue; }
    if (tags.has(term) || roleHints.has(term)) { positive += 8; hitTerms.add(term); continue; }
    if (subcat.includes(term)) { positive += 6; hitTerms.add(term); }
  }
  positive = Math.min(positive, 36);

  // If the registry explicitly declares this asset for the requested role,
  // trust that hint. Negative terms in the id/name/tags are usually incidental
  // file-naming noise (e.g. enemy sprites packaged as "tile_0000.png").
  if (roleHints.has(requirement.role)) {
    return Math.min(positive + 8, 40);
  }

  let negative = 0;
  for (const term of profile.negative || []) {
    if (hitTerms.has(term)) continue;
    if (idName.includes(term)) { negative -= 10; continue; }
    if (tags.has(term) || roleHints.has(term)) { negative -= 8; continue; }
    if (subcat.includes(term)) { negative -= 6; }
  }
  negative = Math.max(negative, -32);

  return positive + negative;
}

function gameTypeBonusScore(asset, requirement, queryPlan) {
  const gameType = queryPlan?.gameType;
  if (!gameType || gameType === 'generic') return 0;
  const idName = normalize(`${asset.id} ${asset.name}`);
  const role = requirement.role;

  if (gameType === 'shooter') {
    if (role === 'player' && matchesAny(idName, ['ship', 'fighter', 'soldier', 'spaceship'])) return 8;
    if (role === 'enemy' && matchesAny(idName, ['alien', 'drone', 'ship', 'soldier'])) return 8;
    if (role === 'vfx' && matchesAny(idName, ['bullet', 'laser', 'explosion', 'muzzle', 'spark'])) return 8;
  }
  if (gameType === 'platformer') {
    if (role === 'platform' && matchesAny(idName, ['platform', 'block', 'tile', 'beam', 'floor'])) return 6;
    if (role === 'collectible' && matchesAny(idName, ['coin', 'gem', 'star', 'crystal'])) return 6;
  }
  if (gameType === 'rpg') {
    if (['terrain', 'environment'].includes(role) && matchesAny(idName, ['dungeon', 'tilemap', 'tileset', 'cave', 'castle'])) return 8;
    if (role === 'enemy' && matchesAny(idName, ['monster', 'goblin', 'skeleton', 'orc', 'slime'])) return 8;
  }
  if (gameType === 'runner') {
    if (role === 'hazard' && matchesAny(idName, ['rock', 'spike', 'obstacle', 'pit'])) return 6;
    if (role === 'platform' && matchesAny(idName, ['platform', 'track', 'lane'])) return 6;
  }

  return 0;
}

// Group asset styles into broad "style families" so visually-clashing combinations
// (e.g., pixel-art alongside low-poly) can be detected even when raw style terms differ.
const STYLE_FAMILIES = {
  pixel: ['pixel'],
  lowPoly: ['low-poly'],
  cartoon: ['cartoon', 'bright', 'clean'],
  realistic: ['dark', 'magenta']
};

function styleFamilyFor(style) {
  for (const [family, terms] of Object.entries(STYLE_FAMILIES)) {
    if (terms.includes(style)) return family;
  }
  return null;
}

function computeCoherenceSummary(selectedAssets, registryIndex) {
  const packCounts = new Map();
  const gameplayPackCounts = new Map();
  const styleCounts = new Map();
  const themeCounts = new Map();
  const familyCounts = new Map();
  const gameplayFamilyCounts = new Map();
  const dimensions = new Map();
  const gameplayDimensions = new Map();

  for (const resolved of selectedAssets) {
    const isGameplay = GAMEPLAY_ROLES.has(resolved.role);
    if (resolved.pack) {
      packCounts.set(resolved.pack, (packCounts.get(resolved.pack) || 0) + 1);
      if (isGameplay) gameplayPackCounts.set(resolved.pack, (gameplayPackCounts.get(resolved.pack) || 0) + 1);
    }
    const registryAsset = registryIndex.indexes.byId.get(resolved.id);
    if (!registryAsset) continue;
    for (const style of registryAsset.assetStyles || []) {
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
      const family = styleFamilyFor(style);
      if (family) {
        familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
        if (isGameplay) gameplayFamilyCounts.set(family, (gameplayFamilyCounts.get(family) || 0) + 1);
      }
    }
    for (const theme of registryAsset.assetThemes || []) {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    }
    if (registryAsset.assetDimension) {
      dimensions.set(registryAsset.assetDimension, (dimensions.get(registryAsset.assetDimension) || 0) + 1);
      if (isGameplay) gameplayDimensions.set(registryAsset.assetDimension, (gameplayDimensions.get(registryAsset.assetDimension) || 0) + 1);
    }
  }

  const dominant = (map) => {
    let best = null;
    let bestCount = 0;
    for (const [key, count] of map.entries()) {
      if (count > bestCount || (count === bestCount && best && key < best)) {
        best = key;
        bestCount = count;
      }
    }
    return best;
  };

  return {
    totalAssets: selectedAssets.length,
    uniquePacks: packCounts.size,
    gameplayUniquePacks: gameplayPackCounts.size,
    dominantPack: dominant(packCounts),
    dominantGameplayPack: dominant(gameplayPackCounts),
    packCounts: Object.fromEntries(packCounts),
    uniqueStyleFamilies: familyCounts.size,
    gameplayUniqueStyleFamilies: gameplayFamilyCounts.size,
    dominantStyle: dominant(styleCounts),
    styleFamilies: [...familyCounts.keys()].sort(),
    gameplayStyleFamilies: [...gameplayFamilyCounts.keys()].sort(),
    dominantTheme: dominant(themeCounts),
    dimensions: Object.fromEntries(dimensions),
    gameplayDimensions: Object.fromEntries(gameplayDimensions)
  };
}

// Calibrated to reduce false positives: warnings now key on the GAMEPLAY slice
// of selected assets, so a hybrid game (3D world + 2D UI + audio) or a 2D
// game that also pulled an audio asset doesn't get flagged for "mixed
// dimensions" or "scattered packs" when the actual world is consistent.
// Inspect a single asset/role pair for obvious registry-metadata contradictions.
// Returns null when consistent, otherwise an object describing the conflict.
// These are surfaced as info-level warnings so bad metadata is *visible* but
// never blocks an otherwise-good selection.
function detectMetadataConflict(asset, role) {
  if (!asset) return null;
  const roleHints = new Set(asset.normalizedRoleHints || []);
  const category = asset.normalizedCategory;
  const type = asset.normalizedType;
  const idName = `${normalize(asset.id)} ${normalize(asset.name)}`;

  if (roleHints.has('enemy') && category === 'ui') {
    return { issue: 'enemy-but-ui-category', detail: `Role hint 'enemy' but normalizedCategory is 'ui'.` };
  }
  if (roleHints.has('player') && type === 'tilemap') {
    return { issue: 'player-but-tilemap-type', detail: `Role hint 'player' but asset type is 'tilemap'.` };
  }
  if (roleHints.has('collectible') && category === 'hazard') {
    return { issue: 'collectible-but-hazard-category', detail: `Role hint 'collectible' but category is 'hazard'.` };
  }
  if (roleHints.has('player') && roleHints.has('background')) {
    return { issue: 'player-and-background', detail: `Role hints include both 'player' and 'background'.` };
  }
  if (['player', 'enemy'].includes(role) && type === 'tilemap') {
    return { issue: 'character-from-tilemap-type', detail: `Picked for ${role} role but type is 'tilemap'.` };
  }
  return null;
}

function findMetadataConflicts(selectedAssets, registryIndex) {
  const conflicts = [];
  for (const resolved of selectedAssets) {
    const asset = registryIndex.indexes.byId.get(resolved.id);
    const conflict = detectMetadataConflict(asset, resolved.role);
    if (conflict) {
      conflicts.push({
        assetId: resolved.id,
        role: resolved.role,
        issue: conflict.issue,
        detail: conflict.detail
      });
    }
  }
  return conflicts;
}

function buildCompatibilityWarnings(coherenceSummary, runtimeTarget) {
  const warnings = [];

  // Style families: only complain when the GAMEPLAY set itself mixes families.
  if (coherenceSummary.gameplayUniqueStyleFamilies >= 2) {
    warnings.push({
      code: 'style.mixed-families',
      severity: 'info',
      message: `Gameplay assets span ${coherenceSummary.gameplayUniqueStyleFamilies} style families (${coherenceSummary.gameplayStyleFamilies.join(', ')}); world may look inconsistent.`
    });
  }

  // Scattered packs: count only gameplay-role packs. UI / audio specialists
  // are expected and shouldn't count toward visual fragmentation.
  if (coherenceSummary.gameplayUniquePacks >= 4 && coherenceSummary.totalAssets >= 5) {
    warnings.push({
      code: 'pack.scattered',
      severity: 'info',
      message: `Gameplay picks span ${coherenceSummary.gameplayUniquePacks} distinct packs; consider tightening routing for visual coherence.`
    });
  }

  // 2D-runtime, unexpected 3D: only fires if a GAMEPLAY asset is 3D-tagged.
  // UI / audio are excluded because audio is dimension=any and UI shouldn't be 3D.
  if (runtimeTarget.runtimeTarget === '2D' && coherenceSummary.gameplayDimensions['3D']) {
    warnings.push({
      code: 'dimension.unexpected-3d',
      severity: 'warning',
      message: 'A 3D gameplay asset was selected for a pure 2D runtime; verify it loads as an image.'
    });
  }

  // 3D-runtime, mostly-2D: only count gameplay dimensions. A 3D world with a
  // few 2D UI picks is legitimate; flag only when the gameplay set itself is
  // not predominantly 3D.
  if (runtimeTarget.runtimeTarget === '3D') {
    const gp2D = coherenceSummary.gameplayDimensions['2D'] || 0;
    const gp3D = coherenceSummary.gameplayDimensions['3D'] || 0;
    if (gp2D > 0 && gp2D >= gp3D && (gp2D + gp3D) >= 2) {
      warnings.push({
        code: 'dimension.mostly-2d',
        severity: 'warning',
        message: 'Most gameplay assets are 2D-tagged for a 3D runtime; gameplay roles should prefer GLB models.'
      });
    }
  }

  return warnings;
}

// Apply coherence only when scoring a gameplay-role candidate: support roles
// (ui, audio, vfx) come from utility packs that often look stylistically
// different from the world, and rewarding them for "same pack" would push the
// resolver to pull e.g. mobile-controls UI into a roguelike just because the
// roguelike pack came first.
function coherenceBonusScore(asset, requirement, coherenceState) {
  if (!coherenceState || !GAMEPLAY_ROLES.has(requirement.role)) return 0;
  let score = 0;
  if (coherenceState.packs?.size && asset.packId && coherenceState.packs.has(asset.packId)) {
    score += 6;
  }
  if (coherenceState.styleFamilies?.size) {
    for (const style of asset.assetStyles || []) {
      const family = styleFamilyFor(style);
      if (family && coherenceState.styleFamilies.has(family)) { score += 4; break; }
    }
  }
  if (coherenceState.themes?.size) {
    for (const theme of asset.assetThemes || []) {
      if (coherenceState.themes.has(theme)) { score += 3; break; }
    }
  }
  return Math.min(score, 12);
}

// Conservative style-clash penalty: if at least one gameplay asset already
// established a style family and the candidate's style families don't overlap,
// apply a small penalty. Only for gameplay roles. Assets with no detectable
// style family are treated as neutral (no penalty) to avoid punishing assets
// that simply lack style tags in the registry.
function styleClashScore(asset, requirement, coherenceState) {
  if (!GAMEPLAY_ROLES.has(requirement.role)) return 0;
  if (!coherenceState?.styleFamilies?.size) return 0;
  const candidateFamilies = new Set();
  for (const style of asset.assetStyles || []) {
    const family = styleFamilyFor(style);
    if (family) candidateFamilies.add(family);
  }
  if (!candidateFamilies.size) return 0;
  for (const family of candidateFamilies) {
    if (coherenceState.styleFamilies.has(family)) return 0;
  }
  return -5;
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
  if (matchesAny(normalized, ['coin', 'crystal', 'gem', 'star', 'jewel', 'orb', 'token', 'flower', 'key', 'collect', 'pickup', 'powerup', 'power-up', 'bonus', 'heart', 'repair'])) return 'collectible';
  if (matchesAny(normalized, ['spike', 'trap', 'saw', 'hazard', 'obstacle', 'rock', 'boulder', 'thorn', 'lava', 'fire', 'bomb', 'cannon', 'falling', 'dodge', 'avoid', 'danger'])) return 'hazard';
  if (matchesAny(normalized, ['platform', 'jump', 'leap'])) return 'platform';
  if (matchesAny(normalized, ['ground', 'terrain', 'tile', 'block', 'tilemap', 'tileset'])) return 'terrain';
  if (matchesAny(normalized, ['hud', 'button', 'health', 'score', 'lives', 'timer', 'joystick', 'dpad', 'controls', 'interface', 'menu', 'bar', 'counter', 'hp', 'points'])) return 'ui';
  if (matchesAny(normalized, ['sound', 'music', 'sfx', 'audio', 'ambient', 'soundtrack'])) return 'audio';
  if (matchesAny(normalized, ['enemy', 'monster', 'hostile', 'boss', 'foe', 'combat', 'fight'])) return 'enemy';
  if (matchesAny(normalized, ['bullet', 'missile', 'laser', 'projectile', 'explosion', 'spark', 'magic', 'vfx', 'effect', 'particle'])) return 'vfx';
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
  const id = normalize(asset.id);
  const name = normalize(asset.name);
  const subcat = normalize(asset.normalizedSubcategory || '');
  const path = normalize(asset.sourceRelativePath || '');
  const tags = asset.normalizedTags || [];
  const roleHints = asset.normalizedRoleHints || [];

  // Requirement keyword hits weighted by where they land.
  // id/name matches are strongest; tag/roleHint next; path/searchText weakest.
  const hitTerms = new Set();
  for (const keyword of requirement.keywords || []) {
    const term = normalize(keyword);
    if (!term) continue;
    let hitScore = 0;
    if (id.includes(term) || name.includes(term)) hitScore = 7;
    else if (tags.includes(term) || roleHints.includes(term)) hitScore = 5;
    else if (subcat.includes(term)) hitScore = 4;
    else if (path.includes(term)) hitScore = 3;
    else if (asset.searchText.includes(term)) hitScore = 1;
    if (hitScore > 0) {
      score += hitScore;
      hitTerms.add(term);
    }
  }

  // Asset tags appearing in the broader game context (theme alignment).
  for (const tag of tags) {
    if (tag && !hitTerms.has(tag) && context.includes(tag)) {
      score += 2;
      hitTerms.add(tag);
    }
  }

  score = Math.min(score, 40);

  if (requirement.role === 'ui' && matchesAny(context, ['mobile', 'touch', 'controls', 'joystick', 'dpad', 'button']) && roleHints.includes('controls')) score += 12;
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

  // Existing core penalties (preserved).
  if (GAMEPLAY_ROLES.has(requirement.role) && asset.normalizedCategory === 'ui') penalty -= 45;
  if (requirement.role !== 'audio' && asset.normalizedType === 'audio') penalty -= 60;
  if (requirement.role !== 'ui' && asset.packId.includes('mobile-controls')) penalty -= 40;
  if (queryPlan.primaryEngine === 'three' && requirement.role !== 'ui' && requirement.role !== 'audio' && asset.normalizedType !== 'gltf') penalty -= 80;
  if (!allowReferenceAssets && isReferenceOnlyAsset(asset)) penalty -= 80;

  // Semantic mismatch penalties — penalize assets that look technically valid but
  // are clearly intended for a different purpose than the requirement role.
  // When the registry already declares the asset for this role (roleHints
  // includes the role), skip mismatch penalties — the role hint is the strongest
  // signal we have and trumps incidental keywords in the id/path/tags.
  const idName = `${normalize(asset.id)} ${normalize(asset.name)}`;
  const tags = asset.normalizedTags || [];
  const roleHints = asset.normalizedRoleHints || [];
  const explicitRoleMatch = roleHints.includes(requirement.role);

  if (!explicitRoleMatch) {
    const isBackdrop = matchesAny(idName, ['background', 'parallax', 'sky-back', 'skybox'])
      || tags.includes('background')
      || tags.includes('parallax')
      || roleHints.includes('background');
    if (isBackdrop && ['player', 'enemy', 'platform', 'hazard', 'collectible'].includes(requirement.role)) {
      penalty -= 35;
    }

    if (['player', 'enemy', 'collectible'].includes(requirement.role)
      && (asset.normalizedType === 'tilemap' || matchesAny(idName, ['tilemap', 'tileset', 'tilesheet']))) {
      penalty -= 30;
    }

    if (['platform', 'terrain', 'environment'].includes(requirement.role)
      && (asset.normalizedCategory === 'character'
        || roleHints.includes('player')
        || roleHints.includes('enemy'))) {
      penalty -= 25;
    }

    if (['hazard', 'enemy'].includes(requirement.role)
      && (asset.normalizedCategory === 'collectible'
        || roleHints.includes('collectible')
        || matchesAny(idName, ['coin-', 'gem-', 'jewel-']))) {
      penalty -= 25;
    }

    if (['collectible', 'player'].includes(requirement.role)
      && (asset.normalizedCategory === 'hazard' || roleHints.includes('hazard'))) {
      penalty -= 20;
    }
  }

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

function classifyGameType(brief, context) {
  const genre = normalize(brief.genre || '');
  if (matchesAny(genre, ['platformer', 'platform', 'side-scroller', 'sidescroller'])) return 'platformer';
  if (matchesAny(genre, ['runner', 'endless-runner', 'auto-runner', 'infinite-runner'])) return 'runner';
  if (matchesAny(genre, ['shooter', 'shoot-em-up', 'shmup', 'top-down-shooter', 'fps', 'combat', 'fighting'])) return 'shooter';
  if (matchesAny(genre, ['puzzle', 'match', 'sliding', 'block-puzzle'])) return 'puzzle';
  if (matchesAny(genre, ['rpg', 'roguelike', 'dungeon', 'role-playing'])) return 'rpg';
  if (matchesAny(genre, ['arcade', 'casual'])) return 'arcade';
  if (matchesAny(context, ['platformer', 'side scroller', 'platform game'])) return 'platformer';
  if (matchesAny(context, ['endless runner', 'auto runner', 'infinite runner'])) return 'runner';
  if (matchesAny(context, ['top down shooter', 'shoot em up', 'first person shooter'])) return 'shooter';
  if (matchesAny(context, ['roguelike', 'dungeon crawler', 'rpg'])) return 'rpg';
  return 'generic';
}

function detectMechanics(brief, context) {
  const mechanics = new Set();

  if (matchesAny(context, [
    'avoid', 'dodge', 'falling', 'rock', 'spike', 'saw', 'hazard', 'trap', 'bomb',
    'obstacle', 'danger', 'thorn', 'fire', 'lava', 'pit', 'cannon', 'boulder'
  ])) mechanics.add('hazard');

  if (matchesAny(context, [
    'collect', 'coin', 'gem', 'crystal', 'star', 'power-up', 'powerup', 'pickup',
    'item', 'flower', 'key', 'orb', 'token', 'trophy', 'repair', 'jewel', 'heart', 'bonus'
  ])) mechanics.add('collectible');

  if (matchesAny(context, [
    'enemy', 'enemies', 'combat', 'fight', 'attack', 'shoot', 'boss', 'chase',
    'battle', 'monster', 'hostile', 'kill', 'destroy', 'defeat', 'foe'
  ])) mechanics.add('enemy');

  if (matchesAny(context, [
    'bullet', 'missile', 'laser', 'projectile', 'muzzle flash', 'fireball', 'arrow', 'blast'
  ])) mechanics.add('projectile');

  if (matchesAny(context, [
    'jump', 'platform', 'leap', 'bounce', 'hop', 'land on', 'jump between'
  ])) mechanics.add('platform');

  if (matchesAny(context, [
    'score', 'health', 'lives', 'timer', 'hud', 'menu', 'interface', 'bar', 'counter',
    'points', 'hp', 'stamina', 'life bar'
  ])) mechanics.add('ui');

  if (matchesAny(context, [
    'music', 'sfx', 'sound', 'audio', 'ambient', 'soundtrack', 'chime'
  ])) mechanics.add('audio');

  if (matchesAny(context, [
    'visual effect', 'vfx', 'particle', 'spark', 'magic', 'explosion', 'muzzle flash', 'glow'
  ])) mechanics.add('vfx');

  return mechanics;
}

function genreThemeKeywords(brief) {
  const words = [];
  if (brief.genre) words.push(...normalize(brief.genre).split(/[-\s]+/).filter((w) => w.length > 2));
  if (brief.assetPlan?.visualStyle) {
    words.push(...normalize(brief.assetPlan.visualStyle).split(/\s+/).filter((w) => w.length > 3).slice(0, 4));
  }
  return [...new Set(words)].slice(0, 6);
}

function describePlayerFor(brief, gameType) {
  const style = brief.assetPlan?.visualStyle ? `${brief.assetPlan.visualStyle} ` : '';
  const typeDesc = { platformer: 'platformer hero', runner: 'running character', shooter: 'player ship or fighter', rpg: 'hero or avatar', puzzle: 'player character', arcade: 'arcade player', generic: 'playable character or avatar' };
  return `${style}${typeDesc[gameType] || 'playable character or avatar'}`.trim();
}

function playerKeywords(brief, gameType, context, themeKws) {
  const base = ['player', 'character', 'hero'];
  if (gameType === 'shooter') base.push('soldier', 'fighter', 'spaceship', 'ship');
  if (gameType === 'platformer') base.push('runner', 'jumper', 'adventurer');
  if (gameType === 'rpg') base.push('knight', 'wizard', 'warrior');
  if (context.includes('robot')) base.push('robot', 'mech');
  if (context.includes('ninja')) base.push('ninja');
  if (context.includes('alien')) base.push('alien');
  if (context.includes('space')) base.push('astronaut', 'spaceship');
  return [...new Set([...base, ...themeKws])];
}

function collectibleDescFor(context) {
  if (matchesAny(context, ['crystal', 'repair'])) return 'Collectible crystal or repair item';
  if (matchesAny(context, ['gem', 'jewel'])) return 'Collectible gem or jewel';
  if (context.includes('flower')) return 'Collectible flower or nature item';
  if (context.includes('star')) return 'Collectible star or bonus item';
  return 'Collectible objective item the player picks up';
}

function collectibleKeywords(brief, context, themeKws) {
  const base = ['collectible', 'coin', 'item'];
  if (matchesAny(context, ['crystal', 'repair'])) base.push('crystal', 'gem');
  if (matchesAny(context, ['gem', 'jewel'])) base.push('gem', 'jewel', 'diamond');
  if (context.includes('star')) base.push('star');
  if (context.includes('flower')) base.push('flower');
  if (context.includes('key')) base.push('key');
  if (matchesAny(context, ['power-up', 'powerup', 'bonus'])) base.push('powerup', 'bonus');
  if (context.includes('heart')) base.push('heart');
  if (context.includes('orb')) base.push('orb');
  return [...new Set([...base, ...themeKws])];
}

function hazardDescFor(context) {
  if (matchesAny(context, ['rock', 'boulder', 'stone', 'falling'])) return 'Falling rock or boulder hazard';
  if (context.includes('thorn')) return 'Thorn or plant hazard obstacle';
  if (context.includes('saw')) return 'Saw blade or spinning hazard';
  if (matchesAny(context, ['fire', 'lava'])) return 'Fire or lava hazard';
  if (matchesAny(context, ['spike', 'trap'])) return 'Spike or trap hazard';
  return 'Hazard or trap obstacle in the level';
}

function hazardKeywords(brief, context, themeKws) {
  const base = ['hazard', 'trap', 'obstacle', 'spike'];
  if (matchesAny(context, ['rock', 'stone', 'boulder'])) base.push('rock', 'stone', 'boulder');
  if (context.includes('saw')) base.push('saw', 'blade');
  if (context.includes('thorn')) base.push('thorn', 'plant');
  if (matchesAny(context, ['fire', 'lava'])) base.push('fire', 'lava');
  if (context.includes('bomb')) base.push('bomb');
  if (matchesAny(context, ['falling', 'fall'])) base.push('falling', 'drop');
  if (context.includes('cannon')) base.push('cannon', 'projectile');
  return [...new Set([...base, ...themeKws])];
}

function enemyKeywords(brief, context, themeKws) {
  const base = ['enemy', 'monster', 'hostile', 'character'];
  if (context.includes('boss')) base.push('boss');
  if (matchesAny(context, ['robot', 'mech', 'drone'])) base.push('robot', 'drone', 'mech');
  if (context.includes('zombie')) base.push('zombie', 'undead');
  if (context.includes('alien')) base.push('alien');
  if (context.includes('soldier')) base.push('soldier');
  if (context.includes('slime')) base.push('slime');
  return [...new Set([...base, ...themeKws])];
}

function uiKeywords(context) {
  const base = ['ui', 'hud', 'interface'];
  if (matchesAny(context, ['score', 'points'])) base.push('score', 'counter');
  if (matchesAny(context, ['health', 'lives', 'hp'])) base.push('health', 'bar', 'heart', 'life');
  if (matchesAny(context, ['timer', 'clock'])) base.push('timer', 'clock');
  if (matchesAny(context, ['menu', 'button'])) base.push('menu', 'button');
  if (matchesAny(context, ['mobile', 'touch'])) base.push('mobile', 'touch');
  return [...new Set(base)];
}

function vfxKeywords(context) {
  const base = ['vfx', 'effect', 'spark'];
  if (matchesAny(context, ['explosion', 'blast'])) base.push('explosion');
  if (matchesAny(context, ['bullet', 'missile', 'shoot'])) base.push('bullet', 'projectile', 'muzzle');
  if (context.includes('magic')) base.push('magic', 'spell');
  if (context.includes('laser')) base.push('laser');
  return [...new Set(base)];
}

function audioKeywords(context) {
  const base = ['audio', 'sfx', 'music'];
  if (context.includes('ambient')) base.push('ambient', 'loop');
  if (context.includes('jump')) base.push('jump');
  if (matchesAny(context, ['coin', 'collect'])) base.push('pickup', 'collect');
  return [...new Set(base)];
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
