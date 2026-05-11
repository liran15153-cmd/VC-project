#!/usr/bin/env node

const { performance } = require('node:perf_hooks');
const { readRegistry } = require('./asset-utils');
const { createAssetRegistryIndex } = require('../prototype/backend/src/services/assetRegistryService');
const { resolveAssetsForBriefWithRegistry } = require('../prototype/backend/src/services/assetResolutionService');

const sizes = process.argv.slice(2).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
const targetSizes = sizes.length ? sizes : [25000, 100000];

const followUpQuestions = [
  { id: 'pace', question: 'What pace?', options: [{ id: 'A', label: 'Relaxed', value: 'relaxed' }, { id: 'B', label: 'Fast', value: 'fast' }] },
  { id: 'danger', question: 'How dangerous?', options: [{ id: 'A', label: 'Low', value: 'low' }, { id: 'B', label: 'High', value: 'high' }] },
  { id: 'goal', question: 'Main goal?', options: [{ id: 'A', label: 'Collect', value: 'collect' }, { id: 'B', label: 'Escape', value: 'escape' }] }
];

function benchmarkBrief() {
  return {
    title: 'Benchmark Platformer',
    oneSentencePitch: 'A 2D platformer using the new platformer pack.',
    playerFantasy: 'Move fast and collect coins.',
    targetPlatform: 'desktop-first',
    dimension: '2D',
    genre: 'platformer',
    coreLoop: ['run', 'jump', 'collect coins', 'avoid spikes'],
    keyMechanics: ['jumping', 'coin collection', 'spike hazards', 'enemy avoidance', 'score HUD', 'coin sfx'],
    controls: { primary: 'WASD', mobile: 'touch controls', accessibilityNotes: [] },
    runtimePlan: {
      runtime: 'hybrid',
      phaserRole: '2D sprites, tilemaps, UI, and audio.',
      threeRole: 'No 3D role for this benchmark.',
      rapierRole: 'Collision helpers if needed.',
      godotStyleGenerationNotes: 'Keep generated content editable.',
      systems: ['movement', 'ui']
    },
    assetPlan: {
      existingAssetsToUse: ['Kenney new platformer pack'],
      assetsToGenerate: ['player sprite', 'coin collectible', 'spike hazard', 'enemy sprite', 'HUD coin icon', 'coin sfx'],
      visualStyle: 'bright platformer'
    },
    missingInfo: [],
    followUpQuestions,
    productionNotes: ['Keep first loop tiny.', 'Use registry assets only.'],
    nonGoals: ['No multiplayer']
  };
}

function expandAssets(baseAssets, targetSize) {
  const assets = [];
  for (let i = 0; i < targetSize; i += 1) {
    const source = baseAssets[i % baseAssets.length];
    const syntheticPack = i % 5 === 0 ? source.pack : `${source.pack || source.sourcePack || 'synthetic-pack'}-synthetic-${i % 200}`;
    assets.push({
      ...source,
      id: `${source.id}-bench-${i}`,
      pack: syntheticPack,
      sourcePack: syntheticPack,
      filePath: `${source.filePath}#bench-${i}`,
      publicPath: source.publicPath
    });
  }
  return assets;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

const baseRegistry = readRegistry();
if (!baseRegistry.assets.length) {
  console.error('No assets available for benchmark.');
  process.exit(1);
}

for (const targetSize of targetSizes) {
  const syntheticRegistry = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assets: expandAssets(baseRegistry.assets, targetSize)
  };

  const buildStart = performance.now();
  const registryIndex = createAssetRegistryIndex(syntheticRegistry);
  const buildMs = performance.now() - buildStart;
  const runs = [];
  let last;

  for (let i = 0; i < 8; i += 1) {
    const start = performance.now();
    last = resolveAssetsForBriefWithRegistry({
      prompt: '2D platformer using Kenney new platformer pack with coins spikes enemy HUD coin sfx',
      dimension: '2D',
      brief: benchmarkBrief(),
      debug: false
    }, registryIndex);
    runs.push(performance.now() - start);
  }

  console.log(`ASSET_BENCH size=${targetSize} packs=${registryIndex.packSummaries.length} buildMs=${buildMs.toFixed(1)} avgResolveMs=${(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(1)} p95ResolveMs=${percentile(runs, 95).toFixed(1)} evaluated=${last.meta.evaluatedAssets} candidates=${last.meta.candidateAssets} total=${last.meta.totalAssets}`);
}
