# Loomier Brain

This vault is the working memory for the LOOMIER / Gaming Vibe Coding project.

It is not a marketing folder and not a dumping ground. It should answer three questions quickly:

1. What are we building?
2. What is true right now?
3. What should we do next?

Last updated: 2026-05-08

---

## Start Here

| Need | Open |
| --- | --- |
| Current state | [[STATUS]] |
| How Codex should work | [[CLAUDE]] |
| Product philosophy | [[AGENTS]] |
| Architecture map | [[ARCHITECTURE_UPDATED]] |
| Locked decisions | [[DECISIONS]] |
| Next actions | [[NEXT]] |
| Runtime direction | [[docs/runtime]] |
| Asset system | [[docs/assets]] |
| AI workflow | [[docs/agents]] |
| Security rules | [[docs/security]] |
| Open decisions | [[knowledge/open-questions]] |

---

## Brain Hubs

| Cluster | Hub | Key Notes |
| --- | --- | --- |
| Product | [[docs/vision]] | [[Vision/platform-vision]], [[README_READY]], [[knowledge/competitors]] |
| Architecture | [[ARCHITECTURE_UPDATED]] | [[Architecture/overview]], [[Architecture/manifest-format]], [[Architecture/agent-hierarchy]], [[Architecture/communication-protocol]] |
| Runtime | [[docs/runtime]] | [[Systems/hybrid-runtime]], [[knowledge/game-schema]], [[docs/adr/ADR-002-hybrid-runtime]] |
| Assets | [[docs/assets]] | [[Agents/02-asset-discovery-agent]], [[Agents/03-asset-generation-agent]], [[docs/adr/ADR-005-asset-system]] |
| Agents | [[docs/agents]] | [[Agents/15-orchestrator]], [[Agents/01-game-design-agent]], [[Agents/07-qa-testing-agent]] |
| Security | [[docs/security]] | [[docs/adr/ADR-001-supabase]], [[knowledge/open-questions]] |
| Memory | [[Memory/persistent-memory-architecture]] | [[STATUS]], [[DECISIONS]], [[NEXT]] |
| Workflow | [[Workflows/game-creation-flow]] | [[NEXT]], [[knowledge/ai-prompts]], [[knowledge/agent-autonomy-lessons]], [[knowledge/game-schema]] |

---

## Product In One Paragraph

LOOMIER is an AI-assisted game creation platform. The goal is not to generate disposable HTML games from prompts. The goal is to help a creator move from idea to editable playable game through chat, clarifying questions, reusable assets, structured game manifests, a hybrid runtime, live preview, and iterative edits.

The product should feel creator-first, fast, experimental, and AI-native.

---

## Current Truth

- Canonical creator UI for now: `prototype/index.html` and the vanilla prototype files.
- React frontend exists but is not the current product surface. It was reverted to the older baseline because the newer version was not good enough.
- Backend prototype is now best treated as an AI generation service, not as the long-term source of user/game truth.
- Supabase is the intended home for auth, database, storage, RLS, games, prompt history, token ledger, and assets.
- `GAME_ENGINE` is the strategic runtime direction: a unified Phaser + Three.js + Rapier runtime, not separate 2D/3D products.
- Assets are core infrastructure, not attachments.
- AI output is untrusted until schema-validated.

---

## Active Focus

1. Make the creative core loop excellent:
   - prompt
   - MCQ clarification
   - validated game definition
   - playable preview
   - edit via chat
   - save/export

2. Move from old game JSON / generated HTML toward editable `GameDefinition` objects used by `GAME_ENGINE`.

3. Keep Supabase as infrastructure, but do not let infrastructure work outrun the creative experience.

See [[NEXT]] for the current implementation queue.

---

## Repo Map

| Path | Role | Current Guidance |
| --- | --- | --- |
| `prototype/` | Current usable prototype UI | Preserve as the current creative surface |
| `prototype/backend/` | AI generation service | Keep routes thin, logic in services |
| `GAME_ENGINE/` | Long-term hybrid runtime | Invest here carefully |
| `supabase/` | DB/auth/storage/RLS schema | Keep, review before production |
| `public/assets/starter-packs/` | Starter asset infrastructure | Keep and expand intentionally |
| `frontend/` | React app experiment | Do not treat as canonical yet |
| `Loomier brain/` | Project memory | Keep updated after major decisions |

---

## Operating Rule

When in doubt, choose the path that makes the next playable, editable game easier to create.

Avoid infrastructure fantasy. The product wins when a creator can make something playable quickly and then shape it.

## Related

- [[STATUS]]
- [[DECISIONS]]
- [[NEXT]]
- [[ARCHITECTURE_UPDATED]]
