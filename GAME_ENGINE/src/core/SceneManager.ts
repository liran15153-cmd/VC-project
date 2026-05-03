import type { Engine } from './Engine';
import type { Scene } from './Scene';
import type { SystemContext } from './types';

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private active: Scene | null = null;
  private activeKey: string | null = null;

  constructor(private readonly engine: Engine) {}

  register(key: string, scene: Scene): void {
    this.scenes.set(key, scene);
  }

  async switchTo(key: string): Promise<void> {
    const next = this.scenes.get(key);
    if (!next) throw new Error(`Scene "${key}" is not registered.`);
    const previousKey = this.activeKey;
    this.engine.events.emit('scene:before-switch', { from: previousKey, to: key });
    if (this.active) this.active.destroy();
    this.active = next;
    this.activeKey = key;
    await next._bootstrap(this.engine);
    this.engine.events.emit('scene:after-switch', { from: previousKey, to: key });
  }

  current(): Scene | null {
    return this.active;
  }

  currentKey(): string | null {
    return this.activeKey;
  }

  update(ctx: SystemContext): void {
    this.active?._update(ctx);
  }

  destroy(): void {
    this.active?.destroy();
    this.scenes.clear();
    this.active = null;
    this.activeKey = null;
  }
}
