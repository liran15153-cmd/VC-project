import type { ISystem, SystemContext } from '../core/types';
import { Transform } from '../components/Transform';
import { CameraTarget } from '../components/CameraTarget';
import { CameraController } from '../camera/CameraController';

/**
 * Picks the (first) entity tagged with CameraTarget and feeds its transform
 * into the engine's CameraController. Runs after PhysicsSyncSystem.
 */
export class CameraSystem implements ISystem {
  readonly name = 'CameraSystem';
  enabled = true;
  priority = 50;

  controller!: CameraController;

  init({ engine }: SystemContext): void {
    this.controller = new CameraController(engine);
  }

  update({ world, deltaTime }: SystemContext): void {
    for (const { components } of world.query(Transform, CameraTarget)) {
      const t = components[0] as Transform;
      const tag = components[1] as CameraTarget;
      this.controller.lerpFactor = tag.lerp;
      this.controller.follow(t.position, tag.offset);
      break; // first match wins
    }
    this.controller.update(deltaTime);
  }
}
