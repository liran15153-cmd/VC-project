# ADR-003: Use AI Provider Adapters

Status: Accepted

---

## Context

The project has used or considered Gemini, OpenAI, OpenRouter, Claude, and local fallback behavior.

Locking product logic to one provider would make the system brittle.

---

## Decision

Keep AI provider calls behind backend services/adapters.

Routes and frontend code should not know provider-specific details beyond model selection where appropriate.

---

## Consequences

Good:

- provider flexibility
- easier fallback
- easier testing
- less frontend leakage

Tradeoffs:

- adapter layer adds some complexity
- model-specific capabilities still need careful handling

---

## Current Implementation

`prototype/backend/src/services/openaiService.js` now treats OpenRouter as the only real hosted AI provider for the Questions Agent / Game Brief flow.

Current mode switch:

- `AI_MODE=real`: OpenRouter is primary. Local MockAI is only fallback when allowed.
- `AI_MODE=mock`: deterministic local simulator for development and automated tests.
- `AI_MODE=hybrid`: deterministic local helpers for simple predictable steps, OpenRouter for reasoning-heavy planning.

Required real-AI env:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

MockAI is not the product intelligence layer. It is a cheap simulator/fallback/testing utility. The Game Brief route (`POST /api/brief/generate`) is planning-only and must not generate full game code.

Token controls added:

- prompt minimization and oversized-context compression before LLM calls
- reusable server-owned prompts
- brief in-memory response caching for duplicate JSON requests
- one JSON repair retry, then Zod validation and one schema repair retry
- hybrid mode avoids OpenRouter for trivial question generation when dimension and genre are already known

The name should eventually become provider-neutral if more providers are added.

---

## Related

- [[DECISIONS]]
- [[knowledge/ai-prompts]]
- [[docs/agents]]
- [[CLAUDE]]
