import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/types';
import { Colliders } from './Colliders';
import { canCollisionGroupsInteract } from './CollisionLayers';
import type { PhysicsWorld } from './PhysicsWorld';

/*
 * Internal fixtures adapted from selected Rapier Apache-2.0 examples.
 * See third_party/rapier/NOTICE for source attribution.
 *
 * These helpers are not exported from GAME_ENGINE's public API. They exist to
 * keep Rapier-derived behavior tests close to the LOOMIER physics wrappers.
 */

export const RAPIER_EXAMPLE_ENTITY_IDS = Object.freeze({
  player: 1001,
  ground: 1002,
  slope: 1003,
  steepSlope: 1004,
  wall: 1005,
  step: 1006,
  movingPlatform: 1007,
  sensorCarrier: 1008,
  sensorTarget: 1009,
});

// Radians, matching the upstream Rapier 3D character-controller example angles.
export const RAPIER_EXAMPLE_3D_CLIMBABLE_SLOPE_ANGLE = 0.2;
export const RAPIER_EXAMPLE_3D_STEEP_SLOPE_ANGLE = 0.6;
export const RAPIER_EXAMPLE_SLOPE_MARGIN = 0.02;

export interface RapierExampleBodyFixture {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export interface RapierExampleSensorFixture {
  carrier: RAPIER.RigidBody;
  solidCollider: RAPIER.Collider;
  sensorCollider: RAPIER.Collider;
  target: RapierExampleBodyFixture;
}

export interface RapierRayFanResult {
  hitCount: number;
  missCount: number;
  hits: Array<RAPIER.RayColliderHit | RAPIER.RayColliderIntersection | null>;
}

export function createRapierExamplePlayer(
  physics: PhysicsWorld,
  position: Vec3 = { x: 0, y: 0.45, z: 0 },
): RapierExampleBodyFixture {
  const player = Colliders.capsule(
    physics,
    0.3,
    0.15,
    { type: 'kinematic', position, ccd: true },
    { layer: 'player' },
  );
  physics.registerEntityBody(RAPIER_EXAMPLE_ENTITY_IDS.player, player.body, player.collider, {
    key: 'rapier-example-player',
    role: 'player',
    tags: ['player', 'rapier-example'],
  });
  return player;
}

export function createRapierExampleGround(physics: PhysicsWorld): RapierExampleBodyFixture {
  const ground = Colliders.ground(physics, { x: 6, y: 0.1, z: 6 }, { x: 0, y: -0.1, z: 0 });
  physics.registerEntityBody(RAPIER_EXAMPLE_ENTITY_IDS.ground, ground.body, ground.collider, {
    key: 'rapier-example-ground',
    role: 'world',
    tags: ['ground', 'rapier-example'],
  });
  return ground;
}

export function createRapierExampleSlopeCourse(physics: PhysicsWorld): {
  slope: RapierExampleBodyFixture;
  steepSlope: RapierExampleBodyFixture;
} {
  const slope = createFixedCuboid(
    physics,
    { x: 1.5, y: 0.2, z: 0 },
    { x: 2, y: 0.1, z: 1.5 },
    RAPIER_EXAMPLE_ENTITY_IDS.slope,
    'rapier-example-slope',
    RAPIER_EXAMPLE_3D_CLIMBABLE_SLOPE_ANGLE,
  );
  const steepSlope = createFixedCuboid(
    physics,
    { x: 4.5, y: 0.8, z: 0 },
    { x: 2, y: 0.1, z: 1.5 },
    RAPIER_EXAMPLE_ENTITY_IDS.steepSlope,
    'rapier-example-steep-slope',
    RAPIER_EXAMPLE_3D_STEEP_SLOPE_ANGLE,
  );
  return { slope, steepSlope };
}

export function createRapierExampleWall(physics: PhysicsWorld): RapierExampleBodyFixture {
  return createFixedCuboid(
    physics,
    { x: 0.9, y: 0.5, z: 0 },
    { x: 0.08, y: 0.5, z: 1 },
    RAPIER_EXAMPLE_ENTITY_IDS.wall,
    'rapier-example-wall',
  );
}

export function createRapierExampleSmallStep(physics: PhysicsWorld): RapierExampleBodyFixture {
  return createFixedCuboid(
    physics,
    { x: 0.55, y: 0.1, z: 0 },
    { x: 0.08, y: 0.1, z: 0.6 },
    RAPIER_EXAMPLE_ENTITY_IDS.step,
    'rapier-example-step',
  );
}

export function createRapierExampleMovingPlatform(physics: PhysicsWorld): RapierExampleBodyFixture {
  assertPhysicsReady(physics);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(-1.5, 0.05, 0),
  );
  const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.1, 1), body);
  physics.registerEntityBody(RAPIER_EXAMPLE_ENTITY_IDS.movingPlatform, body, collider, {
    key: 'rapier-example-moving-platform',
    role: 'world',
    tags: ['platform', 'moving-platform', 'rapier-example'],
  });
  return { body, collider };
}

