import type { EntityId, Vec3 } from '../core/types';
import type { PhysicsWorld } from './PhysicsWorld';

export interface KnockbackOptions {
  /** Magnitude of the knockback impulse along the direction. */
  power?: number;
  /** Optional upward bias applied on top of the planar direction. */
  upwardBias?: number;
  /** Reset linear velocity before applying the knockback impulse. */
  clearVelocity?: boolean;
}

/**
 * Thin wrappers over Rapier rigid-body force/velocity APIs that:
 *  - guard against non-dynamic bodies (kinematic + static can't accept forces),
 *  - emit a typed diagnostic (`BODY_NOT_DYNAMIC_FOR_FORCE`) on misuse,
 *  - keep raw Rapier objects off the LOOMIER callers / `GameDefinition` surface.
 */
export const PhysicsDynamics = {
  applyImpulse(physics: PhysicsWorld, entityId: EntityId, impulse: Vec3): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic()) {
      recordNotDynamic(physics, entityId, 'applyImpulse');
      return false;
    }
    body.applyImpulse(impulse, true);
    return true;
  },

  applyForce(physics: PhysicsWorld, entityId: EntityId, force: Vec3): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic()) {
      recordNotDynamic(physics, entityId, 'applyForce');
      return false;
    }
    body.addForce(force, true);
    return true;
  },

  applyTorque(physics: PhysicsWorld, entityId: EntityId, torque: Vec3): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic()) {
      recordNotDynamic(physics, entityId, 'applyTorque');
      return false;
    }
    body.addTorque(torque, true);
    return true;
  },

  setLinearVelocity(physics: PhysicsWorld, entityId: EntityId, velocity: Vec3): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic() && !body.isKinematic()) {
      recordNotDynamic(physics, entityId, 'setLinearVelocity');
      return false;
    }
    body.setLinvel(velocity, true);
    return true;
  },

  setLinearVelocityAxis(
    physics: PhysicsWorld,
    entityId: EntityId,
    axis: 'x' | 'y' | 'z',
    value: number,
  ): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic() && !body.isKinematic()) {
      recordNotDynamic(physics, entityId, 'setLinearVelocityAxis');
      return false;
    }
    const current = body.linvel();
    body.setLinvel(
      {
        x: axis === 'x' ? value : current.x,
        y: axis === 'y' ? value : current.y,
        z: axis === 'z' ? value : current.z,
      },
      true,
    );
    return true;
  },

  setAngularVelocity(physics: PhysicsWorld, entityId: EntityId, velocity: Vec3): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic() && !body.isKinematic()) {
      recordNotDynamic(physics, entityId, 'setAngularVelocity');
      return false;
    }
    body.setAngvel(velocity, true);
    return true;
  },

  addKnockback(physics: PhysicsWorld, entityId: EntityId, direction: Vec3, opts: KnockbackOptions = {}): boolean {
    const body = physics.getBodyByEntityId(entityId);
    if (!body) return false;
    if (!body.isDynamic()) {
      recordNotDynamic(physics, entityId, 'addKnockback');
      return false;
    }
    const power = opts.power ?? 1;
    const upwardBias = opts.upwardBias ?? 0;
    const planar = normalizeVec3(direction);
    const impulse = {
      x: planar.x * power,
      y: planar.y * power + upwardBias,
      z: planar.z * power,
    };
    if (opts.clearVelocity) body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.applyImpulse(impulse, true);
    return true;
  },
};

function recordNotDynamic(physics: PhysicsWorld, entityId: EntityId, op: string): void {
  physics.recordTransientIssue({
    code: 'BODY_NOT_DYNAMIC_FOR_FORCE',
    severity: 'warning',
    entityId,
    message: `${op} ignored: entity ${entityId} is not a dynamic rigid body.`,
  });
}

function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
