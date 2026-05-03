import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import { Scene } from '../core/Scene';
import { Transform } from '../components/Transform';
import { MeshComponent } from '../components/MeshComponent';
import { RigidBodyComponent } from '../components/RigidBody';
import { SpriteComponent } from '../components/SpriteComponent';
import { CameraTarget } from '../components/CameraTarget';
import { EntityInfo } from '../components/EntityInfo';
import { PhysicsSyncSystem } from '../systems/PhysicsSyncSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { BehaviorSystem } from '../systems/BehaviorSystem';
import { TweenSystem } from '../systems/TweenSystem';
import { SpawnerSystem } from '../systems/SpawnerSystem';
import { UISystem } from '../systems/UISystem';
import { AudioSystem } from '../systems/AudioSystem';
import { Colliders } from '../physics/Colliders';
import { AssetManager } from '../assets/AssetManager';
import type { LoadedAsset } from '../assets/AssetManager';
import type { ColliderOptions } from '../physics/Colliders';
import type { ISystem } from '../core/types';
import type {
  EntityDefinition,
  GameDefinition,
  LightDefinition,
  MeshDefinition,
  PrefabDefinition,
  RigidBodyDefinition,
  SceneDefinition,
  SpriteDefinition,
} from './GameDefinition';
import { parseGameDefinition } from './GameDefinition';
import { Registry } from './Registry';
import type { RuntimeSceneApi } from '../systems/RuntimeSceneApi';

export interface GameRuntimeLoadOptions {
  autoSwitch?: boolean;
  sceneKey?: string;
}

export type SystemFactory = () => ISystem;

/**
 * Safe JSON runtime: validates a declarative game definition and builds scenes
 * from whitelisted components/systems. No generated JavaScript is executed.
 */
export class GameRuntime {
  readonly assets = new AssetManager();
  readonly systemRegistry = new Registry<SystemFactory>('SystemRegistry');
  private definition: GameDefinition | null = null;

  constructor(private readonly engine: Engine) {
    this.systemRegistry.register('physicsSync', () => new PhysicsSyncSystem());
    this.systemRegistry.register('camera', () => new CameraSystem());
  }

  async load(input: unknown, options: GameRuntimeLoadOptions = {}): Promise<GameDefinition> {
    const definition = parseGameDefinition(input);
    this.definition = definition;

    if (definition.engine.width && definition.engine.height) {
      this.engine.setSize(definition.engine.width, definition.engine.height);
    }
    if (definition.engine.gravity && this.engine.physics?.isReady()) {
      this.engine.physics.setGravity(definition.engine.gravity);
    }
    this.engine.state.configure(definition.state);
    this.engine.input.configureBindings(definition.inputBindings);

    await this.assets.loadMany(definition.assets);

    for (const scene of definition.scenes) {
      this.engine.scenes.register(scene.key, new DefinitionScene(scene, definition, this.systemRegistry, this.assets));
    }

    if (options.autoSwitch ?? true) {
      const sceneKey = options.sceneKey ?? definition.initialScene ?? definition.scenes[0].key;
      await this.engine.scenes.switchTo(sceneKey);
    }

    return definition;
  }

  currentDefinition(): GameDefinition | null {
    return this.definition;
  }
}

class DefinitionScene extends Scene {
  constructor(
    private readonly definition: SceneDefinition,
    private readonly rootDefinition: GameDefinition,
    private readonly systemRegistry: Registry<SystemFactory>,
    private readonly assets: AssetManager,
  ) {
    super();
  }

  create(engine: Engine): void {
    if (this.definition.background !== undefined && engine.three) {
      engine.three.scene.background = new THREE.Color(toThreeColor(this.definition.background));
    }
    this.attachLights(engine, this.definition.lights);

    const api = this.createSceneApi(engine);
    const behaviors = [...this.rootDefinition.behaviors, ...this.definition.behaviors];
    const animations = [...this.rootDefinition.animations, ...this.definition.animations];
    const ui = [...this.rootDefinition.ui, ...this.definition.ui];
    const audio = [...this.rootDefinition.audio, ...this.definition.audio];

    for (const system of this.definition.systems) {
      if (system === 'physicsSync' || system === 'camera') this.addSystem(this.systemRegistry.require(system)());
    }
    if (behaviors.length || audio.some((rule) => triggerType(rule.trigger) === 'collision') || this.definition.systems.includes('behavior')) {
      this.addSystem(new BehaviorSystem(behaviors, api));
    }
    if (this.definition.spawners.length || this.definition.systems.includes('spawner')) this.addSystem(new SpawnerSystem(this.definition.spawners, api));
    if (animations.length || this.definition.systems.includes('tween')) this.addSystem(new TweenSystem(animations));
    if (ui.length || this.definition.systems.includes('ui')) this.addSystem(new UISystem(ui));
    if (audio.length || this.definition.systems.includes('audio')) this.addSystem(new AudioSystem(audio, api));

    for (const entity of this.definition.entities) {
      this.instantiateEntity(engine, entity);
    }
  }

