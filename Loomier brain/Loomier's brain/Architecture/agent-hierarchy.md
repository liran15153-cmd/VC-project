# Agent Hierarchy

The long-term system may use many agents, but the near-term system should not.

---

## Recommended Near-Term Hierarchy

```txt
Orchestrator
  -> Game Design
  -> Asset Planning
  -> Game Definition Builder
  -> QA Validator
```

Keep these as services/functions until there is evidence that independent agents are needed.

---

## When To Split An Agent

Split a responsibility into its own agent only when:

- it has a separate context window
- it needs different tools
- it can fail/retry independently
- it materially improves output quality

Do not split for aesthetics.

---

## Human Override

The creator always wins over the agent.

AI should suggest and generate, but the system must preserve user edits and intent.

---

## Related

- [[ARCHITECTURE_UPDATED]]
- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[Architecture/communication-protocol]]
