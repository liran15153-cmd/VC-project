import RAPIER from '@dimforge/rapier3d-compat';
import type { EntityId, Vec3 } from '../core/types';
import { canCollisionGroupsInteract, defaultCollisionLayersInteract } from './CollisionLayers';
import type { PhysicsCollisionLayer } from './CollisionLayers';
import {
  isSolidCollisionRole,
  physicsRoleToCollisionLayer,
  type PhysicsEntityRole,
} from './PhysicsRoles';

export type { PhysicsEntityRole } from './PhysicsRoles';

export type RapierModule = typeof RAPIER;

export interface CollisionEvent {
  colliderA: number;
  colliderB: number;
  started: boolean;
}

export type PhysicsInteractionKind = 'collision' | 'sensor';
export type PhysicsInteractionEventType =
  | 'collisionEnter'
  | 'collisionStay'
  | 'collisionExit'
  | 'sensorEnter'
  | 'sensorExit';

export interface PhysicsInteractionPair {
  key: string;
  kind: PhysicsInteractionKind;
  entityA: EntityId;
  entityB: EntityId;
  colliderHandleA: number;
  colliderHandleB: number;
  roleA: PhysicsEntityRole;
  roleB: PhysicsEntityRole;
  sensorA: boolean;
  sensorB: boolean;
}

export interface PhysicsInteractionEvent extends PhysicsInteractionPair {
  type: PhysicsInteractionEventType;
  frame: number;
  tick: number;
}

export interface PhysicsRaycastOptions {
  origin: Vec3;
  direction: Vec3;
  maxToi?: number;
  solid?: boolean;
  includeNormal?: boolean;
  filterFlags?: RAPIER.QueryFilterFlags;
  filterGroups?: RAPIER.InteractionGroups;
  excludeCollider?: RAPIER.Collider;
  excludeRigidBody?: RAPIER.RigidBody;
  predicate?: (collider: RAPIER.Collider) => boolean;
}

export interface PhysicsShapeCastOptions {
  shape: RAPIER.Shape;
  position: Vec3;
  velocity: Vec3;
  rotation?: RAPIER.Rotation;
  targetDistance?: number;
  maxToi?: number;
  stopAtPenetration?: boolean;
  filterFlags?: RAPIER.QueryFilterFlags;
  filterGroups?: RAPIER.InteractionGroups;
  excludeCollider?: RAPIER.Collider;
  excludeRigidBody?: RAPIER.RigidBody;
  predicate?: (collider: RAPIER.Collider) => boolean;
}

export interface PhysicsEntityQueryOptions {
  roles?: readonly PhysicsEntityRole[];
  excludeEntityId?: EntityId;
  includeSensors?: boolean;
  includeSolids?: boolean;
  maxToi?: number;
}

export interface PhysicsQueryHit {
  entityId: EntityId | null;
  colliderHandle: number;
  role: PhysicsEntityRole;
  timeOfImpact: number;
  normal?: Vec3;
}

export interface PhysicsRadiusQueryHit {
  entityId: EntityId;
  colliderHandle: number;
  role: PhysicsEntityRole;
  sensor: boolean;
}

export interface PhysicsLineOfSightResult {
  clear: boolean;
  hit: PhysicsQueryHit | null;
  blockedByEntityId: EntityId | null;
}

export interface PhysicsEntityMetadata {
  key?: string;
  role?: PhysicsEntityRole;
  tags?: readonly string[];
  expectedCollider?: boolean;
}

export interface RegisterEntityColliderOptions {
  primary?: boolean;
  metadata?: PhysicsEntityMetadata;
}

export type PhysicsDiagnosticSeverity = 'info' | 'warning' | 'error';

export type PhysicsDiagnosticCode =
  | 'PLAYER_HAS_NO_COLLIDER'
  | 'COLLECTIBLE_NOT_SENSOR'
  | 'TRIGGER_NOT_SENSOR'
  | 'ENTITY_BODY_LOOKUP_MISSING'
  | 'NO_WORLD_COLLIDER_FOUND'
  | 'PHYSICS_EVENT_PAIR_ORPHANED'
  | 'ENTITY_HAS_COLLIDER_NO_ROLE'
  | 'PLAYER_NOT_GROUNDED'
  | 'WORLD_HAS_NO_STATIC_COLLIDER'
  | 'SENSOR_WITH_SOLID_COLLISION_ROLE'
  | 'COLLISION_MATRIX_BLOCKED_EXPECTED_PAIR'
  | 'PROJECTILE_HAS_NO_COLLIDER'
  | 'CHARACTER_CONTROLLER_NO_BODY'
  | 'CHARACTER_CONTROLLER_NO_COLLIDER'
  | 'CHARACTER_CONTROLLER_NOT_KINEMATIC'
  | 'CHARACTER_CONTROLLER_NO_GROUND'
  | 'CHARACTER_CONTROLLER_INVALID_PRESET'
  | 'BODY_NOT_DYNAMIC_FOR_FORCE';

