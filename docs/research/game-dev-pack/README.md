# Game Dev Pack Research Import

This folder contains curated material extracted from the temporary game-dev files under
`C:\Users\lior\AppData\Local\Temp`.

The imported files are intentionally treated as research/context, not production runtime
code. Many original Temp files had misleading names or wrong extensions, so files here were
renamed by content.

## What To Use

- `asset-generation/fal/` - notes for fal.ai image generation, queue runs, model selection, and cost-aware image workflows.
- `asset-generation/retro-diffusion/` - Retro Diffusion notes for pixel art, spritesheets, reference-image workflows, and animation prompts.
- `phaser/` - Phaser 3 notes for scenes, Arcade Physics, spritesheets, nine-slice UI, and tilemaps.
- `phaser4/` - Phaser 4 rendering and migration notes for later engine upgrades.
- `threejs/` - Three.js guidance for GLTF loading, reference-frame calibration, animation indexes, and game patterns.
- `testing/` - browser-game testing notes for deterministic mode, flake reduction, Playwright, and visual regression.
- `starter-packs/` - reference READMEs/plans from starter projects, useful as examples rather than code to import directly.

## Related Assets

Sample assets were copied to:

- `public/assets/starter-packs/tiny-swords-sample/`
- `public/assets/starter-packs/oak-woods-sample/`

These are useful for local prototypes, asset manifest experiments, and template-builder demos.
Before commercial use, confirm the original license/attribution for each asset pack.

## Related Tools

Unverified scripts were copied to:

- `tools/game-dev-pack/asset-generation/`
- `tools/game-dev-pack/testing-unverified/`

They are intentionally outside `prototype/` and `GAME_ENGINE/` because they need cleanup before
being called by production code. Treat them as reference implementations.

## Recommended Integration Order

1. Feed selected docs into `prototype/backend/src/services/systemPrompts.js` so generated JSON follows better Phaser/Three.js patterns.
2. Extend `GAME_ENGINE/src/runtime/GameDefinition.ts` with asset types for `spritesheet`, `tilemap`, `gltf`, and animation metadata.
3. Build a clean `assetGenerationService` from the fal/Retro notes and scripts.
4. Add deterministic preview tests using the testing notes and `imgdiff.py`.
