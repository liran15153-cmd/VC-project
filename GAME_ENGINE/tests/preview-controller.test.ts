import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PreviewController,
  preflightAssets,
  categoriseValidationError,
  buildSummary,
} from '../src/preview/PreviewController';
import type {
  PreviewControllerOptions,
  PreviewEngineFactory,
  PreviewRuntimeFactory,
} from '../src/preview/PreviewController';
import type { Engine } from '../src/core/Engine';
import type { GameRuntime } from '../src/runtime/GameRuntime';
import type { PreviewEvent } from '../src/preview/protocol';
import { parseGameDefinitionWithWarnings } from '../src/runtime/GameDefinition';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface MockEngineHandle {
  init: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  engine: Engine;
}
interface MockRuntimeHandle {
  load: ReturnType<typeof vi.fn>;
  runtime: GameRuntime;
}

function makeMockEngine(overrides: Partial<MockEngineHandle> = {}): MockEngineHandle {
  const handle = {
    init: overrides.init ?? vi.fn().mockResolvedValue(undefined),
    start: overrides.start ?? vi.fn(),
    destroy: overrides.destroy ?? vi.fn(),
    pause: overrides.pause ?? vi.fn(),
    resume: overrides.resume ?? vi.fn(),
  };
  return { ...handle, engine: handle as unknown as Engine };
}

function makeMockRuntime(overrides: Partial<MockRuntimeHandle> = {}): MockRuntimeHandle {
  const load = overrides.load ?? vi.fn().mockResolvedValue(undefined);
  return { load, runtime: { load } as unknown as GameRuntime };
}

function makeContainer() {
  return { replaceChildren: vi.fn() } as unknown as HTMLElement;
}

const SAMPLE_DEFINITION = {
  schemaVersion: 1,
  metadata: { title: 'Mock Game', genre: 'platformer', description: 'Tiny test game' },
  engine: { enable2D: true, enable3D: true, enablePhysics: true, gravity: { x: 0, y: -9.81, z: 0 } },
  state: {},
  inputBindings: {},
  assets: [],
  prefabs: {},
  behaviors: [],
  animations: [],
  ui: [],
  audio: [],
  scenes: [{ key: 'main', entities: [] }],
  initialScene: 'main',
};

interface Harness {
  controller: PreviewController;
  events: PreviewEvent[];
  engineHandle: MockEngineHandle;
  runtimeHandle: MockRuntimeHandle;
  engineFactory: ReturnType<typeof vi.fn>;
  runtimeFactory: ReturnType<typeof vi.fn>;
  advanceTime: (delta: number) => void;
}

function buildHarness(overrides: {
  engineHandle?: MockEngineHandle;
  runtimeHandle?: MockRuntimeHandle;
  now?: number;
} = {}): Harness {
  const events: PreviewEvent[] = [];
  const engineHandle = overrides.engineHandle ?? makeMockEngine();
  const runtimeHandle = overrides.runtimeHandle ?? makeMockRuntime();
  const engineFactory: ReturnType<typeof vi.fn> = vi.fn(() => engineHandle.engine);
  const runtimeFactory: ReturnType<typeof vi.fn> = vi.fn(() => runtimeHandle.runtime);
  let now = overrides.now ?? 1000;
  const options: PreviewControllerOptions = {
    container: makeContainer(),
    emit: (event) => events.push(event),
    engineFactory: engineFactory as unknown as PreviewEngineFactory,
    runtimeFactory: runtimeFactory as unknown as PreviewRuntimeFactory,
    now: () => now,
  };
  const controller = new PreviewController(options);
  return {
    controller,
    events,
    engineHandle,
    runtimeHandle,
    engineFactory,
    runtimeFactory,
    advanceTime: (delta) => { now += delta; },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PreviewController.announce', () => {
  it('emits preview:hello with origin + protocol version', () => {
    const h = buildHarness();
    h.controller.announce('https://parent.example');
    expect(h.events).toEqual([
      { v: 1, type: 'preview:hello', protocolVersion: 1, origin: 'https://parent.example' },
    ]);
  });
});

