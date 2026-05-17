import * as THREE from 'three';
import type { ISystem, SystemContext } from '../core/types';
import { Transform } from '../components/Transform';
import { RigidBodyComponent } from '../components/RigidBody';
import { MeshComponent } from '../components/MeshComponent';
import { SpriteComponent } from '../components/SpriteComponent';

/**
 * Order:
 *  1) Rapier → ECS Transform (authoritative post-step state for gameplay)
 *  2) Transform → THREE.Object3D (interpolated via engine.physicsAlpha when a physics body exists)
 *  3) Transform → Phaser sprite (when SpriteComponent.followIn3D is true; uses the interpolated Three position)
 *
 * Runs early (priority 10) so the camera + renderers always see fresh transforms.
 */
export class PhysicsSyncSystem implements ISystem {
  readonly name = 'PhysicsSyncSystem';
  enabled = true;
  priority = 10;

  private readonly scratch = new THREE.Vector3();
  private readonly entitiesWithBody = new Set<number>();

  update({ world, engine }: SystemContext): void {
    this.entitiesWithBody.clear();
    if (engine.physics?.isReady()) {
      for (const { id, components } of world.query(Transform, RigidBodyComponent)) {
        const t = components[0] as Transform;
        const rb = (components[1] as RigidBodyComponent).body;
        const p = rb.translation();
        const r = rb.rotation();
        t.position.x = p.x;
        t.position.y = p.y;
        t.position.z = p.z;
        t.rotation.x = r.x;
        t.rotation.y = r.y;
        t.rotation.z = r.z;
        t.rotation.w = r.w;
        this.entitiesWithBody.add(id);
      }
    }

    const alpha = engine.physicsAlpha ?? 1;

    if (engine.three) {
      for (const { id, components } of world.query(Transform, MeshComponent)) {
        const t = components[0] as Transform;
        const obj = (components[1] as MeshComponent).object3D;
        const interpolated = this.entitiesWithBody.has(id) && engine.physics
          ? engine.physics.getInterpolationState(id)
          : null;
        if (interpolated) {
          const ip = lerpVec3(interpolated.prevTranslation, interpolated.currTranslation, alpha);
          const ir = engine.physics!.getInterpolatedRotation(id, alpha) ?? interpolated.currRotation;
          obj.position.set(ip.x, ip.y, ip.z);
          obj.quaternion.set(ir.x, ir.y, ir.z, ir.w);
        } else {
          obj.position.set(t.position.x, t.position.y, t.position.z);
          obj.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
        }
        obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
      }
    }

    if (engine.phaser && engine.three) {
      const cam = engine.three.camera;
      const { width: w, height: h } = engine.getViewport();
      for (const { id, components } of world.query(Transform, SpriteComponent)) {
        const t = components[0] as Transform;
        const sc = components[1] as SpriteComponent;
        if (!sc.followIn3D) continue;
        const interpolated = this.entitiesWithBody.has(id) && engine.physics
          ? engine.physics.getInterpolatedTranslation(id, alpha)
          : null;
        const px = interpolated?.x ?? t.position.x;
        const py = interpolated?.y ?? t.position.y;
        const pz = interpolated?.z ?? t.position.z;
        this.scratch.set(px, py, pz).project(cam);
        const screenX = (this.scratch.x * 0.5 + 0.5) * w;
        const screenY = (-this.scratch.y * 0.5 + 0.5) * h;
        const go = sc.gameObject as Phaser.GameObjects.GameObject & { x?: number; y?: number };
        if (typeof go.x === 'number' && typeof go.y === 'number') {
          go.x = screenX;
          go.y = screenY;
        }
      }
    }
  }
}

function lerpVec3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
