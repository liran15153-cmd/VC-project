import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/types';

export type RapierModule = typeof RAPIER;

export interface CollisionEvent {
  colliderA: number;
  colliderB: number;
  started: boolean;
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

  constructor(private readonly gravity: Vec3) {}

  async init(): Promise<void> {
    if (this.initialised) return;
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: this.gravity.x, y: this.gravity.y, z: this.gravity.z });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.initialised = true;
  }

  step(dt: number): void {
    if (!this.initialised) return;
    this.world.timestep = dt;
    this.world.step(this.eventQueue);
  }

  setGravity(g: Vec3): void {
    if (!this.initialised) return;
    this.world.gravity = { x: g.x, y: g.y, z: g.z };
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
    this.world.free();
    this.eventQueue.free();
    this.initialised = false;
  }
}
