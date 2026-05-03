import type { Engine } from '../core/Engine';
import { getOrientation } from './device';

/**
 * Watches the container and dispatches a resize cascade to every renderer.
 * Uses ResizeObserver where available, falling back to window 'resize'.
 */
export class AutoResizer {
  private observer?: ResizeObserver;
  private lastOrientation = getOrientation();
  private boundOnWindowResize = () => this.resize();

  constructor(private readonly engine: Engine) {}

  attach(): void {
    const ResizeObserverCtor = globalThis.ResizeObserver;
    if (ResizeObserverCtor) {
      this.observer = new ResizeObserverCtor(() => this.resize());
      this.observer.observe(this.engine.container);
    } else {
      window.addEventListener('resize', this.boundOnWindowResize);
    }
    window.addEventListener('orientationchange', this.boundOnWindowResize);
    this.resize();
  }

  detach(): void {
    this.observer?.disconnect();
    window.removeEventListener('resize', this.boundOnWindowResize);
    window.removeEventListener('orientationchange', this.boundOnWindowResize);
  }

  resize(): void {
    const w = this.engine.container.clientWidth || window.innerWidth;
    const h = this.engine.container.clientHeight || window.innerHeight;
    this.engine.setSize(w, h);

    const orientation = getOrientation();
    if (orientation !== this.lastOrientation) {
      this.lastOrientation = orientation;
      this.engine.three?.onOrientationChange(orientation);
    }
  }
}
