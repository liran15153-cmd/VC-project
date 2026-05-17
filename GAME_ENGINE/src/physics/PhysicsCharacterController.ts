import type RAPIER from '@dimforge/rapier3d-compat';
import type { EntityId, Vec3 } from '../core/types';
import type { PhysicsDiagnosticIssue } from './PhysicsWorld';
import { PhysicsWorld } from './PhysicsWorld';

export const PHYSICS_CHARACTER_CONTROLLER_PRESETS = ['platformer2d', 'runner2d', 'simple3d', 'topdown'] as const;

export type PhysicsCharacterControllerPreset = typeof PHYSICS_CHARACTER_CONTROLLER_PRESETS[number];

interface CharacterControllerPresetConfig {
  // Distances are Rapier world units; slope angles are radians.
  offset: number;
  up: Vec3;
  snapToGroundDistance: number;
  groundCheckDistance: number;
  maxSlopeClimbAngle: number;
  minSlopeSlideAngle: number;
  autostep: {
    maxHeight: number;
    minWidth: number;
    includeDynamicBodies: boolean;
  };
  constrainZ: boolean;
  constrainY: boolean;
}

const RAPIER_EXAMPLE_3D_STEEP_SLOPE_ANGLE_RADIANS = 0.6;
const RAPIER_EXAMPLE_SLOPE_LIMIT_MARGIN_RADIANS = 0.02;
// Rapier's KinematicCharacterController expects slope angles in radians. The
// upstream 3D example keeps controller limits just below the steep test slope.
const RAPIER_EXAMPLE_3D_STEEP_SLOPE_LIMIT_RADIANS =
  RAPIER_EXAMPLE_3D_STEEP_SLOPE_ANGLE_RADIANS - RAPIER_EXAMPLE_SLOPE_LIMIT_MARGIN_RADIANS;

export interface PhysicsCharacterControllerOptions {
  entityId: EntityId;
  preset: PhysicsCharacterControllerPreset | string;
}

export interface PhysicsCharacterGroundCheck {
  grounded: boolean;
  hit: RAPIER.RayColliderIntersection | RAPIER.RayColliderHit | null;
  distance: number | null;
  onSlope: boolean;
  slopeAngle: number | null;
}

export interface PhysicsCharacterMoveResult {
  requested: Vec3;
  computed: Vec3;
  grounded: boolean;
  groundCheck: PhysicsCharacterGroundCheck;
  collisionCount: number;
  falling: boolean;
  wallHit: boolean;
  onSlope: boolean;
  slopeAngle: number | null;
  issues: PhysicsDiagnosticIssue[];
}

const PRESET_CONFIGS: Record<PhysicsCharacterControllerPreset, CharacterControllerPresetConfig> = {
  platformer2d: {
    offset: 0.02,
    up: { x: 0, y: 1, z: 0 },
    snapToGroundDistance: 0.22,
    groundCheckDistance: 0.85,
    maxSlopeClimbAngle: Math.PI / 4,
    minSlopeSlideAngle: Math.PI / 3,
    autostep: { maxHeight: 0.25, minWidth: 0.08, includeDynamicBodies: false },
    constrainZ: true,
    constrainY: false,
  },
  runner2d: {
    offset: 0.02,
    up: { x: 0, y: 1, z: 0 },
    snapToGroundDistance: 0.18,
    groundCheckDistance: 0.8,
    maxSlopeClimbAngle: Math.PI / 5,
    minSlopeSlideAngle: Math.PI / 3,
    autostep: { maxHeight: 0.12, minWidth: 0.08, includeDynamicBodies: false },
    constrainZ: true,
    constrainY: false,
  },
  simple3d: {
    offset: 0.025,
    up: { x: 0, y: 1, z: 0 },
    snapToGroundDistance: 0.2,
    groundCheckDistance: 0.9,
    maxSlopeClimbAngle: RAPIER_EXAMPLE_3D_STEEP_SLOPE_LIMIT_RADIANS,
    minSlopeSlideAngle: RAPIER_EXAMPLE_3D_STEEP_SLOPE_LIMIT_RADIANS,
    autostep: { maxHeight: 0.3, minWidth: 0.1, includeDynamicBodies: false },
    constrainZ: false,
    constrainY: false,
  },
  topdown: {
    offset: 0.025,
    up: { x: 0, y: 1, z: 0 },
    snapToGroundDistance: 0.2,
    groundCheckDistance: 0.9,
    maxSlopeClimbAngle: Math.PI / 3,
    minSlopeSlideAngle: Math.PI / 3,
    autostep: { maxHeight: 0, minWidth: 0.08, includeDynamicBodies: false },
    constrainZ: false,
    constrainY: true,
  },
};

export class PhysicsCharacterController {
  readonly entityId: EntityId;
  readonly preset: string;
  readonly validPreset: boolean;
  private readonly config: CharacterControllerPresetConfig;
  private readonly controller: RAPIER.KinematicCharacterController;
  private disposed = false;

