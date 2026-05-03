import Phaser from 'phaser';
import type { Component } from '../core/types';

/**
 * Wraps a Phaser GameObject. Sync system will project a 3D world position
 * (via three.js camera) onto the Phaser screen so 2D HUDs can attach to 3D entities.
 */
export class SpriteComponent implements Component {
  static readonly type = 'Sprite';
  readonly type = SpriteComponent.type;

  /** When true, the sprite's screen position is driven by the Transform projected through the 3D camera. */
  followIn3D = false;

  constructor(public gameObject: Phaser.GameObjects.GameObject) {}
}
