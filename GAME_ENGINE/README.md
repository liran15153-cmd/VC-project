# GVC Game Engine

TypeScript game runtime for Gaming Vibe Coding: Three.js for 3D, Phaser for 2D/HUD, Rapier for physics, and a small ECS layer that keeps generated games structured and testable.

## What This Engine Is

This is not meant to execute arbitrary JavaScript from an AI response. The safe path is:

1. AI produces a declarative `GameDefinition` JSON document.
2. `parseGameDefinition()` validates and normalizes it with Zod.
3. `GameRuntime` builds scenes from whitelisted systems and components.
4. The engine runs the result in one controlled lifecycle.

That model is much safer and easier to improve than injecting generated code snippets into a template.

## Layout

```text
GAME_ENGINE/
  src/
    assets/       AssetManager and asset definitions
    camera/       Universal camera controller
    components/   Transform, Mesh, Sprite, RigidBody, CameraTarget
    core/         Engine, Scene, SceneManager, World, EventBus, types
    input/        InputManager and mobile VirtualJoystick
    physics/      Rapier wrapper and collider helpers
    renderers/    ThreeRenderer and PhaserRenderer
    runtime/      JSON schema, GameRuntime, Registry
    systems/      PhysicsSyncSystem and CameraSystem
    utils/        Resize and device helpers
  examples/       Browser hello-world demo
  tests/          Unit tests for core/runtime behavior
```

## Frame Lifecycle

```text
requestAnimationFrame tick
  1. Fixed-step Rapier physics
  2. Scene systems by priority
  3. Sync physics -> ECS -> Three/Phaser
  4. Render Three
  5. Manually step/render Phaser overlay
```

Phaser's own RAF is put to sleep after boot so render ordering stays deterministic.

## Verify

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Or run the full gate:

```bash
npm run verify
```

## Run Demo

```bash
npm run dev
```

Open `http://localhost:5173`.

## Minimal JSON Runtime Example

```ts
import { Engine, GameRuntime } from './src';

const engine = new Engine({
  container: '#app',
  enable3D: true,
  enable2D: true,
  enablePhysics: true,
});

await engine.init();

const runtime = new GameRuntime(engine);
await runtime.load({
  metadata: { title: 'Dragon Cube' },
  scenes: [
    {
      key: 'main',
      entities: [
        {
          key: 'player',
          transform: { position: { x: 0, y: 5, z: 0 } },
          mesh: { shape: 'box', color: 0xff6b35 },
          rigidBody: { collider: { shape: 'cuboid' } },
          cameraTarget: {},
        },
      ],
    },
  ],
});

engine.start();
```

## Current Status

Production-oriented skeleton. The engine now has a typed ECS, lifecycle events, deterministic render stepping, resize-safe viewport state, asset loading, declarative JSON validation, a safe runtime loader, and unit tests.

Next major upgrades should be behavior graphs, animation/tween systems, audio, asset manifest integration, richer 2D support, collision event routing to game rules, and a sandboxed preview/export pipeline.
