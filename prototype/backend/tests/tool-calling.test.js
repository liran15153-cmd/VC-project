const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.AI_MODE = 'real';
process.env.AI_FALLBACK_ENABLED = 'true';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.AI_TOOL_CALLING_ENABLED = 'true';

const {
  getEngineToolBudget,
  buildCompactToolPrompt,
  compactAssetResolutionForModel
} = require('../src/services/engineToolBudgetService');
const {
  generateEngineGameFromBriefInternal,
  sanitizeResolveAssetsToolArgs,
  validateGeneratedAssetUse
} = require('../src/services/engineGenerationService');
const { generateJSONWithSingleTool } = require('../src/services/openaiService');

function sampleGameDefinition(asset = null) {
  const definition = {
    schemaVersion: 1,
    metadata: {
      title: 'Tool Runner',
      description: 'A compact generated test game.',
      genre: 'platformer',
      estimatedPlaytime: '2-5 minutes'
    },
    engine: {
      width: 960,
      height: 540,
      enable3D: true,
      enable2D: true,
      enablePhysics: true,
      gravity: { x: 0, y: -12, z: 0 },
      background: '#111827'
    },
    state: { score: { type: 'number', initial: 0, min: 0 } },
    inputBindings: {
      moveLeft: ['ArrowLeft', 'KeyA'],
      moveRight: ['ArrowRight', 'KeyD'],
      jump: ['Space']
    },
    assets: [],
    prefabs: {
      coin: {
        tags: ['coin'],
        mesh: { shape: 'sphere', radius: 0.3, color: '#facc15' },
        rigidBody: { type: 'static', collider: { shape: 'ball', radius: 0.3 }, colliderOptions: { sensor: true } }
      }
    },
    behaviors: [
      { trigger: { type: 'inputDown', input: 'moveLeft' }, actions: [{ type: 'setVelocityX', target: 'player', value: -4 }] },
      { trigger: { type: 'inputDown', input: 'moveRight' }, actions: [{ type: 'setVelocityX', target: 'player', value: 4 }] },
      { trigger: { type: 'inputPressed', input: 'jump' }, actions: [{ type: 'applyImpulse', target: 'player', value: { x: 0, y: 7, z: 0 } }] },
      {
        trigger: { type: 'collision', entityTag: 'player', withTag: 'coin' },
        actions: [
          { type: 'incrementState', stateKey: 'score', amount: 1 },
          { type: 'destroyEntity', target: 'collisionOther' }
        ]
      },
      {
        trigger: { type: 'stateChange', stateKey: 'score' },
        conditions: [{ stateKey: 'score', gte: 1 }],
        actions: [{ type: 'switchScene', scene: 'win' }]
      }
    ],
    ui: [{ type: 'text', text: 'Score: {score}', x: 16, y: 16 }],
    audio: [],
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'behavior', 'spawner', 'ui'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            transform: { position: { x: 0, y: 2, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#38bdf8' },
            rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.4, y: 0.6, z: 0.4 } } },
            cameraTarget: { lerp: 5, offset: { x: 0, y: 4, z: 8 } }
          },
          {
            key: 'ground',
            tags: ['ground'],
            transform: { position: { x: 0, y: -0.25, z: 0 } },
            mesh: { shape: 'box', size: { x: 12, y: 0.5, z: 4 }, color: '#4a7c59' },
            rigidBody: { type: 'static', collider: { shape: 'cuboid', halfExtents: { x: 6, y: 0.25, z: 2 } } }
          }
        ],
        spawners: [{ prefab: 'coin', positions: [{ x: 2, y: 1, z: 0 }] }]
      },
      {
        key: 'win',
        systems: ['ui'],
        entities: [{ key: 'win-text', sprite: { kind: 'text', text: 'Win!', x: 360, y: 240 } }]
      }
    ],
    initialScene: 'main'
  };

  if (asset) {
    definition.assets = [{ key: asset.id, type: asset.runtimeType || 'gltf', url: asset.publicPath }];
    definition.scenes[0].entities[0].model = { assetKey: asset.id, scale: { x: 1, y: 1, z: 1 } };
    delete definition.scenes[0].entities[0].mesh;
  }

  return definition;
}