  private instantiateEntity(engine: Engine, entity: EntityDefinition): number {
    const id = this.world.createEntity();
    const transform = new Transform({
      position: entity.transform.position,
      scale: entity.transform.scale,
    });
    transform.rotation = { ...entity.transform.rotation };
    this.world.addComponent(id, new EntityInfo({ key: entity.key, name: entity.name, tags: entity.tags, data: entity.data }));
    this.world.addComponent(id, transform);

    if (entity.mesh) this.attachMesh(engine, id, entity.mesh);
    if (entity.rigidBody) this.attachRigidBody(engine, id, entity.rigidBody, transform);
    if (entity.sprite) this.attachSprite(engine, id, entity.sprite);
    if (entity.cameraTarget) {
      const cameraTarget = new CameraTarget();
      cameraTarget.lerp = entity.cameraTarget.lerp;
      cameraTarget.offset = { ...entity.cameraTarget.offset };
      this.world.addComponent(id, cameraTarget);
    }
    return id;
  }

  private instantiatePrefab(
    engine: Engine,
    prefabKey: string,
    options: { position?: { x: number; y: number; z: number }; key?: string; tags?: string[]; data?: Record<string, unknown> } = {},
  ): number {
    const prefab = this.rootDefinition.prefabs[prefabKey];
    if (!prefab) throw new Error(`Prefab "${prefabKey}" is not registered.`);
    const entity = prefabToEntity(prefabKey, prefab, options);
    return this.instantiateEntity(engine, entity);
  }

  private createSceneApi(engine: Engine): RuntimeSceneApi {
    return {
      assets: this.assets,
      spawnPrefab: (prefab, options) => this.instantiatePrefab(engine, prefab, options),
      destroyEntity: (id) => this.destroyRuntimeEntity(engine, id),
      playAudio: (assetKey, volume = 1) => this.playAudio(assetKey, volume),
      emitGameEvent: (name, payload) => engine.events.emit('game:event', { name, payload }),
    };
  }

  private destroyRuntimeEntity(engine: Engine, id: number): void {
    const mesh = this.world.getComponent(id, MeshComponent)?.object3D;
    if (mesh) {
      engine.three?.scene.remove(mesh);
      disposeObject(mesh);
    }
    const sprite = this.world.getComponent(id, SpriteComponent)?.gameObject;
    sprite?.destroy();
    const body = this.world.getComponent(id, RigidBodyComponent)?.body;
    if (body && engine.physics?.isReady()) engine.physics.world.removeRigidBody(body);
    this.world.destroyEntity(id);
  }

  private playAudio(assetKey: string, volume: number): void {
    const asset = this.assets.get<LoadedAsset>(assetKey);
    if (!(asset instanceof HTMLAudioElement)) return;
    const audio = asset.cloneNode(true) as HTMLAudioElement;
    audio.volume = Math.max(0, Math.min(1, volume));
    void audio.play().catch(() => {
      // Browsers may block autoplay until user interaction. This should not crash games.
    });
  }

  private attachLights(engine: Engine, definitions: LightDefinition[]): void {
    if (!engine.three || definitions.length === 0) return;
    for (const definition of definitions) {
      const light = createLight(definition);
      engine.three.scene.add(light);
      this.addCleanup(() => engine.three?.scene.remove(light));
    }
  }

  private attachMesh(engine: Engine, id: number, definition: MeshDefinition): void {
    if (!engine.three) throw new Error(`Entity ${id} defines a mesh but 3D rendering is disabled.`);
    const mesh = createMesh(definition);
    engine.three.scene.add(mesh);
    this.addCleanup(() => {
      engine.three?.scene.remove(mesh);
      disposeObject(mesh);
    });
    this.world.addComponent(id, new MeshComponent(mesh));
  }

  private attachRigidBody(engine: Engine, id: number, definition: RigidBodyDefinition, transform: Transform): void {
    if (!engine.physics?.isReady()) throw new Error(`Entity ${id} defines a rigidBody but physics is disabled or not ready.`);

    const bodyOptions = {
      type: definition.type,
      position: transform.position,
      linearDamping: definition.linearDamping,
      angularDamping: definition.angularDamping,
      ccd: definition.ccd,
    };
    const colliderOptions: ColliderOptions = definition.colliderOptions;

    const physicsBody =
      definition.collider.shape === 'cuboid'
        ? Colliders.cuboid(engine.physics, definition.collider.halfExtents, bodyOptions, colliderOptions)
        : definition.collider.shape === 'ball'
          ? Colliders.ball(engine.physics, definition.collider.radius, bodyOptions, colliderOptions)
          : Colliders.capsule(engine.physics, definition.collider.halfHeight, definition.collider.radius, bodyOptions, colliderOptions);

    this.addCleanup(() => {
      if (engine.physics?.isReady()) engine.physics.world.removeRigidBody(physicsBody.body);
    });
    this.world.addComponent(id, new RigidBodyComponent(physicsBody.body, physicsBody.collider));
  }

