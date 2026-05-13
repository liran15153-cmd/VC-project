import { z } from 'zod';
import type { Engine } from '../core/Engine';
import type { EngineConfig } from '../core/types';
import type { GameRuntime } from '../runtime/GameRuntime';
import {
  parseGameDefinitionWithWarnings,
  type GameDefinition,
  type GameDefinitionNormalizationWarning,
} from '../runtime/GameDefinition';
import {
  PREVIEW_PROTOCOL_VERSION,
  type GameSummary,
  type PreviewCommand,
  type PreviewError,
  type PreviewEvent,
  type PreviewLoadPhase,
  type PreviewMode,
  type PreviewSnapshot,
  type PreviewWarning,
} from './protocol';

/**
 * Asset types this runtime knows how to instantiate. Anything outside this set
 * is treated as `asset-unsupported`, even if the GameDefinition schema accepts
 * it — that protects future engine versions from silently shipping broken
 * games when a new asset type appears in the schema before the runtime
 * supports it.
 */
const RUNTIME_SUPPORTED_ASSET_TYPES: ReadonlySet<string> = new Set([
  'image',
  'spritesheet',
  'atlas',
  'tilemap',
  'gltf',
  'audio',
  'json',
  'text',
  'arrayBuffer',
]);

export type PreviewEngineFactory = (config: EngineConfig) => Engine;
export type PreviewRuntimeFactory = (engine: Engine) => GameRuntime;

export interface PreviewControllerOptions {
  container: HTMLElement;
  emit: (event: PreviewEvent) => void;
  /** Build the Engine for a given config. Required — the controller never imports Engine to avoid pulling Three/Phaser into headless tests. */
  engineFactory: PreviewEngineFactory;
  /** Build the GameRuntime that wraps the Engine. Required for the same reason. */
  runtimeFactory: PreviewRuntimeFactory;
  /** Override clock for deterministic tests. */
  now?: () => number;
}

/**
 * Owns the iframe-side lifecycle: engine boot, asset load, scene activation,
 * pause/resume, teardown, structured error reporting. Pure with respect to
 * window/document — wiring lives in the iframe entry shell.
 */
export class PreviewController {
  private engine: Engine | null = null;
  private runtime: GameRuntime | null = null;
  private mode: PreviewMode = 'idle';
  private currentRequestId: string | null = null;
  private lastDefinition: GameDefinition | null = null;
  private lastSummary: GameSummary | null = null;
  private lastWarnings: PreviewWarning[] = [];
  private startedAt = 0;
  private destroying = false;

  private readonly container: HTMLElement;
  private readonly emit: (event: PreviewEvent) => void;
  private readonly engineFactory: PreviewEngineFactory;
  private readonly runtimeFactory: PreviewRuntimeFactory;
  private readonly now: () => number;

  constructor(options: PreviewControllerOptions) {
    this.container = options.container;
    this.emit = options.emit;
    this.engineFactory = options.engineFactory;
    this.runtimeFactory = options.runtimeFactory;
    this.now = options.now ?? (() => Date.now());
  }

  /** Emit the initial `preview:hello` announcement. Call after wiring listeners. */
  announce(origin: string): void {
    this.emit({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:hello',
      protocolVersion: PREVIEW_PROTOCOL_VERSION,
      origin,
    });
  }

  async handleCommand(command: PreviewCommand): Promise<void> {
    switch (command.type) {
      case 'preview:load':
        await this.load(command.requestId, command.gameDefinition);
        return;
      case 'preview:reload':
        await this.reload(command.requestId);
        return;
      case 'preview:destroy':
        await this.destroy(command.requestId);
        return;
      case 'preview:pause':
        this.pause(command.requestId);
        return;
      case 'preview:resume':
        this.resume(command.requestId);
        return;
      case 'preview:get-snapshot':
        this.emitSnapshot(command.requestId);
        return;
    }
  }

  /** Forward an uncaught window-level error into the protocol stream. */
  reportRuntimeError(error: unknown): void {
    if (this.mode !== 'running' && this.mode !== 'loading') return;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.fail({ category: 'runtime', message, phase: 'runtime', stack });
  }

  getMode(): PreviewMode {
    return this.mode;
  }

  getSnapshot(): PreviewSnapshot {
    const base: GameSummary = this.lastSummary ?? this.emptySummary();
    return {
      ...base,
      mode: this.mode,
      warnings: this.lastWarnings,
      uptimeMs: this.startedAt > 0 ? Math.max(0, this.now() - this.startedAt) : 0,
      // Engine.frame is private; expose 0 here and surface it via a future API.
      frame: 0,
    };
  }

