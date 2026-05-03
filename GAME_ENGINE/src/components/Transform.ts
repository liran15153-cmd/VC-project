import type { Component, Vec3 } from '../core/types';

/** World-space transform shared by 3D meshes and 2D sprites. */
export class Transform implements Component {
  static readonly type = 'Transform';
  readonly type = Transform.type;

  position: Vec3 = { x: 0, y: 0, z: 0 };
  rotation: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 };
  scale: Vec3 = { x: 1, y: 1, z: 1 };

  constructor(init?: Partial<{ position: Vec3; scale: Vec3 }>) {
    if (init?.position) this.position = { ...init.position };
    if (init?.scale) this.scale = { ...init.scale };
  }
}
