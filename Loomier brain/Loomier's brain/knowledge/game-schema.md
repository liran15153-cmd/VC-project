# Game Schema Notes

The project is moving from old prototype game JSON toward `GAME_ENGINE` `GameDefinition`.

---

## Current Problem

There are multiple schema ideas in the repo:

- old prototype JSON for Phaser/Three templates
- backend game schemas
- `GAME_ENGINE` runtime definitions
- Supabase `game_json`

This is dangerous because AI can generate something valid for one layer and useless for another.

---

## Preferred Direction

Use `GameDefinition` as the canonical runtime object.

Storage can still use `game_json`, but the object inside should be runtime-valid.

```txt
Supabase games.game_json
  -> GameDefinition
  -> GAME_ENGINE validation
  -> preview/export
```

---

## Minimum Required Concepts

A useful game definition needs:

- metadata
- scenes
- entities
- components
- systems
- assets
- input
- camera
- physics
- UI

---

## Validation Requirements

Validation should check:

- schema shape
- supported systems/components
- asset references exist
- scene references exist
- entity ids are unique
- physics/rendering fields are compatible
- no unsafe generated script execution

---

## Transition Rule

Old prototype JSON may remain only as a compatibility layer.

New AI work should prefer:

```txt
prompt -> GameDefinition -> GAME_ENGINE
```

---

## Related

- [[HOME]]
- [[Architecture/manifest-format]]
- [[docs/runtime]]
- [[docs/adr/ADR-004-manifests]]
- [[Agents/04-game-logic-agent]]
- [[Agents/07-qa-testing-agent]]

## Feeds Into

- [[NEXT]]
