import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGameDefinition } from '../src/runtime/GameDefinition';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('GameDefinition schema', () => {
  it('fills safe defaults for a minimal generated game', () => {
    const definition = parseGameDefinition({
      metadata: {
        title: 'Dragon Cube',
      },
      scenes: [
        {
          key: 'main',
          entities: [
            {
              key: 'player',
              mesh: { shape: 'box' },
              rigidBody: { collider: { shape: 'cuboid' } },
              cameraTarget: {},
            },
          ],
        },
      ],
    });

    expect(definition.schemaVersion).toBe(1);
    expect(definition.engine.gravity).toEqual({ x: 0, y: -9.81, z: 0 });
    expect(definition.scenes[0].systems).toEqual(['physicsSync', 'camera']);
    expect(definition.scenes[0].entities[0].transform.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('rejects an initialScene that does not exist', () => {
    expect(() =>
      parseGameDefinition({
        metadata: { title: 'Broken' },
        initialScene: 'missing',
        scenes: [{ key: 'main' }],
      }),
    ).toThrow(/initialScene/i);
  });

  it('accepts AI-safe logic, prefab, UI, audio, and richer shape definitions', () => {
    const definition = parseGameDefinition({
      metadata: { title: 'Coin Runner' },
      state: {
        score: { type: 'number', initial: 0, min: 0 },
        lives: 3,
      },
      inputBindings: {
        jump: ['Space', 'ArrowUp'],
      },
      prefabs: {
        coin: {
          tags: ['coin'],
          mesh: { shape: 'cylinder', radiusTop: 0.4, radiusBottom: 0.4, height: 0.1 },
          rigidBody: { type: 'static', collider: { shape: 'ball', radius: 0.4 }, colliderOptions: { sensor: true } },
        },
      },
      behaviors: [
        {
          trigger: { type: 'stateChange', stateKey: 'score' },
          conditions: [{ stateKey: 'score', gte: 10 }],
          actions: [{ type: 'switchScene', scene: 'win' }],
        },
      ],
      scenes: [
        {
          key: 'main',
          lights: [{ type: 'ambient', intensity: 0.7 }],
          entities: [{ key: 'player', tags: ['player'], mesh: { shape: 'cone' } }],
          spawners: [{ prefab: 'coin', positions: [{ x: 1, y: 2, z: 0 }] }],
          ui: [{ type: 'text', text: 'Score: {score}' }],
          audio: [{ trigger: { type: 'stateChange', stateKey: 'score' }, asset: 'coinSound' }],
        },
        { key: 'win' },
      ],
    });

    expect(definition.inputBindings.jump).toEqual(['Space', 'ArrowUp']);
    expect(definition.scenes[0].spawners[0].prefab).toBe('coin');
    expect(definition.scenes[0].lights[0].type).toBe('ambient');
  });

  it('accepts model-backed entities when the GLB asset is declared', () => {
    const definition = parseGameDefinition({
      metadata: { title: 'Model Preview' },
      assets: [{ key: 'crate-model', type: 'gltf', url: '/assets/library/kenney-platformer-kit/models/glb-format/crate.glb' }],
      scenes: [
        {
          key: 'main',
          entities: [
            {
              key: 'crate',
              model: {
                assetKey: 'crate-model',
                positionOffset: { x: 0, y: -0.5, z: 0 },
                scale: { x: 1.2, y: 1.2, z: 1.2 },
              },
              rigidBody: { type: 'static', collider: { shape: 'cuboid' } },
            },
          ],
        },
      ],
    });

    expect(definition.scenes[0].entities[0].model?.assetKey).toBe('crate-model');
  });

  it('rejects model-backed entities when the asset is missing', () => {
    expect(() =>
      parseGameDefinition({
        metadata: { title: 'Broken Model Preview' },
        scenes: [
          {
            key: 'main',
            entities: [{ key: 'crate', model: { assetKey: 'missing-model' } }],
          },
        ],
      }),
    ).toThrow(/missing model asset/i);
  });

  it('rejects spawners that reference missing prefabs', () => {
    expect(() =>
      parseGameDefinition({
        metadata: { title: 'Broken Spawner' },
        scenes: [{ key: 'main', spawners: [{ prefab: 'missing' }] }],
      }),
    ).toThrow(/missing prefab/i);
  });

  it('keeps the AI game example valid', () => {
    const example = JSON.parse(readFileSync(resolve(__dirname, '../examples/ai-game-definition.json'), 'utf-8'));
    const definition = parseGameDefinition(example);
    expect(definition.metadata.title).toBe('AI Coin Jumper');
  });
});
