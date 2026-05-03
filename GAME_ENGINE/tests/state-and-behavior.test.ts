import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { GameStateStore } from '../src/core/GameStateStore';
import { World } from '../src/core/World';
import { BehaviorSystem } from '../src/systems/BehaviorSystem';
import type { RuntimeSceneApi } from '../src/systems/RuntimeSceneApi';

describe('GameStateStore', () => {
  it('tracks typed state changes and clamps numeric values', () => {
    const state = new GameStateStore();
    const changes: unknown[] = [];
    state.onChange((change) => changes.push(change));
    state.configure({ score: { type: 'number', initial: 0, min: 0, max: 10 } });

    state.increment('score', 7);
    state.increment('score', 7);
    state.decrement('score', 20);

    expect(state.get('score')).toBe(0);
    expect(changes).toHaveLength(3);
  });
});

describe('BehaviorSystem', () => {
  it('runs AI-safe sceneStart behaviors against the game state store', () => {
    const world = new World();
    const state = new GameStateStore();
    state.configure({ score: 0 });
    const engine = {
      state,
      events: new EventBus<any>(),
      input: {},
      scenes: { switchTo: vi.fn() },
    } as any;
    const api = {
      spawnPrefab: vi.fn(),
      destroyEntity: vi.fn(),
      playAudio: vi.fn(),
      emitGameEvent: vi.fn(),
    } as unknown as RuntimeSceneApi;

    const system = new BehaviorSystem(
      [
        {
          trigger: 'sceneStart',
          conditions: [],
          actions: [{ type: 'incrementState', stateKey: 'score', amount: 3 }],
        },
      ],
      api,
    );

    system.init?.({ world, engine, deltaTime: 0, elapsed: 0 });
    system.update?.({ world, engine, deltaTime: 1 / 60, elapsed: 1 / 60 });
    system.update?.({ world, engine, deltaTime: 1 / 60, elapsed: 2 / 60 });

    expect(state.get('score')).toBe(3);
  });
});
