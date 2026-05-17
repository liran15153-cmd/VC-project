import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import {
  DEFAULT_COLLISION_FILTERS,
  canCollisionGroupsInteract,
  collisionGroupsForLayer,
  defaultCollisionLayersInteract,
  toRapierCollisionGroups,
} from '../src/physics/CollisionLayers';
import { PhysicsWorld, type PhysicsInteractionEvent } from '../src/physics/PhysicsWorld';
import { resolvePhysicsRole } from '../src/physics/PhysicsRoles';

describe('Physics Core events', () => {
  it('derives player/enemy collision enter, stay, and exit', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      const enemy = createBall(physics, 2, 'enemy', { x: 0.4, y: 0.5, z: 0 }, 'enemy');

      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('collisionEnter');
      expect(physics.getActiveCollisionPairs()).toHaveLength(1);

      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('collisionStay');

      enemy.body.setTranslation({ x: 5, y: 0.5, z: 0 }, true);
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('collisionExit');
      expect(physics.getActiveCollisionPairs()).toHaveLength(0);
    } finally {
      physics.destroy();
    }
  });

  it('derives player/collectible sensor enter and exit', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      const collectible = createBall(physics, 2, 'collectible', { x: 0.3, y: 0.5, z: 0 }, 'collectible');

      step(physics);
      const enter = drainEvents(physics).find((event) => event.type === 'sensorEnter');
      expect(enter?.roleA === 'collectible' || enter?.roleB === 'collectible').toBe(true);
      expect(physics.getActiveSensorPairs()).toHaveLength(1);

      collectible.body.setTranslation({ x: 5, y: 0.5, z: 0 }, true);
      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('sensorExit');
      expect(physics.getActiveSensorPairs()).toHaveLength(0);
    } finally {
      physics.destroy();
    }
  });

  it('derives player/trigger sensor enter and exit', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      const trigger = createBall(physics, 2, 'trigger-zone', { x: 0.3, y: 0.5, z: 0 }, 'trigger');

      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('sensorEnter');

      trigger.body.setTranslation({ x: 4, y: 0.5, z: 0 }, true);
      step(physics);
      expect(eventTypes(drainEvents(physics))).toContain('sensorExit');
    } finally {
      physics.destroy();
    }
  });

  it('tracks projectile/enemy collision', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'projectile', { x: 0, y: 0.5, z: 0 }, 'projectile');
      createBall(physics, 2, 'enemy', { x: 0.35, y: 0.5, z: 0 }, 'enemy');

      step(physics);
      const event = drainEvents(physics).find((candidate) => candidate.type === 'collisionEnter');

      expect(event).toBeTruthy();
      expect([event?.roleA, event?.roleB]).toEqual(expect.arrayContaining(['projectile', 'enemy']));
    } finally {
      physics.destroy();
    }
  });
});

describe('Physics Core roles and collision matrix', () => {
  it('resolves physics roles from metadata, tags, data, key/name fallback, and unknown fallback', () => {
    expect(resolvePhysicsRole({ role: 'hazard', key: 'enemy-looking-spike' })).toBe('hazard');
    expect(resolvePhysicsRole({ tags: ['collectible'] })).toBe('collectible');
    expect(resolvePhysicsRole({ data: { physicsRole: 'goal' } })).toBe('goal');
    expect(resolvePhysicsRole({ key: 'moving-platform' })).toBe('platform');
    expect(resolvePhysicsRole({ colliderSensor: true })).toBe('trigger');
    expect(resolvePhysicsRole({ bodyType: 'static' })).toBe('world');
    expect(resolvePhysicsRole({ key: 'decorative-cloud' })).toBe('unknown');
  });

  it('formalizes default allowed and blocked collision pairs', () => {
    for (const [layer, filter] of Object.entries(DEFAULT_COLLISION_FILTERS)) {
      if (layer === 'sensor') continue;
      for (const target of filter) {
        if (target === 'sensor') continue;
        expect(defaultCollisionLayersInteract(layer as keyof typeof DEFAULT_COLLISION_FILTERS, target)).toBe(true);
        expect(canCollisionGroupsInteract(
          collisionGroupsForLayer(layer as keyof typeof DEFAULT_COLLISION_FILTERS),
          collisionGroupsForLayer(target),
        )).toBe(true);
      }
    }

    expect(defaultCollisionLayersInteract('player', 'projectile')).toBe(false);
    expect(canCollisionGroupsInteract(collisionGroupsForLayer('player'), collisionGroupsForLayer('projectile'))).toBe(false);
  });

  it('diagnoses expected matrix pairs blocked by custom groups', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = Colliders.ball(
        physics,
        0.5,
        { position: { x: 0, y: 0.5, z: 0 } },
        { collisionGroups: { memberships: ['player'], filter: [] } },
      );
      const world = Colliders.ground(physics, { x: 1, y: 0.1, z: 1 }, { x: 0, y: 0, z: 0 });
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player', tags: ['player'] });
      physics.registerEntityBody(2, world.body, world.collider, { key: 'ground', role: 'world', tags: ['ground'] });

      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);

      expect(codes).toContain('COLLISION_MATRIX_BLOCKED_EXPECTED_PAIR');
    } finally {
      physics.destroy();
    }
  });
});

