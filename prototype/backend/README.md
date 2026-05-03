# Gaming Vibe Coding Backend

Express backend for the Gaming Vibe Coding MVP.

It now includes real authentication, ownership checks, token spending, server-owned AI prompts, MCQ generation, validated game JSON, playable HTML building, ZIP downloads, analytics, and tests.

## Quick Start

```bash
npm install
copy .env.example .env
npm start
```

Local URL: `http://localhost:3000`

## Folder Structure

```text
backend/
  server.js
  scripts/
    check-js.js
  tests/
    backend.test.js
  src/
    app.js
    config/
      constants.js
      env.js
    db/
      analytics.js
      connection.js
      games.js
      migrations.js
      schema.sql
      users.js
    middleware/
      auth.js
      errorHandler.js
      notFoundHandler.js
      rateLimiter.js
      requestLogger.js
      validate.js
    routes/
      auth.js
      games.js
      generation.js
      health.js
      index.js
      mcq.js
      openai.js
      stats.js
      tokens.js
    schemas/
      apiSchemas.js
      commonSchemas.js
      gameSchemas.js
      index.js
    services/
      assetService.js
      authService.js
      downloadService.js
      openaiService.js
      promptService.js
      systemPrompts.js
      templateBuilder.js
      tokenService.js
    utils/
      errors.js
      logger.js
```

## Main API

Auth:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Tokens:

```text
GET  /api/user/tokens
POST /api/user/tokens/grant   admin only
```

AI/game creation:

```text
POST /api/mcq/generate
POST /api/generate-game
POST /api/edit-game
```

Games:

```text
GET    /api/games
POST   /api/games
GET    /api/games/:id
GET    /api/games/:id/assets
PUT    /api/games/:id
DELETE /api/games/:id
GET    /api/games/:id/download
```

Admin:

```text
GET /api/stats
GET /api/stats/events
```

`/api/v1/...` is also mounted as a versioned alias.

## Security Model

- First registered user becomes `admin` by default in development.
- Additional admins can be configured with `ADMIN_EMAILS`.
- Every protected endpoint requires `Authorization: Bearer <token>`.
- Games are scoped to their owner. Admins can access all games.
- `/api/stats` is admin-only.
- Generic `/api/openai` is admin-only and disabled unless `GENERIC_OPENAI_ENABLED=true`.
- Game generation and editing spend tokens before the AI call. Failed generation is not refunded, matching the product spec.
- System prompts are owned by the backend, not accepted from the frontend.

## Environment

Copy `.env.example` to `.env` and set:

```text
OPENAI_API_KEY=...
OPENAI_DEFAULT_MODEL=gpt-5
AUTH_TOKEN_SECRET=long-random-secret-at-least-32-chars
CORS_ORIGINS=http://localhost:5173
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

The test suite covers auth, ownership, admin-only stats, token grants, game saving, asset manifests, server-built HTML, and ZIP download.
