# Kenney Platformer Kit

Installed from the local download at `C:\Users\lior\Downloads\kenney_platformer-kit`.

This starter pack is stored under:

- `/assets/starter-packs/kenney-platformer-kit/models/*.glb`
- `/assets/starter-packs/kenney-platformer-kit/textures/variation-a.png`
- `/assets/starter-packs/kenney-platformer-kit/previews/Preview.png`
- `/assets/starter-packs/kenney-platformer-kit/previews/Sample.png`

What was intentionally included:

- `GLB` models for runtime use
- the shared texture used by the pack
- preview images
- `License.txt`

What was intentionally excluded:

- `FBX` models
- `OBJ` models
- duplicate source-format files not needed for the current runtime

Reason:

The platform already treats Phaser.js, Three.js, and Rapier as one hybrid runtime. For a first playable build, `GLB` is the cleanest format to keep because it is directly usable from Three.js without dragging multiple export formats into the repo.

Recommended first-use subset:

- terrain: `block-grass*.glb`, `platform*.glb`, `ladder*.glb`
- hazards: `spike-block*.glb`, `trap-spikes*.glb`, `saw.glb`
- pickups: `coin-gold.glb`, `coin-silver.glb`, `key.glb`, `heart.glb`, `star.glb`
- props: `crate*.glb`, `barrel.glb`, `sign.glb`, `flag.glb`
- characters: `character-oobi.glb`, `character-oodi.glb`, `character-ooli.glb`, `character-oopi.glb`, `character-oozi.glb`

License:

- CC0, copied from `License.txt`
