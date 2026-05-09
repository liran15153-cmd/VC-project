# Asset System

Assets are core infrastructure.

They are not random uploads and not optional decoration.

---

## Why Assets Matter

Good game generation needs:

- visual style consistency
- compatible sprites/models/audio
- reusable packs
- ownership and license tracking
- AI-readable metadata

Without an asset system, AI generation becomes a toy that invents things it cannot actually render.

---

## Current Assets

The repo has starter samples under:

- `public/assets/starter-packs/`
- `GAME_ENGINE/examples/assets/`

These should be treated as seed data for the future asset library.

---

## Target Asset Metadata

Each asset should eventually track:

- id
- owner/user
- source
- license
- type
- tags
- style
- dimensions
- animation states
- compatible runtime systems
- storage path
- thumbnail

---

## AI Asset Behavior

AI should prefer:

1. reuse existing compatible assets
2. adapt/select from starter packs
3. generate missing assets only when needed
4. record what it used and why

---

## Near-Term Work

1. Define an asset manifest shape used by `GAME_ENGINE`.
2. Index starter packs with simple metadata.
3. Make generation reference assets by id/path instead of inventing invisible assets.
4. Add Supabase Storage later, after local manifest behavior works.

---

## Related

- [[HOME]]
- [[ARCHITECTURE_UPDATED]]
- [[docs/adr/ADR-005-asset-system]]
- [[Agents/02-asset-discovery-agent]]
- [[Agents/03-asset-generation-agent]]

## Feeds Into

- [[NEXT]]
- [[knowledge/game-schema]]
