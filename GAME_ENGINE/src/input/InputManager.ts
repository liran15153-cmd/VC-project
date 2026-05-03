import type { InputState } from '../core/types';
import { VirtualJoystick } from './VirtualJoystick';

export interface InputManagerOptions {
  virtualJoystick?: boolean;
  preventDefaultKeys?: boolean;
}

/**
 * One unified input gateway for mouse, keyboard, and touch.
 *
 * Per-frame helpers:
 *   - .pressed("Space"): true only on the first frame the key went down
 *   - .down("Space"):    true every frame the key is held
 *   - .axis():           normalised x/y from WASD, arrow keys, or virtual joystick
 *
 * The user passes `endFrame()` once per frame; the engine does this automatically.
 */
export class InputManager {
  readonly state: InputState = {
    pointerX: 0,
    pointerY: 0,
    pointerDown: false,
    keys: new Set(),
    axis: { x: 0, y: 0 },
    isTouch: false,
  };

  private justPressed = new Set<string>();
  private justReleased = new Set<string>();
  private bindings = new Map<string, string[]>();
  private joystick?: VirtualJoystick;
  private attached = false;

  // Bound listeners so we can remove them later.
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (this.options.preventDefaultKeys ?? true) this.preventGameKeyDefaults(e);
    if (!this.state.keys.has(e.code)) this.justPressed.add(e.code);
    this.state.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (this.options.preventDefaultKeys ?? true) this.preventGameKeyDefaults(e);
    this.state.keys.delete(e.code);
    this.justReleased.add(e.code);
  };
  private readonly onPointerDown = (e: PointerEvent) => {
    this.state.pointerDown = true;
    this.state.isTouch = e.pointerType === 'touch';
    this.updatePointer(e);
  };
  private readonly onPointerUp = () => {
    this.state.pointerDown = false;
  };
  private readonly onPointerMove = (e: PointerEvent) => this.updatePointer(e);
  private readonly onContextMenu = (e: MouseEvent) => e.preventDefault();
  private readonly onBlur = () => this.clear();

  constructor(private readonly target: HTMLElement, private readonly options: InputManagerOptions = {}) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('pointermove', this.onPointerMove);
    this.target.addEventListener('contextmenu', this.onContextMenu);

    if (this.options.virtualJoystick) {
      this.joystick = new VirtualJoystick(this.target);
      this.joystick.attach();
    }
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
    this.joystick?.detach();
  }

  /** Synthesised x/y axis: virtual joystick wins, then WASD, then arrows. */
  axis(): { x: number; y: number } {
    if (this.joystick && this.joystick.active) {
      const value = this.joystick.value();
      this.state.axis.x = value.x;
      this.state.axis.y = value.y;
      return this.state.axis;
    }
    let x = 0;
    let y = 0;
    if (this.state.keys.has('KeyA') || this.state.keys.has('ArrowLeft')) x -= 1;
    if (this.state.keys.has('KeyD') || this.state.keys.has('ArrowRight')) x += 1;
    if (this.state.keys.has('KeyW') || this.state.keys.has('ArrowUp')) y -= 1;
    if (this.state.keys.has('KeyS') || this.state.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    this.state.axis.x = x;
    this.state.axis.y = y;
    return this.state.axis;
  }

  pressed(code: string): boolean {
    return this.justPressed.has(normalizeKeyCode(code));
  }
  released(code: string): boolean {
    return this.justReleased.has(normalizeKeyCode(code));
  }
  down(code: string): boolean {
    return this.state.keys.has(normalizeKeyCode(code));
  }

  configureBindings(bindings: Record<string, string[]> = {}): void {
    this.bindings.clear();
    for (const [action, codes] of Object.entries(bindings)) {
      this.bindings.set(
        action,
        codes.map((code) => normalizeKeyCode(code)),
      );
    }
  }

  actionPressed(action: string): boolean {
    return this.codesForAction(action).some((code) => this.pressed(code));
  }

  actionReleased(action: string): boolean {
    return this.codesForAction(action).some((code) => this.released(code));
  }

  actionDown(action: string): boolean {
    return this.codesForAction(action).some((code) => this.down(code));
  }

  /** Engine calls this after each frame's systems have run, to clear edge-triggered sets. */
  endFrame(): void {
    if (this.justPressed.size) this.justPressed.clear();
    if (this.justReleased.size) this.justReleased.clear();
  }

  clear(): void {
    this.state.keys.clear();
    this.justPressed.clear();
    this.justReleased.clear();
    this.state.pointerDown = false;
    this.state.axis.x = 0;
    this.state.axis.y = 0;
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.target.getBoundingClientRect();
    this.state.pointerX = e.clientX - rect.left;
    this.state.pointerY = e.clientY - rect.top;
  }

  private preventGameKeyDefaults(e: KeyboardEvent): void {
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
  }

  private codesForAction(action: string): string[] {
    return this.bindings.get(action) ?? [normalizeKeyCode(action)];
  }
}

function normalizeKeyCode(code: string): string {
  const text = code.trim();
  const lower = text.toLowerCase();
  if (lower === 'space' || lower === 'spacebar') return 'Space';
  if (lower === 'left') return 'ArrowLeft';
  if (lower === 'right') return 'ArrowRight';
  if (lower === 'up') return 'ArrowUp';
  if (lower === 'down') return 'ArrowDown';
  if (/^[a-z]$/i.test(text)) return `Key${text.toUpperCase()}`;
  return text;
}