  constructor(private readonly physics: PhysicsWorld, options: PhysicsCharacterControllerOptions) {
    this.entityId = options.entityId;
    this.preset = options.preset;
    const preset = options.preset;
    if (isCharacterControllerPreset(preset)) {
      this.validPreset = true;
      this.config = PRESET_CONFIGS[preset];
    } else {
      this.validPreset = false;
      this.config = PRESET_CONFIGS.simple3d;
    }
    this.controller = physics.world.createCharacterController(this.config.offset);
    this.configureController();
    this.physics.registerCharacterController(this.entityId, {
      preset: this.preset,
      validPreset: this.validPreset,
    });
  }

  move(desiredTranslation: Vec3): PhysicsCharacterMoveResult {
    const issues = this.validateBinding();
    const body = this.physics.getBodyByEntityId(this.entityId);
    const collider = this.physics.getPrimaryColliderByEntityId(this.entityId);
    const groundCheck = this.checkGround();

    if (issues.length || !body || !collider) {
      return {
        requested: { ...desiredTranslation },
        computed: { x: 0, y: 0, z: 0 },
        grounded: groundCheck.grounded,
        groundCheck,
        collisionCount: 0,
        falling: !groundCheck.grounded && desiredTranslation.y <= 0,
        wallHit: false,
        onSlope: groundCheck.onSlope,
        slopeAngle: groundCheck.slopeAngle,
        issues,
      };
    }

    const requested = this.normalizeRequestedMovement(desiredTranslation);
    const ownColliders = this.physics.getCollidersByEntityId(this.entityId);
    const adjusted = this.applyAutostepProbe(requested, body, ownColliders, groundCheck);
    this.controller.computeColliderMovement(
      collider,
      adjusted,
      undefined,
      undefined,
      (candidate) => !ownColliders.includes(candidate),
    );
    const computed = this.controller.computedMovement();
    const movement = {
      x: computed.x,
      y: this.config.constrainY ? 0 : computed.y,
      z: this.config.constrainZ ? 0 : computed.z,
    };
    const translation = body.translation();
    body.setNextKinematicTranslation({
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z,
    });

    const grounded = this.controller.computedGrounded() || groundCheck.grounded;
    const platformDelta = grounded ? this.getRidingPlatformDelta(groundCheck) : null;
    if (platformDelta) {
      body.setNextKinematicTranslation({
        x: translation.x + movement.x + platformDelta.x,
        y: translation.y + movement.y + platformDelta.y,
        z: translation.z + movement.z + platformDelta.z,
      });
    }
    const wallHit = this.detectWallHit();
    const falling = !grounded && requested.y <= 0;
    this.physics.updateCharacterControllerDiagnostics(this.entityId, {
      grounded,
      groundCheckPerformed: true,
      lastGroundDistance: groundCheck.distance,
      falling,
      wallHit,
      onSlope: groundCheck.onSlope,
      slopeAngle: groundCheck.slopeAngle,
    });

    return {
      requested,
      computed: movement,
      grounded,
      groundCheck,
      collisionCount: this.controller.numComputedCollisions(),
      falling,
      wallHit,
      onSlope: groundCheck.onSlope,
      slopeAngle: groundCheck.slopeAngle,
      issues,
    };
  }