describe('PreviewController.load (happy path)', () => {
  let h: Harness;
  beforeEach(async () => {
    h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r1', gameDefinition: SAMPLE_DEFINITION });
  });

  it('emits the phase markers in order', () => {
    const phases = h.events.filter((e) => e.type === 'preview:loading').map((e) => (e as { phase: string }).phase);
    expect(phases).toEqual(['validating', 'asset-check', 'asset-load', 'starting']);
  });

  it('boots engine + runtime and starts the loop', () => {
    expect(h.engineFactory).toHaveBeenCalledTimes(1);
    expect(h.runtimeFactory).toHaveBeenCalledTimes(1);
    expect(h.engineHandle.init).toHaveBeenCalledTimes(1);
    expect(h.runtimeHandle.load).toHaveBeenCalledTimes(1);
    expect(h.engineHandle.start).toHaveBeenCalledTimes(1);
  });

  it('emits preview:loaded with a summary echoing the requestId', () => {
    const loaded = h.events.find((e) => e.type === 'preview:loaded');
    expect(loaded).toBeTruthy();
    const event = loaded as Extract<PreviewEvent, { type: 'preview:loaded' }>;
    expect(event.requestId).toBe('r1');
    expect(event.summary.title).toBe('Mock Game');
    expect(event.summary.sceneCount).toBe(1);
  });

  it('transitions to running', () => {
    expect(h.controller.getMode()).toBe('running');
  });
});

describe('PreviewController.load (error categorisation)', () => {
  it('emits validation error for malformed input', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'rx', gameDefinition: { bogus: true } });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err).toBeTruthy();
    expect(err.error.category).toBe('validation');
    expect(err.error.issues?.length).toBeGreaterThan(0);
    expect(h.controller.getMode()).toBe('error');
  });

  it('emits asset-missing-reference for a sprite/model that points at no asset', async () => {
    const h = buildHarness();
    const definition = {
      ...SAMPLE_DEFINITION,
      assets: [],
      scenes: [
        {
          key: 'main',
          entities: [
            {
              key: 'player',
              model: {
                assetKey: 'ghost',
                positionOffset: { x: 0, y: 0, z: 0 },
                rotationOffset: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                castShadow: false,
                receiveShadow: false,
              },
            },
          ],
        },
      ],
    };
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r2', gameDefinition: definition });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('asset-missing-reference');
  });

  it('emits engine-init when Engine.init rejects', async () => {
    const engineHandle = makeMockEngine({ init: vi.fn().mockRejectedValue(new Error('rapier wasm failed')) });
    const h = buildHarness({ engineHandle });
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'rZ', gameDefinition: SAMPLE_DEFINITION });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('engine-init');
    expect(err.error.message).toMatch(/rapier wasm failed/);
  });

  it('emits asset-load when runtime.load throws an asset error', async () => {
    const runtimeHandle = makeMockRuntime({
      load: vi.fn().mockRejectedValue(new Error('Failed to load image asset "spr" from /x.png.')),
    });
    const h = buildHarness({ runtimeHandle });
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'rY', gameDefinition: SAMPLE_DEFINITION });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('asset-load');
    expect(err.error.failedAssets?.[0]?.key).toBe('spr');
  });

  it('emits runtime for non-asset runtime.load failures', async () => {
    const runtimeHandle = makeMockRuntime({ load: vi.fn().mockRejectedValue(new Error('scene-graph blew up')) });
    const h = buildHarness({ runtimeHandle });
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'rW', gameDefinition: SAMPLE_DEFINITION });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('runtime');
  });
});

describe('PreviewController.reload', () => {
  it('replays the most recent definition with the new requestId', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'first', gameDefinition: SAMPLE_DEFINITION });
    h.events.length = 0;
    await h.controller.handleCommand({ v: 1, type: 'preview:reload', requestId: 'second' });
    const loaded = h.events.find((e) => e.type === 'preview:loaded') as Extract<PreviewEvent, { type: 'preview:loaded' }>;
    expect(loaded).toBeTruthy();
    expect(loaded.requestId).toBe('second');
  });

  it('fails with protocol error when nothing was loaded', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:reload', requestId: 'first' });
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('protocol');
  });
});

describe('PreviewController pause/resume/destroy', () => {
  it('pause + resume update mode and notify', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r1', gameDefinition: SAMPLE_DEFINITION });
    await h.controller.handleCommand({ v: 1, type: 'preview:pause', requestId: 'rp' });
    expect(h.controller.getMode()).toBe('paused');
    expect(h.events.find((e) => e.type === 'preview:paused')).toBeTruthy();

    await h.controller.handleCommand({ v: 1, type: 'preview:resume', requestId: 'rr' });
    expect(h.controller.getMode()).toBe('running');
    expect(h.events.find((e) => e.type === 'preview:resumed')).toBeTruthy();
  });

  it('destroy tears down the engine and reports destroyed', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r1', gameDefinition: SAMPLE_DEFINITION });
    await h.controller.handleCommand({ v: 1, type: 'preview:destroy', requestId: 'rd' });
    expect(h.controller.getMode()).toBe('idle');
    expect(h.engineHandle.destroy).toHaveBeenCalledTimes(1);
    const destroyed = h.events.find((e) => e.type === 'preview:destroyed') as Extract<PreviewEvent, { type: 'preview:destroyed' }>;
    expect(destroyed.requestId).toBe('rd');
  });

  it('multi-load tears down the previous engine before booting a new one', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'a', gameDefinition: SAMPLE_DEFINITION });
    const firstEngine = h.engineHandle;
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'b', gameDefinition: SAMPLE_DEFINITION });
    expect(firstEngine.destroy).toHaveBeenCalledTimes(1);
    expect(h.engineFactory).toHaveBeenCalledTimes(2);
  });
});

