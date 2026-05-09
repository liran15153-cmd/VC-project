# Agent 08 - Export and Publishing

Purpose: package validated games for play outside the editor.

---

## Use When

- user wants to download/share/publish
- game needs asset bundling
- export metadata is required

---

## Inputs

- validated game definition
- asset manifest
- runtime bundle
- export target

---

## Outputs

- web export bundle
- README/metadata
- asset package
- warnings if export target is unsupported

---

## Current Implementation Guidance

Web export comes first.

Mobile/desktop publishing is later and should not distract from the creator loop.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[docs/assets]]
- [[docs/runtime]]
- [[Workflows/game-creation-flow]]