export interface PhysicsDiagnosticIssue {
  code: PhysicsDiagnosticCode;
  severity: PhysicsDiagnosticSeverity;
  message: string;
  entityId?: EntityId;
  entityKey?: string;
}

export interface PhysicsEntityDiagnostic {
  entityId: EntityId;
  key?: string;
  role: PhysicsEntityRole;
  tags: readonly string[];
  bodyRegistered: boolean;
  bodyIsStatic: boolean;
  colliderCount: number;
  primaryColliderRegistered: boolean;
  sensorColliderCount: number;
  grounded: boolean | null;
  characterController?: PhysicsCharacterControllerDiagnostic;
}

export interface PhysicsCharacterControllerDiagnostic {
  preset: string;
  validPreset: boolean;
  grounded: boolean | null;
  groundCheckPerformed: boolean;
  lastGroundDistance: number | null;
  falling?: boolean;
  wallHit?: boolean;
  onSlope?: boolean;
  slopeAngle?: number | null;
}

export interface PhysicsCharacterControllerRegistration {
  preset: string;
  validPreset: boolean;
  grounded?: boolean | null;
  groundCheckPerformed?: boolean;
  lastGroundDistance?: number | null;
  falling?: boolean;
  wallHit?: boolean;
  onSlope?: boolean;
  slopeAngle?: number | null;
}

export interface PhysicsBodyInterpolationState {
  prevTranslation: Vec3;
  prevRotation: { x: number; y: number; z: number; w: number };
  currTranslation: Vec3;
  currRotation: { x: number; y: number; z: number; w: number };
}

export interface PhysicsDiagnostics {
  ready: boolean;
  gravity: Vec3;
  bodyCount: number;
  colliderCount: number;
  entityBindingCount: number;
  debugLineCount: number;
  lastStepDt: number | null;
  lastStepAt: number | null;
  physicsFrame: number;
  activeCollisionPairCount: number;
  activeSensorPairCount: number;
  pendingPhysicsEventCount: number;
  entities: PhysicsEntityDiagnostic[];
  issues: PhysicsDiagnosticIssue[];
}

/**
 * Thin wrapper around a Rapier 3D world. Loads the WASM lazily.
 * Stays a 3D physics world even for 2D games - we just lock the unused axis
 * via a RigidBodyDesc.lockTranslations() / lockRotations() helper if needed.
 */
export class PhysicsWorld {
  world!: RAPIER.World;
  eventQueue!: RAPIER.EventQueue;
  rapier!: RapierModule;
  private initialised = false;
  private currentGravity: Vec3;
  private readonly bodiesByEntityId = new Map<EntityId, RAPIER.RigidBody>();
  private readonly collidersByEntityId = new Map<EntityId, RAPIER.Collider[]>();
  private readonly primaryColliderByEntityId = new Map<EntityId, RAPIER.Collider>();
  private readonly entityIdByColliderHandle = new Map<number, EntityId>();
  private readonly colliderByHandle = new Map<number, RAPIER.Collider>();
  private readonly entityMetadataById = new Map<EntityId, PhysicsEntityMetadata>();
  private readonly characterControllersByEntityId = new Map<EntityId, PhysicsCharacterControllerDiagnostic>();
  private readonly interpolationStateByEntityId = new Map<EntityId, PhysicsBodyInterpolationState>();
  private readonly platformDeltaByEntityId = new Map<EntityId, Vec3>();
  private readonly transientDiagnosticIssues: PhysicsDiagnosticIssue[] = [];
  private activeCollisionPairs = new Map<string, PhysicsInteractionPair>();
  private activeSensorPairs = new Map<string, PhysicsInteractionPair>();
  private readonly pendingPhysicsEvents: PhysicsInteractionEvent[] = [];
  private orphanedPairCount = 0;
  private physicsFrame = 0;
  private lastStepDt: number | null = null;
  private lastStepAt: number | null = null;

  constructor(gravity: Vec3) {
    this.currentGravity = { ...gravity };
  }

