import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from './PhysicsWorld';
import type { Vec3 } from '../core/types';

export type BodyType = 'dynamic' | 'static' | 'kinematic';

export interface BodyOptions {
  type?: BodyType;
  position?: Vec3;
  linearDamping?: number;
  angularDamping?: number;
  ccd?: boolean;
}

export interface ColliderOptions {
  density?: number;
  friction?: number;
  restitution?: number;
  sensor?: boolean;
}

function bodyDesc(type: BodyType): RAPIER.RigidBodyDesc {
  switch (type) {
    case 'static':
      return RAPIER.RigidBodyDesc.fixed();
    case 'kinematic':
      return RAPIER.RigidBodyDesc.kinematicPositionBased();
    case 'dynamic':
    default:
      return RAPIER.RigidBodyDesc.dynamic();
  }
}

function applyBodyOpts(desc: RAPIER.RigidBodyDesc, opts: BodyOptions): RAPIER.RigidBodyDesc {
  const p = opts.position ?? { x: 0, y: 0, z: 0 };
  desc.setTranslation(p.x, p.y, p.z);
  if (opts.linearDamping !== undefined) desc.setLinearDamping(opts.linearDamping);
  if (opts.angularDamping !== undefined) desc.setAngularDamping(opts.angularDamping);
  if (opts.ccd) desc.setCcdEnabled(true);
  return desc;
}

function applyColliderOpts(desc: RAPIER.ColliderDesc, opts: ColliderOptions): RAPIER.ColliderDesc {
  desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  if (opts.density !== undefined) desc.setDensity(opts.density);
  if (opts.friction !== undefined) desc.setFriction(opts.friction);
  if (opts.restitution !== undefined) desc.setRestitution(opts.restitution);
  if (opts.sensor) desc.setSensor(true);
  return desc;
}

export const Colliders = {
  cuboid(physics: PhysicsWorld, half: Vec3, body: BodyOptions = {}, col: ColliderOptions = {}) {
    assertPhysicsReady(physics);
    const rb = physics.world.createRigidBody(applyBodyOpts(bodyDesc(body.type ?? 'dynamic'), body));
    const cd = applyColliderOpts(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), col);
    const collider = physics.world.createCollider(cd, rb);
    return { body: rb, collider };
  },

  ball(physics: PhysicsWorld, radius: number, body: BodyOptions = {}, col: ColliderOptions = {}) {
    assertPhysicsReady(physics);
    const rb = physics.world.createRigidBody(applyBodyOpts(bodyDesc(body.type ?? 'dynamic'), body));
    const cd = applyColliderOpts(RAPIER.ColliderDesc.ball(radius), col);
    const collider = physics.world.createCollider(cd, rb);
    return { body: rb, collider };
  },

  capsule(physics: PhysicsWorld, halfHeight: number, radius: number, body: BodyOptions = {}, col: ColliderOptions = {}) {
    assertPhysicsReady(physics);
    const rb = physics.world.createRigidBody(applyBodyOpts(bodyDesc(body.type ?? 'dynamic'), body));
    const cd = applyColliderOpts(RAPIER.ColliderDesc.capsule(halfHeight, radius), col);
    const collider = physics.world.createCollider(cd, rb);
    return { body: rb, collider };
  },

  ground(physics: PhysicsWorld, halfExtents: Vec3 = { x: 50, y: 0.1, z: 50 }, position: Vec3 = { x: 0, y: 0, z: 0 }) {
    return Colliders.cuboid(physics, halfExtents, { type: 'static', position }, { friction: 0.9 });
  },
};

function assertPhysicsReady(physics: PhysicsWorld): void {
  if (!physics.isReady()) throw new Error('PhysicsWorld must be initialised before creating colliders.');
}
