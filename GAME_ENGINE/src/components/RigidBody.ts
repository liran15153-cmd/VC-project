import RAPIER from '@dimforge/rapier3d-compat';
import type { Component } from '../core/types';

/** Wraps a Rapier rigid body + its (optional) collider handle. */
export class RigidBodyComponent implements Component {
  static readonly type = 'RigidBody';
  readonly type = RigidBodyComponent.type;
  readonly colliders: readonly RAPIER.Collider[];
  readonly collider?: RAPIER.Collider;

  constructor(public body: RAPIER.RigidBody, collider?: RAPIER.Collider, colliders: readonly RAPIER.Collider[] = collider ? [collider] : []) {
    this.colliders = colliders;
    this.collider = colliders[0];
  }
}
