import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { PhysicsCharacterController } from '../src/physics/PhysicsCharacterController';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import {
  RAPIER_EXAMPLE_ENTITY_IDS,
  castRapierExampleRayFan,
  createRapierExampleGround,
  createRapierExampleLayerPair,
  createRapierExampleMovingPlatform,
  createRapierExamplePlayer,
  createRapierExampleSensorCarrier,
  createRapierExampleSlopeCourse,
  createRapierExampleSmallStep,
  createRapierExampleWall,
  advanceRapierExampleMovingPlatform,
  rapierExampleLayerGroupsInteract,
} from '../src/physics/RapierExampleFixtures';

describe('controlled Rapier source adoption', () => {
  it('records selected upstream snapshots without making them runtime code', () => {
    const manifestPath = resolve(process.cwd(), '..', 'third_party', 'rapier', 'upstream-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')) as {
      upstream: {
        repository: string;
        commitSha: string | null;
        commitShaStatus: string;
        sourceVersion: string;
        localSnapshotDate: string;
      };
      policy: string;
      files: Array<{
        path: string;
        sha256: string;
        status: 'adapted' | 'reference-only' | 'deferred' | 'rejected';
        localTypeScriptAdaptationTarget: string | null;
      }>;
    };

    const paths = manifest.files.map((file) => file.path);
    const byPath = new Map(manifest.files.map((file) => [file.path, file]));
    expect(manifest.upstream.repository).toBe('https://github.com/dimforge/rapier');
    expect(manifest.upstream.commitSha).toBeNull();
    expect(manifest.upstream.commitShaStatus).toContain('unavailable');
    expect(manifest.upstream.sourceVersion).toBe('0.32.0');
    expect(manifest.upstream.localSnapshotDate).toContain('2026-05-16');
    expect(manifest.policy).toContain('@dimforge/rapier3d-compat');
    expect(paths).toContain('examples3d/character_controller3.rs');
    expect(paths).toContain('examples3d/sensor3.rs');
    expect(paths).toContain('src_testbed/debug_render.rs');
    expect(byPath.get('examples3d/character_controller3.rs')?.status).toBe('adapted');
    expect(byPath.get('examples2d/character_controller2.rs')?.status).toBe('reference-only');
    expect(byPath.get('examples3d/heightfield3.rs')?.status).toBe('deferred');
    expect(byPath.get('examples3d/trimesh3.rs')?.status).toBe('deferred');
    expect(byPath.get('examples3d/character_controller3.rs')?.localTypeScriptAdaptationTarget).toContain(
      'GAME_ENGINE/src/physics',
    );
    expect(paths.some((path) => path.startsWith('src/dynamics/'))).toBe(false);
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });

  it('adapts the Rapier character-controller flat-ground fixture through LOOMIER wrappers', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createRapierExamplePlayer(physics);
      createRapierExampleGround(physics);
      const controller = new PhysicsCharacterController(physics, {
        entityId: RAPIER_EXAMPLE_ENTITY_IDS.player,
        preset: 'simple3d',
      });
      physics.step(1 / 60);

      const result = controller.move({ x: 0.45, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.issues).toHaveLength(0);
      expect(result.grounded).toBe(true);
      expect(result.computed.x).toBeGreaterThan(0.2);
      expect(player.body.translation().x).toBeGreaterThan(0.2);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('adapts the Rapier slope fixture without losing grounded state', async () => {
    const physics = await createPhysicsWorld();
    try {
      createRapierExampleSlopeCourse(physics);
      createRapierExamplePlayer(physics, { x: 1.5, y: 0.75, z: 0 });
      const controller = new PhysicsCharacterController(physics, {
        entityId: RAPIER_EXAMPLE_ENTITY_IDS.player,
        preset: 'simple3d',
      });
      physics.step(1 / 60);

      const before = controller.checkGround();
      const result = controller.move({ x: 0.2, y: -0.04, z: 0 });
      physics.step(1 / 60);
      const after = controller.checkGround();

      expect(before.grounded).toBe(true);
      expect(result.grounded).toBe(true);
      expect(after.grounded).toBe(true);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('adapts the Rapier wall fixture so the character stops short', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createRapierExamplePlayer(physics);
      createRapierExampleGround(physics);
      createRapierExampleWall(physics);
      const controller = new PhysicsCharacterController(physics, {
        entityId: RAPIER_EXAMPLE_ENTITY_IDS.player,
        preset: 'simple3d',
      });
      physics.step(1 / 60);

      const result = controller.move({ x: 1.6, y: -0.04, z: 0 });
      physics.step(1 / 60);

      expect(result.collisionCount).toBeGreaterThan(0);
      expect(player.body.translation().x).toBeLessThan(0.7);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('adapts the Rapier small-step fixture for autostep', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = createRapierExamplePlayer(physics);
      createRapierExampleGround(physics);
      createRapierExampleSmallStep(physics);
      const controller = new PhysicsCharacterController(physics, {
        entityId: RAPIER_EXAMPLE_ENTITY_IDS.player,
        preset: 'simple3d',
      });
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

  it('documents the moving-platform fixture without claiming character riding support', async () => {
    const physics = await createPhysicsWorld();
    try {
      const platform = createRapierExampleMovingPlatform(physics);
      const before = platform.body.translation().x;
      const velocity = advanceRapierExampleMovingPlatform(platform, Math.PI / 4);
      physics.step(0.5);

      expect(velocity.x).toBeGreaterThan(1.9);
      expect(platform.body.translation().x).toBeGreaterThan(before + 0.8);
    } finally {
      physics.destroy();
    }
  });

  it('adapts Rapier sensor-body behavior with multiple colliders on one entity', async () => {
    const physics = await createPhysicsWorld();
    try {
      const fixture = createRapierExampleSensorCarrier(physics);
      physics.step(1 / 60);

      expect(fixture.solidCollider.isSensor()).toBe(false);
      expect(fixture.sensorCollider.isSensor()).toBe(true);
      expect(physics.getCollidersByEntityId(RAPIER_EXAMPLE_ENTITY_IDS.sensorCarrier)).toHaveLength(2);
      expect(physics.world.intersectionPair(fixture.sensorCollider, fixture.target.collider)).toBe(true);
    } finally {
      physics.destroy();
    }
  });

  it('adapts Rapier collision-group separation through LOOMIER named layers', async () => {
    const physics = await createPhysicsWorld();
    try {
      const fixture = createRapierExampleLayerPair(physics);
      physics.step(1 / 60);

      expect(rapierExampleLayerGroupsInteract(fixture.player.collider, fixture.world.collider)).toBe(true);
      expect(rapierExampleLayerGroupsInteract(fixture.player.collider, fixture.enemyFilteredOut.collider)).toBe(false);
      expect(hasContactPair(physics, fixture.player.collider, fixture.world.collider)).toBe(true);
      expect(hasContactPair(physics, fixture.player.collider, fixture.enemyFilteredOut.collider)).toBe(false);
    } finally {
      physics.destroy();
    }
  });

  it('adapts the Rapier ray-cast stress idea into a reduced deterministic ray fan', async () => {
    const physics = await createPhysicsWorld();
    try {
      createRapierExampleGround(physics);
      physics.step(1 / 60);

      const fan = castRapierExampleRayFan(physics);

      expect(fan.hitCount).toBe(3);
      expect(fan.missCount).toBe(2);
    } finally {
      physics.destroy();
    }
  });

  it('keeps debug-render buffer shape compatible with the preview overlay', async () => {
    const physics = await createPhysicsWorld();
    try {
      createRapierExampleGround(physics);
      createRapierExamplePlayer(physics);
      physics.step(1 / 60);

      const buffers = physics.debugRender();

      expect(buffers).not.toBeNull();
      expect(buffers?.vertices.length).toBeGreaterThan(0);
      expect(buffers?.colors.length).toBeGreaterThan(0);
      expect((buffers?.colors.length ?? 0) / 4 * 3).toBe(buffers?.vertices.length);
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

function hasContactPair(physics: PhysicsWorld, a: RAPIER.Collider, b: RAPIER.Collider): boolean {
  let manifolds = 0;
  physics.world.contactPair(a, b, () => {
    manifolds += 1;
  });
  return manifolds > 0;
}
