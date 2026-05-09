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
POST /api/brief/generate
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

Copy `.env.example` to `.env` and configure OpenRouter:

```text
AI_MODE=real
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-5-mini
AI_GENERATION_TIMEOUT_MS=90000
```

`AI_MODE` controls the Questions Agent / Game Brief Agent flow:

```text
mock   = deterministic local simulator for development and tests
real   = OpenRouter-first intelligence layer
hybrid = local/mock for predictable cheap steps, OpenRouter for reasoning-heavy brief work
```

OpenRouter requests are server-side only. Never expose `OPENROUTER_API_KEY` to the frontend.

In production, do not use `CORS_ORIGINS=*`.

## Real AI + Hybrid Flow

Questions and Game Brief generation now use OpenRouter as the primary reasoning layer in `real` mode. MockAI/local fallback is only for local development, automated tests, emergency fallback, token-saving hybrid shortcuts, and simple placeholders.

Hybrid mode saves tokens by:

- using deterministic local questions for very simple prompts with known dimension and genre
- caching repeated JSON requests briefly in memory
- minimizing prompts and trimming oversized context before LLM calls
- retrying invalid JSON once with a repair prompt instead of repeatedly sending the full flow
- keeping Game Brief prompts focused instead of sending whole conversation histories
- using a configurable OpenRouter timeout so slow JSON/repair responses do not fail at the old 30s limit

`POST /api/brief/generate` creates a planning-only Game Brief. It does not generate full game code.

## Validation

AI output goes through:

1. JSON response parsing.
2. One JSON repair retry if parsing fails.
3. Zod schema validation.
4. One schema repair retry if validation fails.
5. Deterministic local fallback only when configured and appropriate.
6. For legacy game generation only: loose/strict game schema validation and server-side HTML build.

## Testing

```bash
npm run check
npm test
```

Useful local modes:

```bash
AI_MODE=mock npm test
AI_MODE=real npm start
AI_MODE=hybrid npm start
```
