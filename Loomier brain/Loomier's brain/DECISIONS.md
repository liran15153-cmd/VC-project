# Decisions

This file tracks decisions that should not be reopened casually.

Last updated: 2026-05-09

---

## Locked Decisions

| Decision | Outcome | Notes |
| --- | --- | --- |
| Project memory | `Loomier brain/` is the project memory vault | Root docs were intentionally removed |
| Current UI | `prototype/` is canonical for now | React frontend is not accepted as product UX |
| Runtime | Use unified hybrid runtime | Phaser + Three.js + Rapier through `GAME_ENGINE` |
| Persistence | Use Supabase | Auth, DB, storage, RLS, token ledger, prompt history |
| Backend role | Backend is AI/generation service | Do not rebuild custom auth/db there |
| Assets | Assets are core infrastructure | Not file attachments |
| AI output | Always validate | Treat generated data as untrusted |
| Questions/Game Brief AI | OpenRouter-first | MockAI is fallback/testing/token-saving only |
| Game Brief scope | Planning only | Do not generate full game code in this step |
| GameDefinition preview | `/api/engine/from-brief` is the main bridge | `/api/generate-game` stays compatibility/fallback |
| Runtime model assets | GLB/GLTF via `entity.model.assetKey` | Visual model only; physics remains primitive colliders |
| Branch cleanup | Accidental branch/worktrees removed | Do not restore `.claude` worktrees |

---

## Decisions That Can Change Later

| Topic | Current Default | Revisit When |
| --- | --- | --- |
| React frontend | Not canonical | After core loop works and UX direction is clearer |
| Supabase required locally | Not yet | After GameDefinition preview is stable |
| Visual editor scope | Scene tree + asset browser first | After preview bridge works |
| AI provider | OpenRouter for real hosted AI | If provider quality/cost pushes change |

---

## Decision Standard

A decision should be changed only if:

- the current path blocks the creative core loop
- tests or implementation prove the assumption wrong
- user/product priorities changed clearly
- security risk requires it

---

## Related

- [[HOME]]
- [[STATUS]]
- [[NEXT]]
- [[ARCHITECTURE_UPDATED]]

## Depends On

- [[docs/adr/ADR-001-supabase]]
- [[docs/adr/ADR-002-hybrid-runtime]]
- [[docs/adr/ADR-003-ai-adapters]]
- [[docs/adr/ADR-004-manifests]]
- [[docs/adr/ADR-005-asset-system]]