export function advanceRapierExampleMovingPlatform(
  platform: RapierExampleBodyFixture,
  timeSeconds: number,
): Vec3 {
  const velocity = {
    x: Math.sin(timeSeconds * 2) * 2,
    y: Math.sin(timeSeconds * 5) * 0.4,
    z: 0,
  };
  platform.body.setLinvel(velocity, true);
  return velocity;
}

export function createRapierExampleSensorCarrier(physics: PhysicsWorld): RapierExampleSensorFixture {
  assertPhysicsReady(physics);
  const carrier = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.5, 0));
  const solidCollider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2), carrier);
  const sensorCollider = physics.world.createCollider(
    RAPIER.ColliderDesc.ball(1)
      .setDensity(0)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    carrier,
  );
  physics.registerEntityBody(
    RAPIER_EXAMPLE_ENTITY_IDS.sensorCarrier,
    carrier,
    [solidCollider, sensorCollider],
    { key: 'rapier-example-sensor-carrier', role: 'trigger', tags: ['sensor', 'rapier-example'] },
  );

  const target = Colliders.ball(
    physics,
    0.2,
    { type: 'static', position: { x: 0.8, y: 0.5, z: 0 } },
    { layer: 'enemy' },
  );
  physics.registerEntityBody(RAPIER_EXAMPLE_ENTITY_IDS.sensorTarget, target.body, target.collider, {
    key: 'rapier-example-sensor-target',
    role: 'enemy',
    tags: ['enemy', 'rapier-example'],
  });

  return { carrier, solidCollider, sensorCollider, target };
}

export function createRapierExampleLayerPair(physics: PhysicsWorld): {
  player: RapierExampleBodyFixture;
  world: RapierExampleBodyFixture;
  enemyFilteredOut: RapierExampleBodyFixture;
} {
  const player = Colliders.ball(
    physics,
    0.3,
    { position: { x: 0, y: 0.3, z: 0 } },
    { layer: 'player', collidesWith: ['world'] },
  );
  const world = Colliders.ball(
    physics,
    0.3,
    { type: 'static', position: { x: 0, y: 0.3, z: 0 } },
    { layer: 'world' },
  );
  const enemyFilteredOut = Colliders.ball(
    physics,
    0.3,
    { type: 'static', position: { x: 0, y: 0.3, z: 0 } },
    { layer: 'enemy' },
  );

  return { player, world, enemyFilteredOut };
}

export function rapierExampleLayerGroupsInteract(a: RAPIER.Collider, b: RAPIER.Collider): boolean {
  return canCollisionGroupsInteract(a.collisionGroups(), b.collisionGroups());
}

export function castRapierExampleRayFan(physics: PhysicsWorld): RapierRayFanResult {
  const origin = { x: 0, y: 2, z: 0 };
  const directions: Vec3[] = [
    { x: 0, y: -1, z: 0 },
    normalizeVector({ x: 1, y: -1, z: 0 }),
    normalizeVector({ x: -1, y: -1, z: 0 }),
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];
  const hits = directions.map((direction) => physics.castRay({
    origin,
    direction,
    maxToi: 5,
    includeNormal: true,
  }));
  return {
    hits,
    hitCount: hits.filter(Boolean).length,
    missCount: hits.filter((hit) => !hit).length,
  };
}

function createFixedCuboid(
  physics: PhysicsWorld,
  position: Vec3,
  halfExtents: Vec3,
  entityId: number,
  key: string,
  rotationZ = 0,
): RapierExampleBodyFixture {
  assertPhysicsReady(physics);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: 0, y: 0, z: Math.sin(rotationZ / 2), w: Math.cos(rotationZ / 2) }),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
    body,
  );
  physics.registerEntityBody(entityId, body, collider, {
    key,
    role: 'world',
    tags: ['world', 'rapier-example'],
  });
  return { body, collider };
}

function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function assertPhysicsReady(physics: PhysicsWorld): void {
  if (!physics.isReady()) throw new Error('PhysicsWorld must be initialised before creating Rapier example fixtures.');
}
