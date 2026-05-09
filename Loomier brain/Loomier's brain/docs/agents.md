# AI Agents and Workflow

Use agents as responsibilities first, not as infrastructure.

---

## Practical Agent Model

Near-term implementation should be one orchestrated pipeline:

```txt
orchestrator
  -> game design
  -> asset planning
  -> game definition generation
  -> validation
  -> preview
```

These can be functions/services before they become independent agents.

---

## Core Responsibilities

| Responsibility | Purpose |
| --- | --- |
| [[Agents/15-orchestrator]] | Owns the flow and state |
| [[Agents/01-game-design-agent]] | Turns prompt + MCQ into a plan |
| [[Agents/02-asset-discovery-agent]] | Finds usable assets before generating |
| [[Agents/03-asset-generation-agent]] | Generates missing assets only after discovery |
| [[Agents/04-game-logic-agent]] | Builds systems/components |
| [[Agents/05-ui-ux-agent]] | Designs game UI and creator workspace improvements |
| [[Agents/06-narrative-agent]] | Adds story when it improves gameplay |
| [[Agents/07-qa-testing-agent]] | Checks schema, references, playability |
| [[Agents/08-export-publishing-agent]] | Packages runtime + assets |
| [[Agents/09-to-14-remaining-agents]] | Future specialists, not near-term services |
| [[Agents/14-world-building-agent]] | Future world and scene specialist |

---

## MCQ Rules

MCQs should:

- be based on the user prompt
- be short
- ask about meaningful design choices
- include at least 4 questions for new games
- avoid generic filler
- allow the user to change/add something

---

## Validation Loop

AI output must pass:

1. JSON parse
2. schema validation
3. reference validation
4. runtime compatibility validation
5. playable preview check where possible

Failed output should produce a corrective retry, not a silent broken game.

---

## Anti-Pattern

Do not build a complex multi-agent platform before the simple pipeline works.

The first useful version can be boring internally and magical externally.

## Related

- [[Agents/15-orchestrator]]
- [[Workflows/game-creation-flow]]
- [[knowledge/ai-prompts]]
- [[knowledge/game-schema]]
- [[Architecture/agent-hierarchy]]
