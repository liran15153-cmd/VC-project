import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsCharacterController } from '../src/physics/PhysicsCharacterController';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('PhysicsCharacterController', () => {
  it('moves a kinematic player on flat ground', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.62, z: 0 });
      createGround(physics);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'platformer2d' });
      physics.step(1 / 60);

      const result = controller.move({ x: 1, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.grounded).toBe(true);
      expect(result.falling).toBe(false);
      expect(result.wallHit).toBe(false);
      expect(result.computed.x).toBeGreaterThan(0.5);
      expect(player.body.translation().x).toBeGreaterThan(0.5);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('does not pass through a wall', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.62, z: 0 });
      createGround(physics);
      createFixedCuboid(physics, { x: 1, y: 0.5, z: 0 }, { x: 0.1, y: 0.5, z: 1 }, 2, 'wall');
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'platformer2d' });
      physics.step(1 / 60);

      const result = controller.move({ x: 2, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.collisionCount).toBeGreaterThan(0);
      expect(result.wallHit).toBe(true);
      expect(player.body.translation().x).toBeLessThan(0.8);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('remains grounded on a simple slope', async () => {
    const physics = await createPhysicsWorld();
    try {
      createPlayer(physics, { x: -0.5, y: 0.72, z: 0 });
      createSlope(physics, -Math.PI / 12);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'simple3d' });
      physics.step(1 / 60);

      const before = controller.checkGround();
      const result = controller.move({ x: 0.25, y: -0.04, z: 0 });
      physics.step(1 / 60);
      const after = controller.checkGround();

      expect(before.grounded).toBe(true);
      expect(result.grounded).toBe(true);
      expect(result.onSlope).toBe(true);
      expect(result.slopeAngle).toBeGreaterThan(0.05);
      expect(after.grounded).toBe(true);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('steps over a small obstacle within autostep.maxHeight', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.62, z: 0 });
      createGround(physics);
      createFixedCuboid(physics, { x: 0.55, y: 0.1, z: 0 }, { x: 0.08, y: 0.1, z: 0.6 }, 3, 'step');
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'simple3d' });
      physics.step(1 / 60);

      const result = controller.move({ x: 0.85, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.computed.x).toBeGreaterThan(0.45);
      expect(player.body.translation().x).toBeGreaterThan(0.45);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('is stopped at an obstacle taller than autostep.maxHeight', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.62, z: 0 });
      createGround(physics);
      createFixedCuboid(physics, { x: 0.55, y: 0.4, z: 0 }, { x: 0.08, y: 0.4, z: 0.6 }, 3, 'wall');
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'simple3d' });
      physics.step(1 / 60);

      const result = controller.move({ x: 0.85, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.issues.length).toBe(0);
      expect(result.collisionCount).toBeGreaterThan(0);
      expect(player.body.translation().x).toBeLessThan(0.45);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('steps over a small obstacle that follows a gentle slope', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: -0.5, y: 0.72, z: 0 });
      createSlope(physics, -Math.PI / 12);
      createFixedCuboid(physics, { x: 0.55, y: 0.18, z: 0 }, { x: 0.08, y: 0.1, z: 0.6 }, 3, 'step');
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'simple3d' });
      physics.step(1 / 60);

      const result = controller.move({ x: 0.85, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.grounded).toBe(true);
      expect(result.computed.x).toBeGreaterThan(0.45);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('topdown preset constrains Y and ignores gravity', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.6, z: 0 });
      createGround(physics);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60);

      const initialY = player.body.translation().y;
      // Request a downward + lateral move — Y should be filtered out by constrainY.
      const result = controller.move({ x: 0.3, y: -0.04, z: 0.3 });
      physics.step(1 / 60);

      expect(result.computed.y).toBeCloseTo(0, 5);
      expect(player.body.translation().y).toBeCloseTo(initialY, 5);
      expect(player.body.translation().x).toBeGreaterThan(0.1);
      expect(player.body.translation().z).toBeGreaterThan(0.1);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('topdown preset stops at walls without trying to autostep', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createPlayer(physics, { x: 0, y: 0.6, z: 0 });
      createGround(physics);
      createFixedCuboid(physics, { x: 0.55, y: 0.4, z: 0 }, { x: 0.1, y: 0.4, z: 0.6 }, 3, 'wall');
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60);

      const result = controller.move({ x: 0.85, y: 0, z: 0 });
      physics.step(1 / 60);

      expect(result.collisionCount).toBeGreaterThan(0);
      expect(player.body.translation().x).toBeLessThan(0.45);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('detects a no-ground falling state', async () => {
    const physics = await createPhysicsWorld();
    try {
      createPlayer(physics, { x: 0, y: 5, z: 0 });
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'platformer2d' });
      physics.step(1 / 60);

      const ground = controller.checkGround();
      const result = controller.move({ x: 0, y: -0.04, z: 0 });
      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);

      expect(ground.grounded).toBe(false);
      expect(result.falling).toBe(true);
      expect(codes).toContain('CHARACTER_CONTROLLER_NO_GROUND');
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('keeps debugRender working in a controller scene', async () => {
    const physics = await createPhysicsWorld();
    try {
      createPlayer(physics, { x: 0, y: 0.62, z: 0 });
      createGround(physics);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'platformer2d' });
      physics.step(1 / 60);
      controller.move({ x: 0.2, y: -0.04, z: 0 });
      physics.step(1 / 60);

      const debug = physics.debugRender();

      expect(debug).not.toBeNull();
      expect(debug?.vertices.length).toBeGreaterThan(0);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('reports controller diagnostics for invalid bindings', async () => {
    const physics = await createPhysicsWorld();
    try {
      const invalid = new PhysicsCharacterController(physics, { entityId: 99, preset: 'bogus' });
      invalid.checkGround();

      const dynamic = Colliders.ball(physics, 0.5, { position: { x: 0, y: 1, z: 0 } }, { layer: 'player' });
      physics.registerEntityBody(2, dynamic.body, dynamic.collider, { key: 'dynamic-player', role: 'player' });
      const notKinematic = new PhysicsCharacterController(physics, { entityId: 2, preset: 'platformer2d' });

      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);

      expect(codes).toContain('CHARACTER_CONTROLLER_INVALID_PRESET');
      expect(codes).toContain('CHARACTER_CONTROLLER_NO_BODY');
      expect(codes).toContain('CHARACTER_CONTROLLER_NO_COLLIDER');
      expect(codes).toContain('CHARACTER_CONTROLLER_NOT_KINEMATIC');
      expect(codes).toContain('CHARACTER_CONTROLLER_NO_GROUND');
      invalid.destroy();
      notKinematic.destroy();
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

function createPlayer(physics: PhysicsWorld, position: { x: number; y: number; z: number }) {
  const player = Colliders.cuboid(
    physics,
    { x: 0.25, y: 0.5, z: 0.25 },
    { type: 'kinematic', position },
    { layer: 'player' },
  );
  physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player', tags: ['player'] });
  return player;
}

function createGround(physics: PhysicsWorld) {
  const ground = Colliders.ground(physics, { x: 10, y: 0.1, z: 10 }, { x: 0, y: -0.1, z: 0 });
  physics.registerEntityBody(10, ground.body, ground.collider, { key: 'ground', role: 'world', tags: ['ground'] });
  return ground;
}

function createFixedCuboid(
  physics: PhysicsWorld,
  position: { x: number; y: number; z: number },
  halfExtents: { x: number; y: number; z: number },
  entityId: number,
  key: string,
) {
  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
  const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z), body);
  physics.registerEntityBody(entityId, body, collider, { key, role: 'world', tags: [key] });
  return { body, collider };
}

function createSlope(physics: PhysicsWorld, angle: number) {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, 0, 0)
      .setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) }),
  );
  const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(4, 0.1, 2), body);
  physics.registerEntityBody(10, body, collider, { key: 'slope', role: 'world', tags: ['ground', 'slope'] });
  return { body, collider };
}
