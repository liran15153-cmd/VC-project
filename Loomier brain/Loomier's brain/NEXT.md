# Next Actions

This is the practical queue. Keep it short.

Last updated: 2026-05-09

---

## Immediate Priority

Stabilize the new coherent creative loop:

```txt
prototype UI -> Questions Agent -> Game Brief -> GameDefinition -> GAME_ENGINE preview
```

Do this with the new OpenRouter-first backend flow:

- `AI_MODE=real` for real product reasoning.
- `AI_MODE=hybrid` for token-saving local/simple steps plus OpenRouter for Game Brief reasoning.
- `AI_MODE=mock` only for tests/offline development.

---

## Next Tasks

1. Run an end-to-end real-AI smoke test: prompt -> MCQ -> Brief -> `/api/engine/from-brief` -> engine preview.
2. Add the first edit loop: prompt edit -> patch existing `GameDefinition` -> refresh preview.
3. Improve asset candidate ranking so player/coin/platform/hazard assets are selected more intentionally.
4. Add small runtime error surfacing in the prototype UI so preview failures show actionable schema/runtime messages.
5. Keep `/api/generate-game` as compatibility only; do not use it as the main creator path.
6. Remove or archive `prototype/server.js` only after verifying the vanilla prototype no longer needs the old `/api/openai` compatibility server.

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
- assets are referenced through a manifest, even if simple

The remaining milestone gap is now the edit loop:

- at least one edit can update the preview

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
