# Runtime

The runtime direction is a unified hybrid runtime built around `GAME_ENGINE`.

---

## Core Rule

Do not split the product into "2D engine" and "3D engine."

Use one runtime concept:

```txt
GameDefinition
  -> systems
  -> renderers
  -> physics
  -> input
  -> preview/export
```

Phaser, Three.js, and Rapier are implementation parts, not separate products.

---

## Current Repo Truth

`GAME_ENGINE/` already contains:

- runtime schema/types
- world/scene/state primitives
- input systems
- Phaser renderer
- Three renderer
- Rapier physics foundation
- tests

This is the strategic runtime foundation.

---

## Runtime Responsibilities

The runtime should:

- load a validated `GameDefinition`
- resolve assets through manifests
- run scenes and systems
- support preview
- support export
- keep generated games editable

It should not:

- accept unvalidated AI JSON
- hardcode game-specific logic into the engine
- require separate product flows for 2D and 3D

---

## Near-Term Runtime Work

1. Make backend `/api/engine/generate` the preferred generation path.
2. Create a bridge from prototype UI to `GameDefinition` preview.
3. Add starter asset support to runtime manifests.
4. Keep old HTML template generation only as fallback/demo behavior.

---

## Related

- [[HOME]]
- [[ARCHITECTURE_UPDATED]]
- [[Systems/hybrid-runtime]]
- [[knowledge/game-schema]]
- [[docs/adr/ADR-002-hybrid-runtime]]

## Feeds Into

- [[NEXT]]
- [[Agents/04-game-logic-agent]]
