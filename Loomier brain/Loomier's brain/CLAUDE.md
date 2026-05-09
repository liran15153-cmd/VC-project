# CLAUDE.md - Codex Working Guide

@AGENTS.md

This file tells Codex how to work in this repo.

---

## Project Identity

LOOMIER / Gaming Vibe Coding is an AI-assisted game creation platform.

The product is not "prompt to disposable game." It is:

```txt
idea -> clarification -> structured editable game -> preview -> iteration -> export
```

The user cares more about a strong creative experience than polished infrastructure diagrams.

---

## Current Ground Truth

- Use `prototype/` as the current creator-facing prototype.
- Treat `prototype/backend/` as a stateless AI generation service.
- Treat `GAME_ENGINE/` as the future runtime foundation.
- Treat `supabase/` as the future persistence/auth/storage layer.
- Do not use the rejected React/Supabase frontend work as the default UX direction.
- This vault is the memory source for project decisions.

---

## Engineering Style

Be direct, critical, and practical.

Before editing:

1. Inspect relevant files.
2. Identify whether the request is useful, premature, risky, or overbuilt.
3. Prefer the smallest useful change.
4. Keep code modular and readable.
5. Verify with tests/builds where possible.
6. Report what changed and what still needs testing.

Do not flatter. If a direction is bad, say so and suggest a better path.

---

## Technical Priorities

Priority order:

1. Working creative core loop.
2. Editable structured output.
3. Asset-aware generation.
4. Hybrid runtime preview.
5. Persistence and auth.
6. Visual editing.
7. Export/publishing.

Avoid building enterprise infrastructure before the game creation loop is compelling.

---

## Runtime Rule

Phaser, Three.js, and Rapier should be treated as parts of one hybrid runtime.

Do not describe the product as:

```txt
2D engine path + 3D engine path
```

Use this mental model:

```txt
GameDefinition
  -> runtime systems
  -> Phaser renderer / Three renderer / Rapier physics
  -> preview and export
```

---

## AI Workflow Rule

AI output is untrusted.

Good flow:

```txt
route -> service -> AI adapter -> schema validation -> runtime/game builder -> response
```

Bad flow:

```txt
route -> direct AI call -> raw code/html -> frontend
```

Keep provider calls in services/adapters. Keep routes thin.

---

## Asset Rule

Assets are infrastructure.

Every asset should eventually have:

- owner
- source
- license
- tags
- type
- dimensions
- compatibility
- runtime manifest reference
- project/game relationships

Do not treat assets as random file attachments.

---

## Security Rules

Never:

- expose service keys client-side
- commit `.env`
- trust frontend input
- trust AI output without validation
- bypass ownership/RLS for convenience
- accept unsafe filenames or upload paths

Always:

- validate requests with schemas
- sanitize generated/exported HTML
- keep service-role operations backend-only
- preserve user ownership boundaries

---

## Useful Commands

```bash
npm run verify

cd prototype/backend
npm run check
npm test

cd ../../GAME_ENGINE
npm test
npm run build

cd ../frontend
npm run build
```

Run only the commands relevant to the files changed.

---

## Documentation Discipline

When project direction changes:

- update [[STATUS]]
- update relevant ADR if a decision changed
- update [[knowledge/open-questions]] if a question was answered
- keep this file practical

Do not duplicate the same long explanation in many places.

---

## Related

- [[HOME]]
- [[AGENTS]]
- [[STATUS]]
- [[DECISIONS]]
- [[NEXT]]

## Depends On

- [[ARCHITECTURE_UPDATED]]
- [[docs/security]]
