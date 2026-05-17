# Real backend captures

Outputs captured from a live `prototype/backend` running against OpenRouter
(`openai/gpt-5.1`).

## Current status (after AI prompt + normalization fix, 2026-05-13)

**2/3 prompts succeeded** — first time the live pipeline has produced
schema-valid GameDefinitions that pass the preview contract end-to-end.

| Capture | Status | Title | Scenes / Assets / Entities | Notes |
|---|---|---|---|---|
| `live-2d-platformer.json` | ✅ HTTP 200 | "Coin Maze Patrol" | 1 / 10 / 21 | 2 attempts. 10 real assets from `kenney-new-platformer-pack-1-1`. Backend normalizer fired 22× on the first pass (proves the lenient layer is what unlocked it). |
| `live-3d-adventure.json` | ❌ HTTP 502 | — | — | AI still drifts on `behaviors[].trigger` (not yet normalized) and emits non-`text`/`bar` `ui[].type` values. |
| `live-hybrid-runner.json` | ✅ HTTP 200 | "Skyline Forest Run" | 3 / 8 / 12 | 2 attempts. 8 assets, dominant pack `kenney-platformer-kit`. 1 missing asset. |

Both successful captures **reach `preview:loaded`** when replayed through
`test-fixtures/preview-contract-smoke.ts` against the real `PreviewController`,
confirming the parent ↔ iframe contract works on real AI output, not just
synthetic fixtures.

## Historical baseline (pre-fix)

Before the prompt+normalization fix landed, **4/4 prompts failed** with the
same drift patterns (see git history). The new system gets at least 2/3 first-day,
with retries doing the heavy lifting on attempt 2.

## Known remaining drift (3D adventure failure)

The 3D capture failed on patterns the current fix does not cover:

- **`behaviors[].trigger` shape mismatch.** The schema accepts string OR
  `LooseTriggerSchema` (a passthrough object), but the AI sends a shape that
  fails the union check. The plan intentionally left this prompt-only
  (no normalization) so the model would learn the structured form. The prompt
  rule landed, but the 3D agent is still drifting. Candidate next step: add a
  `normalizeTriggerObject` helper that wraps non-conforming strings or
  partial objects into `{ type: <token>, ... }` and emits
  `normalized.triggerShape`.

- **`ui[].type` enum drift.** AI emits values like `"panel"`, `"icon"`,
  `"badge"` outside the accepted `text|bar` set. Two options: filter+drop
  (similar to `normalizeSceneSystems`), or add the new types to the runtime.
  The latter is a feature; the former a guardrail.

## Reproducing

```bash
# Start backend (uses prototype/backend/.env)
cd prototype/backend && npm start

# Capture a real AI generation
node test-fixtures/capture-real-game.mjs <name> <2D|3D|hybrid> <gameType> "<prompt>"

# Pipe through the preview contract
npx tsx test-fixtures/preview-contract-smoke.ts --file=test-fixtures/real-captures/<name>.json
```

If a generation fails, the raw AI response is logged at `engine.raw_ai_output`
in the backend log (added in the capture-only commit) — grep there to see
exactly what shape the model produced before the validator rejected it.

## Files

- `live-2d-platformer.json` — successful 2D capture (replayable in preview).
- `live-hybrid-runner.json` — successful hybrid capture (replayable in preview).
- `last-validation-error.json` — older snapshot of a pre-fix 502 for
  comparison.
