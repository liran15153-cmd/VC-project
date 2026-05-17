import type { Component, Vec3 } from '../core/types';

export type MovingPlatformMode = 'loop' | 'pingpong' | 'once';

export interface MovingPlatformPathConfig {
  kind: 'path';
  waypoints: readonly Vec3[];
  speed: number;
  mode: MovingPlatformMode;
}

export interface MovingPlatformVelocityConfig {
  kind: 'velocity';
  velocity: Vec3;
}

export type MovingPlatformConfig = MovingPlatformPathConfig | MovingPlatformVelocityConfig;

/**
 * Marker component that turns a kinematic body into a moving platform.
 * The MovingPlatformSystem advances `lastFrameDelta` each tick and publishes
 * it to PhysicsWorld so the character controller can inherit ride velocity.
 */
export class MovingPlatformComponent implements Component {
  static readonly type = 'MovingPlatform';
  readonly type = MovingPlatformComponent.type;
  config: MovingPlatformConfig;
  /** Translation delta applied during the last physics frame. */
  lastFrameDelta: Vec3 = { x: 0, y: 0, z: 0 };
  /** Internal cursor: which waypoint the platform is currently moving toward (path mode). */
  pathIndex = 1;
  /** Direction of traversal for pingpong (1 = forward, -1 = reverse). */
  pathDirection: 1 | -1 = 1;
  /** Set to true when a once-mode path has reached its end. */
  pathComplete = false;

  constructor(config: MovingPlatformConfig) {
    this.config = config;
  }
}