function sampleBrief(overrides = {}) {
  return {
    title: 'Robot Garden Runner',
    oneSentencePitch: 'A tiny robot jumps through floating gardens to collect repair crystals and avoid thorn traps.',
    playerFantasy: 'Feel like a nimble repair robot restoring a broken sky garden.',
    targetPlatform: 'desktop-first',
    dimension: '2D',
    genre: 'platformer',
    coreLoop: ['Explore a short arena', 'Collect repair crystals', 'Avoid hazards', 'Reach the exit'],
    keyMechanics: ['jumping', 'collectibles', 'simple hazards'],
    controls: {
      primary: 'Arrow keys or WASD to move, Space to jump',
      mobile: 'Virtual stick and jump button',
      accessibilityNotes: []
    },
    runtimePlan: {
      runtime: 'hybrid',
      phaserRole: '2D sprites and HUD',
      threeRole: 'No 3D role for the first preview',
      rapierRole: 'Simple platformer collision and triggers',
      godotStyleGenerationNotes: 'Keep scenes declarative and editable.',
      systems: ['physicsSync', 'camera', 'behavior', 'ui']
    },
    assetPlan: {
      existingAssetsToUse: ['robot-like player', 'crystal collectible'],
      assetsToGenerate: ['player character', 'collectible crystal'],
      visualStyle: 'bright readable platformer'
    },
    missingInfo: [],
    followUpQuestions: [
      { id: 'pace', question: 'What pace?', options: [{ id: 'A', label: 'Relaxed', value: 'relaxed' }, { id: 'B', label: 'Fast', value: 'fast' }] },
      { id: 'danger', question: 'How dangerous?', options: [{ id: 'A', label: 'Low', value: 'low' }, { id: 'B', label: 'High', value: 'high' }] },
      { id: 'goal', question: 'Main goal?', options: [{ id: 'A', label: 'Collect', value: 'collect' }, { id: 'B', label: 'Escape', value: 'escape' }] }
    ],
    productionNotes: ['Use primitive colliders.', 'Win by collecting enough crystals. Lose by touching hazards.'],
    nonGoals: ['No full editor in this step'],
    ...overrides
  };
}

function fakeToolAssetResolution(count = 14) {
  const selectedAssets = Array.from({ length: count }, (_, index) => ({
    id: `asset-${index + 1}`,
    role: index === 0 ? 'player' : 'prop',
    name: `Asset ${index + 1}`,
    type: 'gltf',
    publicPath: `/assets/library/test/asset-${index + 1}.glb`,
    confidenceScore: 0.9,
    reason: 'Matches gltf prop role in test pack.',
    scoreBreakdown: { internal: 100 },
    sourceRelativePath: 'internal/path/not-for-model'
  }));
  return {
    selectedAssets,
    missingAssets: [{ role: 'audio', description: 'Jump sound', reason: 'No audio asset passed the strict confidence threshold.' }],
    runtimeAssetManifest: {
      engine: 'three',
      assets: selectedAssets.map((asset) => ({ key: asset.id, type: 'gltf', url: asset.publicPath }))
    },
    debug: { queryPlan: { shouldNotLeak: true } },
    meta: { targetEngine: 'three', runtimeTarget: '3D', primaryEngine: 'three', assetEngines: ['three'] }
  };
}

test('engine tool budget keeps simple requests smaller than normal and complex', () => {
  const simple = getEngineToolBudget({ prompt: 'Make a coin platformer', dimension: '2D', brief: sampleBrief() });
  const normal = getEngineToolBudget({
    prompt: 'Make a coin platformer with a longer set of requirements and a stronger visual identity.',
    dimension: '2D',
    brief: sampleBrief({ keyMechanics: ['jumping', 'collectibles', 'hazards', 'timer', 'moving platforms'] })
  });
  const complex = getEngineToolBudget({
    prompt: 'Make a 3D hybrid platformer with several systems and selected assets.',
    dimension: '3D',
    selectedAssetIds: ['asset-a'],
    brief: sampleBrief({ dimension: '3D' })
  });

  assert.equal(simple.complexity, 'simple');
  assert.ok(simple.maxSelectedAssets < normal.maxSelectedAssets);
  assert.equal(complex.complexity, 'complex');
  assert.ok(complex.toolResultMaxChars > simple.toolResultMaxChars);
});

