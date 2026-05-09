# Architecture Overview

This is the current architecture map for LOOMIER.

---

## Current System Shape

```txt
prototype UI
  -> prototype/backend AI generation service
  -> GAME_ENGINE GameDefinition validation/runtime
  -> Supabase persistence/storage/auth (planned integration)
```

The system is not fully unified yet. The repo contains historical layers. Do not blindly merge them.

---

## Target Architecture

```txt
Creator UI
  -> API gateway / backend routes
  -> creation services
  -> AI provider adapter
  -> schema validation
  -> asset resolver
  -> GameDefinition builder
  -> GAME_ENGINE preview
  -> Supabase save/export
```

---

## Containers

| Container | Role | Status |
| --- | --- | --- |
| `prototype/` | Current usable UI | Keep as canonical for now |
| `prototype/backend/` | AI generation API | Working, stateless direction |
| `GAME_ENGINE/` | Hybrid game runtime | Strategic core |
| `supabase/` | DB/auth/storage schema | Foundation present |
| `frontend/` | React experiment | Not product source yet |
| `public/assets/` | Starter assets | Keep and expand |

---

## Architecture Map

- Runtime: [[docs/runtime]], [[Systems/hybrid-runtime]], [[docs/adr/ADR-002-hybrid-runtime]]
- Manifests and schemas: [[Architecture/manifest-format]], [[knowledge/game-schema]], [[docs/adr/ADR-004-manifests]]
- Agents and workflow: [[docs/agents]], [[Architecture/agent-hierarchy]], [[Architecture/communication-protocol]], [[Workflows/game-creation-flow]]
- Assets: [[docs/assets]], [[docs/adr/ADR-005-asset-system]]
- Persistence and security: [[docs/security]], [[docs/adr/ADR-001-supabase]]
- AI providers: [[knowledge/ai-prompts]], [[docs/adr/ADR-003-ai-adapters]]

---

## Data Flow

### Create Game

```txt
prompt
  -> MCQ questions
  -> answers
  -> game plan
  -> GameDefinition
  -> Zod validation
  -> preview
  -> save
```

### Edit Game

```txt
existing GameDefinition
  -> user edit prompt
  -> constrained patch
  -> validation
  -> preview refresh
  -> save new state/version
```

---

## Core Architecture Decisions

- Supabase handles auth, database, storage, and RLS.
- Backend owns AI provider calls and validation.
- Frontend should not contain provider secrets or prompt orchestration logic.
- GAME_ENGINE owns runtime execution.
- Game output should move toward `GameDefinition`, not raw HTML blobs.
- Assets must be referenced through manifests.

---

## Near-Term Architecture Work

1. Make backend generation prefer `GameDefinition`.
2. Build a preview bridge from `GameDefinition` to `GAME_ENGINE`.
3. Add asset manifest awareness to generation.
4. Use Supabase for persistence after the local core loop is coherent.

---

## Non-Goals Right Now

- Full multiplayer.
- Marketplace.
- Mobile export.
- 15 live agents.
- Complex version history.
- Production billing.

These may matter later. They are not the next bottleneck.

## Related

- [[HOME]]
- [[STATUS]]
- [[DECISIONS]]
- [[NEXT]]
