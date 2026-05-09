# Open Questions

This file tracks unresolved product and architecture decisions.

---

## Active Questions

### Q1 - Canonical game data shape

Should all new generation target `GAME_ENGINE` `GameDefinition` immediately, or should old prototype game JSON remain supported for a short transition?

Recommendation: target `GameDefinition` for new work; keep old JSON only as fallback.

### Q2 - Prototype UI bridge

Should the vanilla prototype call `/api/engine/generate` directly, or should it keep using old `/api/generate-game` until preview is bridged?

Recommendation: build a small bridge, not a rewrite.

### Q3 - Asset metadata minimum

What is the smallest asset metadata shape needed before AI can select starter-pack assets?

Recommendation: id, path, type, tags, style, dimensions, license/source.

### Q4 - Supabase timing

When should Supabase become required for the local prototype?

Recommendation: after the core generation-preview loop works with `GameDefinition`.

### Q5 - Visual editor scope

What is the first visual editing surface?

Recommendation: scene tree + asset browser + selected object properties. Avoid full drag-and-drop editor initially.

---

## Closed Decisions

| Decision | Outcome |
| --- | --- |
| Runtime direction | Unified Phaser + Three + Rapier through `GAME_ENGINE` |
| Persistence direction | Supabase for auth/db/storage/RLS |
| Frontend direction | Prototype UI remains canonical for now |
| React frontend branch | Not merged as product UX |
| Root docs | Replaced by this vault as memory source |
| `.claude` cleanup | Deleted as requested |

---

## Related

- [[HOME]]
- [[STATUS]]
- [[NEXT]]
- [[DECISIONS]]
- [[docs/security]]
