import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import type { PhysicsInteractionEvent } from '../src/physics/PhysicsWorld';

describe('PhysicsWorld.teleportEntity', () => {
  it('moves a kinematic body and resets the interpolation snapshot', async () => {
    const physics = await createWorld();
    try {
      const player = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.5, z: 0.25 },
        { type: 'kinematic', position: { x: 0, y: 0.6, z: 0 } },
        { layer: 'player' },
      );
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player' });
      physics.step(1 / 60);

      const ok = physics.teleportEntity(1, { x: 5, y: 0.6, z: 0 });
      expect(ok).toBe(true);
      expect(player.body.translation().x).toBeCloseTo(5, 5);

      const snapshot = physics.getInterpolationState(1)!;
      expect(snapshot.prevTranslation.x).toBeCloseTo(5, 5);
      expect(snapshot.currTranslation.x).toBeCloseTo(5, 5);
    } finally {
      physics.destroy();
    }
  });

  it('zeroes velocity for dynamic bodies on teleport', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 5, z: 0 } }, { layer: 'projectile' });
      physics.registerEntityBody(1, ball.body, ball.collider, { key: 'ball', role: 'projectile' });
      physics.step(1 / 60);
      physics.step(1 / 60);
      expect(Math.abs(ball.body.linvel().y)).toBeGreaterThan(0.05);

      physics.teleportEntity(1, { x: 10, y: 5, z: 0 });

      expect(ball.body.linvel().x).toBe(0);
      expect(ball.body.linvel().y).toBe(0);
      expect(ball.body.linvel().z).toBe(0);
    } finally {
      physics.destroy();
    }
  });

  it('does not surface PHYSICS_EVENT_PAIR_ORPHANED after a teleport', async () => {
    const physics = await createWorld();
    try {
      const player = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.5, z: 0.25 },
        { type: 'kinematic', position: { x: 0, y: 0.6, z: 0 } },
        { layer: 'player' },
      );
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player' });
      const collectible = Colliders.cuboid(
        physics,
        { x: 0.4, y: 0.4, z: 0.4 },
        { type: 'static', position: { x: 0.4, y: 0.4, z: 0 } },
        { layer: 'collectible' },
      );
      physics.registerEntityBody(2, collectible.body, collectible.collider, { key: 'coin', role: 'collectible' });

      physics.step(1 / 60);
      physics.drainPhysicsEvents(() => {});

      physics.teleportEntity(1, { x: 10, y: 0.6, z: 0 });
      physics.step(1 / 60);
      physics.step(1 / 60);

      const events: PhysicsInteractionEvent[] = [];
      physics.drainPhysicsEvents((event) => events.push(event));
      const orphanIssues = physics
        .collectDiagnostics()
        .issues.filter((issue) => issue.code === 'PHYSICS_EVENT_PAIR_ORPHANED');
      expect(orphanIssues.length).toBe(0);
      const lingeringSensorEnters = events.filter(
        (event) => event.type === 'sensorEnter' && (event.entityA === 1 || event.entityB === 1),
      );
      expect(lingeringSensorEnters.length).toBe(0);
    } finally {
      physics.destroy();
    }
  });

  it('the player can be grounded again on the tick after teleport onto a platform', async () => {
    const physics = await createWorld();
    try {
      const player = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.5, z: 0.25 },
        { type: 'kinematic', position: { x: 0, y: 0.6, z: 0 } },
        { layer: 'player' },
      );
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player' });
      const platform = Colliders.cuboid(
        physics,
        { x: 1, y: 0.1, z: 1 },
        { type: 'static', position: { x: 10, y: 2, z: 0 } },
        { layer: 'platform' },
      );
      physics.registerEntityBody(2, platform.body, platform.collider, { key: 'platform', role: 'platform' });

      physics.step(1 / 60);
      physics.teleportEntity(1, { x: 10, y: 2.6, z: 0 });
      physics.step(1 / 60);

      expect(physics.isGrounded(1, { maxToi: 1.5 })).toBe(true);
    } finally {
      physics.destroy();
    }
  });

  it('returns false for an unknown entity id', async () => {
    const physics = await createWorld();
    try {
      expect(physics.teleportEntity(404, { x: 0, y: 0, z: 0 })).toBe(false);
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
