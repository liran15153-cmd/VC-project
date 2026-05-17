import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsCharacterController } from '../src/physics/PhysicsCharacterController';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { MovingPlatformComponent } from '../src/components/MovingPlatform';
import { RigidBodyComponent } from '../src/components/RigidBody';
import { MovingPlatformSystem } from '../src/systems/MovingPlatformSystem';
import { World } from '../src/core/World';
import { Transform } from '../src/components/Transform';
import type { SystemContext } from '../src/core/types';

describe('MovingPlatformSystem', () => {
  it('advances a velocity-based kinematic platform across frames', async () => {
    const physics = await createWorld();
    try {
      const { world, ctx } = createEcsContext(physics);
      const platform = createPlatform(physics, world, { x: 0, y: 0, z: 0 });
      world.addComponent(platform.entityId, new MovingPlatformComponent({ kind: 'velocity', velocity: { x: 2, y: 0, z: 0 } }));

      const system = new MovingPlatformSystem();
      system.update(ctx(1 / 60));
      physics.step(1 / 60);
      system.update(ctx(1 / 60));
      physics.step(1 / 60);

      expect(platform.body.translation().x).toBeGreaterThan(0.05);
      const platformComp = world.getComponent(platform.entityId, MovingPlatformComponent)!;
      expect(platformComp.lastFrameDelta.x).toBeCloseTo(2 / 60, 4);
    } finally {
      physics.destroy();
    }
  });

  it('traverses a path of waypoints in loop mode', async () => {
    const physics = await createWorld();
    try {
      const { world, ctx } = createEcsContext(physics);
      const platform = createPlatform(physics, world, { x: 0, y: 0, z: 0 });
      world.addComponent(
        platform.entityId,
        new MovingPlatformComponent({
          kind: 'path',
          waypoints: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
          speed: 1,
          mode: 'loop',
        }),
      );

      const system = new MovingPlatformSystem();
      for (let i = 0; i < 30; i++) {
        system.update(ctx(1 / 30));
        physics.step(1 / 30);
      }

      // After 30 * (1/30) = 1.0s at speed 1.0, we should have reached waypoint 1
      // and started looping back to waypoint 0.
      const pos = platform.body.translation();
      expect(pos.x).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('publishes platform delta so the character controller can read it', async () => {
    const physics = await createWorld();
    try {
      const { world, ctx } = createEcsContext(physics);
      const platform = createPlatform(physics, world, { x: 0, y: 0, z: 0 });
      world.addComponent(platform.entityId, new MovingPlatformComponent({ kind: 'velocity', velocity: { x: 3, y: 0, z: 0 } }));

      const system = new MovingPlatformSystem();
      system.update(ctx(1 / 60));

      const delta = physics.getPlatformDelta(platform.entityId);
      expect(delta).not.toBeNull();
      expect(delta!.x).toBeCloseTo(3 / 60, 4);
    } finally {
      physics.destroy();
    }
  });

  it('character grounded on a moving platform inherits its horizontal velocity', async () => {
    const physics = await createWorld();
    try {
      const { world, ctx } = createEcsContext(physics);
      const platform = createPlatform(physics, world, { x: 0, y: 0.1, z: 0 });
      world.addComponent(platform.entityId, new MovingPlatformComponent({ kind: 'velocity', velocity: { x: 2, y: 0, z: 0 } }));

      const playerEntityId = world.createEntity();
      const player = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.5, z: 0.25 },
        { type: 'kinematic', position: { x: 0, y: 0.7, z: 0 } },
        { layer: 'player' },
      );
      physics.registerEntityBody(playerEntityId, player.body, player.collider, { key: 'player', role: 'player' });

      const controller = new PhysicsCharacterController(physics, { entityId: playerEntityId, preset: 'simple3d' });
      const system = new MovingPlatformSystem();

      physics.step(1 / 60);
      for (let i = 0; i < 30; i++) {
        system.update(ctx(1 / 60));
        controller.move({ x: 0, y: -0.04, z: 0 });
        physics.step(1 / 60);
      }

      const pos = player.body.translation();
      expect(pos.x).toBeGreaterThan(0.5);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });
});

async function createWorld(): Promise<PhysicsWorld> {
  const physics = new PhysicsWorld({ x: 0, y: -9.81, z: 0 });
  await physics.init();
  return physics;
}

interface PlatformFixture {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  entityId: number;
}

function createPlatform(physics: PhysicsWorld, world: World, position: { x: number; y: number; z: number }): PlatformFixture {
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z),
  );
  const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.1, 1), body);
  const id = world.createEntity();
  physics.registerEntityBody(id, body, collider, { key: `platform-${id}`, role: 'platform' });
  world.addComponent(id, new RigidBodyComponent(body, collider));
  world.addComponent(id, new Transform({ position }));
  return { body, collider, entityId: id };
}

function createEcsContext(physics: PhysicsWorld): { world: World; ctx: (dt: number) => SystemContext } {
  const world = new World();
  const fakeEngine = { physics } as unknown as SystemContext['engine'];
  return {
    world,
    ctx: (dt: number) => ({ world, engine: fakeEngine, deltaTime: dt, elapsed: 0 }),
  };
}
