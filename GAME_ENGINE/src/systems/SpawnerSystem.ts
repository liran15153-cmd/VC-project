import type { SpawnerDefinition } from '../runtime/GameDefinition';
import type { EntityId, ISystem, SystemContext, Vec3 } from '../core/types';
import type { RuntimeSceneApi } from './RuntimeSceneApi';

interface SpawnerState {
  elapsed: number;
  spawned: EntityId[];
}

export class SpawnerSystem implements ISystem {
  readonly name = 'SpawnerSystem';
  enabled = true;
  priority = 1;

  private readonly states = new Map<string, SpawnerState>();

  constructor(
    private readonly spawners: SpawnerDefinition[],
    private readonly api: RuntimeSceneApi,
  ) {}

  init(): void {
    for (let i = 0; i < this.spawners.length; i++) {
      const spawner = this.spawners[i];
      const id = spawner.id ?? `spawner:${i}`;
      const state: SpawnerState = { elapsed: 0, spawned: [] };
      this.states.set(id, state);

      for (let p = 0; p < spawner.positions.length; p++) {
        state.spawned.push(
          this.api.spawnPrefab(spawner.prefab, {
            position: spawner.positions[p],
            key: `${id}:${p}`,
            tags: spawner.tags,
          }),
        );
      }

      const remaining = Math.max(0, (spawner.count ?? 0) - spawner.positions.length);
      for (let p = 0; p < remaining; p++) {
        state.spawned.push(
          this.api.spawnPrefab(spawner.prefab, {
            position: randomPoint(spawner.area) ?? { x: 0, y: 0, z: 0 },
            key: `${id}:generated:${p}`,
            tags: spawner.tags,
          }),
        );
      }
    }
  }

  update({ world, deltaTime }: SystemContext): void {
    for (let i = 0; i < this.spawners.length; i++) {
      const spawner = this.spawners[i];
      if (!spawner.everySeconds) continue;
      const id = spawner.id ?? `spawner:${i}`;
      const state = this.states.get(id);
      if (!state) continue;

      state.spawned = state.spawned.filter((entity) => world.isAlive(entity));
      if (spawner.maxAlive && state.spawned.length >= spawner.maxAlive) continue;

      state.elapsed += deltaTime;
      if (state.elapsed < spawner.everySeconds) continue;
      state.elapsed -= spawner.everySeconds;
      state.spawned.push(
        this.api.spawnPrefab(spawner.prefab, {
          position: randomPoint(spawner.area) ?? spawner.positions[0] ?? { x: 0, y: 0, z: 0 },
          key: `${id}:tick:${Date.now()}`,
          tags: spawner.tags,
        }),
      );
    }
  }
}

function randomPoint(area: SpawnerDefinition['area']): Vec3 | undefined {
  if (!area) return undefined;
  return {
    x: range(area.min.x, area.max.x),
    y: range(area.min.y, area.max.y),
    z: range(area.min.z, area.max.z),
  };
}

function range(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