test('compact tool prompt preserves core gameplay terms while compressing long context', () => {
  const brief = sampleBrief({
    oneSentencePitch: 'A sky robot must collect crystals, avoid hazards, win by repairing the beacon, and lose if energy reaches zero.',
    productionNotes: ['Win condition: repair the beacon.', 'Lose condition: energy reaches zero.'],
    assetPlan: {
      existingAssetsToUse: ['robot', 'crystal'],
      assetsToGenerate: ['player robot', 'repair crystal', 'hazard thorns'],
      visualStyle: 'bright low-poly sky garden'
    }
  });
  const budget = { ...getEngineToolBudget({ prompt: 'x'.repeat(1200), dimension: '2D', brief }), promptMaxChars: 900 };
  const compact = buildCompactToolPrompt({
    prompt: 'Create a long platformer prompt. '.repeat(80),
    answers: { controls: 'keyboard and mobile stick', style: 'bright low-poly sky garden' },
    dimension: '2D',
    brief
  }, budget);

  assert.equal(compact.compressed, true);
  assert.match(compact.text, /crystals|repair|beacon|energy|hazards/i);
  assert.match(compact.text, /2D|low-poly|keyboard|mobile/i);
});

test('compact tool result bounds selected assets and does not expose registry internals', () => {
  const budget = { complexity: 'simple', maxSelectedAssets: 6, toolResultMaxChars: 5000 };
  const compact = compactAssetResolutionForModel(fakeToolAssetResolution(14), budget);

  assert.equal(compact.tooLarge, false);
  assert.equal(compact.compact.selectedAssets.length, 6);
  assert.equal(compact.compact.runtimeAssetManifest.assets.length, 6);
  assert.equal(compact.serialized.includes('scoreBreakdown'), false);
  assert.equal(compact.serialized.includes('queryPlan'), false);
  assert.equal(compact.serialized.includes('sourceRelativePath'), false);
});

test('single-tool JSON generation executes only one tool call', async () => {
  let calls = 0;
  let handlerCalls = 0;
  const firstToolCall = {
    id: 'call-1',
    type: 'function',
    function: { name: 'resolveAssetsForBrief', arguments: '{"strictMissing":true}' }
  };
  const secondToolCall = {
    id: 'call-2',
    type: 'function',
    function: { name: 'resolveAssetsForBrief', arguments: '{}' }
  };
  const chatCompletionCreate = async (request) => {
    calls += 1;
    if (calls === 1) {
      return { model: 'mock-model', choices: [{ message: { tool_calls: [firstToolCall, secondToolCall] } }] };
    }
    return { model: 'mock-model', choices: [{ message: { content: JSON.stringify({ ok: true }) } }] };
  };

  const result = await generateJSONWithSingleTool({
    prompt: 'Use a tool.',
    model: 'openai/gpt-5.1',
    tools: [{ type: 'function', function: { name: 'resolveAssetsForBrief', parameters: { type: 'object' } } }],
    toolHandlers: {
      resolveAssetsForBrief: () => {
        handlerCalls += 1;
        return { content: '{"selectedAssets":[]}' };
      }
    },
    chatCompletionCreate
  });

  assert.equal(result.toolUsed, true);
  assert.deepEqual(result.json, { ok: true });
  assert.equal(handlerCalls, 1);
  assert.equal(result.debug.skippedToolCalls, 1);
});

