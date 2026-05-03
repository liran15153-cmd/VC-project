import RAPIER from '@dimforge/rapier3d-compat';
import type { Component } from '../core/types';

/** Wraps a Rapier rigid body + its (optional) collider handle. */
export class RigidBodyComponent implements Component {
  static readonly type = 'RigidBody';
  readonly type = RigidBodyComponent.type;

  constructor(public body: RAPIER.RigidBody, public collider?: RAPIER.Collider) {}
}
