import * as THREE from 'three';
import {
  Engine,
  Scene,
  Transform,
  MeshComponent,
  RigidBodyComponent,
  SpriteComponent,
  CameraTarget,
  PhysicsSyncSystem,
  CameraSystem,
  Colliders,
} from '../src';

/**
 * Hello-world: a 3D cube falls onto a static ground plane,
 * with a Phaser "Score" text rendered as a 2D HUD overlay.
 *
 *   Three.js  → cube + ground (3D)
 *   Rapier    → physics
 *   Phaser    → HUD text
 *   ECS       → glues them together
 */
class HelloWorldScene extends Scene {
  private score = 0;

  async create(engine: Engine): Promise<void> {
    this.addSystem(new PhysicsSyncSystem());
    this.addSystem(new CameraSystem());

    const three = engine.three!;
    const physics = engine.physics!;
    const phaser = engine.phaser!;

    // ---- Ground (3D mesh + static physics body) ----
    const groundMesh = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x2c8a3b }),
    );
    three.scene.add(groundMesh);

    const groundBody = Colliders.ground(physics, { x: 10, y: 0.1, z: 10 }, { x: 0, y: -0.1, z: 0 });
    const ground = this.world.createEntity();
    this.world.addComponent(ground, new Transform({ position: { x: 0, y: -0.1, z: 0 } }));
    this.world.addComponent(ground, new MeshComponent(groundMesh));
    this.world.addComponent(ground, new RigidBodyComponent(groundBody.body, groundBody.collider));

    // ---- Falling cube ----
    const cubeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff6b35, metalness: 0.2, roughness: 0.4 }),
    );
    three.scene.add(cubeMesh);

    const cubeBody = Colliders.cuboid(
      physics,
      { x: 0.5, y: 0.5, z: 0.5 },
      { type: 'dynamic', position: { x: 0, y: 5, z: 0 } },
      { restitution: 0.4, friction: 0.5, density: 1 },
    );
    const cube = this.world.createEntity();
    this.world.addComponent(cube, new Transform({ position: { x: 0, y: 5, z: 0 } }));
    this.world.addComponent(cube, new MeshComponent(cubeMesh));
    this.world.addComponent(cube, new RigidBodyComponent(cubeBody.body, cubeBody.collider));
    this.addCleanup(() => {
      three.scene.remove(groundMesh, cubeMesh);
      if (physics.isReady()) {
        physics.world.removeRigidBody(groundBody.body);
        physics.world.removeRigidBody(cubeBody.body);
      }
      groundMesh.geometry.dispose();
      cubeMesh.geometry.dispose();
      (groundMesh.material as THREE.Material).dispose();
      (cubeMesh.material as THREE.Material).dispose();
    });

    // Optional: have the camera smoothly follow the cube
    const cameraTag = new CameraTarget();
    cameraTag.offset = { x: 0, y: 4, z: 8 };
    cameraTag.lerp = 3;
    this.world.addComponent(cube, cameraTag);

    // ---- Phaser HUD: a "Score: N" text ----
    const scoreText = phaser.scene.add.text(20, 20, 'Score: 0', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    const hud = this.world.createEntity();
    this.world.addComponent(hud, new SpriteComponent(scoreText));
    this.addCleanup(() => scoreText.destroy());

    // Bump the score every time the cube bounces above a threshold velocity.
    let lastY = cubeBody.body.translation().y;
    const onTick = (): void => {
      const v = cubeBody.body.linvel();
      if (lastY < 1 && v.y > 1) {
        this.score++;
        scoreText.setText(`Score: ${this.score}`);
      }
      lastY = cubeBody.body.translation().y;
    };
    // Run our scoring callback as a tiny inline system.
    this.addSystem({
      name: 'ScoringSystem',
      enabled: true,
      priority: 100,
      update: onTick,
    });
  }
}

async function main(): Promise<void> {
  const engine = new Engine({
    container: '#app',
    background: 0x0c1020,
    enable3D: true,
    enable2D: true,
    enablePhysics: true,
  });

  await engine.init();
  engine.scenes.register('hello', new HelloWorldScene());
  await engine.scenes.switchTo('hello');
  engine.start();

  // Expose for debugging
  (window as unknown as { engine: Engine }).engine = engine;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
