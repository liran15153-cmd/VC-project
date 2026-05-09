# AGENTS.md - Platform Philosophy

This file defines how the project should think.

---

## Core Belief

LOOMIER should reduce the distance between an idea and a playable, editable game.

The creator should feel like they are collaborating with a fast game-making partner, not filling out forms or waiting for a black-box generator.

---

## Product Principles

1. Creator-first.
2. Fast feedback.
3. Editable output.
4. Assets are reusable infrastructure.
5. AI proposes; the system validates.
6. Runtime data should be understandable.
7. Human edits and AI edits should coexist.
8. Avoid infrastructure fantasy.

---

## What The Platform Is Not

LOOMIER is not:

- a prompt-to-video toy
- a random HTML game generator
- a marketplace before it is a creation tool
- a clone of Base44, Rosebud, Astrocade, or Lovable
- two unrelated products for 2D and 3D

---

## AI Agents

Agents are a design tool, not a reason to overbuild.

In the near term, implement agents as service responsibilities:

- Orchestrator: controls the creation flow.
- Game design: turns intent into a plan.
- Asset selection: chooses existing assets before generating new ones.
- Game logic: creates systems/components.
- QA: validates schema/playability.

Do not build a 15-agent distributed system before the simple creation loop works.

---

## Current Practical Agent Model

```txt
User prompt
  -> Orchestrator service
  -> MCQ / clarification
  -> Game plan
  -> Asset plan
  -> GameDefinition
  -> Validation
  -> Preview
```

This can later evolve into specialized agents, but the first implementation should be simple and inspectable.

---

## Criticism Standard

When working on this project, be honest:

- If something is premature, say so.
- If something is overengineered, simplify it.
- If something breaks the creative flow, push back.
- If something creates security risk, stop and fix the boundary.

The project improves through clear criticism, not automatic agreement.

---

## Related

- [[HOME]]
- [[CLAUDE]]
- [[docs/vision]]
- [[docs/agents]]

## Feeds Into

- [[DECISIONS]]
- [[NEXT]]
