const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';

const {
  parseEngineGameDefinitionWithWarnings
} = require('../src/schemas/engineGameDefinitionSchema');

function baseDefinition(overrides = {}) {
  return {
    metadata: { title: 'Phase 2 test', description: 'physics expansion' },
    scenes: [
      {
        key: 'main',
        systems: ['physicsSync', 'camera', 'behavior'],
        entities: [
          {
            key: 'player',
            tags: ['player'],
            mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
            rigidBody: {
              type: 'kinematic',
              collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

test('schema accepts colliderOptions.material', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'icy-floor',
    mesh: { shape: 'plane', size: { x: 10, y: 10 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 5, y: 0.05, z: 5 } },
      colliderOptions: { material: 'ice' }
    }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const icy = result.definition.scenes[0].entities.find((e) => e.key === 'icy-floor');
  assert.equal(icy.rigidBody.colliderOptions.material, 'ice');
});

test('schema rejects unknown material name', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities[0].rigidBody.colliderOptions = { material: 'lava' };
  assert.throws(() => parseEngineGameDefinitionWithWarnings(definition));
});

test('material + raw friction conflict drops the raw value with a warning', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'ice-with-friction',
    mesh: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
    rigidBody: {
      type: 'static',
      collider: { shape: 'cuboid', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } },
      colliderOptions: { material: 'ice', friction: 0.9 }
    }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const entity = result.definition.scenes[0].entities.find((e) => e.key === 'ice-with-friction');
  assert.equal(entity.rigidBody.colliderOptions.friction, undefined, 'friction should be dropped');
  assert.equal(entity.rigidBody.colliderOptions.material, 'ice');
  const conflict = result.warnings.find((w) => w.code === 'normalized.colliderMaterialConflict');
  assert.ok(conflict, 'expected colliderMaterialConflict normalization warning');
});

test('schema accepts movingPlatform with path waypoints', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'lift',
    mesh: { shape: 'box', size: { x: 2, y: 0.2, z: 2 } },
    rigidBody: {
      type: 'kinematic',
      collider: { shape: 'cuboid', halfExtents: { x: 1, y: 0.1, z: 1 } }
    },
    movingPlatform: {
      kind: 'path',
      waypoints: [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 3, z: 0 }
      ],
      speed: 1.5,
      mode: 'pingpong'
    }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const lift = result.definition.scenes[0].entities.find((e) => e.key === 'lift');
  assert.equal(lift.movingPlatform.kind, 'path');
  assert.equal(lift.movingPlatform.mode, 'pingpong');
  assert.equal(lift.movingPlatform.waypoints.length, 2);
});

test('schema accepts movingPlatform with velocity', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'conveyor',
    mesh: { shape: 'box', size: { x: 4, y: 0.2, z: 2 } },
    rigidBody: {
      type: 'kinematic',
      collider: { shape: 'cuboid', halfExtents: { x: 2, y: 0.1, z: 1 } }
    },
    movingPlatform: { kind: 'velocity', velocity: { x: 1, y: 0, z: 0 } }
  });
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const conv = result.definition.scenes[0].entities.find((e) => e.key === 'conveyor');
  assert.equal(conv.movingPlatform.kind, 'velocity');
  assert.equal(conv.movingPlatform.velocity.x, 1);
});

test('schema rejects path movingPlatform with fewer than 2 waypoints', () => {
  const definition = baseDefinition();
  definition.scenes[0].entities.push({
    key: 'bad-lift',
    mesh: { shape: 'box', size: { x: 2, y: 0.2, z: 2 } },
    rigidBody: {
      type: 'kinematic',
      collider: { shape: 'cuboid', halfExtents: { x: 1, y: 0.1, z: 1 } }
    },
    movingPlatform: { kind: 'path', waypoints: [{ x: 0, y: 0, z: 0 }], speed: 1, mode: 'loop' }
  });
  assert.throws(() => parseEngineGameDefinitionWithWarnings(definition));
});

test('new physics action types pass through normalizeActionList', () => {
  const definition = baseDefinition();
  definition.scenes[0].behaviors = [
    {
      id: 'knockback-on-hit',
      trigger: { type: 'collision' },
      actions: [
        { type: 'applyForce', target: 'self', value: { x: 1, y: 0, z: 0 } },
        { type: 'applyTorque', target: 'self', value: { x: 0, y: 1, z: 0 } },
        { type: 'setAngularVelocity', target: 'self', value: { x: 0, y: 2, z: 0 } },
        { type: 'addKnockback', target: 'other', direction: { x: 1, y: 0, z: 0 }, power: 4, upwardBias: 1.5 },
        { type: 'setLinearVelocity', target: 'self', value: { x: 3, y: 0, z: 0 } }
      ]
    }
  ];
  const result = parseEngineGameDefinitionWithWarnings(definition);
  const actions = result.definition.scenes[0].behaviors[0].actions;
  assert.equal(actions.length, 5);
  assert.deepEqual(
    actions.map((a) => a.type),
    ['applyForce', 'applyTorque', 'setAngularVelocity', 'addKnockback', 'setLinearVelocity']
  );
});
