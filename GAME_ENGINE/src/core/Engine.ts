import type { EngineConfig, EngineErrorPhase, EngineEvents, EngineFrameInfo, ResolvedEngineConfig, SystemContext } from './types';
import { SceneManager } from './SceneManager';
import { EventBus } from './EventBus';
import { GameStateStore } from './GameStateStore';
import { ThreeRenderer } from '../renderers/ThreeRenderer';
import { PhaserRenderer } from '../renderers/PhaserRenderer';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../input/InputManager';
import { AutoResizer } from '../utils/AutoResizer';
import { getOrientation, isMobile } from '../utils/device';

const DEFAULT_FIXED_DT = 1 / 60;
const DEFAULT_MAX_SUBSTEPS = 5;
const DEFAULT_MAX_DT = 0.25;
const DEFAULT_MAX_PIXEL_RATIO = 2;

/**
 * The Engine is the single owner of the lifecycle.
 *
 * Each frame:
 *  1) Physics step (fixed timestep with accumulator)
 *  2) Logic step  (run all systems via SceneManager)
 *  3) Sync step   (PhysicsSyncSystem updates Three/Phaser transforms)
 *  4) Render step (Three first, Phaser overlay second)
 *
 * Library-aware: any disabled subsystem is skipped at zero runtime cost.
 */
export class Engine {
  readonly container: HTMLElement;
  readonly config: ResolvedEngineConfig;

  readonly three?: ThreeRenderer;
  readonly phaser?: PhaserRenderer;
  readonly physics?: PhysicsWorld;
  readonly input: InputManager;
  readonly scenes: SceneManager;
  readonly resizer: AutoResizer;
  readonly events = new EventBus<EngineEvents>();
  readonly state = new GameStateStore();

  private rafId = 0;
  private lastTs = 0;
  private elapsed = 0;
  private accumulator = 0;
  private frame = 0;
  private initialised = false;
  private running = false;
  private paused = false;
  private readonly onVisibilityChange = (): void => {
    if (!this.config.pauseWhenHidden) return;
    if (document.hidden) this.pause();
    else this.resume();
  };

  constructor(config: EngineConfig) {
    this.container = resolveContainer(config.container);
    const width = config.width ?? (this.container.clientWidth || window.innerWidth);
    const height = config.height ?? (this.container.clientHeight || window.innerHeight);
    const pixelRatio = Math.min(config.pixelRatio ?? window.devicePixelRatio, config.maxPixelRatio ?? DEFAULT_MAX_PIXEL_RATIO);
    this.config = {
      container: this.container,
      width,
      height,
      enable3D: config.enable3D ?? true,
      enable2D: config.enable2D ?? true,
      enablePhysics: config.enablePhysics ?? true,
      gravity: config.gravity ?? { x: 0, y: -9.81, z: 0 },
      pixelRatio,
      antialias: config.antialias ?? true,
      fixedTimeStep: config.fixedTimeStep ?? DEFAULT_FIXED_DT,
      maxSubSteps: config.maxSubSteps ?? DEFAULT_MAX_SUBSTEPS,
      maxDeltaTime: config.maxDeltaTime ?? DEFAULT_MAX_DT,
      timeScale: config.timeScale ?? 1,
      maxPixelRatio: config.maxPixelRatio ?? DEFAULT_MAX_PIXEL_RATIO,
      pauseWhenHidden: config.pauseWhenHidden ?? true,
      fatalOnSystemError: config.fatalOnSystemError ?? true,
      virtualJoystick: config.virtualJoystick ?? isMobile(),
      background: config.background ?? null,
    };

    // Layered canvases - Three at the back, Phaser transparently on top.
    if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';

    if (this.config.enable3D) {
      this.three = new ThreeRenderer(this);
    }
    if (this.config.enable2D) {
      this.phaser = new PhaserRenderer(this);
    }
    if (this.config.enablePhysics) {
      this.physics = new PhysicsWorld(this.config.gravity);
    }

    this.input = new InputManager(this.container, { virtualJoystick: this.config.virtualJoystick });
    this.scenes = new SceneManager(this);
    this.resizer = new AutoResizer(this);
    this.state.onChange((change) => this.events.emit('state:change', change));
  }