  // ─── Private command handlers ─────────────────────────────────────────────

  private async load(requestId: string, input: unknown): Promise<void> {
    this.currentRequestId = requestId;
    this.mode = 'loading';

    // 1) Validate the JSON shape and normalize.
    this.emitLoading(requestId, 'validating');
    let parsed: { definition: GameDefinition; warnings: GameDefinitionNormalizationWarning[] };
    try {
      parsed = parseGameDefinitionWithWarnings(input);
    } catch (err) {
      this.fail(categoriseValidationError(err));
      return;
    }
    const definition = parsed.definition;
    this.lastWarnings = parsed.warnings.map(warningFromNormalization);

    // 2) Preflight asset references / supported types.
    this.emitLoading(requestId, 'asset-check');
    const preflight = preflightAssets(definition);
    if (preflight) {
      this.fail(preflight);
      return;
    }

    // 3) Tear down whatever was running.
    await this.destroyCurrent();
    this.container.replaceChildren();

    // 4) Boot a fresh engine.
    let engine: Engine;
    let runtime: GameRuntime;
    try {
      engine = this.engineFactory({
        container: this.container,
        background: definition.engine.background ?? '#0b0f16',
        enable3D: definition.engine.enable3D,
        enable2D: definition.engine.enable2D,
        enablePhysics: definition.engine.enablePhysics,
        gravity: definition.engine.gravity,
        fatalOnSystemError: false,
      });
      runtime = this.runtimeFactory(engine);
      await engine.init();
    } catch (err) {
      this.fail({
        category: 'engine-init',
        message: errorMessage(err),
        phase: 'starting',
        stack: errorStack(err),
      });
      return;
    }

    this.engine = engine;
    this.runtime = runtime;

    // 5) Hand the definition to the runtime (assets + scenes).
    this.emitLoading(requestId, 'asset-load');
    try {
      await runtime.load(definition);
    } catch (err) {
      this.fail(categoriseLoadError(err));
      return;
    }

    // 6) Start the frame loop.
    this.emitLoading(requestId, 'starting');
    try {
      engine.start();
    } catch (err) {
      this.fail({
        category: 'engine-init',
        message: errorMessage(err),
        phase: 'starting',
        stack: errorStack(err),
      });
      return;
    }

    // 7) Success: emit summary.
    this.lastDefinition = definition;
    this.startedAt = this.now();
    this.lastSummary = buildSummary(definition);
    this.mode = 'running';
    this.emit({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:loaded',
      requestId,
      summary: this.lastSummary,
      warnings: this.lastWarnings,
    });
  }

  private async reload(requestId: string): Promise<void> {
    if (!this.lastDefinition) {
      this.currentRequestId = requestId;
      this.fail({ category: 'protocol', message: 'No prior definition to reload.' });
      return;
    }
    await this.load(requestId, this.lastDefinition);
  }