test('invalid or oversized tool calls fall back safely', async () => {
  const invalid = sanitizeResolveAssetsToolArgs.bind(null, { prompt: 'override attempt' }, []);
  assert.throws(invalid, /unsupported/);

  let calls = 0;
  const result = await generateJSONWithSingleTool({
    prompt: 'Use a tool.',
    model: 'openai/gpt-5.1',
    tools: [{ type: 'function', function: { name: 'resolveAssetsForBrief', parameters: { type: 'object' } } }],
    toolHandlers: {
      resolveAssetsForBrief: () => ({ content: 'x'.repeat(50), tooLarge: true })
    },
    chatCompletionCreate: async () => {
      calls += 1;
      return { model: 'mock-model', choices: [{ message: { tool_calls: [{ id: 'call-1', function: { name: 'resolveAssetsForBrief', arguments: '{}' } }] } }] };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.toolUsed, false);
  assert.match(result.fallbackReason, /too large/i);
});

test('asset validation deterministically maps selected asset aliases without allowing unknown assets', () => {
  const definition = sampleGameDefinition();
  definition.assets = [{ key: 'Asset 1', type: 'image', url: '/wrong/path.glb' }];
  definition.scenes[0].entities[0].model = { assetKey: 'Asset 1', scale: { x: 1, y: 1, z: 1 } };
  delete definition.scenes[0].entities[0].mesh;

  const selected = [{
    id: 'asset-1',
    name: 'Asset 1',
    type: 'gltf',
    publicPath: '/assets/library/test/asset-1.glb'
  }];
  const valid = validateGeneratedAssetUse(definition, selected);

  assert.equal(valid.ok, true);
  assert.equal(definition.assets[0].key, 'asset-1');
  assert.equal(definition.assets[0].type, 'gltf');
  assert.equal(definition.assets[0].url, '/assets/library/test/asset-1.glb');
  assert.equal(definition.scenes[0].entities[0].model.assetKey, 'asset-1');
  assert.ok(valid.warnings.some((warning) => warning.code === 'normalized.assetCandidateKey'));
  assert.ok(valid.warnings.some((warning) => warning.code === 'normalized.assetCandidateType'));
  assert.ok(valid.warnings.some((warning) => warning.code === 'normalized.assetCandidateUrl'));
  assert.ok(valid.warnings.some((warning) => warning.code === 'normalized.assetReferenceKey'));

  const invented = sampleGameDefinition();
  invented.assets = [{ key: 'invented', type: 'gltf', url: '/assets/library/test/invented.glb' }];
  const invalid = validateGeneratedAssetUse(invented, selected);
  assert.equal(invalid.ok, false);
});

test('engine from-brief mocked tool path returns assets and bounded debug', async () => {
  let calls = 0;
  let finalAsset = null;
  const chatCompletionCreate = async (request) => {
    calls += 1;
    if (calls === 1) {
      return {
        model: 'mock-model',
        choices: [{
          message: {
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: { name: 'resolveAssetsForBrief', arguments: '{}' }
            }]
          }
        }]
      };
    }
    const toolMessage = request.messages.find((message) => message.role === 'tool');
    const toolPayload = JSON.parse(toolMessage.content);
    const selected = toolPayload.selectedAssets[0];
    finalAsset = { id: selected.id, publicPath: selected.publicPath };
    return {
      model: 'mock-model',
      choices: [{ message: { content: JSON.stringify(sampleGameDefinition({ ...finalAsset, runtimeType: 'gltf' })) } }]
    };
  };

  const result = await generateEngineGameFromBriefInternal({
    prompt: 'Create a tiny 3D platformer preview',
    answers: {},
    gameType: 'platformer-3d',
    dimension: '3D',
    brief: sampleBrief({ dimension: '3D' }),
    model: 'openai/gpt-5.1',
    debug: true
  }, { chatCompletionCreate });

  assert.equal(result.toolCalling.used, true);
  assert.equal(result.toolCalling.selectedAssets.length <= result.toolCalling.budget.maxSelectedAssets, true);
  assert.ok(result.selectedAssets.some((asset) => asset.id === finalAsset.id));
  assert.equal(result.gameDefinition.assets[0].url, finalAsset.publicPath);
});

