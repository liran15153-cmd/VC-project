# Next Actions

This is the practical queue. Keep it short.

Last updated: 2026-05-09

---

## Immediate Priority

Build one coherent creative loop:

```txt
prototype UI -> Questions Agent -> Game Brief -> GameDefinition -> GAME_ENGINE preview
```

Do this with the new OpenRouter-first backend flow:

- `AI_MODE=real` for real product reasoning.
- `AI_MODE=hybrid` for token-saving local/simple steps plus OpenRouter for Game Brief reasoning.
- `AI_MODE=mock` only for tests/offline development.

---

## Next 5 Tasks

1. Wire prototype UI to `POST /api/mcq/generate` and `POST /api/brief/generate` before generating a game.
2. Convert accepted Game Briefs into `GAME_ENGINE` `GameDefinition` prompts.
3. Inspect `/api/engine/generate` and `engineGameDefinitionSchema` against `GAME_ENGINE` runtime types.
4. Build or expose a simple `GameDefinition` preview bridge.
5. Add starter asset manifest metadata for the existing sample packs.

---

## Do Not Do Next

- Do not rebuild the React frontend yet.
- Do not build a full marketplace.
- Do not build 15 independent agents.
- Do not spend time on production billing.
- Do not add complex versioning before edit/preview works.
- Do not make MockAI the primary product intelligence layer again.
- Do not let the Game Brief Agent generate full game code.

---

## Acceptance For Next Milestone

The next milestone is met when:

- a user prompt generates focused questions through the backend
- answers produce a validated planning-only Game Brief
- the accepted Game Brief generates a valid `GameDefinition`
- the definition runs in `GAME_ENGINE`
- the user can see/play a preview
- at least one edit can update the preview
- assets are referenced through a manifest, even if simple

---

## Related

- [[HOME]]
- [[STATUS]]
- [[DECISIONS]]
- [[Workflows/game-creation-flow]]

## Depends On

- [[docs/runtime]]
- [[docs/assets]]
- [[knowledge/open-questions]]
- [[knowledge/game-schema]]
