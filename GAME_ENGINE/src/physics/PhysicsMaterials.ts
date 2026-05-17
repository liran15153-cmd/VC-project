export const PHYSICS_MATERIAL_PRESETS = ['default', 'ice', 'metal', 'rubber', 'wood', 'flesh'] as const;

export type PhysicsMaterialName = typeof PHYSICS_MATERIAL_PRESETS[number];

export interface PhysicsMaterialProperties {
  friction: number;
  restitution: number;
  density: number;
  linearDamping?: number;
  angularDamping?: number;
}

export const PHYSICS_MATERIAL_PROPERTIES: Record<PhysicsMaterialName, PhysicsMaterialProperties> = {
  default: { friction: 0.5, restitution: 0, density: 1 },
  ice: { friction: 0.02, restitution: 0, density: 0.9 },
  metal: { friction: 0.6, restitution: 0.05, density: 7.8 },
  rubber: { friction: 0.9, restitution: 0.7, density: 1.1 },
  wood: { friction: 0.7, restitution: 0.15, density: 0.7 },
  flesh: { friction: 0.8, restitution: 0, density: 1, linearDamping: 0.3, angularDamping: 0.3 },
};

export function isPhysicsMaterialName(value: string): value is PhysicsMaterialName {
  return (PHYSICS_MATERIAL_PRESETS as readonly string[]).includes(value);
}

export function getMaterialProperties(name: PhysicsMaterialName): PhysicsMaterialProperties {
  return PHYSICS_MATERIAL_PROPERTIES[name];
}
