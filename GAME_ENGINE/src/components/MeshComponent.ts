import * as THREE from 'three';
import type { Component } from '../core/types';

/** Wraps a Three.js Object3D so the PhysicsSyncSystem can update it. */
export class MeshComponent implements Component {
  static readonly type = 'Mesh';
  readonly type = MeshComponent.type;

  constructor(public object3D: THREE.Object3D) {}
}
