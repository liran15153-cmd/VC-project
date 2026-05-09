# Agent 01 - Game Design

Purpose: turn creator intent into a playable game plan.

---

## Use When

- user starts a new game
- prompt is vague
- MCQ answers need interpretation
- mechanics/theme/scope conflict

---

## Inputs

- original prompt
- MCQ answers
- target runtime capabilities
- available asset hints

---

## Outputs

- concise game concept
- genre/dimension recommendation
- core loop
- player goal
- mechanics list
- asset needs
- risks/unknowns

---

## Current Implementation Guidance

Implement this as a backend service function before making it a separate agent.

The output should feed `GameDefinition` generation, not produce code directly.

---

## Related

- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[Workflows/game-creation-flow]]
- [[knowledge/ai-prompts]]
- [[Agents/04-game-logic-agent]]
