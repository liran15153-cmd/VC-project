# Agent 02 - Asset Discovery

Purpose: choose usable assets before generating new ones.

---

## Use When

- generating a game scene
- editing visual style
- exporting/bundling assets
- checking whether requested assets already exist

---

## Inputs

- game plan
- asset manifest/index
- style tags
- runtime constraints

---

## Outputs

- selected assets
- missing assets
- compatibility warnings
- fallback procedural assets if needed

---

## Current Implementation Guidance

Start with local starter packs.

Do not build a full asset marketplace before AI can reliably use the existing starter assets.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[docs/assets]]
- [[Agents/03-asset-generation-agent]]
- [[docs/adr/ADR-005-asset-system]]
