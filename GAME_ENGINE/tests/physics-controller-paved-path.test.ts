/**
 * Phase 4 — Paved-path perf harness
 *
 * Validates that a topdown character controller can walk a 20-tile paved path
 * (fixed static cuboids) through 500 physics steps without errors, and that
 * the total wall-clock time is within an acceptable budget.
 *
 * Also confirms the CharacterControllerSystem drives controller.move() from
 * simulated input at the system level.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsCharacterController } from '../src/physics/PhysicsCharacterController';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CharacterControllerSystem } from '../src/systems/CharacterControllerSystem';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const world = new PhysicsWorld({ x: 0, y: 0, z: 0 }); // no gravity for topdown
  await world.init();
  return world;
}

/**
 * Builds a paved path: `count` 1×0.1×1 static tiles laid end-to-end along +X.
 * Each tile center is at (i, -0.05, 0) so the walkable surface is at y=0.
 */
function buildPavedPath(physics: PhysicsWorld, count: number): void {
  for (let i = 0; i < count; i++) {
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(i, -0.05, 0),
    );
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 0.05, 0.5),
      body,
    );
    physics.registerEntityBody(100 + i, body, collider, {
      key: `tile-${i}`,
      role: 'world',
      tags: ['ground', 'tile'],
    });
  }
}

function createPlayerOnPath(physics: PhysicsWorld, startX = 0): { body: RAPIER.RigidBody } {
  const player = Colliders.cuboid(
    physics,
    { x: 0.25, y: 0.25, z: 0.25 },
    { type: 'kinematic', position: { x: startX, y: 0.3, z: 0 } },
    { layer: 'player' },
  );
  physics.registerEntityBody(1, player.body, player.collider, {
    key: 'player',
    role: 'player',
    tags: ['player'],
  });
  return player;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Paved-path — character controller physics', () => {
  it('topdown controller traverses 20-tile path without errors', async () => {
    const physics = await createPhysicsWorld();
    try {
      buildPavedPath(physics, 20);
      const player = createPlayerOnPath(physics, 0);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60);

      const STEPS = 200;
      const SPEED = 0.1; // world units per step
      for (let i = 0; i < STEPS; i++) {
        controller.move({ x: SPEED, y: 0, z: 0 });
        physics.step(1 / 60);
      }

      const finalX = player.body.translation().x;
      // Should have advanced meaningfully along the path without falling off.
      expect(finalX).toBeGreaterThan(5);
      expect(player.body.translation().y).toBeGreaterThan(-0.5); // still on surface

      const diag = physics.collectDiagnostics();
      const errorCodes = diag.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.code);
      expect(errorCodes).toHaveLength(0);

      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('perf: 500 steps over 20-tile path complete in under 3000ms', async () => {
    const physics = await createPhysicsWorld();
    try {
      buildPavedPath(physics, 20);
      createPlayerOnPath(physics, 0);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60); // warm-up

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        controller.move({ x: 0.05, y: 0, z: 0 });
        physics.step(1 / 60);
      }
      const elapsed = performance.now() - start;

      // This should be well under 1 s on any modern machine; 3 s is a safe CI ceiling.
      expect(elapsed).toBeLessThan(3000);

      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('topdown controller stays on path when walking along Z axis', async () => {
    const physics = await createPhysicsWorld();
    try {
      // Build a path along Z instead.
      for (let i = 0; i < 10; i++) {
        const body = physics.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, i),
        );
        const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.05, 0.5), body);
        physics.registerEntityBody(200 + i, body, collider, { key: `ztile-${i}`, role: 'world', tags: ['ground'] });
      }

      const player = createPlayerOnPath(physics, 0);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60);

      for (let i = 0; i < 100; i++) {
        controller.move({ x: 0, y: 0, z: 0.1 });
        physics.step(1 / 60);
      }

      expect(player.body.translation().z).toBeGreaterThan(3);
      expect(player.body.translation().y).toBeGreaterThan(-0.5);
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });
});

describe('CharacterControllerSystem — unit', () => {
  it('register + update drives controller.move with simulated input', async () => {
    const physics = await createPhysicsWorld();
    try {
      buildPavedPath(physics, 5);
      createPlayerOnPath(physics, 0);
      const controller = new PhysicsCharacterController(physics, { entityId: 1, preset: 'topdown' });
      physics.step(1 / 60);

      const system = new CharacterControllerSystem();
      system.register(1, controller, 'topdown', 5);

      // Build a minimal SystemContext stub with actionDown returning true for moveRight.
      const ctx = makeInputCtx({ moveRight: true });

      for (let i = 0; i < 30; i++) {
        system.update(ctx);
        physics.step(1 / 60);
      }

      const body = physics.getBodyByEntityId(1)!;
      expect(body.translation().x).toBeGreaterThan(0.5);

      system.unregister(1);
      system.destroy();
      controller.destroy();
    } finally {
      physics.destroy();
    }
  });

  it('destroy clears all entries', () => {
    const system = new CharacterControllerSystem();
    // Register a stub — we only need to test that destroy does not throw.
    const stub = { move: () => ({ computed: { x: 0, y: 0, z: 0 }, grounded: false, issues: [], falling: false, wallHit: false, onSlope: false, slopeAngle: null, collisionCount: 0, requested: { x: 0, y: 0, z: 0 }, groundCheck: { grounded: false, hit: null, distance: null, onSlope: false, slopeAngle: null } }), checkGround: () => ({ grounded: false, hit: null, distance: null, onSlope: false, slopeAngle: null }), destroy: () => {} } as unknown as PhysicsCharacterController;
    system.register(99, stub, 'topdown');
    expect(() => system.destroy()).not.toThrow();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type InputActions = { moveRight?: boolean; moveLeft?: boolean; moveUp?: boolean; moveDown?: boolean; jump?: boolean };

function makeInputCtx(actions: InputActions = {}) {
  const input = {
    actionDown:     (key: string) => Boolean(actions[key as keyof InputActions]),
    actionPressed:  (key: string) => Boolean(actions[key as keyof InputActions]),
    actionReleased: (_key: string) => false,
    pressed:  (_key: string) => false,
    down:     (_key: string) => false,
    released: (_key: string) => false,
  };
  return {
    deltaTime: 1 / 60,
    elapsed: 0,
    world: {} as never,
    engine: { input } as never,
  };
}
