import * as THREE from 'three';
import type { ISystem, SystemContext } from '../core/types';
import { Transform } from '../components/Transform';
import { RigidBodyComponent } from '../components/RigidBody';
import { MeshComponent } from '../components/MeshComponent';
import { SpriteComponent } from '../components/SpriteComponent';

/**
 * Order:
 *  1) Rapier → ECS Transform
 *  2) Transform → THREE.Object3D
 *  3) Transform → Phaser sprite (when SpriteComponent.followIn3D is true)
 *
 * Runs early (priority 10) so the camera + renderers always see fresh transforms.
 */
export class PhysicsSyncSystem implements ISystem {
  readonly name = 'PhysicsSyncSystem';
  enabled = true;
  priority = 10;

  // Re-used scratch vector to avoid per-frame allocations.
  private readonly scratch = new THREE.Vector3();

  update({ world, engine }: SystemContext): void {
    if (engine.physics?.isReady()) {
      for (const { components } of world.query(Transform, RigidBodyComponent)) {
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
      }
    }

    if (engine.three) {
      for (const { components } of world.query(Transform, MeshComponent)) {
        const t = components[0] as Transform;
        const obj = (components[1] as MeshComponent).object3D;
        obj.position.set(t.position.x, t.position.y, t.position.z);
        obj.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
        obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
      }
    }

    if (engine.phaser && engine.three) {
      const cam = engine.three.camera;
      const { width: w, height: h } = engine.getViewport();
      for (const { components } of world.query(Transform, SpriteComponent)) {
        const t = components[0] as Transform;
        const sc = components[1] as SpriteComponent;
        if (!sc.followIn3D) continue;
        this.scratch.set(t.position.x, t.position.y, t.position.z).project(cam);
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
