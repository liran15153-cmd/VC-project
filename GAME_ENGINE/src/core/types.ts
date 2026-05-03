/**
 * Core Type Definitions for the ECS architecture and Engine.
 */

export type EntityId = number;

export interface Component {
  readonly type: string;
}

export interface ComponentClass<T extends Component = Component> {
  readonly type: string;
  readonly prototype: T;
}

export interface SystemContext {
  readonly world: import('./World').World;
  readonly engine: import('./Engine').Engine;
  readonly deltaTime: number;
  readonly elapsed: number;
}

export type ComponentsOf<T extends readonly ComponentClass[]> = {
  [K in keyof T]: T[K] extends ComponentClass<infer C> ? C : never;
};

export interface ISystem {
  readonly name: string;
  enabled: boolean;
  priority: number;
  init?(ctx: SystemContext): void | Promise<void>;
  update?(ctx: SystemContext): void;
  destroy?(): void;
}

export interface EngineConfig {
  container: HTMLElement | string;
  width?: number;
  height?: number;
  enable3D?: boolean;
  enable2D?: boolean;
  enablePhysics?: boolean;
  gravity?: { x: number; y: number; z: number };
  pixelRatio?: number;
  antialias?: boolean;
  fixedTimeStep?: number;
  maxSubSteps?: number;
  maxDeltaTime?: number;
  timeScale?: number;
  maxPixelRatio?: number;
  pauseWhenHidden?: boolean;
  fatalOnSystemError?: boolean;
  virtualJoystick?: boolean;
  background?: number | string | null;
}

export type ResolvedEngineConfig = Required<EngineConfig>;

export interface EngineFrameInfo {
  readonly frame: number;
  readonly deltaTime: number;
  readonly rawDeltaTime: number;
  readonly elapsed: number;
  readonly fixedSteps: number;
}

export type EngineErrorPhase = 'init' | 'physics' | 'systems' | 'render' | 'scene' | 'destroy';

export interface EngineEvents {
  init: { engine: import('./Engine').Engine };
  start: { engine: import('./Engine').Engine };
  stop: { engine: import('./Engine').Engine };
  pause: { engine: import('./Engine').Engine };
  resume: { engine: import('./Engine').Engine };
  destroy: { engine: import('./Engine').Engine };
  resize: { width: number; height: number; orientation: 'portrait' | 'landscape' };
  'scene:before-switch': { from: string | null; to: string };
  'scene:after-switch': { from: string | null; to: string };
  'frame:before': EngineFrameInfo;
  'frame:after-physics': EngineFrameInfo;
  'frame:after-systems': EngineFrameInfo;
  'frame:after-render': EngineFrameInfo;
  'state:change': import('./GameStateStore').GameStateChange;
  'game:event': { name: string; payload?: Record<string, unknown> };
  'game:collision': {
    entityA: EntityId;
    entityB: EntityId;
    keyA?: string;
    keyB?: string;
    tagsA: string[];
    tagsB: string[];
    started: boolean;
  };
  error: {
    error: unknown;
    phase: EngineErrorPhase;
    sceneKey: string | null;
    engine: import('./Engine').Engine;
  };
}

export interface InputState {
  pointerX: number;
  pointerY: number;
  pointerDown: boolean;
  keys: Set<string>;
  axis: { x: number; y: number };
  isTouch: boolean;
}

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };
