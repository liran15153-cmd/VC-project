# Game Dev Pack Research

Curated, validated material imported into the `GAME_ENGINE` workspace from the temporary
game-dev files under `C:\Users\lior\AppData\Local\Temp`.

These files are here as engine research and prompt context. They are not runtime code unless
explicitly wired into `src/`.

## Included

- `asset-generation/fal/` - fal.ai image model notes and model presets for future asset generation.
- `asset-generation/retro-diffusion/` - Retro Diffusion notes, model presets, and animation workflow guidance for pixel-art assets.
- `phaser/` - Phaser 3 scene, input, Arcade Physics, spritesheet, nine-slice, and tilemap references.
- `phaser4/` - Phaser 4 rendering, texture, and migration notes for future engine upgrades.
- `threejs/` - Three.js, GLTF loading, animation, reference-frame, and game-pattern notes.
- `testing/` - Deterministic canvas/WebGL testing, flake reduction, and visual-regression notes.
- `starter-packs/` - selected starter-project READMEs/plans kept as implementation references only.

## Included Tools

Validated utility scripts were moved to:

- `GAME_ENGINE/tools/game-dev-pack/asset-generation/retro-diffusion/prepare_reference_image.py`
- `GAME_ENGINE/tools/game-dev-pack/testing/imgdiff.py`
- `GAME_ENGINE/tools/game-dev-pack/testing/with_server.py`

## Included Sample Assets

Only image files that passed basic image validation were moved to:

- `GAME_ENGINE/examples/assets/starter-packs/oak-woods-sample/Fence.png`
- `GAME_ENGINE/examples/assets/starter-packs/tiny-swords-sample/Castle.png`
- `GAME_ENGINE/examples/assets/starter-packs/tiny-swords-sample/Warrior_Run.png`

Confirm original asset-pack licenses before commercial use.

## Excluded

See `REJECTED_IMPORTS.md` for files that were skipped because they were corrupted, had the
wrong content for their name, or were not appropriate for the engine package.