  checkGround(maxDistance = this.config.groundCheckDistance): PhysicsCharacterGroundCheck {
    const body = this.physics.getBodyByEntityId(this.entityId);
    if (!body) return this.recordGroundCheck(null);

    const ownColliders = this.physics.getCollidersByEntityId(this.entityId);
    const hit = this.physics.castRay({
      origin: body.translation(),
      direction: { x: -this.config.up.x, y: -this.config.up.y, z: -this.config.up.z },
      maxToi: maxDistance,
      includeNormal: true,
      excludeRigidBody: body,
      predicate: (candidate) => !ownColliders.includes(candidate),
    });

    return this.recordGroundCheck(hit);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.physics.isReady()) {
      this.physics.world.removeCharacterController(this.controller);
    }
    this.physics.unregisterCharacterController(this.entityId);
  }

  private getRidingPlatformDelta(groundCheck: PhysicsCharacterGroundCheck): Vec3 | null {
    const hit = groundCheck.hit;
    if (!hit) return null;
    const groundEntityId = this.physics.getEntityIdByColliderHandle(hit.collider.handle);
    if (groundEntityId === null) return null;
    return this.physics.getPlatformDelta(groundEntityId);
  }

  private applyAutostepProbe(
    requested: Vec3,
    body: RAPIER.RigidBody,
    ownColliders: readonly RAPIER.Collider[],
    groundCheck: PhysicsCharacterGroundCheck,
  ): Vec3 {
    const maxHeight = this.config.autostep.maxHeight;
    if (maxHeight <= 0) return requested;
    if (!groundCheck.grounded || groundCheck.distance === null) return requested;

    const horizontalMag = Math.hypot(requested.x, requested.z);
    if (horizontalMag <= 1e-6) return requested;

    const dir = { x: requested.x / horizontalMag, y: 0, z: requested.z / horizontalMag };
    const pos = body.translation();
    const feetY = pos.y - groundCheck.distance;
    const forwardOrigin = { x: pos.x, y: feetY + 0.02, z: pos.z };
    const forwardMaxToi = horizontalMag + this.config.offset + 0.05;

    const forwardHit = this.physics.castRay({
      origin: forwardOrigin,
      direction: dir,
      maxToi: forwardMaxToi,
      includeNormal: true,
      excludeRigidBody: body,
      predicate: (candidate) => !ownColliders.includes(candidate),
    });
    if (!forwardHit || !('normal' in forwardHit) || !forwardHit.normal) return requested;

    const faceNormal = normalizeVector(forwardHit.normal);
    const upDot = Math.abs(dot(faceNormal, normalizeVector(this.config.up)));
    if (upDot > 0.4) return requested;

    const probeDistance = forwardHit.timeOfImpact + 0.02;
    const downOrigin = {
      x: forwardOrigin.x + dir.x * probeDistance,
      y: feetY + maxHeight + 0.05,
      z: forwardOrigin.z + dir.z * probeDistance,
    };
    const downHit = this.physics.castRay({
      origin: downOrigin,
      direction: { x: 0, y: -1, z: 0 },
      maxToi: maxHeight + 0.1,
      excludeRigidBody: body,
      predicate: (candidate) => !ownColliders.includes(candidate),
    });
    if (!downHit) return requested;

    const obstacleTopY = downOrigin.y - downHit.timeOfImpact;
    const stepHeight = obstacleTopY - feetY;
    if (stepHeight <= 1e-3 || stepHeight > maxHeight) return requested;

    return {
      x: requested.x,
      y: requested.y + stepHeight + this.config.offset,
      z: requested.z,
    };
  }

  private configureController(): void {
    this.controller.setUp(this.config.up);
    this.controller.enableSnapToGround(this.config.snapToGroundDistance);
    this.controller.enableAutostep(
      this.config.autostep.maxHeight,
      this.config.autostep.minWidth,
      this.config.autostep.includeDynamicBodies,
    );
    this.controller.setMaxSlopeClimbAngle(this.config.maxSlopeClimbAngle);
    this.controller.setMinSlopeSlideAngle(this.config.minSlopeSlideAngle);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }

  private validateBinding(): PhysicsDiagnosticIssue[] {
    const issues: PhysicsDiagnosticIssue[] = [];
    const body = this.physics.getBodyByEntityId(this.entityId);
    const collider = this.physics.getPrimaryColliderByEntityId(this.entityId);

    if (!this.validPreset) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_INVALID_PRESET',
        severity: 'error',
        entityId: this.entityId,
        message: `Character controller preset "${this.preset}" is not supported.`,
      });
    }
    if (!body) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NO_BODY',
        severity: 'error',
        entityId: this.entityId,
        message: `Character controller entity ${this.entityId} has no registered rigid body.`,
      });
    } else if (!body.isKinematic()) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NOT_KINEMATIC',
        severity: 'error',
        entityId: this.entityId,
        message: `Character controller entity ${this.entityId} must use a kinematic rigid body.`,
      });
    }
    if (!collider) {
      issues.push({
        code: 'CHARACTER_CONTROLLER_NO_COLLIDER',
        severity: 'error',
        entityId: this.entityId,
        message: `Character controller entity ${this.entityId} has no primary collider.`,
      });
    }

    return issues;
  }

  private normalizeRequestedMovement(desiredTranslation: Vec3): Vec3 {
    return {
      x: desiredTranslation.x,
      y: this.config.constrainY ? 0 : desiredTranslation.y,
      z: this.config.constrainZ ? 0 : desiredTranslation.z,
    };
  }

  private recordGroundCheck(hit: RAPIER.RayColliderIntersection | RAPIER.RayColliderHit | null): PhysicsCharacterGroundCheck {
    const slopeAngle = hit && 'normal' in hit ? angleBetween(hit.normal, this.config.up) : null;
    const result = {
      grounded: hit !== null,
      hit,
      distance: hit?.timeOfImpact ?? null,
      onSlope: slopeAngle !== null && slopeAngle > 0.03,
      slopeAngle,
    };
    this.physics.updateCharacterControllerDiagnostics(this.entityId, {
      grounded: result.grounded,
      groundCheckPerformed: true,
      lastGroundDistance: result.distance,
      falling: !result.grounded,
      onSlope: result.onSlope,
      slopeAngle: result.slopeAngle,
    });
    return result;
  }

  private detectWallHit(): boolean {
    const up = normalizeVector(this.config.up);
    for (let i = 0; i < this.controller.numComputedCollisions(); i += 1) {
      const collision = this.controller.computedCollision(i);
      if (!collision) continue;
      const normal = normalizeVector(collision.normal1);
      const upDot = Math.abs(dot(normal, up));
      if (upDot < 0.5) return true;
    }
    return false;
  }
}

function isCharacterControllerPreset(value: string): value is PhysicsCharacterControllerPreset {
  return (PHYSICS_CHARACTER_CONTROLLER_PRESETS as readonly string[]).includes(value);
}

function angleBetween(a: Vec3, b: Vec3): number {
  const normalA = normalizeVector(a);
  const normalB = normalizeVector(b);
  const value = Math.max(-1, Math.min(1, dot(normalA, normalB)));
  return Math.acos(value);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
