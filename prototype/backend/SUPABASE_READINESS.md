# Supabase Backend Readiness

Date: 2026-05-03

## What Supabase Replaces

Supabase should own these platform concerns:

- Auth: signup, login, sessions, JWTs, OAuth, magic links, password reset, user identity.
- Authorization: Postgres Row Level Security policies per user and game row.
- Database: Postgres tables for users/profiles, games, prompt history, token balances, token usage, analytics events, and publish state.
- API over data: auto-generated REST/GraphQL APIs from Postgres where RLS is enough.
- Storage: generated assets, thumbnails, exported ZIP files, and downloadable game bundles.
- Realtime: live generation status, dashboard updates, collaborative state later if needed.
- Observability: Supabase logs, database logs, function logs, and optional analytics/event tables.
- Edge Functions: secure server-side actions such as Stripe webhooks, OpenAI calls, token spending, privileged writes, and download bundle assembly.

## What This Backend Still Does

This backend is now intentionally stateless and focused on AI/game generation:

- `GET /api/health`
- `POST /api/mcq/generate`
- `POST /api/generate-game`
- `POST /api/edit-game`
- `POST /api/engine/generate`

It still owns:

- AI prompt orchestration.
- JSON validation and retry logic.
- Local fallback generation for development.
- Template Builder HTML output.
- GAME_ENGINE GameDefinition generation and validation.

## Removed From This Backend

- SQLite database, migrations, and repositories.
- Local users table and handwritten JWT auth.
- Local token spending and token grant endpoints.
- Local games CRUD and ownership checks.
- Local analytics/stats endpoints.
- Admin-only generic AI route.
- Local ZIP download service.

## Supabase Integration Notes

Recommended first Supabase tables:

- `profiles`: one row per `auth.users.id`; subscription tier and display metadata.
- `games`: latest game JSON, compiled HTML, title, genre, publish state, owner id.
- `prompt_history`: prompt, MCQ questions, MCQ answers, model, duration, action type.
- `token_ledger`: immutable token charges/grants/refunds.
- `analytics_events`: product events and generation failures.

Recommended buckets:

- `game-assets`: generated images/audio and public starter assets.
- `game-exports`: downloadable bundles or generated ZIP artifacts.
- `thumbnails`: game dashboard previews.

Security baseline:

- Enable RLS on exposed tables.
- Restrict rows by `auth.uid() = user_id`.
- Keep service role keys only inside Edge Functions or trusted server runtime.
- Use Edge Functions for token spending, model calls, Stripe webhooks, and privileged writes.
