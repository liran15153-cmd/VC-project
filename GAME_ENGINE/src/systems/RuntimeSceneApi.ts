import type { AssetManager } from '../assets/AssetManager';
import type { Engine } from '../core/Engine';
import type { EntityId, Vec3 } from '../core/types';
import type { World } from '../core/World';
import { EntityInfo } from '../components/EntityInfo';

export interface CollisionContext {
  entityA: EntityId;
  entityB: EntityId;
  other?: EntityId;
  self?: EntityId;
  started: boolean;
}

export interface RuntimeSceneApi {
  readonly assets: AssetManager;
  spawnPrefab(prefab: string, options?: { position?: Vec3; key?: string; tags?: string[]; data?: Record<string, unknown> }): EntityId;
  destroyEntity(id: EntityId): void;
  playAudio(assetKey: string, volume?: number): void;
  emitGameEvent(name: string, payload?: Record<string, unknown>): void;
}

export function entityInfo(world: World, id: EntityId): EntityInfo | undefined {
  return world.getComponent(id, EntityInfo);
}

export function entityKey(world: World, id: EntityId): string | undefined {
  return entityInfo(world, id)?.key;
}

export function entityTags(world: World, id: EntityId): string[] {
  return [...(entityInfo(world, id)?.tags ?? [])];
}

export function findEntityByKey(world: World, key: string): EntityId | undefined {
  for (const { id, components } of world.query(EntityInfo)) {
    if ((components[0] as EntityInfo).key === key) return id;
  }
  return undefined;
}

export function findEntitiesByTag(world: World, tag: string): EntityId[] {
  const ids: EntityId[] = [];
  for (const { id, components } of world.query(EntityInfo)) {
    if ((components[0] as EntityInfo).hasTag(tag)) ids.push(id);
  }
  return ids;
}

export function selectEntities(world: World, target: unknown, context: CollisionContext = { entityA: 0, entityB: 0, started: false }): EntityId[] {
  if (typeof target === 'number') return world.isAlive(target) ? [target] : [];
  if (typeof target === 'string') {
    if (target === 'self' && context.self) return [context.self];
    if ((target === 'other' || target === 'collisionOther') && context.other) return [context.other];
    if (target === 'collisionA' && context.entityA) return [context.entityA];
    if (target === 'collisionB' && context.entityB) return [context.entityB];
    const byKey = findEntityByKey(world, target);
    if (byKey !== undefined) return [byKey];
    return findEntitiesByTag(world, target);
  }
  if (!target || typeof target !== 'object') return [];

  const selector = target as Record<string, unknown>;
  if (typeof selector.key === 'string') {
    const found = findEntityByKey(world, selector.key);
    return found !== undefined ? [found] : [];
  }
  if (typeof selector.tag === 'string') return findEntitiesByTag(world, selector.tag);
  if (selector.type === 'self' && context.self) return [context.self];
  if ((selector.type === 'other' || selector.type === 'collisionOther') && context.other) return [context.other];
  if (selector.type === 'all') {
    return [...world.query(EntityInfo)].map(({ id }) => id);
  }
  return [];
}

export function emitCollision(engine: Engine, world: World, context: CollisionContext): void {
  engine.events.emit('game:collision', {
    entityA: context.entityA,
    entityB: context.entityB,
    keyA: entityKey(world, context.entityA),
    keyB: entityKey(world, context.entityB),
    tagsA: entityTags(world, context.entityA),
    tagsB: entityTags(world, context.entityB),
    started: context.started,
  });
}
