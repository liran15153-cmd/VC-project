# LOOMIER Public README Draft

LOOMIER is an AI-assisted game creation platform for turning ideas into playable, editable games.

This is a draft README, not the source of truth for internal planning.

---

## What It Does

LOOMIER helps creators:

- describe a game idea
- answer a few focused questions
- generate a structured game definition
- preview the result
- edit through chat or future visual tools
- save and export playable projects

---

## Why It Is Different

Most prompt-to-game tools generate a one-off result.

LOOMIER is designed around:

- editable generated content
- reusable assets
- structured manifests
- hybrid 2D/3D runtime
- AI + human collaboration
- fast iteration

---

## Current Status

This is an early prototype.

Working:

- prototype UI
- backend AI generation service
- local fallback generation
- GAME_ENGINE runtime foundation
- Supabase schema foundation

Not ready:

- production auth flow
- production asset library
- visual editor
- real publishing pipeline

---

## Tech Direction

- Frontend: prototype first, future editor later
- Backend: Node.js + Express
- Runtime: Phaser + Three.js + Rapier unified through `GAME_ENGINE`
- Persistence: Supabase
- AI: provider adapter layer
- Validation: Zod

---

## Development Warning

Do not present this as production-ready yet.

The next milestone is a strong end-to-end creative loop, not a polished SaaS shell.

---

## Related

- [[HOME]]
- [[docs/vision]]
- [[STATUS]]
- [[knowledge/competitors]]
