import type { ISystem, SystemContext, Vec3 } from '../core/types';
import { RigidBodyComponent } from '../components/RigidBody';
import { MovingPlatformComponent } from '../components/MovingPlatform';

/**
 * Advances kinematic bodies tagged with MovingPlatformComponent each frame.
 * Publishes the per-frame delta into PhysicsWorld so the character controller
 * can inherit the platform's velocity when the player is grounded on it.
 *
 * Priority 5 (runs before PhysicsSyncSystem at 10) so platform deltas are
 * already published by the time downstream systems read them.
 */
export class MovingPlatformSystem implements ISystem {
  readonly name = 'MovingPlatformSystem';
  enabled = true;
  priority = 5;

  update({ world, engine, deltaTime }: SystemContext): void {
    const physics = engine.physics;
    if (!physics?.isReady()) return;
    if (deltaTime <= 0) return;

    for (const { id, components } of world.query(MovingPlatformComponent, RigidBodyComponent)) {
      const platform = components[0] as MovingPlatformComponent;
      const rb = (components[1] as RigidBodyComponent).body;
      if (!rb.isKinematic()) continue;

      const current = rb.translation();
      const target = computeTarget(platform, current, deltaTime);
      const delta: Vec3 = {
        x: target.x - current.x,
        y: target.y - current.y,
        z: target.z - current.z,
      };
      platform.lastFrameDelta = delta;
      rb.setNextKinematicTranslation(target);
      physics.registerPlatformDelta(id, delta);
    }
  }
}

function computeTarget(platform: MovingPlatformComponent, current: Vec3, dt: number): Vec3 {
  if (platform.config.kind === 'velocity') {
    return {
      x: current.x + platform.config.velocity.x * dt,
      y: current.y + platform.config.velocity.y * dt,
      z: current.z + platform.config.velocity.z * dt,
    };
  }

  const path = platform.config;
  if (platform.pathComplete || path.waypoints.length === 0) return current;
  if (path.waypoints.length === 1) return path.waypoints[0];

  let remainingStep = path.speed * dt;
  let position: Vec3 = current;

  while (remainingStep > 0) {
    const target = path.waypoints[clampIndex(platform.pathIndex, path.waypoints.length)];
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dy, dz);

    if (distance <= remainingStep) {
      position = target;
      remainingStep -= distance;
      advanceWaypoint(platform, path);
      if (platform.pathComplete) break;
    } else {
      const ratio = remainingStep / distance;
      position = {
        x: position.x + dx * ratio,
        y: position.y + dy * ratio,
        z: position.z + dz * ratio,
      };
      remainingStep = 0;
    }
  }

  return position;
}

function advanceWaypoint(platform: MovingPlatformComponent, path: { waypoints: readonly Vec3[]; mode: 'loop' | 'pingpong' | 'once' }): void {
  const count = path.waypoints.length;
  if (path.mode === 'loop') {
    platform.pathIndex = (platform.pathIndex + 1) % count;
    return;
  }
  if (path.mode === 'pingpong') {
    let next = platform.pathIndex + platform.pathDirection;
    if (next >= count) {
      platform.pathDirection = -1;
      next = count - 2;
    } else if (next < 0) {
      platform.pathDirection = 1;
      next = 1;
    }
    platform.pathIndex = next;
    return;
  }
  // once
  if (platform.pathIndex >= count - 1) {
    platform.pathComplete = true;
    return;
  }
  platform.pathIndex += 1;
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}