test('engine from-brief mocked hybrid path returns previewable mixed GameDefinition metadata', async () => {
  let finalModelAsset = null;
  let finalUiAsset = null;
  const chatCompletionCreate = async (request) => {
    if (request.messages.every((message) => message.role !== 'tool')) {
      return {
        model: 'mock-model',
        choices: [{
          message: {
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: { name: 'resolveAssetsForBrief', arguments: '{}' }
            }]
          }
        }]
      };
    }

    const toolMessage = request.messages.find((message) => message.role === 'tool');
    const toolPayload = JSON.parse(toolMessage.content);
    const selectedAssets = toolPayload.selectedAssets;
    const modelAsset = selectedAssets.find((asset) => asset.type === 'gltf' && asset.role !== 'ui');
    const uiAsset = selectedAssets.find((asset) => ['image', 'spritesheet', 'atlas'].includes(asset.type) && asset.role === 'ui');
    finalModelAsset = modelAsset;
    finalUiAsset = uiAsset;

    return {
      model: 'mock-model',
      choices: [{
        message: {
          content: JSON.stringify({
            schemaVersion: 1,
            metadata: {
              title: 'Hybrid Tool Runner',
              description: 'Hybrid mixed composition test.',
              genre: 'runner'
            },
            engine: {
              width: 960,
              height: 540,
              enable3D: true,
              enable2D: true,
              enablePhysics: true,
              gravity: { x: 0, y: -12, z: 0 }
            },
            state: { score: 0 },
            assets: [
              { key: modelAsset.id, type: 'gltf', url: modelAsset.publicPath },
              { key: uiAsset.id, type: uiAsset.type, url: uiAsset.publicPath }
            ],
            scenes: [{
              key: 'main',
              systems: ['physicsSync', 'camera', 'ui'],
              entities: [{
                key: 'player',
                transform: { position: { x: 0, y: 1, z: 0 } },
                model: { assetKey: modelAsset.id },
                sprite: { kind: 'image', assetKey: uiAsset.id, x: 48, y: 48, followIn3D: true },
                rigidBody: { type: 'dynamic', collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 1, z: 0.5 } } },
                cameraTarget: {}
              }],
              ui: [{ type: 'text', text: 'Score: {score}' }]
            }],
            initialScene: 'main'
          })
        }
      }]
    };
  };

  const result = await generateEngineGameFromBriefInternal({
    prompt: 'Create a hybrid runner with a Three.js world, Phaser HUD, mobile controls, and Rapier physics.',
    answers: {},
    gameType: 'platformer',
    dimension: 'hybrid',
    brief: sampleBrief({
      dimension: 'hybrid',
      runtimePlan: {
        runtime: 'hybrid',
        phaserRole: 'HUD overlays and mobile controls only',
        threeRole: '3D world and model visuals',
        rapierRole: 'Rigid-body collisions',
        systems: ['physicsSync', 'camera', 'ui']
      },
      keyMechanics: ['3D jumping', 'HUD overlay', 'mobile controls']
    }),
    model: 'openai/gpt-5.1',
    debug: true
  }, { chatCompletionCreate });

  assert.equal(result.assetResolution.meta.runtimeTarget, 'hybrid');
  assert.deepEqual(result.assetResolution.meta.assetEngines, ['three', 'phaser']);
  assert.ok(finalModelAsset, 'hybrid resolver should provide a Three.js GLTF gameplay lane');
  assert.ok(finalUiAsset, 'hybrid resolver should provide a Phaser-compatible UI lane');
  assert.equal(result.gameDefinition.engine.enable3D, true);
  assert.equal(result.gameDefinition.engine.enable2D, true);
  assert.equal(result.gameDefinition.engine.enablePhysics, true);
  assert.equal(result.gameDefinition.assets.some((asset) => asset.key === finalModelAsset.id && asset.type === 'gltf'), true);
  assert.equal(result.gameDefinition.assets.some((asset) => asset.key === finalUiAsset.id && ['image', 'spritesheet', 'atlas'].includes(asset.type)), true);
  assert.equal(result.normalizationWarnings.length, 0);
});