  private attachSprite(engine: Engine, id: number, definition: SpriteDefinition): void {
    if (!engine.phaser?.isReady()) throw new Error(`Entity ${id} defines a sprite but 2D rendering is disabled or not ready.`);
    if (definition.kind === 'text') {
      const text = engine.phaser.scene.add.text(definition.x, definition.y, definition.text, definition.style);
      const component = new SpriteComponent(text);
      component.followIn3D = definition.followIn3D;
      this.addCleanup(() => text.destroy());
      this.world.addComponent(id, component);
    } else if (definition.kind === 'image') {
      const imageAsset = this.assets.require<HTMLImageElement>(definition.assetKey);
      if (!engine.phaser.scene.textures.exists(definition.assetKey)) {
        engine.phaser.scene.textures.addImage(definition.assetKey, imageAsset);
      }
      const image = engine.phaser.scene.add.image(definition.x, definition.y, definition.assetKey);
      image.setOrigin(definition.origin.x, definition.origin.y);
      image.setAlpha(definition.alpha);
      image.setDepth(definition.depth);
      if (definition.width || definition.height) {
        image.setDisplaySize(definition.width ?? image.displayWidth, definition.height ?? image.displayHeight);
      }
      const component = new SpriteComponent(image);
      component.followIn3D = definition.followIn3D;
      this.addCleanup(() => image.destroy());
      this.world.addComponent(id, component);
    }
  }
}

function createMesh(definition: MeshDefinition): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: toThreeColor(definition.color),
    metalness: definition.metalness,
    roughness: definition.roughness,
  });

  if (definition.shape === 'box') {
    return new THREE.Mesh(new THREE.BoxGeometry(definition.size.x, definition.size.y, definition.size.z), material);
  }
  if (definition.shape === 'sphere') {
    return new THREE.Mesh(new THREE.SphereGeometry(definition.radius, definition.widthSegments, definition.heightSegments), material);
  }
  if (definition.shape === 'plane') {
    return new THREE.Mesh(new THREE.PlaneGeometry(definition.size.x, definition.size.y), material);
  }
  if (definition.shape === 'cylinder') {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(definition.radiusTop, definition.radiusBottom, definition.height, definition.radialSegments),
      material,
    );
  }
  if (definition.shape === 'cone') {
    return new THREE.Mesh(new THREE.ConeGeometry(definition.radius, definition.height, definition.radialSegments), material);
  }
  return new THREE.Mesh(new THREE.TorusGeometry(definition.radius, definition.tube, definition.radialSegments, definition.tubularSegments), material);
}

function toThreeColor(color: string | number): THREE.ColorRepresentation {
  if (typeof color === 'number') return color;
  if (color.startsWith('#')) return color;
  if (color.startsWith('0x')) return Number.parseInt(color.slice(2), 16);
  return color;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
  });
}

function createLight(definition: LightDefinition): THREE.Light {
  if (definition.type === 'ambient') return new THREE.AmbientLight(toThreeColor(definition.color), definition.intensity);
  if (definition.type === 'directional') {
    const light = new THREE.DirectionalLight(toThreeColor(definition.color), definition.intensity);
    light.position.set(definition.position.x, definition.position.y, definition.position.z);
    light.castShadow = definition.castShadow;
    return light;
  }
  const light = new THREE.PointLight(toThreeColor(definition.color), definition.intensity, definition.distance, definition.decay);
  light.position.set(definition.position.x, definition.position.y, definition.position.z);
  return light;
}

function prefabToEntity(
  prefabKey: string,
  prefab: PrefabDefinition,
  options: { position?: { x: number; y: number; z: number }; key?: string; tags?: string[]; data?: Record<string, unknown> },
): EntityDefinition {
  return {
    key: options.key ?? `${prefabKey}-${cryptoRandomId()}`,
    name: prefab.name,
    transform: {
      ...prefab.transform,
      position: options.position ?? prefab.transform.position,
    },
    mesh: prefab.mesh,
    rigidBody: prefab.rigidBody,
    sprite: prefab.sprite,
    cameraTarget: prefab.cameraTarget,
    tags: [...prefab.tags, ...(options.tags ?? [])],
    data: { ...prefab.data, ...(options.data ?? {}) },
  };
}

function cryptoRandomId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function triggerType(trigger: unknown): string {
  if (typeof trigger === 'string') return trigger;
  if (trigger && typeof trigger === 'object') {
    const source = trigger as Record<string, unknown>;
    if (typeof source.type === 'string') return source.type;
    if (typeof source.trigger === 'string') return source.trigger;
  }
  return '';
}
