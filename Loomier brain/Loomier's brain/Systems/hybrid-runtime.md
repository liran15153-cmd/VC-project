# Hybrid Runtime System

See also [[docs/runtime]].

---

## Intent

The runtime should let creators make 2D and 3D games through one coherent model.

```txt
GameDefinition
  -> shared systems
  -> Phaser renderer for 2D
  -> Three renderer for 3D
  -> Rapier physics where needed
```

---

## Why This Matters

If 2D and 3D become separate products, the platform becomes harder to learn, harder to generate for, and harder to edit.

One data model creates:

- consistent AI output
- reusable systems
- shared asset logic
- easier save/load
- better export path

---

## Current Work

Invest in `GAME_ENGINE` tests and schema stability before building a large visual editor.

---

## Related

- [[docs/runtime]]
- [[ARCHITECTURE_UPDATED]]
- [[docs/adr/ADR-002-hybrid-runtime]]
- [[knowledge/game-schema]]
