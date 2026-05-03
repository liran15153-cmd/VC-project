import { World } from './World';
import type { ISystem, SystemContext } from './types';
import type { Engine } from './Engine';

/**
 * A Scene owns its own ECS World and an ordered list of systems.
 * Switching scenes is cheap because each scene is self-contained.
 */
export abstract class Scene {
  readonly world = new World();
  readonly systems: ISystem[] = [];
  protected engine!: Engine;
  private readonly cleanupCallbacks: Array<() => void> = [];
  private initialised = false;

  /** Called once when the scene becomes active. Subclasses build the world here. */
  abstract create(engine: Engine): void | Promise<void>;

  /** Optional hook fired when the scene is unloaded. */
  destroy(): void {
    for (const cleanup of [...this.cleanupCallbacks].reverse()) cleanup();
    this.cleanupCallbacks.length = 0;
    for (const sys of this.systems) sys.destroy?.();
    this.world.clear();
    this.systems.length = 0;
    this.initialised = false;
  }

  addSystem<T extends ISystem>(system: T): T {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    return system;
  }

  addCleanup(cleanup: () => void): void {
    this.cleanupCallbacks.push(cleanup);
  }

  removeSystem(name: string): void {
    const idx = this.systems.findIndex((s) => s.name === name);
    if (idx >= 0) {
      this.systems[idx].destroy?.();
      this.systems.splice(idx, 1);
    }
  }

  /** @internal - called by Engine */
  async _bootstrap(engine: Engine): Promise<void> {
    this.engine = engine;
    await this.create(engine);
    const ctx: SystemContext = { world: this.world, engine, deltaTime: 0, elapsed: 0 };
    for (const sys of this.systems) await sys.init?.(ctx);
    this.initialised = true;
  }

  /** @internal - called by Engine each frame */
  _update(ctx: SystemContext): void {
    if (!this.initialised) return;
    for (const sys of this.systems) {
      if (sys.enabled) sys.update?.(ctx);
    }
  }
}

/** Convenience: build a scene from a plain create-callback. */
export class CallbackScene extends Scene {
  constructor(private readonly fn: (engine: Engine, scene: Scene) => void | Promise<void>) {
    super();
  }
  async create(engine: Engine): Promise<void> {
    await this.fn(engine, this);
  }
}
