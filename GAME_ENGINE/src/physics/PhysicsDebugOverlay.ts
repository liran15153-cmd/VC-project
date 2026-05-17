import * as THREE from 'three';
import type { Engine } from '../core/Engine';

export class PhysicsDebugOverlay {
  private enabled = false;
  private lines: THREE.LineSegments | null = null;
  private material: THREE.LineBasicMaterial | null = null;

  constructor(private readonly engine: Engine) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearLines();
      this.disposeMaterial();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(): void {
    if (!this.enabled || !this.engine.three || !this.engine.physics?.isReady()) return;
    const buffers = this.engine.physics.debugRender();
    if (!buffers || buffers.vertices.length === 0) {
      this.clearLines();
      return;
    }

    this.clearLines();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.vertices.slice(), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(toRgbColors(buffers.colors), 3));
    this.lines = new THREE.LineSegments(geometry, this.getMaterial());
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 9999;
    this.engine.three.scene.add(this.lines);
  }

  destroy(): void {
    this.clearLines();
    this.disposeMaterial();
  }

  private clearLines(): void {
    if (!this.lines) return;
    this.engine.three?.scene.remove(this.lines);
    this.lines.geometry.dispose();
    this.lines = null;
  }

  private getMaterial(): THREE.LineBasicMaterial {
    if (!this.material) {
      this.material = new THREE.LineBasicMaterial({
        vertexColors: true,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
      });
    }
    return this.material;
  }

  private disposeMaterial(): void {
    this.material?.dispose();
    this.material = null;
  }
}

function toRgbColors(rgba: Float32Array): Float32Array {
  const rgb = new Float32Array((rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    rgb[target] = rgba[source];
    rgb[target + 1] = rgba[source + 1];
    rgb[target + 2] = rgba[source + 2];
  }
  return rgb;
}
