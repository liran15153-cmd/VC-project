# ADR-002: Use a Unified Hybrid Runtime

Status: Accepted

---

## Context

The platform needs to support 2D and 3D games without making creators choose between unrelated products.

---

## Decision

Treat Phaser, Three.js, and Rapier as implementation parts of one runtime:

```txt
GameDefinition -> GAME_ENGINE -> renderer/physics/systems
```

---

## Consequences

Good:

- one creator mental model
- one AI output target
- shared systems/assets
- better editing/export path

Tradeoffs:

- runtime design must stay disciplined
- schema needs to support both 2D and 3D cleanly
- early implementation may be slower than one-off templates

---

## Current Implementation

`GAME_ENGINE/` is the strategic runtime foundation and has passing tests.

---

## Related

- [[DECISIONS]]
- [[docs/runtime]]
- [[Systems/hybrid-runtime]]
- [[ARCHITECTURE_UPDATED]]
