import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Engine } from '../src/core/Engine';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsWorld, type CollisionEvent } from '../src/physics/PhysicsWorld';
import { PhysicsDebugOverlay } from '../src/physics/PhysicsDebugOverlay';
import {
  PHYSICS_LAYER_BITS,
  canCollisionGroupsInteract,
  collisionGroupsForLayer,
  physicsLayerMask,
  toRapierCollisionGroups,
} from '../src/physics/CollisionLayers';
import { parseGameDefinition } from '../src/runtime/GameDefinition';

describe('named collision layers', () => {
  it('converts LOOMIER layer names into Rapier interaction groups', () => {
    const groups = toRapierCollisionGroups({
      memberships: ['player'],
      filter: ['world', 'enemy'],
    });

    expect(groups >>> 16).toBe(PHYSICS_LAYER_BITS.player);
    expect(groups & 0xffff).toBe(PHYSICS_LAYER_BITS.world | PHYSICS_LAYER_BITS.enemy);
  });

  it('keeps raw bitmasks behind named layer helpers', () => {
    const player = collisionGroupsForLayer('player');
    const world = collisionGroupsForLayer('world');
    const collectible = collisionGroupsForLayer('collectible');
    const projectileOnly = toRapierCollisionGroups({
      memberships: ['projectile'],
      filter: ['projectile'],
    });

    expect(physicsLayerMask(['player', 'sensor'])).toBe(PHYSICS_LAYER_BITS.player | PHYSICS_LAYER_BITS.sensor);
    expect(physicsLayerMask([])).toBe(0);
    expect(canCollisionGroupsInteract(player, world)).toBe(true);
    expect(canCollisionGroupsInteract(player, collectible)).toBe(true);
    expect(canCollisionGroupsInteract(player, projectileOnly)).toBe(false);
  });

  it('uses Rapier sensor behavior for collectible/trigger layers', async () => {
    const physics = await createPhysicsWorld();
    try {
      const collectible = Colliders.ball(
        physics,
        0.5,
        { type: 'static', position: { x: 0, y: 0, z: 0 } },
        { layer: 'collectible' },
      );
      const trigger = Colliders.ball(
        physics,
        0.5,
        { type: 'static', position: { x: 2, y: 0, z: 0 } },
        { layer: 'trigger' },
      );
      const genericSensorLayer = Colliders.ball(
        physics,
        0.5,
        { type: 'static', position: { x: 4, y: 0, z: 0 } },
        { layer: 'sensor' },
      );

      expect(collectible.collider.isSensor()).toBe(true);
      expect(trigger.collider.isSensor()).toBe(true);
      expect(genericSensorLayer.collider.isSensor()).toBe(false);
    } finally {
      physics.destroy();
    }
  });
});

