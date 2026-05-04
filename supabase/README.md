# Supabase Setup

This directory contains the Supabase-owned backend surface for Gaming Vibe Coding:

- `migrations/20260504190000_initial_supabase_backend.sql` creates profiles, games, prompt history, token ledger, analytics events, storage buckets, triggers, and RLS policies.
- `config.toml` is a minimal local Supabase CLI config.

## Apply The Schema

Install the Supabase CLI, link the project, then push the migration:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

For local development:

```bash
supabase start
supabase db reset
```

## Frontend Environment

Create `frontend/.env` from `frontend/.env.example` and set:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

The Express backend remains the stateless AI service for `/api/health`, `/api/mcq/generate`, `/api/generate-game`, `/api/edit-game`, and `/api/engine/generate`.
