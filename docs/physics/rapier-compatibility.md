# Rapier JS Compatibility Audit

Date: 2026-05-16

## Scope

LOOMIER must use Rapier through the official JavaScript/WASM package and engine-level wrappers. Do not vendor or compile Rapier's Rust engine internals into LOOMIER.

As of 2026-05-17, LOOMIER allows controlled source snapshots of selected Rapier examples/testbed files under `third_party/rapier/` for attribution, provenance, and TypeScript fixture adaptation. These snapshots are not runtime code and do not introduce a Rust/WASM build.

## Local Package State

- Declared dependency: `GAME_ENGINE/package.json` uses `@dimforge/rapier3d-compat: ^0.13.0`.
- Installed package: root `node_modules/@dimforge/rapier3d-compat/package.json` is `0.13.1`.
- Installed package license: `Apache-2.0`.
- Installed package repository: `github.com/dimforge/rapier.js`.

## Latest Registry State

- Verified with `npm view @dimforge/rapier3d-compat version license dist-tags.latest --json` on 2026-05-16.
- npm latest: `0.19.3`.
- npm latest license: `Apache-2.0`.
- jsDelivr package page also reports `0.19.3` and `Apache-2.0`.

## API Availability In Installed 0.13.1

| Capability | Installed API | Status |
| --- | --- | --- |
| Debug render | `World.debugRender()` returns `DebugRenderBuffers` | Available |
| Ray casting | `World.castRay()`, `World.castRayAndGetNormal()`, `World.intersectionsWithRay()` | Available |
| Shape casting | `World.castShape()` | Available |
| Point/intersection queries | `World.projectPoint()`, `World.intersectionsWithPoint()`, `World.intersectionWithShape()`, `World.intersectionsWithShape()` | Available |
| Collision groups | `ColliderDesc.setCollisionGroups()`, `Collider.setCollisionGroups()`, `InteractionGroups` bitmask format | Available |
| Character controller | `World.createCharacterController()` and `KinematicCharacterController` | Available |
| Heightfield | `ColliderDesc.heightfield()` | Available |
| Trimesh | `ColliderDesc.trimesh()` | Available |

## Legal/Attribution Assessment

Using the npm package as a dependency is allowed under Apache-2.0. A later controlled source-adoption pass copied selected Rapier examples/testbed files as source snapshots, so `third_party/rapier/LICENSE`, `NOTICE`, and `upstream-manifest.json` are now required and present.

If LOOMIER later copies or adapts additional Rapier source or examples, update `third_party/rapier/NOTICE` and `upstream-manifest.json` before shipping.

## Recommendation

Keep `0.13.1` for the wrapper/test pass. The required APIs already exist locally, so upgrading first would add migration risk before LOOMIER has engine-level diagnostics and fixtures.

Defer a `0.19.x` migration until after the wrappers, preview overlay, named collision layers, and fixtures are green. A future upgrade should compare type signatures for query filters, debug buffers, character controller behavior, and collision event semantics.

## Hardening Notes

- Entity physics lookup supports one body plus multiple colliders per entity.
- `getBodyByEntityId(entityId)`, `getPrimaryColliderByEntityId(entityId)`, and `getCollidersByEntityId(entityId)` are the preferred lookup methods.
- `getColliderByEntityId(entityId)` remains as a compatibility alias for the primary collider.
- `collectible` and `trigger` layers force Rapier sensor behavior internally. The generic `sensor` layer does not replace `ColliderDesc.setSensor(true)`.
- `GameDefinition` does not support `layer`, `collidesWith`, or raw collision groups. `colliderOptions` is strict so these fields are rejected instead of being silently stripped.
- `PhysicsDebugOverlay` is preview/dev-only and is not exported from the public engine index.
- `collectDiagnostics()` now returns structured entity diagnostics plus issue codes including `PLAYER_HAS_NO_COLLIDER`, `COLLECTIBLE_NOT_SENSOR`, `TRIGGER_NOT_SENSOR`, `ENTITY_BODY_LOOKUP_MISSING`, and `NO_WORLD_COLLIDER_FOUND`.
- Character controller infrastructure is internal-only. `PhysicsCharacterController` wraps Rapier `KinematicCharacterController` with LOOMIER presets `platformer2d`, `runner2d`, and `simple3d`.
- Because LOOMIER uses `@dimforge/rapier3d-compat`, `platformer2d` and `runner2d` are 2D-style presets inside a Rapier3D world. They are not Rapier2D controllers.
- Character controller presets own safe defaults for snap-to-ground, slope handling, autostep, and raycast-based ground checks. Raw Rapier controller options are not exposed to AI or `GameDefinition`.
- `third_party/rapier/` contains controlled snapshots of selected Rapier examples/testbed files. Rapier core engine internals remain excluded from LOOMIER runtime.
- Character controller diagnostics include `CHARACTER_CONTROLLER_NO_BODY`, `CHARACTER_CONTROLLER_NO_COLLIDER`, `CHARACTER_CONTROLLER_NOT_KINEMATIC`, `CHARACTER_CONTROLLER_NO_GROUND`, and `CHARACTER_CONTROLLER_INVALID_PRESET`.
- Local verification commands and the manual preview fixture are documented in `docs/physics/rapier-verification.md`.
- `CharacterControllerSystem` (Phase 4) drives registered controllers from game input actions (`moveLeft`, `moveRight`, `moveUp`, `moveDown`, `jump`). Topdown preset uses XZ movement only (constrainY handles gravity). Platformer/runner presets accumulate vertical velocity with gravity. GameRuntime auto-instantiates the system when any entity in a scene has `characterController`.

## Phase 4 Perf Baseline

Test file: `GAME_ENGINE/tests/physics-controller-paved-path.test.ts`

500 physics steps + controller.move() over a 20-tile paved path (topdown preset, no gravity):
- **Budget**: < 3000 ms total on CI  
- Expected in practice: < 200 ms on a developer machine
- Autostep gap: autostep over small obstacles is not yet proven stable on the topdown preset (autostep.maxHeight = 0 for topdown intentionally). Active fixtures document current collision-stop behavior.

## Deferred Features

Do not expose or implement these yet: `solverGroups`, joints, vehicles, PID, robotics, multibody, arbitrary trimesh colliders, raw Rapier character controller options in `GameDefinition`, or Rapier core-engine Rust vendoring/building.