describe('PhysicsWorld Rapier wrappers', () => {
  it('returns non-empty debug geometry for a simple physics scene', async () => {
    const physics = await createPhysicsWorld();
    try {
      Colliders.ground(physics);
      Colliders.ball(physics, 0.5, { position: { x: 0, y: 2, z: 0 } });

      const debug = physics.debugRender();

      expect(debug).not.toBeNull();
      expect(debug?.vertices.length).toBeGreaterThan(0);
      expect(debug?.colors.length).toBeGreaterThan(0);
      expect(physics.collectDiagnostics().debugLineCount).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('casts a ray for a ground-check fixture', async () => {
    const physics = await createPhysicsWorld();
    try {
      Colliders.ground(physics);
      physics.step(1 / 60);

      const hit = physics.castRay({
        origin: { x: 0, y: 3, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
        maxToi: 10,
        includeNormal: true,
      });

      expect(hit).not.toBeNull();
      expect(hit?.timeOfImpact).toBeGreaterThan(0);
      expect(hit?.collider).toBeTruthy();
    } finally {
      physics.destroy();
    }
  });

  it('casts a shape through the PhysicsWorld wrapper', async () => {
    const physics = await createPhysicsWorld();
    try {
      Colliders.ground(physics);
      physics.step(1 / 60);

      const hit = physics.castShape({
        shape: new RAPIER.Ball(0.25),
        position: { x: 0, y: 3, z: 0 },
        velocity: { x: 0, y: -1, z: 0 },
        maxToi: 10,
      });

      expect(hit).not.toBeNull();
      expect(hit?.time_of_impact).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('tracks bodies plus multiple colliders by ECS entity id', async () => {
    const physics = await createPhysicsWorld();
    try {
      const created = Colliders.ball(physics, 0.5, { position: { x: 0, y: 1, z: 0 } }, { layer: 'player' });
      const groundSensor = physics.world.createCollider(
        RAPIER.ColliderDesc.ball(0.7).setSensor(true),
        created.body,
      );
      physics.registerEntityBody(42, created.body, created.collider, { key: 'player', role: 'player', tags: ['player'] });
      physics.registerEntityCollider(42, groundSensor);

      expect(physics.getBodyByEntityId(42)).toBe(created.body);
      expect(physics.getPrimaryColliderByEntityId(42)).toBe(created.collider);
      expect(physics.getColliderByEntityId(42)).toBe(created.collider);
      expect(physics.getCollidersByEntityId(42)).toEqual([created.collider, groundSensor]);
      expect(physics.collectDiagnostics().entityBindingCount).toBe(1);

      physics.unregisterEntityBody(42);
      expect(physics.getBodyByEntityId(42)).toBeNull();
      expect(physics.getPrimaryColliderByEntityId(42)).toBeNull();
      expect(physics.getColliderByEntityId(42)).toBeNull();
      expect(physics.getCollidersByEntityId(42)).toEqual([]);
    } finally {
      physics.destroy();
    }
  });

  it('supports a trigger collectible fixture with named collision layers', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = Colliders.ball(
        physics,
        0.5,
        { position: { x: 0, y: 0, z: 0 } },
        { layer: 'player' },
      );
      const collectible = Colliders.ball(
        physics,
        0.6,
        { type: 'static', position: { x: 0, y: 0, z: 0 } },
        { layer: 'collectible', sensor: true },
      );

      stepAndDrain(physics);

      expect(collectible.collider.isSensor()).toBe(true);
      expect(physics.world.intersectionPair(player.collider, collectible.collider)).toBe(true);
      expect(canCollisionGroupsInteract(player.collider.collisionGroups(), collectible.collider.collisionGroups())).toBe(true);
    } finally {
      physics.destroy();
    }
  });

  it('supports an enemy/player collision fixture with named collision layers', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = Colliders.ball(
        physics,
        0.5,
        { position: { x: 0, y: 0, z: 0 } },
        { layer: 'player' },
      );
      const enemy = Colliders.ball(
        physics,
        0.5,
        { type: 'static', position: { x: 0.4, y: 0, z: 0 } },
        { layer: 'enemy' },
      );

      stepAndDrain(physics);
      let contactManifolds = 0;
      physics.world.contactPair(player.collider, enemy.collider, () => {
        contactManifolds += 1;
      });

      expect(canCollisionGroupsInteract(player.collider.collisionGroups(), enemy.collider.collisionGroups())).toBe(true);
      expect(contactManifolds).toBeGreaterThan(0);
    } finally {
      physics.destroy();
    }
  });

  it('reports structured diagnostics with stable codes', async () => {
    const physics = await createPhysicsWorld();
    try {
      const playerBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
      physics.registerEntityBody(1, playerBody, undefined, { key: 'player', role: 'player', tags: ['player'] });

      const collectible = Colliders.ball(physics, 0.5, { type: 'static', position: { x: 2, y: 0, z: 0 } });
      physics.registerEntityBody(2, collectible.body, collectible.collider, { key: 'coin', role: 'collectible', tags: ['collectible'] });

      const trigger = Colliders.ball(physics, 0.5, { type: 'static', position: { x: 4, y: 0, z: 0 } });
      physics.registerEntityBody(3, trigger.body, trigger.collider, { key: 'door-zone', role: 'trigger', tags: ['trigger'] });

      const orphan = Colliders.ball(physics, 0.5, { type: 'static', position: { x: 6, y: 0, z: 0 } });
      physics.registerEntityCollider(4, orphan.collider, { metadata: { key: 'orphan', role: 'enemy' } });

      const diagnostics = physics.collectDiagnostics();
      const codes = diagnostics.issues.map((issue) => issue.code);

      expect(codes).toContain('PLAYER_HAS_NO_COLLIDER');
      expect(codes).toContain('COLLECTIBLE_NOT_SENSOR');
      expect(codes).toContain('TRIGGER_NOT_SENSOR');
      expect(codes).toContain('ENTITY_BODY_LOOKUP_MISSING');
      expect(codes).toContain('WORLD_HAS_NO_STATIC_COLLIDER');
    } finally {
      physics.destroy();
    }
  });

  it('runs an integrated playable physics fixture', async () => {
    const physics = await createPhysicsWorld();
    try {
      const player = Colliders.ball(
        physics,
        0.45,
        { position: { x: 0, y: 1, z: 0 }, linearDamping: 0.2 },
        { layer: 'player' },
      );
      const ground = Colliders.ground(physics, { x: 10, y: 0.1, z: 10 }, { x: 0, y: 0, z: 0 });
      const collectible = Colliders.ball(
        physics,
        0.35,
        { type: 'static', position: { x: 0, y: 1, z: 0 } },
        { layer: 'collectible' },
      );
      const enemy = Colliders.ball(
        physics,
        0.45,
        { type: 'static', position: { x: 1.5, y: 1, z: 0 } },
        { layer: 'enemy' },
      );

      physics.registerEntityBody(1, player.body, player.collider, { key: 'player', role: 'player', tags: ['player'] });
      physics.registerEntityBody(2, ground.body, ground.collider, { key: 'ground', role: 'world', tags: ['ground'] });
      physics.registerEntityBody(3, collectible.body, collectible.collider, { key: 'coin', role: 'collectible', tags: ['collectible'] });
      physics.registerEntityBody(4, enemy.body, enemy.collider, { key: 'enemy', role: 'enemy', tags: ['enemy'] });

      stepAndDrain(physics);
      const groundHit = physics.castRay({
        origin: { x: 0, y: 2, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
        maxToi: 10,
        includeNormal: true,
      });
      const debug = physics.debugRender();
      const diagnostics = physics.collectDiagnostics();

      expect(physics.getBodyByEntityId(1)).toBe(player.body);
      expect(physics.getPrimaryColliderByEntityId(1)).toBe(player.collider);
      expect(physics.getCollidersByEntityId(1)).toEqual([player.collider]);
      expect(collectible.collider.isSensor()).toBe(true);
      expect(groundHit).not.toBeNull();
      expect(debug?.vertices.length).toBeGreaterThan(0);
      expect(diagnostics.issues).toEqual([]);
    } finally {
      physics.destroy();
    }
  });
});

describe('GameDefinition physics boundary', () => {
  it('rejects collision layer fields until the schema officially supports them', () => {
    expect(() => parseGameDefinition({
      metadata: { title: 'Layer Drift' },
      scenes: [
        {
          key: 'main',
          entities: [
            {
              key: 'player',
              tags: ['player'],
              rigidBody: {
                collider: { shape: 'ball', radius: 0.5 },
                colliderOptions: { layer: 'player', collidesWith: ['world'] },
              },
            },
          ],
        },
      ],
    })).toThrow(/unrecognized/i);
  });
});

describe('PhysicsDebugOverlay lifecycle', () => {
  it('creates no Three resources while disabled', () => {
    const scene = new THREE.Scene();
    const debugRender = vi.fn();
    const overlay = new PhysicsDebugOverlay({
      three: { scene },
      physics: { isReady: () => true, debugRender },
    } as unknown as Engine);

    overlay.update();

    expect(debugRender).not.toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
    expect((overlay as unknown as { material: THREE.LineBasicMaterial | null }).material).toBeNull();
    overlay.destroy();
  });

  it('updates only when enabled and disposes scene objects when disabled', () => {
    const scene = new THREE.Scene();
    const debugRender = vi.fn(() => ({
      vertices: new Float32Array([0, 0, 0, 1, 0, 0]),
      colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
    }));
    const overlay = new PhysicsDebugOverlay({
      three: { scene },
      physics: { isReady: () => true, debugRender },
    } as unknown as Engine);

    overlay.setEnabled(true);
    overlay.update();
    const line = scene.children[0] as THREE.LineSegments;
    const geometryDispose = vi.spyOn(line.geometry, 'dispose');
    const material = (overlay as unknown as { material: THREE.LineBasicMaterial }).material;
    const materialDispose = vi.spyOn(material, 'dispose');

    expect(scene.children).toHaveLength(1);
    expect(debugRender).toHaveBeenCalledTimes(1);

    overlay.setEnabled(false);

    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect((overlay as unknown as { material: THREE.LineBasicMaterial | null }).material).toBeNull();
  });
});

async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const physics = new PhysicsWorld({ x: 0, y: -9.81, z: 0 });
  await physics.init();
  return physics;
}

function stepAndDrain(physics: PhysicsWorld): CollisionEvent[] {
  const events: CollisionEvent[] = [];
  for (let i = 0; i < 4; i += 1) physics.step(1 / 60);
  physics.drainCollisionEvents((event) => events.push(event));
  return events;
}
