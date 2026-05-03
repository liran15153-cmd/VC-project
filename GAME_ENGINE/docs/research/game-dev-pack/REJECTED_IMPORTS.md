# Rejected Imports

These files were deliberately not moved into `GAME_ENGINE` as usable engine material.

## Corrupted Or Misidentified Images

Most image-looking files copied from Temp failed basic image validation. They had `.png` or
`.gif` names but did not have valid image headers or could not be treated as real assets.

Examples skipped:

- `Bushe2.png`
- `preview.gif`
- `preview-oakwoods.gif`
- `Rock3.png`
- `Tree1.png`
- `Tree2.png`
- `Archer_Idle.png`
- `Archer_Run.png`
- `Archer_Shoot.png`
- `Avatars_03.png`
- `BigBar_Base.png`
- `BigBar_Fill.png`
- `RegularPaper.png`
- `SmallRibbons.png`
- `SpecialPaper.png`
- `Swords.png`
- `Tilemap_color2.png`
- `Warrior_Attack1.png`
- `Warrior_Idle.png`
- `WoodTable.png`

## Misnamed Or Broken Scripts

- `_fal_common.py` was rejected because it was not valid Python in the extracted copy.
- `fal_image_experiment_matrix.py` was rejected for now because it imports missing/broken fal helper modules.
- `fal_queue_image_run.py` was rejected as an active tool because the extracted set was incomplete for a reliable fal runner.

The fal material kept in `docs/research/game-dev-pack/asset-generation/fal/` is useful as
design reference, but a production `assetGenerationService` should be rebuilt cleanly.

## Misplaced Content

- `retro-api-and-styles.md` was rejected because the extracted file content was actually
Playwright testing notes, not Retro Diffusion API guidance.

## Rule Used

Only files that passed basic validation and had a clear use for the engine were moved into
`GAME_ENGINE`. Research docs are allowed to be reference-only; scripts and assets need a
stronger bar because they may be executed or loaded by examples.
