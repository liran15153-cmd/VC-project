# Rapier Verification And Stabilization

Date: 2026-05-16

## Local Verification Commands

Run these from the repository root on Windows:

```powershell
npm.cmd run engine:verify
```

Expected successful shape:

```text
> gvc-game-engine@0.1.0 verify
> npm run typecheck && npm run test && npm run build

> gvc-game-engine@0.1.0 typecheck
> tsc --noEmit

> gvc-game-engine@0.1.0 test
> vitest run

Test Files  ... passed
Tests       ... passed | ... skipped

> gvc-game-engine@0.1.0 build
> tsc && vite build

dist/...
built in ...
```

The skipped test should be the known autostep fixture until Rapier autostep behavior is fixed or the fixture is redesigned.

After the controlled Rapier source-adoption pass, `engine:verify` should also
include the Rapier source-adoption fixture tests. These tests exercise
LOOMIER-owned TypeScript adaptations of selected Rapier examples while keeping
the copied upstream files under `third_party/rapier/` as non-runtime snapshots.

If the React frontend needs to consume the built preview bundle, run:

```powershell
npm.cmd run build -w gvc-game-engine
npm.cmd --prefix frontend run engine-preview:copy
npm.cmd --prefix frontend run build
```

Notes:

- `frontend` is not currently a root npm workspace, so use `npm.cmd --prefix frontend ...` or run the command from the `frontend` directory.
- `frontend` build runs `engine-preview:copy` in `prebuild`, but the explicit copy command makes the dependency visible.
- `engine-preview:copy` expects `GAME_ENGINE/examples/dist` to exist, so build `gvc-game-engine` first.

## CharacterController Naming

LOOMIER currently uses `@dimforge/rapier3d-compat`, not Rapier2D.

Therefore:

- `simple3d` is a normal 3D-style controller preset inside a Rapier3D world.
- `platformer2d` and `runner2d` are 2D-style controller presets inside the same Rapier3D world.
- `platformer2d` and `runner2d` constrain movement on the unused Z axis; they are not true Rapier2D controllers.

Do not describe these presets as Rapier2D. The architecture remains one hybrid runtime with Rapier3D as the physics backend.

## Manual Preview Scenario

Start the engine preview:

```powershell
npm.cmd run engine:dev
```

Open:

```text
http://localhost:5175/preview.html?physicsDebug=1&physicsDebugControls=1
```

In the browser console, load this preview fixture:

```js
window.__loomierPreview.handleCommand({
  type: 'preview:load',
  requestId: 'manual-rapier-fixture',
  gameDefinition: {
    schemaVersion: 1,
    metadata: {
      title: 'Manual Rapier Fixture',
      description: 'Player, ground, wall, step, collectible trigger, enemy collider, and debug overlay.',
      genre: 'physics-fixture'
    },
    engine: {
      enable3D: true,
      enable2D: false,
      enablePhysics: true,
      background: '#101820',
      gravity: { x: 0, y: -9.81, z: 0 }
    },
    initialScene: 'main',
    assets: [],
    scenes: [
      {
        key: 'main',
        entities: [
          {
            key: 'player',
            tags: ['player'],
            transform: { position: { x: 0, y: 0.55, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.5, y: 1, z: 0.5 }, color: 0x38bdf8 },
            rigidBody: {
              type: 'dynamic',
              collider: { shape: 'cuboid', halfExtents: { x: 0.25, y: 0.5, z: 0.25 } },
              linearDamping: 0.2
            },
            cameraTarget: {}
          },
          {
            key: 'ground',
            tags: ['world', 'ground'],
            transform: { position: { x: 0, y: -0.1, z: 0 } },
            mesh: { shape: 'box', size: { x: 12, y: 0.2, z: 6 }, color: 0x166534 },
            rigidBody: {
              type: 'static',
              collider: { shape: 'cuboid', halfExtents: { x: 6, y: 0.1, z: 3 } }
            }
          },
          {
            key: 'wall',
            tags: ['world', 'wall'],
            transform: { position: { x: 2, y: 0.75, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.2, y: 1.5, z: 2 }, color: 0x475569 },
            rigidBody: {
              type: 'static',
              collider: { shape: 'cuboid', halfExtents: { x: 0.1, y: 0.75, z: 1 } }
            }
          },
          {
            key: 'small-step',
            tags: ['world', 'step', 'obstacle'],
            transform: { position: { x: 0.85, y: 0.1, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.35, y: 0.2, z: 1.5 }, color: 0xf59e0b },
            rigidBody: {
              type: 'static',
              collider: { shape: 'cuboid', halfExtents: { x: 0.175, y: 0.1, z: 0.75 } }
            }
          },
          {
            key: 'coin-collectible',
            tags: ['collectible', 'coin'],
            transform: { position: { x: -1, y: 0.35, z: 0 } },
            mesh: { shape: 'sphere', radius: 0.25, color: 0xfacc15 },
            rigidBody: {
              type: 'static',
              collider: { shape: 'ball', radius: 0.25 },
              colliderOptions: { sensor: true }
            }
          },
          {
            key: 'enemy',
            tags: ['enemy'],
            transform: { position: { x: -2, y: 0.5, z: 0 } },
            mesh: { shape: 'box', size: { x: 0.7, y: 1, z: 0.7 }, color: 0xef4444 },
            rigidBody: {
              type: 'static',
              collider: { shape: 'cuboid', halfExtents: { x: 0.35, y: 0.5, z: 0.35 } }
            }
          }
        ]
      }
    ]
  }
});
```

