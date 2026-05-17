import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { PHYSICS_MATERIAL_PROPERTIES } from '../src/physics/PhysicsMaterials';

describe('PhysicsMaterials', () => {
  it('applies ice friction when material=ice is specified', async () => {
    const physics = await createWorld();
    try {
      const block = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.25, z: 0.25 },
        { position: { x: 0, y: 0.25, z: 0 } },
        { layer: 'world', material: 'ice' },
      );
      expect(block.collider.friction()).toBeCloseTo(PHYSICS_MATERIAL_PROPERTIES.ice.friction, 4);
    } finally {
      physics.destroy();
    }
  });

  it('applies rubber restitution when material=rubber is specified', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 1, z: 0 } }, { layer: 'world', material: 'rubber' });
      expect(ball.collider.restitution()).toBeCloseTo(PHYSICS_MATERIAL_PROPERTIES.rubber.restitution, 4);
    } finally {
      physics.destroy();
    }
  });

  it('lets explicit colliderOptions override the material default for that property only', async () => {
    const physics = await createWorld();
    try {
      // Note: in production the backend/runtime normalizer drops conflicting raw values before
      // the call gets here. This test exercises the direct Colliders API which keeps explicit overrides.
      const block = Colliders.cuboid(
        physics,
        { x: 0.25, y: 0.25, z: 0.25 },
        { position: { x: 0, y: 0.25, z: 0 } },
        { layer: 'world', material: 'metal', friction: 0.1 },
      );
      expect(block.collider.friction()).toBeCloseTo(0.1, 4);
      expect(block.collider.restitution()).toBeCloseTo(PHYSICS_MATERIAL_PROPERTIES.metal.restitution, 4);
    } finally {
      physics.destroy();
    }
  });

  it('flesh material applies damping to a dynamic body', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 1, z: 0 } }, { layer: 'enemy', material: 'flesh' });
      expect(ball.body.linearDamping()).toBeCloseTo(PHYSICS_MATERIAL_PROPERTIES.flesh.linearDamping!, 4);
      expect(ball.body.angularDamping()).toBeCloseTo(PHYSICS_MATERIAL_PROPERTIES.flesh.angularDamping!, 4);
    } finally {
      physics.destroy();
    }
  });

  it('default material is applied when nothing is specified (no material, no overrides)', async () => {
    const physics = await createWorld();
    try {
      const block = Colliders.cuboid(physics, { x: 0.25, y: 0.25, z: 0.25 }, { position: { x: 0, y: 0.25, z: 0 } }, { layer: 'world' });
      // Without explicit material, Rapier defaults apply (friction=0.5, restitution=0).
      expect(block.collider.friction()).toBeCloseTo(0.5, 4);
      expect(block.collider.restitution()).toBeCloseTo(0, 4);
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
