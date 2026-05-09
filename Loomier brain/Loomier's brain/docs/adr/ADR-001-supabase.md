# ADR-001: Use Supabase for Auth, Database, and Storage

Status: Accepted

---

## Context

The project needs user accounts, saved games, prompt history, asset storage, RLS, and eventually publishing/export storage.

SQLite was useful for early backend prototyping, but it is not the right production ownership model.

---

## Decision

Use Supabase for:

- auth
- profiles
- games
- prompt history
- token ledger
- analytics events
- asset/export storage
- row level security

The backend should not become a custom auth/database platform.

---

## Consequences

Good:

- faster production path
- built-in auth/storage/RLS
- simpler ownership model

Tradeoffs:

- RLS must be reviewed carefully
- frontend can only use publishable keys
- service-role operations must stay backend-only

---

## Current Implementation

The repo has a Supabase migration under `supabase/migrations/`.

It is a foundation, not a final production security review.

---

## Related

- [[DECISIONS]]
- [[STATUS]]
- [[docs/security]]
- [[ARCHITECTURE_UPDATED]]
