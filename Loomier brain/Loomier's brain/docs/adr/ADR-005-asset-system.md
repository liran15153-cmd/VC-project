# ADR-005: Treat Assets as Core Infrastructure

Status: Accepted

---

## Context

Games need sprites, textures, models, audio, UI images, animations, and metadata. AI cannot reliably build good games if assets are invisible or unmanaged.

---

## Decision

Build assets as first-class platform objects, not attachments.

Assets should be searchable, tagged, owned, licensed, referenced in manifests, and usable by AI.

---

## Consequences

Good:

- better visual consistency
- reusable starter packs
- AI can select instead of hallucinate
- export can bundle correctly

Tradeoffs:

- metadata work is required
- upload validation matters
- storage paths and ownership need discipline

---

## Current Implementation

Starter packs exist in `public/assets/starter-packs/` and `GAME_ENGINE/examples/assets/`.

Full asset indexing is not built yet.

---

## Related

- [[DECISIONS]]
- [[docs/assets]]
- [[Agents/02-asset-discovery-agent]]
- [[Agents/03-asset-generation-agent]]
