// Public engine surface
export { Engine } from './core/Engine';
export { Scene, CallbackScene } from './core/Scene';
export { World } from './core/World';
export { EventBus } from './core/EventBus';
export { GameStateStore } from './core/GameStateStore';
export type { GameStateChange, GameStateInitialValue, GameStateValue } from './core/GameStateStore';
export type {
  EngineConfig,
  EngineErrorPhase,
  EngineEvents,
  EngineFrameInfo,
  ISystem,
  SystemContext,
  Component,
  ComponentClass,
  ComponentsOf,
  EntityId,
  ResolvedEngineConfig,
  Vec2,
  Vec3,
  InputState,
} from './core/types';

// Components
export { Transform, MeshComponent, SpriteComponent, RigidBodyComponent, CameraTarget } from './components';
export { MovingPlatformComponent } from './components/MovingPlatform';
export type {
  MovingPlatformConfig,
  MovingPlatformMode,
  MovingPlatformPathConfig,
  MovingPlatformVelocityConfig,
} from './components/MovingPlatform';

// Systems
export { PhysicsSyncSystem, CameraSystem } from './systems';
export { BehaviorSystem, TweenSystem, SpawnerSystem, UISystem, AudioSystem, MovingPlatformSystem, CharacterControllerSystem } from './systems';
export { CHARACTER_CONTROLLER_DEFAULT_SPEED, CHARACTER_CONTROLLER_JUMP_SPEED } from './systems/CharacterControllerSystem';
export type { CollisionContext, RuntimeSceneApi } from './systems';

// Subsystems
export { ThreeRenderer } from './renderers/ThreeRenderer';
export { PhaserRenderer } from './renderers/PhaserRenderer';
export { PhysicsWorld } from './physics/PhysicsWorld';
export type {
  PhysicsDiagnostics,
  PhysicsCharacterControllerDiagnostic,
  PhysicsCharacterControllerRegistration,
  PhysicsDiagnosticCode,
  PhysicsDiagnosticIssue,
  PhysicsEntityDiagnostic,
  PhysicsEntityMetadata,
  PhysicsEntityRole,
  PhysicsRaycastOptions,
  PhysicsShapeCastOptions,
} from './physics/PhysicsWorld';
export { Colliders } from './physics/Colliders';
export type { BodyOptions, BodyType, ColliderOptions } from './physics/Colliders';
export { PhysicsCharacterController, PHYSICS_CHARACTER_CONTROLLER_PRESETS } from './physics/PhysicsCharacterController';
export type {
  PhysicsCharacterControllerOptions,
  PhysicsCharacterControllerPreset,
  PhysicsCharacterGroundCheck,
  PhysicsCharacterMoveResult,
} from './physics/PhysicsCharacterController';
export { PhysicsDynamics } from './physics/PhysicsDynamics';
export type { KnockbackOptions } from './physics/PhysicsDynamics';
export {
  PHYSICS_MATERIAL_PRESETS,
  PHYSICS_MATERIAL_PROPERTIES,
  getMaterialProperties,
  isPhysicsMaterialName,
} from './physics/PhysicsMaterials';
export type { PhysicsMaterialName, PhysicsMaterialProperties } from './physics/PhysicsMaterials';
export {
  DEFAULT_COLLISION_FILTERS,
  PHYSICS_COLLISION_LAYERS,
  layerRequiresSensorBehavior,
} from './physics/CollisionLayers';
export type { NamedCollisionGroups, PhysicsCollisionLayer } from './physics/CollisionLayers';
export { InputManager } from './input/InputManager';
export { VirtualJoystick } from './input/VirtualJoystick';
export { CameraController } from './camera/CameraController';
export { isMobile, isPortrait, getOrientation } from './utils/device';

// Assets + JSON runtime
export { AssetManager } from './assets';
export type { AssetDefinition, AssetType, LoadedAsset } from './assets';
export { ENGINE_CAPABILITIES, GameRuntime, Registry, TriggerVolumeRegistry, parseGameDefinition, parseGameDefinitionWithWarnings } from './runtime';
export type { TriggerActionDefinition, TriggerVolumeDefinition, TriggerVolumePhase } from './runtime';
export {
  AssetDefinitionSchema,
  AudioRuleSchema,
  BehaviorDefinitionSchema,
  CameraTargetDefinitionSchema,
  EntityDefinitionSchema,
  GameDefinitionSchema,
  LightDefinitionSchema,
  MeshDefinitionSchema,
  PrefabDefinitionSchema,
  RigidBodyDefinitionSchema,
  SceneDefinitionSchema,
  SpawnerDefinitionSchema,
  SpriteDefinitionSchema,
  TweenDefinitionSchema,
  TransformDefinitionSchema,
  UiDefinitionSchema,
} from './runtime';
export type {
  AudioRule,
  BehaviorDefinition,
  EntityDefinition,
  GameDefinition,
  GameDefinitionNormalizationWarning,
  GameRuntimeLoadOptions,
  LightDefinition,
  MeshDefinition,
  PrefabDefinition,
  CharacterControllerDefinition,
  CharacterControllerPreset,
  MovingPlatformDefinition,
  RigidBodyDefinition,
  SceneDefinition,
  SpawnerDefinition,
  TriggerVolumeDefinitionData,
  SpriteDefinition,
  TweenDefinition,
  UiDefinition,
  SystemFactory,
} from './runtime';

// Preview protocol + iframe runtime controller
export {
  PreviewController,
  PREVIEW_PROTOCOL_VERSION,
  isPreviewCommand,
  isPreviewEvent,
  preflightAssets,
  categoriseValidationError,
  categoriseLoadError,
  buildSummary,
} from './preview';
export type {
  GameSummary,
  PreviewCommand,
  PreviewCommandLoad,
  PreviewCommandType,
  PreviewControllerOptions,
  PreviewEngineFactory,
  PreviewError,
  PreviewErrorCategory,
  PreviewEvent,
  PreviewEventType,
  PreviewLoadPhase,
  PreviewMode,
  PreviewRuntimeFactory,
  PreviewSnapshot,
  PreviewWarning,
} from './preview';
