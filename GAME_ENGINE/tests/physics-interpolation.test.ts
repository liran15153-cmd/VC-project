import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('PhysicsWorld interpolation', () => {
  it('captures prev/curr snapshot around a dynamic step', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 5, z: 0 } }, { layer: 'projectile' });
      physics.registerEntityBody(1, ball.body, ball.collider, { key: 'ball', role: 'projectile' });

      physics.step(1 / 60);
      physics.step(1 / 60);

      const state = physics.getInterpolationState(1);
      expect(state).not.toBeNull();
      expect(state!.prevTranslation.y).toBeGreaterThan(state!.currTranslation.y);
    } finally {
      physics.destroy();
    }
  });

  it('interpolates linearly between snapshots for a kinematic body', async () => {
    const physics = await createWorld();
    try {
      const cube = Colliders.cuboid(
        physics,
        { x: 0.5, y: 0.5, z: 0.5 },
        { type: 'kinematic', position: { x: 0, y: 1, z: 0 } },
        { layer: 'world' },
      );
      physics.registerEntityBody(1, cube.body, cube.collider, { key: 'mover', role: 'world' });

      physics.step(1 / 60);
      cube.body.setNextKinematicTranslation({ x: 1, y: 1, z: 0 });
      physics.step(1 / 60);

      const at0 = physics.getInterpolatedTranslation(1, 0)!;
      const at05 = physics.getInterpolatedTranslation(1, 0.5)!;
      const at1 = physics.getInterpolatedTranslation(1, 1)!;
      expect(at0.x).toBeCloseTo(0, 5);
      expect(at05.x).toBeCloseTo(0.5, 5);
      expect(at1.x).toBeCloseTo(1, 5);
    } finally {
      physics.destroy();
    }
  });

  it('clamps alpha outside [0,1]', async () => {
    const physics = await createWorld();
    try {
      const cube = Colliders.cuboid(
        physics,
        { x: 0.5, y: 0.5, z: 0.5 },
        { type: 'kinematic', position: { x: 0, y: 0, z: 0 } },
        { layer: 'world' },
      );
      physics.registerEntityBody(1, cube.body, cube.collider, { key: 'mover', role: 'world' });

      physics.step(1 / 60);
      cube.body.setNextKinematicTranslation({ x: 2, y: 0, z: 0 });
      physics.step(1 / 60);

      const underflow = physics.getInterpolatedTranslation(1, -1)!;
      const overflow = physics.getInterpolatedTranslation(1, 2)!;
      expect(underflow.x).toBeCloseTo(0, 5);
      expect(overflow.x).toBeCloseTo(2, 5);
    } finally {
      physics.destroy();
    }
  });

  it('returns null for unregistered entities', async () => {
    const physics = await createWorld();
    try {
      expect(physics.getInterpolationState(404)).toBeNull();
      expect(physics.getInterpolatedTranslation(404, 0.5)).toBeNull();
      expect(physics.getInterpolatedRotation(404, 0.5)).toBeNull();
    } finally {
      physics.destroy();
    }
  });

  it('clears interpolation state when an entity is unregistered', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 1, z: 0 } }, { layer: 'projectile' });
      physics.registerEntityBody(1, ball.body, ball.collider, { key: 'ball', role: 'projectile' });
      physics.step(1 / 60);

      physics.unregisterEntityBody(1);
      expect(physics.getInterpolationState(1)).toBeNull();
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
