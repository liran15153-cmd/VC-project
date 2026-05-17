import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/physics/Colliders';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { TriggerVolumeRegistry } from '../src/runtime/TriggerVolumes';
import { BehaviorSystem } from '../src/systems/BehaviorSystem';
import { World } from '../src/core/World';
import { GameStateStore } from '../src/core/GameStateStore';
import { EventBus } from '../src/core/EventBus';
import { EntityInfo } from '../src/components/EntityInfo';
import type { SystemContext } from '../src/core/types';
import type { RuntimeSceneApi } from '../src/systems/RuntimeSceneApi';

describe('TriggerVolumeRegistry', () => {
  it('stores onEnter / onExit / onStay actions per entity', () => {
    const registry = new TriggerVolumeRegistry();
    registry.register(7, { onEnter: [{ type: 'setState', key: 'hurt', value: 1 }] });
    expect(registry.size()).toBe(1);
    expect(registry.has(7)).toBe(true);
    expect(registry.getActions(7, 'onEnter')).toHaveLength(1);
    expect(registry.getActions(7, 'onExit')).toBeUndefined();
  });

  it('unregister removes the entry', () => {
    const registry = new TriggerVolumeRegistry();
    registry.register(1, { onEnter: [{ type: 'setState', key: 'x', value: 1 }] });
    registry.unregister(1);
    expect(registry.has(1)).toBe(false);
  });
});

describe('Triggers-as-data through BehaviorSystem', () => {
  it('fires onEnter actions when a player enters a sensor trigger', async () => {
    const physics = await createPhysicsWorld();
    const world = new World();
    const state = new GameStateStore();
    const events = new EventBus<{ 'game:event': { name: string; payload?: Record<string, unknown> } }>();
    const registry = new TriggerVolumeRegistry();

    const playerEntityId = world.createEntity();
    // Use a dynamic body so Rapier's broadphase reliably detects overlap with static sensors.
    const player = Colliders.ball(
      physics,
      0.4,
      { position: { x: -2, y: 0, z: 0 }, linearDamping: 1 },
      { layer: 'player' },
    );
    physics.registerEntityBody(playerEntityId, player.body, player.collider, { key: 'player', role: 'player' });
    world.addComponent(playerEntityId, new EntityInfo({ key: 'player', tags: ['player'], data: {} }));

    const triggerEntityId = world.createEntity();
    const trigger = Colliders.cuboid(
      physics,
      { x: 0.4, y: 0.4, z: 0.4 },
      { type: 'static', position: { x: 0, y: 0, z: 0 } },
      { layer: 'trigger' },
    );
    physics.registerEntityBody(triggerEntityId, trigger.body, trigger.collider, { key: 'lava', role: 'trigger' });
    world.addComponent(triggerEntityId, new EntityInfo({ key: 'lava', tags: ['hazard'], data: {} }));

    registry.register(triggerEntityId, {
      onEnter: [{ type: 'setState', key: 'health', value: 50 }],
      onExit: [{ type: 'setState', key: 'health', value: 100 }],
    });

    const api = makeSceneApi();
    const system = new BehaviorSystem([], api, registry);
    const ctx = makeCtx({ world, physics, state, events });

    system.init(ctx);
    // Move the player into the trigger zone.
    player.body.setTranslation({ x: 0, y: 0, z: 0 }, true);
    physics.step(1 / 60);
    system.update(ctx);

    expect(state.get('health')).toBe(50);

    // Move the player out of range so sensorExit fires.
    player.body.setTranslation({ x: 10, y: 0, z: 0 }, true);
    physics.step(1 / 60);
    system.update(ctx);

    expect(state.get('health')).toBe(100);
  });

  it('does not error when an entity has no trigger registration', async () => {
    const physics = await createPhysicsWorld();
    const world = new World();
    const state = new GameStateStore();
    const events = new EventBus<{ 'game:event': { name: string; payload?: Record<string, unknown> } }>();
    const registry = new TriggerVolumeRegistry();

    const playerEntityId = world.createEntity();
    const player = Colliders.cuboid(
      physics,
      { x: 0.4, y: 0.4, z: 0.4 },
      { type: 'kinematic', position: { x: 0, y: 0, z: 0 } },
      { layer: 'player' },
    );
    physics.registerEntityBody(playerEntityId, player.body, player.collider, { key: 'player', role: 'player' });

    const triggerEntityId = world.createEntity();
    const trigger = Colliders.cuboid(
      physics,
      { x: 0.4, y: 0.4, z: 0.4 },
      { type: 'static', position: { x: 0, y: 0, z: 0 } },
      { layer: 'trigger' },
    );
    physics.registerEntityBody(triggerEntityId, trigger.body, trigger.collider, { key: 'orphan-trigger', role: 'trigger' });

    const api = makeSceneApi();
    const system = new BehaviorSystem([], api, registry);
    const ctx = makeCtx({ world, physics, state, events });

    system.init(ctx);
    physics.step(1 / 60);
    expect(() => system.update(ctx)).not.toThrow();
  });

  it('still surfaces TRIGGER_NOT_SENSOR diagnostic when the trigger entity has no sensor collider', async () => {
    const physics = await createPhysicsWorld();
    // Use the 'world' layer (which does NOT force sensor) while keeping the trigger role —
    // mirrors AI mis-classification where role says trigger but the collider is a solid wall.
    const trigger = Colliders.cuboid(
      physics,
      { x: 0.4, y: 0.4, z: 0.4 },
      { type: 'static', position: { x: 0, y: 0, z: 0 } },
      { layer: 'world' },
    );
    physics.registerEntityBody(1, trigger.body, trigger.collider, { key: 'bad-trigger', role: 'trigger' });

    const codes = physics.collectDiagnostics().issues.map((issue) => issue.code);
    expect(codes).toContain('TRIGGER_NOT_SENSOR');
  });
});

async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const physics = new PhysicsWorld({ x: 0, y: -9.81, z: 0 });
  await physics.init();
  return physics;
}

function makeSceneApi(): RuntimeSceneApi {
  return {
    assets: { require: () => null, has: () => false, get: () => null } as never,
    spawnPrefab: () => 0,
    destroyEntity: () => {},
    playAudio: () => {},
    emitGameEvent: () => {},
  };
}

function makeCtx(opts: {
  world: World;
  physics: PhysicsWorld;
  state: GameStateStore;
  events: EventBus<{ 'game:event': { name: string; payload?: Record<string, unknown> } }>;
}): SystemContext {
  const fakeEngine = {
    physics: opts.physics,
    state: opts.state,
    events: opts.events,
    input: {
      actionPressed: () => false,
      actionDown: () => false,
      actionReleased: () => false,
      pressed: () => false,
      down: () => false,
      released: () => false,
    },
    scenes: { switchTo: () => Promise.resolve() },
  } as unknown as SystemContext['engine'];
  return { world: opts.world, engine: fakeEngine, deltaTime: 1 / 60, elapsed: 0 };
}
