export const PHYSICS_COLLISION_LAYERS = [
  'player',
  'world',
  'enemy',
  'collectible',
  'trigger',
  'projectile',
  'hazard',
  'goal',
  'platform',
  'sensor',
] as const;

export type PhysicsCollisionLayer = typeof PHYSICS_COLLISION_LAYERS[number];

export interface NamedCollisionGroups {
  memberships: readonly PhysicsCollisionLayer[];
  filter: readonly PhysicsCollisionLayer[];
}

export const PHYSICS_LAYER_BITS: Record<PhysicsCollisionLayer, number> = {
  player: 1 << 0,
  world: 1 << 1,
  enemy: 1 << 2,
  collectible: 1 << 3,
  trigger: 1 << 4,
  projectile: 1 << 5,
  hazard: 1 << 6,
  goal: 1 << 7,
  platform: 1 << 8,
  sensor: 1 << 9,
};

export const DEFAULT_COLLISION_FILTERS: Record<PhysicsCollisionLayer, readonly PhysicsCollisionLayer[]> = {
  player: ['world', 'enemy', 'hazard', 'platform', 'collectible', 'trigger', 'goal'],
  world: ['player', 'enemy', 'projectile'],
  enemy: ['world', 'player', 'projectile', 'platform'],
  collectible: ['player'],
  trigger: ['player'],
  projectile: ['enemy', 'world', 'hazard', 'platform'],
  hazard: ['player', 'projectile'],
  goal: ['player'],
  platform: ['player', 'enemy', 'projectile'],
  sensor: ['player', 'world', 'enemy', 'collectible', 'trigger', 'projectile', 'hazard', 'goal', 'platform'],
};

export function physicsLayerBit(layer: PhysicsCollisionLayer): number {
  return PHYSICS_LAYER_BITS[layer];
}

export function physicsLayerMask(layers: readonly PhysicsCollisionLayer[]): number {
  return layers.reduce((mask, layer) => mask | physicsLayerBit(layer), 0);
}

export function toRapierCollisionGroups(groups: NamedCollisionGroups): number {
  if (groups.memberships.length === 0) throw new Error('Collision groups must include at least one membership layer.');
  const memberships = physicsLayerMask(groups.memberships);
  const filter = physicsLayerMask(groups.filter);
  return ((memberships & 0xffff) << 16) | (filter & 0xffff);
}

export function collisionGroupsForLayer(
  layer: PhysicsCollisionLayer,
  collidesWith: readonly PhysicsCollisionLayer[] = DEFAULT_COLLISION_FILTERS[layer],
): number {
  return toRapierCollisionGroups({ memberships: [layer], filter: collidesWith });
}

export function defaultCollisionLayersInteract(a: PhysicsCollisionLayer, b: PhysicsCollisionLayer): boolean {
  return DEFAULT_COLLISION_FILTERS[a].includes(b) && DEFAULT_COLLISION_FILTERS[b].includes(a);
}

export function layerRequiresSensorBehavior(layer: PhysicsCollisionLayer): boolean {
  return layer === 'collectible' || layer === 'trigger' || layer === 'goal';
}

export function canCollisionGroupsInteract(a: number, b: number): boolean {
  const aMemberships = (a >>> 16) & 0xffff;
  const aFilter = a & 0xffff;
  const bMemberships = (b >>> 16) & 0xffff;
  const bFilter = b & 0xffff;
  return (aMemberships & bFilter) !== 0 && (bMemberships & aFilter) !== 0;
}
