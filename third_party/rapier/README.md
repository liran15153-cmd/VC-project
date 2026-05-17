# third_party/rapier

This directory documents LOOMIER's controlled use of selected Rapier source
snapshots under the Apache License 2.0.

## What Is Included


- `LICENSE` contains the upstream Apache-2.0 license.
- `NOTICE` records attribution and the LOOMIER adaptation policy.
- `upstream-manifest.json` records the local source snapshot path and SHA-256
  hashes, source metadata, per-file status, and local TypeScript adaptation
  targets for the copied upstream files.
- `upstream/` contains selected Rapier examples/testbed files used as source
  snapshots for implementation reference and provenance.

## Runtime Policy

LOOMIER does not build or vendor Rapier's Rust physics engine. Runtime physics
continues to use the official `@dimforge/rapier3d-compat` JavaScript/WASM
package behind LOOMIER's TypeScript wrappers.

The copied files are not compiled into LOOMIER. Any live behavior must be
implemented as LOOMIER-owned TypeScript under `GAME_ENGINE/src/physics`, with
source attribution kept here.

Dimforge and Rapier names are used only for attribution and provenance. No
Dimforge/Rapier endorsement of LOOMIER is implied.

## Excluded

- Rapier core engine internals (`src/dynamics`, `src/geometry`, `src/pipeline`)
- Rust crate/build setup (`crates`, `.cargo`, `Cargo.toml`)
- CI/publish scripts
- vehicle, PID, joints, multibody, robotics, and arbitrary trimesh runtime
  exposure for this phase
