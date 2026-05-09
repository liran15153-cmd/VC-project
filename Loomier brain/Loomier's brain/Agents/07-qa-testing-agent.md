# Agent 07 - QA Testing

Purpose: catch broken generated games before users see them.

---

## Use When

- after AI generation
- after AI edit patches
- before export

---

## Checks

- JSON/schema validity
- missing asset references
- duplicate ids
- impossible mechanics
- runtime compatibility
- basic playability
- export safety

---

## Current Implementation Guidance

Prefer automated validation first.

Use AI-assisted QA only for fuzzy design/playability judgments.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[knowledge/game-schema]]
- [[docs/security]]
- [[Architecture/manifest-format]]
