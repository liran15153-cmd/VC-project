# Local Asset System

LOOMIER uses a local asset library for the MVP. Assets live in the repo, are indexed into an AI-readable registry, and are copied to a public runtime path that `GAME_ENGINE` can load.

## Directory Layout

- `assets-library/raw/` is the default drop zone for new local source assets.
- `assets-library/processed/` stores normalized imported files.
- `assets-library/thumbnails/` is reserved for future thumbnails.
- `assets-library/previews/` is reserved for preview sheets or screenshots.
- `assets-library/manifests/asset-registry.json` is the canonical local registry.
- `public/assets/library/` contains runtime files served by the app.
- `public/assets/starter-packs/` remains untouched seed data.

Do not put source-only formats, huge unused packs, private files, secrets, or user-owned draft uploads directly in `public/`.

## Importing Assets

Import the Kenney starter pack:

```bash
npm run import:assets -- --source public/assets/starter-packs/kenney-platformer-kit --pack kenney-platformer-kit
```

Import from the default raw drop zone:

```bash
npm run import:assets
```

The importer copies supported files into `assets-library/processed/<pack>/...` and `public/assets/library/<pack>/...`, computes a SHA-256 hash, and updates the registry without deleting old entries.

## Registry

The registry shape is:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-09T00:00:00.000Z",
  "assets": []
}
```

Each asset tracks ID, name, type, category, subcategory, tags, engine compatibility, local path, public path, license, dimensions when available, file size, format, hash, and timestamps.

Tags can be edited manually in `assets-library/manifests/asset-registry.json`. After manual edits, run:

```bash
npm run validate:assets
```

## Agent Usage

Backend code should use `prototype/backend/src/services/assetRegistryService.js`:

- `searchAssets(query)` for broad text search.
- `getAssetsForEngine(engine)` for runtime-compatible assets.
- `getRecommendedAssetsForGameBrief(gameBrief)` when selecting assets from a planning brief.
- `buildGameAssetManifest(assetIds, engine)` to produce `{ key, type, url }` entries for `GAME_ENGINE`.

Agents should choose only assets the game actually needs. A small, specific manifest is better than attaching an entire pack.

## Validation And Summary

Validate registry and file references:

```bash
npm run validate:assets
```

Print a quick overview:

```bash
npm run assets:summary
```

## Future Supabase Migration

The local registry is intentionally close to a future database/storage model. Stable fields that should survive migration are `id`, `source`, `license`, `hash`, `filePath`, `publicPath`, `type`, `tags`, and `engineCompatibility`.

When Supabase is added, keep asset IDs stable and change only the storage resolver/public URL layer. Do not make game definitions depend on local filesystem paths.
