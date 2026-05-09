# Agent 15 - Orchestrator

Purpose: own the creation flow.

---

## Near-Term Role

The orchestrator should be a backend service, not an autonomous agent swarm.

It coordinates:

```txt
prompt
  -> MCQ
  -> game plan
  -> asset plan
  -> GameDefinition
  -> validation
  -> preview response
```

---

## Responsibilities

- choose the next step
- keep creation state coherent
- call AI provider adapters
- call validators
- decide whether to retry/fallback
- return useful errors

---

## Anti-Pattern

Do not create a complex multi-agent runtime before a single orchestrated pipeline works.

The orchestrator can become smarter later. First it must make the core loop reliable.

---

## Related

- [[docs/agents]]
- [[Workflows/game-creation-flow]]
- [[NEXT]]
- [[knowledge/game-schema]]
- [[Agents/01-game-design-agent]]
- [[Agents/02-asset-discovery-agent]]
- [[Agents/04-game-logic-agent]]
- [[Agents/07-qa-testing-agent]]
