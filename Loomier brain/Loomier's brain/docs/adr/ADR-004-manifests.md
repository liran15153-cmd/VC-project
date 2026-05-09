# ADR-004: Prefer Manifests Over Generated HTML Blobs

Status: Accepted

---

## Context

The early prototype generated playable HTML/JS. That is useful for demos but weak for editing, validation, assets, and long-term projects.

---

## Decision

New generation should move toward structured `GameDefinition` / manifest output.

Generated HTML can remain as fallback/export output, not as the primary project format.

---

## Consequences

Good:

- editable games
- visual editor support
- better validation
- better asset references
- future versioning

Tradeoffs:

- requires runtime investment
- generation prompts must be stricter
- preview bridge is needed

---

## Current Implementation

`prototype/backend` still has legacy generation paths and an `/api/engine/generate` path.

The engine path should become preferred.

---

## Related

- [[DECISIONS]]
- [[knowledge/game-schema]]
- [[Architecture/manifest-format]]
- [[docs/runtime]]
