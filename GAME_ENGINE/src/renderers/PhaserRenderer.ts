import Phaser from 'phaser';
import type { Engine } from '../core/Engine';

/**
 * Owns the Phaser.Game instance for 2D / HUD / UI work.
 * Configured with a transparent background so it can sit on top of Three.js.
 */
export class PhaserRenderer {
  game!: Phaser.Game;
  scene!: Phaser.Scene;
  canvas!: HTMLCanvasElement;
  private ready = false;
  private manualTime = 0;
  private readonly sceneKey = 'GVC_OverlayScene';

  constructor(private readonly engine: Engine) {}

  init(): Promise<void> {
    return new Promise((resolve) => {
      const { width, height } = this.engine.config;
      const overlay = this;

      class OverlayScene extends Phaser.Scene {
        constructor() {
          super(overlay.sceneKey);
        }
        create(): void {
          overlay.scene = this;
          overlay.ready = true;
          overlay.manualTime = performance.now();
          overlay.game.loop.sleep();
          resolve();
        }
      }

      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        width,
        height,
        parent: this.engine.container,
        transparent: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [OverlayScene],
        // Phaser drives its own RAF; we keep stepping it manually below for ordering.
        autoFocus: true,
      });

      const canvas = this.game.canvas;
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.zIndex = '1';
      canvas.style.pointerEvents = 'none'; // allow Three.js underneath to receive input by default
      this.canvas = canvas;
    });
  }

  /** Allow consumers to opt-in to Phaser handling pointer events (e.g. UI buttons). */
  enablePointerCapture(enabled = true): void {
    if (this.canvas) this.canvas.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  resize(width: number, height: number): void {
    if (!this.game) return;
    this.game.scale.resize(width, height);
  }

  /** Phaser's RAF is asleep; the Engine advances it here after Three has rendered. */
  render(dt: number): void {
    if (!this.ready) return;
    const deltaMs = dt * 1000;
    this.manualTime += deltaMs;
    this.game.step(this.manualTime, deltaMs);
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    this.game?.destroy(true);
  }
}
