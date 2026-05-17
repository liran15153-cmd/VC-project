const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  parseEngineGameDefinitionWithWarnings
} = require('../src/schemas/engineGameDefinitionSchema');

function baseDefinition(overrides = {}) {
  return {
    metadata: { title: 'Phase 3 test', description: 'topdown + triggers' },
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'behavior'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            mesh: { shape: 'sphere', radius: 0.4 },
            rigidBody: {
              type: 'kinematic',
              collider: { shape: 'ball', radius: 0.4 }
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

test('schema accepts characterController.preset=topdown', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities[0].characterController = { preset: 'topdown' };
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const player = result.definition.scenes[0].entities[0];
  assert.equal(player.characterController.preset, 'topdown');
});

test('schema accepts all four character controller presets', () => {
  for (const preset of ['platformer2d', 'runner2d', 'simple3d', 'topdown']) {
    const definition = baseDefinition();
    definition.scenes[0].entities[0].characterController = { preset };
    const result = parseEngineGameDefinitionWithWarnings(definition);
    assert.equal(result.definition.scenes[0].entities[0].characterController.preset, preset);
  }
});

test('schema rejects unknown character controller preset', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities[0].characterController = { preset: 'super-mario' };
  assert.throws(() => parseEngineGameDefinitionWithWarnings(definition));
});

test('schema accepts entity.trigger with onEnter actions', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'lava',
    tags: ['hazard'],
    mesh: { shape: 'box', size: { x: 1, y: 0.1, z: 1 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.05, z: 0.5 } }
    },
    trigger: {
      onEnter: [{ type: 'decrementState', key: 'health', amount: 10 }]
    }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const lava = result.definition.scenes[0].entities.find((e) => e.key === 'lava');
  assert.ok(lava.trigger);
  assert.equal(lava.trigger.onEnter.length, 1);
  assert.equal(lava.trigger.onEnter[0].type, 'decrementState');
});

test('schema accepts trigger with onEnter + onExit + onStay', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'safe-zone',
    mesh: { shape: 'plane', size: { x: 2, y: 2 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 1, y: 0.05, z: 1 } }
    },
    trigger: {
      onEnter: [{ type: 'setState', key: 'inSafeZone', value: true }],
      onStay: [{ type: 'incrementState', key: 'safeTicks', amount: 1 }],
      onExit: [{ type: 'setState', key: 'inSafeZone', value: false }]
    }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const safe = result.definition.scenes[0].entities.find((e) => e.key === 'safe-zone');
  assert.equal(safe.trigger.onEnter.length, 1);
  assert.equal(safe.trigger.onStay.length, 1);
  assert.equal(safe.trigger.onExit.length, 1);
});

test('schema rejects trigger with no phases declared', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'empty-trigger',
    mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
    },
    trigger: {}
  });
  assert.throws(() => parseEngineGameDefinitionWithWarnings(definition));
});

test('schema rejects trigger with empty onEnter array (refine catches it)', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'empty-onenter',
    mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
    },
    trigger: { onEnter: [] }
  });
  assert.throws(() => parseEngineGameDefinitionWithWarnings(definition));
});
