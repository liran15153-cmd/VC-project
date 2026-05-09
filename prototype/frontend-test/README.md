# Frontend Test App

Small local tester for the backend AI, auth, token, game, asset, and preview flows.

## Run

From the repository root:

```powershell
npm run prototype:frontend
```

Open:

```text
http://localhost:5173
```

Backend default:

```text
http://localhost:3000/api
```

GAME_ENGINE preview default:

```text
http://localhost:5175/preview.html
```

## What This Tests

- Register, login, logout, and token balance.
- Generate MCQ questions through the backend.
- Generate a planning Game Brief.
- Convert an accepted brief into a `GameDefinition`.
- Send the definition to the GAME_ENGINE preview page.
- Run the legacy HTML generation and edit routes for compatibility checks.
- Inspect JSON, HTML, and selected asset data.
- Download or delete saved games when persistence is available.

## Notes

- The backend is OpenRouter-first. Configure `OPENROUTER_API_KEY` in `prototype/backend/.env`.
- Temporary hosted model default: `openai/gpt-5.1`.
- Use `AI_MODE=real` for real model calls, `AI_MODE=hybrid` for token-saving behavior, or `AI_MODE=mock` for offline tests.
- `AI_FALLBACK_ENABLED=true` is useful for local demos, but keep it off when validating real provider behavior.
- The legacy HTML route is compatibility-only. The main product path is `prompt -> MCQ -> Game Brief -> GameDefinition -> GAME_ENGINE preview`.
