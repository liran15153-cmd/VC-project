import type { Component } from '../core/types';

/** Tag entities the camera should follow (smooth-lerp). */
export class CameraTarget implements Component {
  static readonly type = 'CameraTarget';
  readonly type = CameraTarget.type;

  /** 0..1 - how aggressively the camera lerps to target (per second). */
  lerp = 5;
  /** World-space offset from target. */
  offset = { x: 0, y: 5, z: 10 };
}
