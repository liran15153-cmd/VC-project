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

// Systems
export { PhysicsSyncSystem, CameraSystem } from './systems';
export { BehaviorSystem, TweenSystem, SpawnerSystem, UISystem, AudioSystem } from './systems';
export type { CollisionContext, RuntimeSceneApi } from './systems';

// Subsystems
export { ThreeRenderer } from './renderers/ThreeRenderer';
export { PhaserRenderer } from './renderers/PhaserRenderer';
export { PhysicsWorld } from './physics/PhysicsWorld';
export { Colliders } from './physics/Colliders';
export { InputManager } from './input/InputManager';
export { VirtualJoystick } from './input/VirtualJoystick';
export { CameraController } from './camera/CameraController';
export { isMobile, isPortrait, getOrientation } from './utils/device';

// Assets + JSON runtime
export { AssetManager } from './assets';
export type { AssetDefinition, AssetType, LoadedAsset } from './assets';
export { ENGINE_CAPABILITIES, GameRuntime, Registry, parseGameDefinition, parseGameDefinitionWithWarnings } from './runtime';
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
  RigidBodyDefinition,
  SceneDefinition,
  SpawnerDefinition,
  SpriteDefinition,
  TweenDefinition,
  UiDefinition,
  SystemFactory,
} from './runtime';