Expected manual checks:

- The debug overlay is visible immediately because `physicsDebug=1`.
- The toggle button is visible because `physicsDebugControls=1`.
- The player, ground, wall, small step, collectible sensor, and enemy collider all show debug lines.
- The collectible is a trigger/sensor by role and explicit `colliderOptions.sensor`.
- The wall/enemy/ground are solid colliders.

Slope note: physical slope colliders are covered by the internal CharacterController fixture. A rotated slope is not a reliable `GameDefinition` manual preview case yet because runtime rigid body creation currently applies transform position but not transform rotation to Rapier bodies.

## Public API Safety

Confirmed boundaries:

- `PhysicsDebugOverlay` is used by `GAME_ENGINE/examples/preview.ts` through an internal source import and is not exported from `GAME_ENGINE/src/index.ts`.
- `PhysicsCharacterController` is not exported from `GAME_ENGINE/src/index.ts`.
- `GameDefinition` has no CharacterController field and no controller preset field.
- Raw Rapier CharacterController options are not accepted by backend schema or `GameDefinition`.
- Collision bitmasks are not exposed through `GameDefinition`; runtime infers named layers internally from entity keys/tags/defaults.
- The public engine index exports named collision-layer constants/types, but not raw bitmask helper functions.

## Runtime Stability Checks

Current behavior:

- `PhysicsDebugOverlay.update()` returns before creating Three objects when disabled.
- `PhysicsDebugOverlay.setEnabled(false)` removes line objects and disposes geometry/material.
- `PhysicsDebugOverlay.destroy()` clears line geometry and material.
- Preview reset creates a new overlay for each engine and destroys the previous overlay before replacing it.
- Engine destroy clears event listeners after emitting destroy; overlay teardown is wired to that destroy event.
- `PhysicsCharacterController` creates a Rapier character controller only. It does not create rigid bodies or colliders.
- `PhysicsCharacterController.destroy()` removes the Rapier character controller and unregisters controller diagnostics.
- Controller query predicates exclude all colliders registered to the same entity, so multi-collider entities remain compatible.
- Diagnostics detect invalid controller setup with `CHARACTER_CONTROLLER_NO_BODY`, `CHARACTER_CONTROLLER_NO_COLLIDER`, `CHARACTER_CONTROLLER_NOT_KINEMATIC`, `CHARACTER_CONTROLLER_NO_GROUND`, and `CHARACTER_CONTROLLER_INVALID_PRESET`.

Known gap:

- Autostep is not proven stable. The intended "step over small obstacle" fixture is present but skipped; the active fixture documents current behavior: the controller detects the obstacle and stops short.