describe('Physics Core query helpers', () => {
  it('reports grounded state and ground hit details', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.55, z: 0 }, 'player');
      createGround(physics);
      step(physics);

      const hit = physics.getGroundHit(1);

      expect(physics.isGrounded(1)).toBe(true);
      expect(hit?.entityId).toBe(10);
      expect(hit?.role).toBe('world');
      expect(hit?.timeOfImpact).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('raycasts from an entity and returns LOOMIER-level hit data', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      createBall(physics, 2, 'enemy', { x: 2, y: 0.5, z: 0 }, 'enemy');
      step(physics);

      const hit = physics.raycastFromEntity(1, { x: 1, y: 0, z: 0 }, { maxToi: 5 });

      expect(hit?.entityId).toBe(2);
      expect(hit?.role).toBe('enemy');
      expect(hit?.colliderHandle).toBeTypeOf('number');
    } finally {
      physics.destroy();
    }
  });

  it('finds registered entities in a radius', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      createBall(physics, 2, 'enemy', { x: 1, y: 0.5, z: 0 }, 'enemy');
      createBall(physics, 3, 'far-enemy', { x: 5, y: 0.5, z: 0 }, 'enemy');
      step(physics);

      const hits = physics.findEntitiesInRadius({ x: 0, y: 0.5, z: 0 }, 2, { roles: ['enemy'] });

      expect(hits.map((hit) => hit.entityId)).toEqual([2]);
    } finally {
      physics.destroy();
    }
  });

  it('detects clear and blocked line of sight', async () => {
    const physics = await createPhysicsWorld();
    try {
      createBall(physics, 1, 'player', { x: 0, y: 0.5, z: 0 }, 'player');
      createBall(physics, 2, 'enemy', { x: 4, y: 0.5, z: 0 }, 'enemy');
      step(physics);

      expect(physics.lineOfSight(1, 2).clear).toBe(true);

      const wall = Colliders.cuboid(
        physics,
        { x: 0.2, y: 1, z: 1 },
        { type: 'static', position: { x: 2, y: 0.5, z: 0 } },
        { layer: 'world' },
      );
      physics.registerEntityBody(3, wall.body, wall.collider, { key: 'wall', role: 'world', tags: ['wall'] });
      step(physics);

      const blocked = physics.lineOfSight(1, 2);

      expect(blocked.clear).toBe(false);
      expect(blocked.blockedByEntityId).toBe(3);
    } finally {
      physics.destroy();
    }
  });
});

describe('Physics Core diagnostics', () => {
  it('reports invalid physics setups with stable diagnostic codes', async () => {
    const physics = await createPhysicsWorld();
    try {
      const orphanEnemy = createBall(physics, 2, 'enemy', { x: 0.4, y: 0.5, z: 0 }, 'enemy');
      createBall(physics, 1, 'player', { x: 0, y: 5, z: 0 }, 'player');
      const unknown = Colliders.ball(physics, 0.3, { type: 'static', position: { x: 4, y: 0, z: 0 } });
      physics.registerEntityBody(3, unknown.body, unknown.collider, { key: 'mystery' });
      const dynamicWorld = Colliders.ball(physics, 0.3, { position: { x: 6, y: 0, z: 0 } }, { layer: 'world' });
      physics.registerEntityBody(4, dynamicWorld.body, dynamicWorld.collider, { key: 'bad-world', role: 'world' });
      const enemySensor = Colliders.ball(physics, 0.3, { type: 'static', position: { x: 8, y: 0, z: 0 } }, { layer: 'enemy', sensor: true });
      physics.registerEntityBody(5, enemySensor.body, enemySensor.collider, { key: 'sensor-enemy', role: 'enemy' });
      const projectileBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
      physics.registerEntityBody(6, projectileBody, undefined, { key: 'projectile', role: 'projectile' });

      // Create then orphan an active pair by unregistering one side before the next tracking pass.
      orphanEnemy.body.setTranslation({ x: 0.2, y: 5, z: 0 }, true);
      step(physics);
      drainEvents(physics);
      physics.unregisterEntityBody(2);
      step(physics);

      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);

      expect(codes).toContain('PHYSICS_EVENT_PAIR_ORPHANED');
      expect(codes).toContain('ENTITY_HAS_COLLIDER_NO_ROLE');
      expect(codes).toContain('PLAYER_NOT_GROUNDED');
      expect(codes).toContain('WORLD_HAS_NO_STATIC_COLLIDER');
      expect(codes).toContain('SENSOR_WITH_SOLID_COLLISION_ROLE');
      expect(codes).toContain('PROJECTILE_HAS_NO_COLLIDER');
    } finally {
      physics.destroy();
    }
  });
});

async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const physics = new PhysicsWorld({ x: 0, y: -9.81, z: 0 });
  await physics.init();
  return physics;
}

function createBall(
  physics: PhysicsWorld,
  entityId: number,
  key: string,
  position: { x: number; y: number; z: number },
  role: 'player' | 'enemy' | 'collectible' | 'trigger' | 'projectile',
) {
  const created = Colliders.ball(physics, 0.5, { position, linearDamping: 1 }, { layer: role });
  physics.registerEntityBody(entityId, created.body, created.collider, { key, role, tags: [role] });
  return created;
}

function createGround(physics: PhysicsWorld) {
  const ground = Colliders.ground(physics, { x: 10, y: 0.1, z: 10 }, { x: 0, y: -0.1, z: 0 });
  physics.registerEntityBody(10, ground.body, ground.collider, { key: 'ground', role: 'world', tags: ['ground'] });
  return ground;
}

function step(physics: PhysicsWorld, count = 1): void {
  for (let i = 0; i < count; i += 1) physics.step(1 / 60);
}

function drainEvents(physics: PhysicsWorld): PhysicsInteractionEvent[] {
  const events: PhysicsInteractionEvent[] = [];
  physics.drainPhysicsEvents((event) => events.push(event), { includeStay: true });
  return events;
}

function eventTypes(events: readonly PhysicsInteractionEvent[]): string[] {
  return events.map((event) => event.type);
}
