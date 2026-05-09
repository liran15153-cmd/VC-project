# Architecture Overview

Use [[ARCHITECTURE_UPDATED]] as the main architecture map.

This file gives the compact Obsidian view.

---

## Layers

```txt
Creator UI
AI generation service
Schema validation
Asset resolver
GAME_ENGINE runtime
Supabase persistence/storage/auth
```

---

## Core Data Object

The desired central object is `GameDefinition`.

Everything should gradually orbit around it:

- AI generation
- validation
- preview
- save/load
- asset manifests
- export

---

## Current Architecture Debt

The repo still contains:

- old vanilla prototype
- old generated HTML templates
- React frontend experiment
- backend stateless AI service
- GAME_ENGINE runtime
- Supabase schema

Do not merge these blindly. Pull value from each layer into one clean creation loop.

---

## Related

- [[ARCHITECTURE_UPDATED]]
- [[docs/runtime]]
- [[docs/assets]]
- [[docs/agents]]
- [[docs/security]]
