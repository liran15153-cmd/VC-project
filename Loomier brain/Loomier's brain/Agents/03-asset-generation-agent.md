# Agent 03 - Asset Generation

Purpose: generate missing assets only when existing assets are insufficient.

---

## Use When

- asset discovery reports a real gap
- style requires a new sprite/model/texture
- user explicitly asks for a new asset

---

## Inputs

- asset gap
- style reference
- dimensions
- license/source metadata
- target runtime use

---

## Outputs

- generated asset file
- metadata
- thumbnail if relevant
- manifest entry

---

## Current Implementation Guidance

Do not build this before local asset selection works.

AI-generated assets should enter the same asset manifest system as uploaded/starter assets.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[docs/assets]]
- [[Agents/02-asset-discovery-agent]]
- [[docs/adr/ADR-005-asset-system]]
