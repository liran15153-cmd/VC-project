# Communication Protocol

This is the future protocol direction for AI workflow messages.

Do not implement a complex message bus yet.

---

## Minimum Useful Message

```json
{
  "type": "task.request",
  "gameId": "optional",
  "context": {},
  "input": {},
  "expectedOutput": "schema-name"
}
```

---

## Minimum Useful Result

```json
{
  "type": "task.result",
  "ok": true,
  "data": {},
  "warnings": []
}
```

Failed:

```json
{
  "type": "task.result",
  "ok": false,
  "error": "human-readable reason",
  "retryable": true
}
```

---

## Current Guidance

Keep communication local inside backend services until the flow needs true async orchestration.

The first priority is a working pipeline, not distributed-agent ceremony.

---

## Related

- [[ARCHITECTURE_UPDATED]]
- [[Architecture/agent-hierarchy]]
- [[docs/agents]]
- [[Agents/15-orchestrator]]
