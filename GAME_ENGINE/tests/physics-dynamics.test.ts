import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsDynamics } from '../src/physics/PhysicsDynamics';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('PhysicsDynamics', () => {
  it('applyImpulse moves a dynamic body in the requested direction', async () => {
    const physics = await createWorld();
    try {
      const ball = Colliders.ball(physics, 0.25, { position: { x: 0, y: 1, z: 0 } }, { layer: 'projectile' });
      physics.registerEntityBody(1, ball.body, ball.collider, { key: 'ball', role: 'projectile' });
      physics.step(1 / 60);

      const ok = PhysicsDynamics.applyImpulse(physics, 1, { x: 4, y: 0, z: 0 });
      expect(ok).toBe(true);
      physics.step(1 / 60);

      expect(ball.body.linvel().x).toBeGreaterThan(0.5);
      expect(ball.body.translation().x).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('addKnockback applies an impulse along a normalized direction', async () => {
    const physics = await createWorld();
    try {
      const enemy = Colliders.ball(physics, 0.25, { position: { x: 0, y: 1, z: 0 } }, { layer: 'enemy' });
      physics.registerEntityBody(1, enemy.body, enemy.collider, { key: 'enemy', role: 'enemy' });
      physics.step(1 / 60);

      const ok = PhysicsDynamics.addKnockback(physics, 1, { x: 10, y: 0, z: 0 }, { power: 3, upwardBias: 2 });
      expect(ok).toBe(true);
      physics.step(1 / 60);

      const vel = enemy.body.linvel();
      expect(vel.x).toBeGreaterThan(0.5);
      expect(vel.y).toBeGreaterThan(0.1);
    } finally {
      physics.destroy();
    }
  });

  it('refuses to apply force to a static body and records BODY_NOT_DYNAMIC_FOR_FORCE', async () => {
    const physics = await createWorld();
    try {
      const wall = Colliders.cuboid(physics, { x: 1, y: 1, z: 1 }, { type: 'static', position: { x: 0, y: 0, z: 0 } }, { layer: 'world' });
      physics.registerEntityBody(1, wall.body, wall.collider, { key: 'wall', role: 'world' });

      const ok = PhysicsDynamics.applyForce(physics, 1, { x: 10, y: 0, z: 0 });
      expect(ok).toBe(false);

      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);
      expect(codes).toContain('BODY_NOT_DYNAMIC_FOR_FORCE');
    } finally {
      physics.destroy();
    }
  });

  it('refuses to apply impulse to a kinematic body and records BODY_NOT_DYNAMIC_FOR_FORCE', async () => {
    const physics = await createWorld();
    try {
      const player = Colliders.cuboid(physics, { x: 0.25, y: 0.5, z: 0.25 }, { type: 'kinematic', position: { x: 0, y: 1, z: 0 } }, { layer: 'player' });
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player' });

      const ok = PhysicsDynamics.applyImpulse(physics, 1, { x: 5, y: 0, z: 0 });
      expect(ok).toBe(false);
      const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);
      expect(codes).toContain('BODY_NOT_DYNAMIC_FOR_FORCE');
    } finally {
      physics.destroy();
    }
  });

  it('setLinearVelocity works on kinematic bodies (allowed for character controllers)', async () => {
    const physics = await createWorld();
    try {
      const player = Colliders.cuboid(physics, { x: 0.25, y: 0.5, z: 0.25 }, { type: 'kinematic', position: { x: 0, y: 1, z: 0 } }, { layer: 'player' });
      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player' });

      const ok = PhysicsDynamics.setLinearVelocity(physics, 1, { x: 0, y: 5, z: 0 });
      expect(ok).toBe(true);
    } finally {
      physics.destroy();
    }
  });

  it('clears transient diagnostic issues across a physics step', async () => {
    const physics = await createWorld();
    try {
      const wall = Colliders.cuboid(physics, { x: 1, y: 1, z: 1 }, { type: 'static', position: { x: 0, y: 0, z: 0 } }, { layer: 'world' });
      physics.registerEntityBody(1, wall.body, wall.collider, { key: 'wall', role: 'world' });

      PhysicsDynamics.applyForce(physics, 1, { x: 5, y: 0, z: 0 });
      expect(physics.collectDiagnostics().issues.map((issue) => issue.code)).toContain('BODY_NOT_DYNAMIC_FOR_FORCE');

      physics.step(1 / 60);
      expect(physics.collectDiagnostics().issues.map((issue) => issue.code)).not.toContain('BODY_NOT_DYNAMIC_FOR_FORCE');
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
