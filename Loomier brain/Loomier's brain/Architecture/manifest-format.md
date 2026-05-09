# Manifest Format

The manifest exists so games stay editable.

---

## Rule

Generated games should be data first, code second.

Prefer:

```txt
GameDefinition + AssetManifest
```

over:

```txt
generated HTML/JS blob
```

---

## Manifest Responsibilities

A manifest should describe:

- project metadata
- scenes
- entities
- components
- systems
- assets
- input
- camera
- physics
- UI
- export settings

---

## Edit Behavior

AI edits should patch the manifest and preserve ids where possible.

This enables:

- undo/versioning later
- visual editor integration
- asset replacement
- reliable preview refresh

---

## Source of Truth

Use the actual `GAME_ENGINE` schemas/types as implementation truth. This document is conceptual memory, not a second schema.

---

## Related

- [[ARCHITECTURE_UPDATED]]
- [[knowledge/game-schema]]
- [[docs/runtime]]
- [[docs/adr/ADR-004-manifests]]

## Feeds Into

- [[Agents/04-game-logic-agent]]
- [[Agents/07-qa-testing-agent]]
