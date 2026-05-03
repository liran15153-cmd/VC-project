/**
 * Lightweight DOM-based virtual joystick for mobile devices.
 * Designed to live as a sibling overlay on the engine's container so it works
 * regardless of whether Phaser is enabled.
 */
export class VirtualJoystick {
  active = false;
  private base!: HTMLDivElement;
  private stick!: HTMLDivElement;
  private origin = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private radius = 60;

  constructor(private readonly container: HTMLElement) {}

  attach(): void {
    this.base = document.createElement('div');
    Object.assign(this.base.style, {
      position: 'absolute',
      bottom: '24px',
      left: '24px',
      width: `${this.radius * 2}px`,
      height: `${this.radius * 2}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.10)',
      border: '2px solid rgba(255,255,255,0.35)',
      zIndex: '10',
      touchAction: 'none',
      pointerEvents: 'auto',
    } as CSSStyleDeclaration);

    this.stick = document.createElement('div');
    Object.assign(this.stick.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '50%',
      height: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.55)',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);

    this.base.appendChild(this.stick);
    this.container.appendChild(this.base);

    this.base.addEventListener('pointerdown', this.onDown);
    this.base.addEventListener('pointermove', this.onMove);
    this.base.addEventListener('pointerup', this.onUp);
    this.base.addEventListener('pointercancel', this.onUp);
    this.base.addEventListener('pointerleave', this.onUp);
  }

  detach(): void {
    this.active = false;
    this.pointerId = null;
    this.current = { x: 0, y: 0 };
    this.base?.remove();
  }

  value(): { x: number; y: number } {
    return this.current;
  }

  private onDown = (e: PointerEvent): void => {
    this.active = true;
    this.pointerId = e.pointerId;
    this.base.setPointerCapture(e.pointerId);
    const rect = this.base.getBoundingClientRect();
    this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.update(e);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    this.update(e);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.active = false;
    this.pointerId = null;
    this.current.x = 0;
    this.current.y = 0;
    this.stick.style.left = '50%';
    this.stick.style.top = '50%';
  };

  private update(e: PointerEvent): void {
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.radius);
    const angle = Math.atan2(dy, dx);
    const cx = Math.cos(angle) * clamped;
    const cy = Math.sin(angle) * clamped;
    this.current.x = cx / this.radius;
    this.current.y = cy / this.radius;
    this.stick.style.left = `calc(50% + ${cx}px)`;
    this.stick.style.top = `calc(50% + ${cy}px)`;
  }
}
