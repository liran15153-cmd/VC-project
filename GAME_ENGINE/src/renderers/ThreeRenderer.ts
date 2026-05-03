import * as THREE from 'three';
import type { Engine } from '../core/Engine';

/**
 * Owns the THREE.Scene, the camera, and the WebGLRenderer.
 * Sits at z-index 0 (behind Phaser overlay).
 */
export class ThreeRenderer {
  readonly scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  canvas!: HTMLCanvasElement;

  constructor(private readonly engine: Engine) {}

  init(): void {
    const { width, height, pixelRatio, antialias, background } = this.engine.config;

    this.renderer = new THREE.WebGLRenderer({ antialias, alpha: true });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.canvas = this.renderer.domElement;
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '0';
    this.engine.container.appendChild(this.canvas);

    if (background !== null) {
      this.scene.background = new THREE.Color(background as THREE.ColorRepresentation);
    }

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    // Sensible default lighting so a Hello-World scene isn't pitch black.
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    this.scene.add(ambient, dir);
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  onOrientationChange(orientation: 'portrait' | 'landscape'): void {
    if (!this.camera) return;
    // Slightly wider FOV on portrait to compensate for narrow framing.
    this.camera.fov = orientation === 'portrait' ? 75 : 60;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.renderer?.dispose();
    this.canvas?.remove();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m.dispose();
      }
    });
    this.scene.clear();
  }
}