  private async destroy(requestId: string): Promise<void> {
    this.currentRequestId = requestId;
    await this.destroyCurrent();
    this.container.replaceChildren();
    this.mode = 'idle';
    this.lastSummary = null;
    this.startedAt = 0;
    this.emit({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:destroyed', requestId });
  }

  private pause(requestId: string): void {
    this.currentRequestId = requestId;
    if (this.engine && this.mode === 'running') {
      this.engine.pause();
      this.mode = 'paused';
      this.emit({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:paused', requestId });
    }
  }

  private resume(requestId: string): void {
    this.currentRequestId = requestId;
    if (this.engine && this.mode === 'paused') {
      this.engine.resume();
      this.mode = 'running';
      this.emit({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:resumed', requestId });
    }
  }

  private emitSnapshot(requestId: string): void {
    this.emit({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:snapshot',
      requestId,
      snapshot: this.getSnapshot(),
    });
  }

  private emitLoading(requestId: string, phase: PreviewLoadPhase, detail?: string): void {
    this.emit({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:loading',
      requestId,
      phase,
      detail,
    });
  }

  private fail(error: PreviewError): void {
    this.mode = 'error';
    this.emit({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:error',
      requestId: this.currentRequestId,
      error,
    });
  }

  private async destroyCurrent(): Promise<void> {
    if (this.destroying || !this.engine) return;
    this.destroying = true;
    try {
      this.engine.destroy();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('PreviewController: error during teardown', err);
    } finally {
      this.engine = null;
      this.runtime = null;
      this.destroying = false;
    }
  }

  private emptySummary(): GameSummary {
    return {
      title: '',
      schemaVersion: PREVIEW_PROTOCOL_VERSION,
      assetCount: 0,
      loadedAssetCount: 0,
      failedAssetCount: 0,
      sceneCount: 0,
      activeScene: '',
      uses3D: false,
      uses2D: false,
      usesPhysics: false,
    };
  }
}

// ─── Pure helpers (exported for unit tests) ─────────────────────────────────

export function preflightAssets(definition: GameDefinition): PreviewError | null {
  const unsupported = definition.assets
    .map((a) => a.type)
    .filter((type) => !RUNTIME_SUPPORTED_ASSET_TYPES.has(type));
  if (unsupported.length > 0) {
    const unique = Array.from(new Set(unsupported));
    return {
      category: 'asset-unsupported',
      message: `GameDefinition declares asset types this runtime does not implement: ${unique.join(', ')}`,
      phase: 'asset-check',
      unsupportedTypes: unique,
    };
  }
  return null;
}

export function categoriseValidationError(err: unknown): PreviewError {
  if (err instanceof z.ZodError) {
    return {
      category: 'validation',
      message: 'GameDefinition failed schema validation.',
      phase: 'validating',
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  const message = errorMessage(err);
  if (/references missing.*asset/i.test(message) || /references asset .* with type/i.test(message)) {
    const match = message.match(/asset "([^"]+)"/i);
    return {
      category: 'asset-missing-reference',
      message,
      phase: 'asset-check',
      failedAssets: match ? [{ key: match[1], reason: 'referenced by gameDefinition but missing or wrong type' }] : undefined,
    };
  }
  return {
    category: 'validation',
    message,
    phase: 'validating',
  };
}

export function categoriseLoadError(err: unknown): PreviewError {
  const message = errorMessage(err);
  const stack = errorStack(err);
  const isAssetError =
    /Failed to load .*asset/i.test(message) ||
    /Asset .* URL must be/i.test(message) ||
    /did not load as an ArrayBuffer/i.test(message) ||
    /Model asset .* is not loaded/i.test(message) ||
    /Asset .* is not loaded/i.test(message);
  if (isAssetError) {
    const match = message.match(/asset "([^"]+)"/i);
    return {
      category: 'asset-load',
      message,
      phase: 'asset-load',
      failedAssets: match ? [{ key: match[1], reason: message }] : undefined,
      stack,
    };
  }
  return {
    category: 'runtime',
    message,
    phase: 'scene-build',
    stack,
  };
}

export function buildSummary(definition: GameDefinition): GameSummary {
  const scenes = definition.scenes ?? [];
  const initialScene = definition.initialScene ?? scenes[0]?.key ?? '';
  const sceneEntities = scenes.flatMap((s) => s.entities ?? []);
  const prefabEntities = Object.values(definition.prefabs ?? {});

  const uses3D =
    sceneEntities.some((e) => Boolean(e.model) || Boolean(e.mesh)) ||
    prefabEntities.some((e) => Boolean(e.model) || Boolean(e.mesh)) ||
    scenes.some((s) => (s.lights ?? []).length > 0);
  const uses2D =
    sceneEntities.some((e) => Boolean(e.sprite)) ||
    prefabEntities.some((e) => Boolean(e.sprite)) ||
    (definition.ui ?? []).length > 0 ||
    scenes.some((s) => (s.ui ?? []).length > 0);
  const usesPhysics =
    sceneEntities.some((e) => Boolean(e.rigidBody)) ||
    prefabEntities.some((e) => Boolean(e.rigidBody));

  const assetCount = definition.assets.length;
  return {
    title: definition.metadata.title,
    description: definition.metadata.description,
    genre: definition.metadata.genre,
    schemaVersion: definition.schemaVersion,
    assetCount,
    // GameRuntime.load throws on the first failing asset, so a successful load
    // implies every declared asset resolved. Per-asset progress will come from
    // AssetManager instrumentation in a follow-up.
    loadedAssetCount: assetCount,
    failedAssetCount: 0,
    sceneCount: scenes.length,
    activeScene: initialScene,
    uses3D,
    uses2D,
    usesPhysics,
  };
}

function warningFromNormalization(warning: GameDefinitionNormalizationWarning): PreviewWarning {
  return {
    code: warning.code,
    path: warning.path,
    message: warning.message,
    before: warning.before,
    after: warning.after,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}
