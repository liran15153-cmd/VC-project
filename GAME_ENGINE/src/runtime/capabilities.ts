/**
 * Public capability catalog for AI prompt builders.
 *
 * Backend generation prompts should pass this catalog to the model so it only emits
 * JSON the engine knows how to validate and run.
 */
export const ENGINE_CAPABILITIES = Object.freeze({
  schemaVersion: 1,
  assetTypes: ['image', 'spritesheet', 'atlas', 'tilemap', 'gltf', 'audio', 'json', 'text', 'arrayBuffer'],
  meshShapes: ['box', 'sphere', 'plane', 'cylinder', 'cone', 'torus'],
  modelComponent: {
    assetKey: 'must match a top-level gltf asset key',
    positionOffset: 'local Vec3 offset',
    rotationOffset: 'local Euler Vec3 in radians',
    scale: 'local Vec3 scale',
  },
  colliderShapes: ['cuboid', 'ball', 'capsule'],
  systems: ['physicsSync', 'camera', 'behavior', 'tween', 'spawner', 'ui', 'audio'],
  triggers: ['sceneStart', 'inputPressed', 'inputDown', 'inputReleased', 'keyDown', 'keyUp', 'collision', 'stateChange', 'timer', 'event'],
  actions: [
    'setState',
    'incrementState',
    'decrementState',
    'switchScene',
    'spawnPrefab',
    'destroyEntity',
    'applyImpulse',
    'setVelocity',
    'setVelocityX',
    'setVelocityY',
    'setVelocityZ',
    'setPosition',
    'translate',
    'playSound',
    'emitEvent',
    'addTag',
    'removeTag',
  ],
  selectors: ['entityKey', 'tag', 'self', 'other', 'collisionOther', 'collisionA', 'collisionB', 'all'],
  uiTypes: ['text', 'bar'],
  lightTypes: ['ambient', 'directional', 'point'],
  tweenProperties: ['position.x', 'position.y', 'position.z', 'scale.x', 'scale.y', 'scale.z', 'rotation.x', 'rotation.y', 'rotation.z'],
});