  /** Boot async subsystems (Rapier WASM, Phaser game). Must be awaited before start(). */
  async init(): Promise<void> {
    if (this.initialised) return;
    try {
      if (this.physics) await this.physics.init();
      if (this.three) this.three.init();
      if (this.phaser) await this.phaser.init();
      this.input.attach();
      this.resizer.attach();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.initialised = true;
      this.events.emit('init', { engine: this });
    } catch (error) {
      this.handleRuntimeError(error, 'init');
    }
  }

  start(): void {
    if (this.running) return;
    if (!this.initialised) throw new Error('Engine.init() must be awaited before start().');
    this.running = true;
    this.paused = false;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    this.events.emit('start', { engine: this });
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.events.emit('stop', { engine: this });
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.events.emit('pause', { engine: this });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastTs = performance.now();
    this.events.emit('resume', { engine: this });
  }

  setTimeScale(timeScale: number): void {
    this.config.timeScale = Math.max(0, timeScale);
  }

  setSize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this.config.width === nextWidth && this.config.height === nextHeight) return;
    this.config.width = nextWidth;
    this.config.height = nextHeight;
    this.three?.resize(nextWidth, nextHeight);
    this.phaser?.resize(nextWidth, nextHeight);
    this.events.emit('resize', { width: nextWidth, height: nextHeight, orientation: getOrientation() });
  }

  getViewport(): { width: number; height: number } {
    return { width: this.config.width, height: this.config.height };
  }

  destroy(): void {
    this.stop();
    try {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.scenes.destroy();
      this.input.detach();
      this.resizer.detach();
      this.three?.destroy();
      this.phaser?.destroy();
      this.physics?.destroy();
      this.events.emit('destroy', { engine: this });
      this.events.clear();
    } catch (error) {
      this.handleRuntimeError(error, 'destroy');
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    if (this.paused) {
      this.lastTs = now;
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const rawDt = (now - this.lastTs) / 1000;
    this.lastTs = now;
    // Clamp big dt spikes so a stalled tab doesn't explode the physics world.
    const dt = Math.min(rawDt, this.config.maxDeltaTime) * this.config.timeScale;
    this.elapsed += dt;
    this.frame++;
    let fixedSteps = 0;

    const makeFrameInfo = (): EngineFrameInfo => ({
      frame: this.frame,
      deltaTime: dt,
      rawDeltaTime: rawDt,
      elapsed: this.elapsed,
      fixedSteps,
    });

    // 1) PHYSICS - fixed-step accumulator
    this.events.emit('frame:before', makeFrameInfo());
    try {
      if (this.physics) {
        this.accumulator += dt;
        while (this.accumulator >= this.config.fixedTimeStep && fixedSteps < this.config.maxSubSteps) {
          this.physics.step(this.config.fixedTimeStep);
          this.accumulator -= this.config.fixedTimeStep;
          fixedSteps++;
        }
      }
      this.events.emit('frame:after-physics', makeFrameInfo());
    } catch (error) {
      this.handleRuntimeError(error, 'physics');
    }

    // 2) LOGIC + 3) SYNC (systems run in priority order; sync system has high priority)
    try {
      const currentScene = this.scenes.current();
      if (currentScene) {
        const ctx: SystemContext = { world: currentScene.world, engine: this, deltaTime: dt, elapsed: this.elapsed };
        this.scenes.update(ctx);
      }
      this.input.endFrame();
      this.events.emit('frame:after-systems', makeFrameInfo());
    } catch (error) {
      this.handleRuntimeError(error, 'systems');
    }

    // 4) RENDER - Three first (background), Phaser overlay second
    try {
      this.three?.render();
      this.phaser?.render(dt);
      this.events.emit('frame:after-render', makeFrameInfo());
    } catch (error) {
      this.handleRuntimeError(error, 'render');
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleRuntimeError(error: unknown, phase: EngineErrorPhase): void {
    this.events.emit('error', { error, phase, sceneKey: this.scenes?.currentKey() ?? null, engine: this });
    if (this.config.fatalOnSystemError) this.stop();
  }
}

function resolveContainer(target: HTMLElement | string): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) throw new Error(`Engine container "${target}" not found.`);
    return el;
  }
  return target;
}
