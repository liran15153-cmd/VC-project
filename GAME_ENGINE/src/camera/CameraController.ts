import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import type { Vec3 } from '../core/types';

export type CameraMode = 'free' | 'follow' | 'topDown' | 'sideScroller';

/**
 * Drives both the Three.js PerspectiveCamera and the Phaser 2D camera
 * in lock-step. A single `target` position can be tracked across both.
 */
export class CameraController {
  mode: CameraMode = 'free';
  lerpFactor = 5;
  offset: Vec3 = { x: 0, y: 5, z: 10 };

  private target: Vec3 | null = null;
  private tmpVec = new THREE.Vector3();

  constructor(private readonly engine: Engine) {}

  follow(target: Vec3, offset?: Partial<Vec3>): void {
    this.mode = 'follow';
    this.target = target;
    if (offset) this.offset = { ...this.offset, ...offset };
  }

  release(): void {
    this.mode = 'free';
    this.target = null;
  }

  update(dt: number): void {
    if (this.mode !== 'follow' || !this.target) return;

    const cam = this.engine.three?.camera;
    if (cam) {
      const desiredX = this.target.x + this.offset.x;
      const desiredY = this.target.y + this.offset.y;
      const desiredZ = this.target.z + this.offset.z;
      const t = 1 - Math.exp(-this.lerpFactor * dt);
      cam.position.x += (desiredX - cam.position.x) * t;
      cam.position.y += (desiredY - cam.position.y) * t;
      cam.position.z += (desiredZ - cam.position.z) * t;
      this.tmpVec.set(this.target.x, this.target.y, this.target.z);
      cam.lookAt(this.tmpVec);
    }

    const phaserScene = this.engine.phaser?.scene;
    if (phaserScene) {
      // Project the 3D target through the 3D camera onto the 2D screen so the
      // Phaser camera can track it for HUD overlays / minimaps.
      const px = this.engine.three ? this.projectTo2D(this.target) : null;
      if (px) phaserScene.cameras.main.centerOn(px.x, px.y);
    }
  }

  /** Projects a 3D world point to Phaser screen coordinates. */
  projectTo2D(p: Vec3): { x: number; y: number } | null {
    const three = this.engine.three;
    if (!three) return null;
    this.tmpVec.set(p.x, p.y, p.z).project(three.camera);
    const { width: w, height: h } = this.engine.getViewport();
    return {
      x: (this.tmpVec.x * 0.5 + 0.5) * w,
      y: (-this.tmpVec.y * 0.5 + 0.5) * h,
    };
  }
}
