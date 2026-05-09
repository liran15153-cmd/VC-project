# Agent 04 - Game Logic

Purpose: translate game design into systems, components, rules, and interactions.

---

## Use When

- creating a `GameDefinition`
- editing mechanics
- adding enemies, collectibles, physics, scoring, win/loss conditions

---

## Inputs

- game design plan
- runtime capabilities
- selected assets
- existing game definition for edits

---

## Outputs

- systems/components
- entity behaviors
- input mapping
- physics rules
- validation notes

---

## Current Implementation Guidance

Keep logic declarative where possible.

Generated code should be avoided unless the runtime cannot express the behavior yet.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[knowledge/game-schema]]
- [[Architecture/manifest-format]]
- [[docs/runtime]]