  async init(): Promise<void> {
    if (this.initialised) return;
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: this.currentGravity.x, y: this.currentGravity.y, z: this.currentGravity.z });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.initialised = true;
  }

  step(dt: number): void {
    if (!this.initialised) return;
    this.capturePreStepInterpolationSnapshot();
    this.world.timestep = dt;
    this.world.step(this.eventQueue);
    this.physicsFrame += 1;
    this.capturePostStepInterpolationSnapshot();
    this.updateInteractionTracking();
    this.transientDiagnosticIssues.length = 0;
    this.lastStepDt = dt;
    this.lastStepAt = Date.now();
  }

  recordTransientIssue(issue: PhysicsDiagnosticIssue): void {
    this.transientDiagnosticIssues.push(issue);
  }

  registerPlatformDelta(entityId: EntityId, delta: Vec3): void {
    this.platformDeltaByEntityId.set(entityId, { x: delta.x, y: delta.y, z: delta.z });
  }

  getPlatformDelta(entityId: EntityId): Vec3 | null {
    const delta = this.platformDeltaByEntityId.get(entityId);
    return delta ? { x: delta.x, y: delta.y, z: delta.z } : null;
  }

  clearPlatformDelta(entityId: EntityId): void {
    this.platformDeltaByEntityId.delete(entityId);
  }

  getInterpolationState(entityId: EntityId): PhysicsBodyInterpolationState | null {
    return this.interpolationStateByEntityId.get(entityId) ?? null;
  }

  getInterpolatedTranslation(entityId: EntityId, alpha: number): Vec3 | null {
    const state = this.interpolationStateByEntityId.get(entityId);
    if (!state) return null;
    const t = clamp01(alpha);
    return {
      x: state.prevTranslation.x + (state.currTranslation.x - state.prevTranslation.x) * t,
      y: state.prevTranslation.y + (state.currTranslation.y - state.prevTranslation.y) * t,
      z: state.prevTranslation.z + (state.currTranslation.z - state.prevTranslation.z) * t,
    };
  }

  getInterpolatedRotation(entityId: EntityId, alpha: number): { x: number; y: number; z: number; w: number } | null {
    const state = this.interpolationStateByEntityId.get(entityId);
    if (!state) return null;
    return slerpQuat(state.prevRotation, state.currRotation, clamp01(alpha));
  }

  /**
   * Teleport an entity's rigid body to a new position (and optional rotation).
   * Wraps Rapier's two body-type APIs (setNextKinematicTranslation vs setTranslation),
   * resets the interpolation snapshot so renderers do not interpolate across the jump,
   * and avoids leaking collision events that span the teleport.
   *
   * Returns `true` if the teleport was applied.
   */
  teleportEntity(
    entityId: EntityId,
    position: Vec3,
    rotation?: { x: number; y: number; z: number; w: number },
  ): boolean {
    const body = this.bodiesByEntityId.get(entityId);
    if (!body) return false;
    if (body.isKinematic()) {
      body.setNextKinematicTranslation(position);
      body.setTranslation(position, true);
      if (rotation) {
        body.setNextKinematicRotation(rotation);
        body.setRotation(rotation, true);
      }
    } else {
      body.setTranslation(position, true);
      if (rotation) body.setRotation(rotation, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.resetInterpolationSnapshot(entityId);
    return true;
  }

  resetInterpolationSnapshot(entityId: EntityId): void {
    const body = this.bodiesByEntityId.get(entityId);
    if (!body) {
      this.interpolationStateByEntityId.delete(entityId);
      return;
    }
    const t = body.translation();
    const r = body.rotation();
    this.interpolationStateByEntityId.set(entityId, {
      prevTranslation: { x: t.x, y: t.y, z: t.z },
      prevRotation: { x: r.x, y: r.y, z: r.z, w: r.w },
      currTranslation: { x: t.x, y: t.y, z: t.z },
      currRotation: { x: r.x, y: r.y, z: r.z, w: r.w },
    });
  }

  setGravity(g: Vec3): void {
    this.currentGravity = { ...g };
    if (!this.initialised) return;
    this.world.gravity = { x: g.x, y: g.y, z: g.z };
  }

  debugRender(): RAPIER.DebugRenderBuffers | null {
    if (!this.initialised) return null;
    return this.world.debugRender();
  }

  castRay(options: PhysicsRaycastOptions): RAPIER.RayColliderHit | RAPIER.RayColliderIntersection | null {
    if (!this.initialised) return null;
    const ray = new RAPIER.Ray(options.origin, options.direction);
    const args = [
      ray,
      options.maxToi ?? 1000,
      options.solid ?? true,
      options.filterFlags,
      options.filterGroups,
      options.excludeCollider,
      options.excludeRigidBody,
      options.predicate,
    ] as const;
    return options.includeNormal ? this.world.castRayAndGetNormal(...args) : this.world.castRay(...args);
  }

  castShape(options: PhysicsShapeCastOptions): RAPIER.ColliderShapeCastHit | null {
    if (!this.initialised) return null;
    return this.world.castShape(
      options.position,
      options.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
      options.velocity,
      options.shape,
      options.targetDistance ?? 0,
      options.maxToi ?? 1000,
      options.stopAtPenetration ?? false,
      options.filterFlags,
      options.filterGroups,
      options.excludeCollider,
      options.excludeRigidBody,
      options.predicate,
    );
  }

  getGroundHit(entityId: EntityId, options: PhysicsEntityQueryOptions = {}): PhysicsQueryHit | null {
    const body = this.getBodyByEntityId(entityId);
    if (!body) return null;
    return this.raycastFromEntity(entityId, { x: 0, y: -1, z: 0 }, {
      ...options,
      includeSensors: options.includeSensors ?? false,
      maxToi: options.maxToi ?? 1.1,
    });
  }

  isGrounded(entityId: EntityId, options: PhysicsEntityQueryOptions = {}): boolean {
    return this.getGroundHit(entityId, options) !== null;
  }

  raycastFromEntity(entityId: EntityId, direction: Vec3, options: PhysicsEntityQueryOptions = {}): PhysicsQueryHit | null {
    const body = this.getBodyByEntityId(entityId);
    if (!body) return null;
    const ownColliders = this.getCollidersByEntityId(entityId);
    const hit = this.castRay({
      origin: body.translation(),
      direction: normalizeVector(direction),
      maxToi: options.maxToi ?? 1000,
      includeNormal: true,
      excludeRigidBody: body,
      predicate: (candidate) => !ownColliders.includes(candidate) && this.matchesEntityQuery(candidate, options),
    });
    return hit ? this.toPhysicsQueryHit(hit) : null;
  }

  findEntitiesInRadius(position: Vec3, radius: number, options: PhysicsEntityQueryOptions = {}): PhysicsRadiusQueryHit[] {
    if (!this.initialised || radius <= 0) return [];
    const seen = new Set<EntityId>();
    const results: PhysicsRadiusQueryHit[] = [];
    this.world.intersectionsWithShape(
      position,
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Ball(radius),
      (collider) => {
        if (!this.matchesEntityQuery(collider, options)) return true;
        const entityId = this.entityIdByColliderHandle.get(collider.handle);
        if (entityId === undefined || seen.has(entityId)) return true;
        seen.add(entityId);
        results.push({
          entityId,
          colliderHandle: collider.handle,
          role: this.getEntityRole(entityId),
          sensor: collider.isSensor(),
        });
        return true;
      },
    );
    return results;
  }

  lineOfSight(fromEntityId: EntityId, toEntityId: EntityId, options: PhysicsEntityQueryOptions = {}): PhysicsLineOfSightResult {
    const from = this.getBodyByEntityId(fromEntityId);
    const to = this.getBodyByEntityId(toEntityId);
    if (!from || !to) return { clear: false, hit: null, blockedByEntityId: null };

    const origin = from.translation();
    const target = to.translation();
    const delta = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
    const distance = Math.hypot(delta.x, delta.y, delta.z);
    if (distance === 0) return { clear: true, hit: null, blockedByEntityId: null };

    const hit = this.raycastFromEntity(fromEntityId, delta, {
      ...options,
      includeSensors: options.includeSensors ?? false,
      maxToi: options.maxToi ?? distance,
    });
    if (!hit) return { clear: true, hit: null, blockedByEntityId: null };
    if (hit.entityId === toEntityId) return { clear: true, hit, blockedByEntityId: null };
    return { clear: false, hit, blockedByEntityId: hit.entityId };
  }

  registerEntityBody(
    entityId: EntityId,
    body: RAPIER.RigidBody,
    colliders?: RAPIER.Collider | readonly RAPIER.Collider[],
    metadata?: PhysicsEntityMetadata,
  ): void {
    this.bodiesByEntityId.set(entityId, body);
    if (metadata) this.setEntityMetadata(entityId, metadata);
    if (!colliders) return;

    const colliderList = Array.isArray(colliders) ? colliders : [colliders];
    this.collidersByEntityId.set(entityId, []);
    this.primaryColliderByEntityId.delete(entityId);
    for (const collider of colliderList) this.registerEntityCollider(entityId, collider);
  }

  registerEntityCollider(entityId: EntityId, collider: RAPIER.Collider, options: RegisterEntityColliderOptions = {}): void {
    if (options.metadata) this.setEntityMetadata(entityId, options.metadata);
    const colliders = this.collidersByEntityId.get(entityId) ?? [];
    if (!colliders.includes(collider)) colliders.push(collider);
    this.collidersByEntityId.set(entityId, colliders);
    this.entityIdByColliderHandle.set(collider.handle, entityId);
    this.colliderByHandle.set(collider.handle, collider);
    if (options.primary || !this.primaryColliderByEntityId.has(entityId)) {
      this.primaryColliderByEntityId.set(entityId, collider);
    }
  }

  unregisterEntityBody(entityId: EntityId): void {
    for (const collider of this.collidersByEntityId.get(entityId) ?? []) {
      this.entityIdByColliderHandle.delete(collider.handle);
      this.colliderByHandle.delete(collider.handle);
    }
    this.bodiesByEntityId.delete(entityId);
    this.collidersByEntityId.delete(entityId);
    this.primaryColliderByEntityId.delete(entityId);
    this.entityMetadataById.delete(entityId);
    this.characterControllersByEntityId.delete(entityId);
    this.interpolationStateByEntityId.delete(entityId);
    this.platformDeltaByEntityId.delete(entityId);
  }

  getBodyByEntityId(entityId: EntityId): RAPIER.RigidBody | null {
    return this.bodiesByEntityId.get(entityId) ?? null;
  }

  getPrimaryColliderByEntityId(entityId: EntityId): RAPIER.Collider | null {
    return this.primaryColliderByEntityId.get(entityId) ?? null;
  }

  getCollidersByEntityId(entityId: EntityId): readonly RAPIER.Collider[] {
    return [...(this.collidersByEntityId.get(entityId) ?? [])];
  }

  getColliderByEntityId(entityId: EntityId): RAPIER.Collider | null {
    return this.getPrimaryColliderByEntityId(entityId);
  }

  getEntityRole(entityId: EntityId): PhysicsEntityRole {
    return this.entityMetadataById.get(entityId)?.role ?? 'unknown';
  }

  getEntityIdByColliderHandle(colliderHandle: number): EntityId | null {
    return this.entityIdByColliderHandle.get(colliderHandle) ?? null;
  }

  getActiveCollisionPairs(): readonly PhysicsInteractionPair[] {
    return [...this.activeCollisionPairs.values()];
  }

  getActiveSensorPairs(): readonly PhysicsInteractionPair[] {
    return [...this.activeSensorPairs.values()];
  }

  getPhysicsEvents(options: { includeStay?: boolean } = {}): readonly PhysicsInteractionEvent[] {
    return this.pendingPhysicsEvents.filter((event) => options.includeStay || event.type !== 'collisionStay');
  }

  drainPhysicsEvents(handler: (event: PhysicsInteractionEvent) => void, options: { includeStay?: boolean } = {}): void {
    for (const event of this.pendingPhysicsEvents) {
      if (options.includeStay || event.type !== 'collisionStay') handler(event);
    }
    this.pendingPhysicsEvents.length = 0;
  }

  registerCharacterController(entityId: EntityId, registration: PhysicsCharacterControllerRegistration): void {
    this.characterControllersByEntityId.set(entityId, {
      preset: registration.preset,
      validPreset: registration.validPreset,
      grounded: registration.grounded ?? null,
      groundCheckPerformed: registration.groundCheckPerformed ?? false,
      lastGroundDistance: registration.lastGroundDistance ?? null,
      falling: registration.falling ?? false,
      wallHit: registration.wallHit ?? false,
      onSlope: registration.onSlope ?? false,
      slopeAngle: registration.slopeAngle ?? null,
    });
  }

  updateCharacterControllerDiagnostics(entityId: EntityId, patch: Partial<PhysicsCharacterControllerDiagnostic>): void {
    const current = this.characterControllersByEntityId.get(entityId);
    if (!current) return;
    this.characterControllersByEntityId.set(entityId, { ...current, ...patch });
  }

  unregisterCharacterController(entityId: EntityId): void {
    this.characterControllersByEntityId.delete(entityId);
  }

  collectDiagnostics(): PhysicsDiagnostics {
    const debug = this.debugRender();
    const entities = this.collectEntityDiagnostics();
    const issues = this.collectDiagnosticIssues(entities);
    return {
      ready: this.initialised,
      gravity: { ...this.currentGravity },
      bodyCount: this.initialised ? this.world.bodies.len() : 0,
      colliderCount: this.initialised ? this.world.colliders.len() : 0,
      entityBindingCount: this.bodiesByEntityId.size,
      debugLineCount: debug ? debug.vertices.length / 6 : 0,
      lastStepDt: this.lastStepDt,
      lastStepAt: this.lastStepAt,
      physicsFrame: this.physicsFrame,
      activeCollisionPairCount: this.activeCollisionPairs.size,
      activeSensorPairCount: this.activeSensorPairs.size,
      pendingPhysicsEventCount: this.pendingPhysicsEvents.length,
      entities,
      issues,
    };
  }

  drainCollisionEvents(handler: (event: CollisionEvent) => void): void {
    if (!this.initialised) return;
    this.eventQueue.drainCollisionEvents((colliderA, colliderB, started) => {
      handler({ colliderA, colliderB, started });
    });
  }

  isReady(): boolean {
    return this.initialised;
  }

  destroy(): void {
    if (!this.initialised) return;
    this.bodiesByEntityId.clear();
    this.collidersByEntityId.clear();
    this.primaryColliderByEntityId.clear();
    this.entityIdByColliderHandle.clear();
    this.colliderByHandle.clear();
    this.entityMetadataById.clear();
    this.characterControllersByEntityId.clear();
    this.interpolationStateByEntityId.clear();
    this.platformDeltaByEntityId.clear();
    this.transientDiagnosticIssues.length = 0;
    this.activeCollisionPairs.clear();
    this.activeSensorPairs.clear();
    this.pendingPhysicsEvents.length = 0;
    this.orphanedPairCount = 0;
    this.physicsFrame = 0;
    this.lastStepDt = null;
    this.lastStepAt = null;
    this.world.free();
    this.eventQueue.free();
    this.initialised = false;
  }

  private capturePreStepInterpolationSnapshot(): void {
    for (const [entityId, body] of this.bodiesByEntityId) {
      const t = body.translation();
      const r = body.rotation();
      const existing = this.interpolationStateByEntityId.get(entityId);
      if (existing) {
        existing.prevTranslation = existing.currTranslation;
        existing.prevRotation = existing.currRotation;
        existing.currTranslation = { x: t.x, y: t.y, z: t.z };
        existing.currRotation = { x: r.x, y: r.y, z: r.z, w: r.w };
      } else {
        this.interpolationStateByEntityId.set(entityId, {
          prevTranslation: { x: t.x, y: t.y, z: t.z },
          prevRotation: { x: r.x, y: r.y, z: r.z, w: r.w },
          currTranslation: { x: t.x, y: t.y, z: t.z },
          currRotation: { x: r.x, y: r.y, z: r.z, w: r.w },
        });
      }
    }
  }

  private capturePostStepInterpolationSnapshot(): void {
    for (const [entityId, body] of this.bodiesByEntityId) {
      const state = this.interpolationStateByEntityId.get(entityId);
      if (!state) continue;
      const t = body.translation();
      const r = body.rotation();
      state.currTranslation = { x: t.x, y: t.y, z: t.z };
      state.currRotation = { x: r.x, y: r.y, z: r.z, w: r.w };
    }
  }

  private setEntityMetadata(entityId: EntityId, metadata: PhysicsEntityMetadata): void {
    this.entityMetadataById.set(entityId, {
      ...metadata,
      role: metadata.role ?? 'unknown',
      tags: metadata.tags ?? [],
    });
  }

  private updateInteractionTracking(): void {
    const previousCollisionPairs = this.activeCollisionPairs;
    const previousSensorPairs = this.activeSensorPairs;
    const currentCollisionPairs = new Map<string, PhysicsInteractionPair>();
    const currentSensorPairs = new Map<string, PhysicsInteractionPair>();
    const colliders = [...this.colliderByHandle.values()];

    for (let i = 0; i < colliders.length; i += 1) {
      for (let j = i + 1; j < colliders.length; j += 1) {
        const a = colliders[i];
        const b = colliders[j];
        if (!canCollisionGroupsInteract(a.collisionGroups(), b.collisionGroups())) continue;

        const sensorPair = a.isSensor() || b.isSensor();
        if (sensorPair) {
          if (this.world.intersectionPair(a, b)) {
            const pair = this.buildInteractionPair('sensor', a, b);
            if (pair) currentSensorPairs.set(pair.key, pair);
          }
          continue;
        }

        if (this.hasContactPair(a, b)) {
          const pair = this.buildInteractionPair('collision', a, b);
          if (pair) currentCollisionPairs.set(pair.key, pair);
        }
      }
    }

    this.enqueueInteractionEvents(previousCollisionPairs, currentCollisionPairs, 'collision');
    this.enqueueInteractionEvents(previousSensorPairs, currentSensorPairs, 'sensor');
    this.activeCollisionPairs = currentCollisionPairs;
    this.activeSensorPairs = currentSensorPairs;
  }

  private enqueueInteractionEvents(
    previousPairs: ReadonlyMap<string, PhysicsInteractionPair>,
    currentPairs: ReadonlyMap<string, PhysicsInteractionPair>,
    kind: PhysicsInteractionKind,
  ): void {
    for (const pair of currentPairs.values()) {
      if (kind === 'collision') {
        this.pendingPhysicsEvents.push(this.toInteractionEvent(previousPairs.has(pair.key) ? 'collisionStay' : 'collisionEnter', pair));
      } else if (!previousPairs.has(pair.key)) {
        this.pendingPhysicsEvents.push(this.toInteractionEvent('sensorEnter', pair));
      }
    }

    for (const pair of previousPairs.values()) {
      if (currentPairs.has(pair.key)) continue;
      if (!this.colliderByHandle.has(pair.colliderHandleA) || !this.colliderByHandle.has(pair.colliderHandleB)) {
        this.orphanedPairCount += 1;
      }
      this.pendingPhysicsEvents.push(this.toInteractionEvent(kind === 'collision' ? 'collisionExit' : 'sensorExit', pair));
    }
  }

  private toInteractionEvent(type: PhysicsInteractionEventType, pair: PhysicsInteractionPair): PhysicsInteractionEvent {
    return {
      ...pair,
      type,
      frame: this.physicsFrame,
      tick: this.physicsFrame,
    };
  }

  private buildInteractionPair(kind: PhysicsInteractionKind, a: RAPIER.Collider, b: RAPIER.Collider): PhysicsInteractionPair | null {
    const entityA = this.entityIdByColliderHandle.get(a.handle);
    const entityB = this.entityIdByColliderHandle.get(b.handle);
    if (entityA === undefined || entityB === undefined || entityA === entityB) return null;
    const [firstCollider, firstEntity, secondCollider, secondEntity] =
      a.handle < b.handle ? [a, entityA, b, entityB] : [b, entityB, a, entityA];
    return {
      key: pairKey(firstCollider.handle, secondCollider.handle),
      kind,
      entityA: firstEntity,
      entityB: secondEntity,
      colliderHandleA: firstCollider.handle,
      colliderHandleB: secondCollider.handle,
      roleA: this.getEntityRole(firstEntity),
      roleB: this.getEntityRole(secondEntity),
      sensorA: firstCollider.isSensor(),
      sensorB: secondCollider.isSensor(),
    };
  }

  private hasContactPair(a: RAPIER.Collider, b: RAPIER.Collider): boolean {
    let manifolds = 0;
    this.world.contactPair(a, b, () => {
      manifolds += 1;
    });
    return manifolds > 0;
  }

  private matchesEntityQuery(collider: RAPIER.Collider, options: PhysicsEntityQueryOptions): boolean {
    const entityId = this.entityIdByColliderHandle.get(collider.handle);
    if (entityId === undefined) return false;
    if (options.excludeEntityId !== undefined && entityId === options.excludeEntityId) return false;
    if (options.includeSensors === false && collider.isSensor()) return false;
    if (options.includeSolids === false && !collider.isSensor()) return false;
    if (options.roles?.length && !options.roles.includes(this.getEntityRole(entityId))) return false;
    return true;
  }

  private toPhysicsQueryHit(hit: RAPIER.RayColliderHit | RAPIER.RayColliderIntersection): PhysicsQueryHit {
    const entityId = this.entityIdByColliderHandle.get(hit.collider.handle) ?? null;
    const normal = 'normal' in hit ? hit.normal : undefined;
    return {
      entityId,
      colliderHandle: hit.collider.handle,
      role: entityId === null ? 'unknown' : this.getEntityRole(entityId),
      timeOfImpact: hit.timeOfImpact,
      normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : undefined,
    };
  }

  private collectEntityDiagnostics(): PhysicsEntityDiagnostic[] {
    const entityIds = new Set<EntityId>([
      ...this.bodiesByEntityId.keys(),
      ...this.collidersByEntityId.keys(),
      ...this.entityMetadataById.keys(),
      ...this.characterControllersByEntityId.keys(),
    ]);
    return [...entityIds].sort((a, b) => a - b).map((entityId) => {
      const metadata = this.entityMetadataById.get(entityId);
      const colliders = this.collidersByEntityId.get(entityId) ?? [];
      const body = this.bodiesByEntityId.get(entityId);
      const role = metadata?.role ?? 'unknown';
      const characterController = this.characterControllersByEntityId.get(entityId);
      return {
        entityId,
        key: metadata?.key,
        role,
        tags: metadata?.tags ?? [],
        bodyRegistered: this.bodiesByEntityId.has(entityId),
        bodyIsStatic: body?.isFixed() ?? false,
        colliderCount: colliders.length,
        primaryColliderRegistered: this.primaryColliderByEntityId.has(entityId),
        sensorColliderCount: colliders.filter((collider) => collider.isSensor()).length,
        grounded: characterController?.grounded ?? (role === 'player' && this.bodiesByEntityId.has(entityId) && colliders.length > 0 ? this.isGrounded(entityId) : null),
        characterController,
      };
    });
  }

  private collectDiagnosticIssues(entities: readonly PhysicsEntityDiagnostic[]): PhysicsDiagnosticIssue[] {
    const issues: PhysicsDiagnosticIssue[] = [];
    let staticWorldColliderFound = false;

    if (this.orphanedPairCount > 0) {
      issues.push({
        code: 'PHYSICS_EVENT_PAIR_ORPHANED',
        severity: 'warning',
        message: `${this.orphanedPairCount} physics interaction pair(s) referenced colliders no longer registered to entities.`,
      });
    }

    for (const entity of entities) {
      if ((entity.role === 'world' || entity.role === 'platform') && entity.colliderCount > 0 && entity.bodyIsStatic) {
        staticWorldColliderFound = true;
      }
      if ((entity.role || entity.colliderCount > 0) && !entity.bodyRegistered) {
        issues.push({
          code: 'ENTITY_BODY_LOOKUP_MISSING',
          severity: 'error',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Entity ${entity.key ?? entity.entityId} has physics metadata/colliders but no registered rigid body.`,
        });
      }
      if (entity.role === 'unknown' && entity.colliderCount > 0) {
        issues.push({
          code: 'ENTITY_HAS_COLLIDER_NO_ROLE',
          severity: 'info',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Entity ${entity.key ?? entity.entityId} has colliders but no resolved LOOMIER physics role.`,
        });
      }
      if (entity.role === 'player' && entity.colliderCount === 0) {
        issues.push({
          code: 'PLAYER_HAS_NO_COLLIDER',
          severity: 'error',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Player entity ${entity.key ?? entity.entityId} has no registered collider.`,
        });
      }
      if (entity.role === 'player' && entity.colliderCount > 0 && entity.grounded === false) {
        issues.push({
          code: 'PLAYER_NOT_GROUNDED',
          severity: 'info',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Player entity ${entity.key ?? entity.entityId} is not grounded.`,
        });
      }
      if (entity.role === 'projectile' && entity.colliderCount === 0) {
        issues.push({
          code: 'PROJECTILE_HAS_NO_COLLIDER',
          severity: 'error',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Projectile entity ${entity.key ?? entity.entityId} has no registered collider.`,
        });
      }
      if (entity.role === 'collectible' && entity.colliderCount > 0 && entity.sensorColliderCount === 0) {
        issues.push({
          code: 'COLLECTIBLE_NOT_SENSOR',
          severity: 'warning',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Collectible entity ${entity.key ?? entity.entityId} has no Rapier sensor collider.`,
        });
      }
      if (entity.role === 'trigger' && entity.colliderCount > 0 && entity.sensorColliderCount === 0) {
        issues.push({
          code: 'TRIGGER_NOT_SENSOR',
          severity: 'warning',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Trigger entity ${entity.key ?? entity.entityId} has no Rapier sensor collider.`,
        });
      }
      if (isSolidCollisionRole(entity.role) && entity.sensorColliderCount > 0) {
        issues.push({
          code: 'SENSOR_WITH_SOLID_COLLISION_ROLE',
          severity: 'warning',
          entityId: entity.entityId,
          entityKey: entity.key,
          message: `Solid collision role ${entity.role} on entity ${entity.key ?? entity.entityId} has a sensor collider.`,
        });
      }
      if (entity.characterController) this.collectCharacterControllerIssues(entity, issues);
    }

    if (this.initialised && entities.length > 0 && !staticWorldColliderFound) {
      issues.push({
        code: 'WORLD_HAS_NO_STATIC_COLLIDER',
        severity: 'warning',
        message: 'No registered static world/platform collider was found for ground collision.',
      });
    }

    this.collectCollisionMatrixIssues(issues);
    for (const transient of this.transientDiagnosticIssues) issues.push(transient);
    return issues;
  }

  private collectCollisionMatrixIssues(issues: PhysicsDiagnosticIssue[]): void {
    const colliders = [...this.colliderByHandle.values()];
    const reported = new Set<string>();
    for (let i = 0; i < colliders.length; i += 1) {
      for (let j = i + 1; j < colliders.length; j += 1) {
        const a = colliders[i];
        const b = colliders[j];
        const entityA = this.entityIdByColliderHandle.get(a.handle);
        const entityB = this.entityIdByColliderHandle.get(b.handle);
        if (entityA === undefined || entityB === undefined || entityA === entityB) continue;
        const layerA = physicsRoleToCollisionLayer(this.getEntityRole(entityA));
        const layerB = physicsRoleToCollisionLayer(this.getEntityRole(entityB));
        if (!layerA || !layerB || !defaultCollisionLayersInteract(layerA, layerB)) continue;
        if (canCollisionGroupsInteract(a.collisionGroups(), b.collisionGroups())) continue;
        const key = pairKey(a.handle, b.handle);
        if (reported.has(key)) continue;
        reported.add(key);
        issues.push({
          code: 'COLLISION_MATRIX_BLOCKED_EXPECTED_PAIR',
          severity: 'warning',
          entityId: entityA,
          entityKey: this.entityMetadataById.get(entityA)?.key,
          message: `Expected ${layerA}/${layerB} physics pair is blocked by collider collision groups.`,
        });
      }
    }
  }

  private collectCharacterControllerIssues(entity: PhysicsEntityDiagnostic, issues: PhysicsDiagnosticIssue[]): void {
    const controller = entity.characterController;
    if (!controller) return;

    const body = this.bodiesByEntityId.get(entity.entityId);
    const primaryCollider = this.primaryColliderByEntityId.get(entity.entityId);

    if (!controller.validPreset) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_INVALID_PRESET',
        severity: 'error',
        entityId: entity.entityId,
        entityKey: entity.key,
        message: `Character controller preset "${controller.preset}" is not supported.`,
      });
    }
    if (!body) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NO_BODY',
        severity: 'error',
        entityId: entity.entityId,
        entityKey: entity.key,
        message: `Character controller entity ${entity.key ?? entity.entityId} has no registered rigid body.`,
      });
    } else if (!body.isKinematic()) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NOT_KINEMATIC',
        severity: 'error',
        entityId: entity.entityId,
        entityKey: entity.key,
        message: `Character controller entity ${entity.key ?? entity.entityId} must use a kinematic rigid body.`,
      });
    }
    if (!primaryCollider) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NO_COLLIDER',
        severity: 'error',
        entityId: entity.entityId,
        entityKey: entity.key,
        message: `Character controller entity ${entity.key ?? entity.entityId} has no primary collider.`,
      });
    }
    if (controller.groundCheckPerformed && controller.grounded === false) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NO_GROUND',
        severity: 'warning',
        entityId: entity.entityId,
        entityKey: entity.key,
        message: `Character controller entity ${entity.key ?? entity.entityId} did not find ground within the preset check distance.`,
      });
    }
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function slerpQuat(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
  t: number,
): { x: number; y: number; z: number; w: number } {
  let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) {
    const x = a.x + (bx - a.x) * t;
    const y = a.y + (by - a.y) * t;
    const z = a.z + (bz - a.z) * t;
    const w = a.w + (bw - a.w) * t;
    const len = Math.hypot(x, y, z, w) || 1;
    return { x: x / len, y: y / len, z: z / len, w: w / len };
  }
  const angle = Math.acos(cos);
  const sin = Math.sin(angle);
  const fa = Math.sin((1 - t) * angle) / sin;
  const fb = Math.sin(t * angle) / sin;
  return {
    x: a.x * fa + bx * fb,
    y: a.y * fa + by * fb,
    z: a.z * fa + bz * fb,
    w: a.w * fa + bw * fb,
  };
}
