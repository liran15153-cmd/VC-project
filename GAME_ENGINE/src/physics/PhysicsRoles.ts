import type { PhysicsCollisionLayer } from './CollisionLayers';

export const PHYSICS_ENTITY_ROLES = [
  'player',
  'world',
  'enemy',
  'collectible',
  'trigger',
  'projectile',
  'hazard',
  'goal',
  'platform',
  'unknown',
] as const;

export type PhysicsEntityRole = typeof PHYSICS_ENTITY_ROLES[number];

export interface PhysicsRoleSource {
  key?: string;
  name?: string;
  tags?: readonly string[];
  data?: Record<string, unknown>;
  role?: PhysicsEntityRole;
  bodyType?: 'dynamic' | 'static' | 'kinematic' | string;
  colliderSensor?: boolean;
}

const ROLE_BY_TOKEN: Array<{ role: Exclude<PhysicsEntityRole, 'unknown'>; tokens: readonly string[] }> = [
  { role: 'player', tokens: ['player', 'hero', 'avatar'] },
  { role: 'collectible', tokens: ['collectible', 'pickup', 'coin', 'gem', 'loot', 'reward', 'powerup', 'power-up'] },
  { role: 'goal', tokens: ['goal', 'finish', 'exit', 'win'] },
  { role: 'trigger', tokens: ['trigger', 'checkpoint', 'portal', 'zone', 'sensor', 'area'] },
  { role: 'hazard', tokens: ['hazard', 'spike', 'lava', 'trap', 'damage'] },
  { role: 'enemy', tokens: ['enemy', 'npc', 'monster', 'boss', 'opponent'] },
  { role: 'projectile', tokens: ['projectile', 'bullet', 'missile', 'shot'] },
  { role: 'platform', tokens: ['platform', 'moving-platform', 'lift'] },
  { role: 'world', tokens: ['world', 'ground', 'floor', 'terrain', 'wall', 'obstacle', 'level'] },
];

export function resolvePhysicsRole(source: PhysicsRoleSource): PhysicsEntityRole {
  if (source.role && source.role !== 'unknown') return source.role;

  const dataRole = readRoleFromData(source.data);
  if (dataRole) return dataRole;

  const tokens = collectPhysicsRoleTokens(source);
  for (const entry of ROLE_BY_TOKEN) {
    if (entry.tokens.some((token) => tokens.includes(token))) return entry.role;
  }

  if (source.colliderSensor) return 'trigger';
  if (source.bodyType === 'static') return 'world';
  return 'unknown';
}

export function physicsRoleToCollisionLayer(role: PhysicsEntityRole): PhysicsCollisionLayer | undefined {
  return role === 'unknown' ? undefined : role;
}

export function roleRequiresSensorBehavior(role: PhysicsEntityRole): boolean {
  return role === 'collectible' || role === 'trigger' || role === 'goal';
}

export function isSolidCollisionRole(role: PhysicsEntityRole): boolean {
  return role === 'player' || role === 'world' || role === 'enemy' || role === 'projectile' || role === 'hazard' || role === 'platform';
}

function readRoleFromData(data?: Record<string, unknown>): PhysicsEntityRole | null {
  if (!data) return null;
  for (const key of ['role', 'physicsRole', 'kind', 'type']) {
    const value = data[key];
    if (typeof value === 'string' && isPhysicsEntityRole(value)) return value;
  }
  return null;
}

function isPhysicsEntityRole(value: string): value is PhysicsEntityRole {
  return (PHYSICS_ENTITY_ROLES as readonly string[]).includes(value);
}

function collectPhysicsRoleTokens(source: PhysicsRoleSource): string[] {
  const values: string[] = [source.key ?? '', source.name ?? '', ...(source.tags ?? [])];
  for (const value of Object.values(source.data ?? {})) {
    if (typeof value === 'string') values.push(value);
  }
  return values.flatMap((value) => value.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
}
