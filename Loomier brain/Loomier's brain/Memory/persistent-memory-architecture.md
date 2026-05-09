# Persistent Memory Architecture

This vault is the current persistent memory.

---

## Memory Layers

| Layer | Purpose | Where |
| --- | --- | --- |
| Project truth | Current status and decisions | [[STATUS]] |
| Operating rules | How Codex should work | [[CLAUDE]] |
| Architecture | System direction | [[ARCHITECTURE_UPDATED]] |
| Decisions | ADR files | [[docs/adr/ADR-001-supabase]] |
| Open loops | Unresolved questions | [[knowledge/open-questions]] |

---

## Update Rule

After meaningful project changes:

1. Update `STATUS.md`.
2. Update or add ADR if a real architecture decision changed.
3. Update open questions if a question was answered.
4. Avoid duplicating long explanations.

---

## What Not To Store

Do not store:

- raw logs
- generated build output
- huge speculative agent docs
- secrets
- temporary branch cleanup notes after they are no longer useful

---

## Related

- [[HOME]]
- [[STATUS]]
- [[DECISIONS]]
- [[NEXT]]
- [[CLAUDE]]