describe('PreviewController.getSnapshot + preview:get-snapshot', () => {
  it('snapshot reflects mode, summary and uptime', async () => {
    const h = buildHarness({ now: 5000 });
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r1', gameDefinition: SAMPLE_DEFINITION });
    h.advanceTime(2500);
    await h.controller.handleCommand({ v: 1, type: 'preview:get-snapshot', requestId: 'rs' });
    const snap = h.events.find((e) => e.type === 'preview:snapshot') as Extract<PreviewEvent, { type: 'preview:snapshot' }>;
    expect(snap.snapshot.mode).toBe('running');
    expect(snap.snapshot.uptimeMs).toBe(2500);
    expect(snap.snapshot.title).toBe('Mock Game');
  });

  it('snapshot when idle returns empty summary with mode=idle', () => {
    const h = buildHarness();
    h.controller.handleCommand({ v: 1, type: 'preview:get-snapshot', requestId: 'rs' });
    const snap = h.events.find((e) => e.type === 'preview:snapshot') as Extract<PreviewEvent, { type: 'preview:snapshot' }>;
    expect(snap.snapshot.mode).toBe('idle');
    expect(snap.snapshot.title).toBe('');
    expect(snap.snapshot.uptimeMs).toBe(0);
  });
});

describe('PreviewController.reportRuntimeError', () => {
  it('is ignored while idle', () => {
    const h = buildHarness();
    h.controller.reportRuntimeError(new Error('stray'));
    expect(h.events.find((e) => e.type === 'preview:error')).toBeUndefined();
  });

  it('produces a runtime category error while running', async () => {
    const h = buildHarness();
    await h.controller.handleCommand({ v: 1, type: 'preview:load', requestId: 'r1', gameDefinition: SAMPLE_DEFINITION });
    h.events.length = 0;
    h.controller.reportRuntimeError(new Error('NaN in fixed step'));
    const err = h.events.find((e) => e.type === 'preview:error') as Extract<PreviewEvent, { type: 'preview:error' }>;
    expect(err.error.category).toBe('runtime');
    expect(err.error.phase).toBe('runtime');
  });
});

// ─── Pure-helper tests ──────────────────────────────────────────────────────

describe('preflightAssets', () => {
  it('returns null when every asset type is supported', () => {
    const { definition } = parseGameDefinitionWithWarnings(SAMPLE_DEFINITION);
    expect(preflightAssets(definition)).toBeNull();
  });

  // The schema currently constrains asset types to the supported set; this is
  // a guard test for forward-compat (schema extends but runtime does not).
  it('flags unsupported types when forced past the schema', () => {
    const { definition } = parseGameDefinitionWithWarnings(SAMPLE_DEFINITION);
    const forged = {
      ...definition,
      assets: [...definition.assets, { key: 'x', type: 'video' as never, url: '/x.mp4' }],
    };
    const result = preflightAssets(forged);
    expect(result?.category).toBe('asset-unsupported');
    expect(result?.unsupportedTypes).toContain('video');
  });
});

describe('categoriseValidationError', () => {
  it('maps generic missing-reference Error messages', () => {
    const error = new Error('Entity "p" references missing model asset "ghost".');
    expect(categoriseValidationError(error).category).toBe('asset-missing-reference');
  });
});

describe('buildSummary', () => {
  it('reports usage flags based on declared content', () => {
    const { definition } = parseGameDefinitionWithWarnings({
      ...SAMPLE_DEFINITION,
      scenes: [
        {
          key: 'main',
          entities: [{ key: 'a', mesh: { shape: 'box' } }],
          ui: [{ type: 'text', text: 'hi' }],
        },
      ],
    });
    const summary = buildSummary(definition);
    expect(summary.uses3D).toBe(true);
    expect(summary.uses2D).toBe(true);
    expect(summary.usesPhysics).toBe(false);
    expect(summary.sceneCount).toBe(1);
    expect(summary.activeScene).toBe('main');
  });
});
