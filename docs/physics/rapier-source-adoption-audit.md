# Rapier Source Adoption Audit

Date: 2026-05-17

## Scope

Local source reviewed: `C:\Users\lior\Downloads\rapier-master\rapier-master`.

LOOMIER still uses `@dimforge/rapier3d-compat` as the live physics engine.
This pass adopts selected Rapier files as Apache-2.0 source snapshots and
ports small behavior patterns into LOOMIER-owned TypeScript fixtures/tests.
It does not add a Rust build, a Rapier fork, or raw Rapier APIs to
`GameDefinition`.

## Provenance

- Upstream repository: `https://github.com/dimforge/rapier`
- Local snapshot date: `2026-05-16T15:53:11.5077243+03:00`
- Local copy/capture date: `2026-05-17`
- Source version: `0.32.0` from `workspace.package.version` in local `Cargo.toml`
- Exact commit SHA: unavailable in this local `rapier-master` snapshot because
  there is no `.git` metadata or archive commit marker.
- Source tag: unavailable; the local changelog starts at `Unreleased`, so this
  should be treated as a master-branch snapshot rather than a verified release
  tag.
- Per-file SHA-256 hashes, file status, and TypeScript adaptation targets are
  recorded in `third_party/rapier/upstream-manifest.json`.

## Adopted Source Snapshots

Copied to `third_party/rapier/upstream/` with hashes in
`third_party/rapier/upstream-manifest.json`:

| Upstream path | Status | LOOMIER use |
| --- | --- | --- |
| `LICENSE`, `README.md`, `ARCHITECTURE.md` | reference-only | Attribution, provenance, repository structure reference |
| `examples3d/character_controller3.rs` | adapted | Character controller slope, wall, step, and safe controller tuning reference |
| `examples2d/character_controller2.rs` | reference-only | 2D-style controller reference only; not a rapier2d runtime adoption |
| `examples3d/utils/character.rs` | adapted | Kinematic controller movement/configuration reference |
| `examples2d/utils/character.rs` | reference-only | 2D-style movement reference only |
| `examples3d/sensor3.rs` | adapted | Sensor attached to moving body reference |
| `examples2d/sensor2.rs` | reference-only | 2D sensor reference only |
| `examples3d/collision_groups3.rs` | adapted | Interaction-group separation reference |
| `examples2d/collision_groups2.rs` | reference-only | 2D interaction-group reference only |
| `examples3d/stress_tests/ray_cast3.rs` | adapted | Reduced deterministic ray-fan fixture reference |
| `src_testbed/debug_render.rs` | reference-only | Debug-render buffer/color sanity reference |
| `examples3d/heightfield3.rs` | deferred | Terrain collider reference; no runtime exposure yet |
| `examples3d/trimesh3.rs` | deferred | Trimesh collider reference; no runtime exposure yet |

## Live TypeScript Adaptations

Implemented in `GAME_ENGINE/src/physics/RapierExampleFixtures.ts` and tested by
`GAME_ENGINE/tests/physics-rapier-source-adoption.test.ts`.

Adapted behavior:

- character controller player/ground/slope/wall/small-step fixtures
- moving platform motion fixture, with character riding/support explicitly
  deferred
- sensor attached to a body with both solid and sensor colliders
- named-layer collision filtering that mirrors Rapier group separation
- reduced deterministic ray fan inspired by Rapier's ray-cast stress test
- debug render buffer shape check for preview overlay compatibility

The fixture helper is intentionally not exported from `GAME_ENGINE/src/index.ts`.
It is internal runtime/test infrastructure only.

## Build Isolation

`third_party/rapier/` is source provenance only:

- `GAME_ENGINE/tsconfig.json` includes only `src/**/*` and excludes examples,
  node_modules, and dist. It does not include `third_party`.
- `GAME_ENGINE/vite.config.ts` builds from `GAME_ENGINE/examples` and aliases
  only `GAME_ENGINE/src/*` paths. It does not alias or import `third_party`.
- `GAME_ENGINE/src/index.ts` does not export `RapierExampleFixtures.ts` or any
  copied upstream snapshot.
- `frontend/scripts/copy-engine-preview.mjs` copies only
  `GAME_ENGINE/examples/dist` into `frontend/public/engine-preview`; it does not
  copy `third_party/rapier`.
- The frontend preview bundle should include only the normal engine/runtime
  output and the npm `@dimforge/rapier3d-compat` dependency, not source
  snapshots.

## Reference-Only Areas

These were reviewed but not copied as live runtime code:

- all copied `examples2d/*` files: reference-only, because the current runtime
  uses `@dimforge/rapier3d-compat`; LOOMIER's `platformer2d` and `runner2d`
  names mean 2D-style controllers inside a 3D Rapier world
- `examples3d/heightfield3.rs` and `examples3d/trimesh3.rs`: deferred terrain
  collider references, not runtime/GameDefinition features
- moving-platform character riding behavior: deferred; only the platform motion
  fixture is currently used
- `src/control/character_controller.rs`: useful for understanding behavior, but
  LOOMIER should call the JS/WASM `KinematicCharacterController` instead of
  porting core controller internals.
- `src_testbed/` other than `debug_render.rs`: useful for scene/testbed ideas,
  but tied to Rust and kiss3d testbed infrastructure.
- non-robot OBJ/font assets under `assets/`: possible future fixture assets,
  but not needed for current primitive-collider tests.
- `CHANGELOG.md`, `CONTRIBUTING.md`, and docs: reference only.

## Rejected For This Phase

Do not copy or compile these into LOOMIER:

- `src/dynamics`, `src/geometry`, `src/pipeline`, solver, broad phase, narrow
  phase, and core engine internals
- `crates/`, `.cargo`, `Cargo.toml`, CI scripts, publish scripts
- vehicle, PID, joints, multibody, inverse kinematics, robotics, and URDF demos
- `assets/3d/T12` robotics STL/URDF assets
- arbitrary live `heightfield` or `trimesh` exposure in `GameDefinition`

## Legal Notes

Rapier is licensed under Apache-2.0. This pass copies selected source snapshots
and therefore adds `third_party/rapier/LICENSE`, `NOTICE`, `README.md`, and
`upstream-manifest.json`.

Any future copied/adapted Rapier file must be added to the manifest and NOTICE
before shipping.

No Rapier assets are copied in this phase. Dimforge and Rapier names are used
only for attribution and provenance; no endorsement is implied.

## Verification

Expected command:

```bash
npm.cmd run engine:verify
```

Run frontend build only if preview/debug overlay files change:

```bash
cd frontend
npm.cmd run build
```
