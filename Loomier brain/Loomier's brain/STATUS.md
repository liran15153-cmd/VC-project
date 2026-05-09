# Project Status

Last updated: 2026-05-10

This file is the source of truth for current implementation status.

---

## High-Level Status

| Area | Status | Notes |
| --- | --- | --- |
| Prototype UI | Working | Current canonical creator surface |
| Prototype backend | Working | AI/generation service; tests pass |
| GAME_ENGINE | Preview-ready foundation | Tests pass; GameDefinition can render primitive meshes and GLB/GLTF model visuals |
| Supabase schema | Present | Good foundation, needs production review |
| React frontend | Not canonical | Build passes, but product/UX is not accepted |
| Asset system | Early | Starter packs exist; full metadata/search/upload not built |
| Visual editor | Not built | Future phase |
| Export pipeline | Basic | Prototype can export simple standalone files; real export not done |

---

## Recent Cleanup Decisions

- Deleted accidental `.claude` worktrees and branch clutter.
- Deleted the accidental remote branch `codex/supabase-backend-integration`.
- Root docs were intentionally removed because this vault is now the memory source.
- `frontend/` was restored to the pre-Supabase baseline.
- `Loomier brain/` must not be deleted during repo cleanup.

---

## Recent AI Flow Change

Questions Agent / Game Brief flow was refactored away from MockAI-first behavior.

Current backend direction:

- OpenRouter is the only real hosted AI provider for this flow.
- `AI_MODE=real` means OpenRouter-first.
- `AI_MODE=mock` means deterministic local simulator for development/tests.
- `AI_MODE=hybrid` means local/mock logic for cheap predictable steps, OpenRouter for reasoning-heavy planning.
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are the required real-AI env vars.
- MockAI must stay, but only as fallback/support/testing/token-saving utility.
- OpenRouter calls must remain server-side only.

Implemented backend pieces:

- `POST /api/mcq/generate` now uses schema-validated OpenRouter-first Questions Agent behavior.
- `POST /api/brief/generate` was added as the planning-only Game Brief Agent route.
- Game Brief generation must not emit full game code.
- LLM JSON output is parsed, repaired once if invalid, validated with Zod, then repaired once for schema failures.
- Prompt minimization, oversized-context compression, and short in-memory request caching were added.
- Local fallback was made deterministic so tests and offline dev are stable.

Relevant files:

- `prototype/backend/src/config/env.js`
- `prototype/backend/src/routes/mcq.js`
- `prototype/backend/src/routes/brief.js`
- `prototype/backend/src/services/openaiService.js`
- `prototype/backend/src/services/fallbackAIService.js`
- `prototype/backend/src/services/aiModeService.js`
- `prototype/backend/src/services/jsonAgentService.js`
- `prototype/backend/src/services/promptOptimizer.js`
- `prototype/backend/src/schemas/apiSchemas.js`

Verified after change:

```bash
cd prototype/backend
npm run check
npm test
```

Backend tests passed: 14/14. In the Codex sandbox, `npm test` required elevated execution because Node's test runner hit `spawn EPERM`.

---

## Recent Preview Bridge Change

The first `GameDefinition` preview bridge is implemented.

Current flow:

```txt
prototype UI
  -> /api/mcq/generate
  -> /api/brief/generate
  -> /api/engine/from-brief
  -> GAME_ENGINE preview iframe
```

Implemented pieces:

- `POST /api/engine/from-brief` accepts an accepted Game Brief, selects local asset candidates, generates a validated `GAME_ENGINE` `GameDefinition`, and returns `{ brief, selectedAssets, assetManifest, gameDefinition, meta }`.
- `GAME_ENGINE` supports an optional `entity.model` component for GLB/GLTF visuals through declared top-level `assets`.
- Model visuals are separate from physics. Runtime collisions still use primitive `rigidBody` colliders.
- The prototype tester has a `Generate GameDefinition Preview` button that sends the generated definition to the engine preview iframe.
- `GAME_ENGINE/examples/preview.html` listens for `LOOMIER_PREVIEW_GAME_DEFINITION` over `postMessage`.
- `public/assets/library` is served into the engine dev/build path so imported local assets can load through `/assets/library/...`.

Verified after change:

```bash
npm run engine:verify
npm run backend:check
npm run backend:test
npm run validate:assets
npm run assets:summary
```

Notes:

- `backend:test` and `engine:verify` may require elevated execution in the Codex Windows sandbox because Node/Vite child-process spawning can hit `EPERM`.
- `GAME_ENGINE` dev preview now uses port `5175`; prototype frontend tester defaults to `5173`.
- Cleanup pass on 2026-05-09 moved the vanilla prototype MCQ path off the old `/api/openai` helper and onto `prototype/backend` `/api/mcq/generate`; local generator fallback still remains.
- `.gitignore` now treats local logs, `dist/`, `*.tsbuildinfo`, `output/`, and generated smoke-test HTML as disposable workspace artifacts.
- Temporary internal-test model lock on 2026-05-09: hosted OpenRouter calls are constrained to `qwen/qwen3-coder:free` to avoid paid-model spend during local smoke tests.
- Questions Agent prompt was tuned to Hybrid Minimal on 2026-05-10: 4-6 first-playable questions by default, stricter MCQ text limits, and OpenRouter generation temperature `0.85` with `maxOutputTokens: 3200`.
- Game Brief prompt was tightened on 2026-05-10 so `followUpQuestions` stays aligned with the schema requirement of 3-6 planning questions and Brief fields stay concise enough to avoid avoidable schema repair.

---

## Current Architecture Direction

The platform should move toward:

```txt
Creator input
  -> OpenRouter-first AI clarification
  -> planning-only Game Brief
  -> asset selection/generation
  -> validated GameDefinition
  -> GAME_ENGINE preview
  -> user/AI edits
  -> save/export
```

Do not optimize for:

- one-off HTML blobs
- separate 2D and 3D product lines
- infrastructure before the creation loop works
- huge multi-agent orchestration before a simple pipeline works

---

## Verified Commands

These passed after cleanup:

```bash
cd prototype/backend
npm run check
npm test

cd ../../GAME_ENGINE
npm test

cd ../frontend
npm run build
```

Notes:

- Backend tests pass without an AI key because missing-key behavior is tested.
- Frontend build passes, but that does not mean the React frontend is the preferred UX.

---

## Next Best Work

1. Connect prototype UI to the stateless backend generation service without importing the rejected React UX.
2. Make backend generation produce `GAME_ENGINE` `GameDefinition` as the preferred output.
3. Build an asset manifest path that uses starter packs and can later use Supabase Storage.
4. Add a simple preview bridge from generated `GameDefinition` into `GAME_ENGINE`.
5. Only after that, revisit React or a proper editor UI.

---

## Risks

- The repo still has multiple historical layers: old prototype JSON, generated HTML templates, React experiment, and GAME_ENGINE.
- The wrong move is to merge everything together. The right move is to choose one creative loop and make it coherent.
- Supabase is useful, but not the product. Do not spend weeks on auth/storage before the game creation loop feels strong.

---

## Related

- [[HOME]]
- [[DECISIONS]]
- [[NEXT]]
- [[ARCHITECTURE_UPDATED]]

## Feeds Into

- [[Memory/persistent-memory-architecture]]
- [[knowledge/open-questions]]
