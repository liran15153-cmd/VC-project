import type { ISystem, SystemContext } from '../core/types';
import type { PhysicsCharacterController, PhysicsCharacterControllerPreset } from '../physics/PhysicsCharacterController';

export const CHARACTER_CONTROLLER_DEFAULT_SPEED = 5;
export const CHARACTER_CONTROLLER_JUMP_SPEED = 8;
const GRAVITY_ACCEL = 9.81;
const TOPDOWN_PRESETS: ReadonlySet<string> = new Set(['topdown']);
const PLATFORMER_PRESETS: ReadonlySet<string> = new Set(['platformer2d', 'runner2d']);

interface ControllerEntry {
  controller: PhysicsCharacterController;
  preset: string;
  speed: number;
  /** Accumulated vertical velocity (world units/s). Not used for topdown (constrainY). */
  velocityY: number;
}

/**
 * Drives registered PhysicsCharacterControllers with game input every frame.
 *
 * Input actions consumed (from engine.input.configureBindings / inputBindings):
 *   moveLeft  — move left  (negative X)
 *   moveRight — move right (positive X)
 *   moveUp    — move toward negative Z (or positive Y for platformer)
 *   moveDown  — move toward positive Z
 *   jump      — jump (platformer2d / runner2d / simple3d only)
 *
 * The system accumulates gravity for non-topdown presets and resets it when
 * the character controller reports grounded.
 */
export class CharacterControllerSystem implements ISystem {
  readonly name = 'CharacterControllerSystem';
  enabled = true;
  priority = 5;

  private readonly entries = new Map<number, ControllerEntry>();

  /**
   * Register a controller so the system drives it each frame.
   * Call once per entity during scene creation.
   */
  register(
    entityId: number,
    controller: PhysicsCharacterController,
    preset: PhysicsCharacterControllerPreset | string,
    speed = CHARACTER_CONTROLLER_DEFAULT_SPEED,
  ): void {
    this.entries.set(entityId, { controller, preset, speed, velocityY: 0 });
  }

  unregister(entityId: number): void {
    this.entries.delete(entityId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(_ctx: SystemContext): void {
    // Nothing to initialise — controllers are registered before the first update.
  }

  update({ engine, deltaTime }: SystemContext): void {
    const input = engine.input;
    // Clamp delta time so large pauses do not produce huge jumps.
    const dt = Math.min(deltaTime, 1 / 20);

    const right = (input.actionDown('moveRight') ? 1 : 0) - (input.actionDown('moveLeft') ? 1 : 0);
    const fwd   = (input.actionDown('moveDown')  ? 1 : 0) - (input.actionDown('moveUp')   ? 1 : 0);
    const jump  = input.actionPressed('jump');

    for (const [, entry] of this.entries) {
      const { controller, preset, speed } = entry;

      if (TOPDOWN_PRESETS.has(preset)) {
        // constrainY=true inside controller — no gravity needed from our side.
        controller.move({
          x: right * speed * dt,
          y: 0,
          z: fwd   * speed * dt,
        });
        entry.velocityY = 0;
        continue;
      }

      if (PLATFORMER_PRESETS.has(preset)) {
        // 2D movement in XY plane; Z is locked by constrainZ inside the controller.
        const groundCheck = controller.checkGround();
        if (groundCheck.grounded) {
          entry.velocityY = jump ? CHARACTER_CONTROLLER_JUMP_SPEED : 0;
        } else {
          entry.velocityY -= GRAVITY_ACCEL * dt;
        }
        controller.move({
          x: right * speed * dt,
          y: entry.velocityY * dt,
          z: 0,
        });
        continue;
      }

      // simple3d (and any unknown preset): full 3D with gravity.
      {
        const groundCheck = controller.checkGround();
        if (groundCheck.grounded) {
          entry.velocityY = jump ? CHARACTER_CONTROLLER_JUMP_SPEED : 0;
        } else {
          entry.velocityY -= GRAVITY_ACCEL * dt;
        }
        controller.move({
          x: right * speed * dt,
          y: entry.velocityY * dt,
          z: fwd   * speed * dt,
        });
      }
    }
  }

  destroy(): void {
    this.entries.clear();
  }
}
