# Gaming Vibe Coding Stateless AI Backend

Express backend for the Gaming Vibe Coding MVP AI layer.

Supabase is planned to own the backend-as-a-service responsibilities: Auth, users, Postgres persistence, Row Level Security, Storage/CDN, Realtime, logs/metrics, and token/account state. This service now stays intentionally stateless and focuses on AI generation, validation, and HTML/game-runtime output.

## Quick Start

```bash
npm install
copy .env.example .env
npm start
```

Local URL: `http://localhost:3000`

## Kept In This Backend

```text
GET  /api/health
POST /api/mcq/generate
POST /api/generate-game
POST /api/edit-game
POST /api/engine/generate
```

`/api/v1/...` is also mounted as a versioned alias.

## Removed For Supabase

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/user/tokens
POST /api/user/tokens/grant
GET  /api/games
POST /api/games
GET  /api/games/:id
PUT  /api/games/:id
DELETE /api/games/:id
GET  /api/games/:id/download
GET  /api/stats
GET  /api/stats/events
```

Those concerns should be implemented with Supabase Auth, Postgres tables with RLS policies, Supabase Storage, and Supabase logs/analytics or database event tables.

## Environment

Copy `.env.example` to `.env` and set one AI provider key:

```text
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
```

or:

```text
AI_PROVIDER=openai
OPENAI_API_KEY=...
```

In production, do not use `CORS_ORIGINS=*`.

## Validation

AI output goes through:

1. JSON response parsing.
2. Loose schema validation.
3. Dimension match validation.
4. Strict 2D/3D game schema validation.
5. Retry loop up to `GENERATION.MAX_RETRIES`.
6. Server-side HTML build.

## Testing

```bash
npm run check
npm test
```
