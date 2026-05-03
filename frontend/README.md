# Gaming Vibe Coding — Frontend

Production-grade React + TypeScript SaaS frontend for the AI Game Builder platform.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to the backend
on `http://localhost:3000`. Make sure the backend is running:

```bash
npm run backend:dev   # from repo root
```

## Configuration

The API base URL is resolved in this order:

1. `localStorage` key `gvc.apiBase` (set via the in-app status panel).
2. `VITE_API_BASE` environment variable.
3. Default `/api` (uses the Vite dev proxy).

Copy `.env.example` to `.env` to override defaults.

## Features

- Email/password auth with persistent JWT in `localStorage`.
- Token balance + health badge (backend / OpenAI status) in the topbar.
- Game builder: prompt → MCQ → generate → playable preview → iterative edit.
- My Games: list, open, edit, download as ZIP, delete.
- Admin Stats (visible only to admins).
- Orange/white SaaS theme. Responsive desktop + mobile.
- All API calls flow through `src/api/client.ts` — no API keys ever live in the
  frontend.

## Project structure

```
src/
  api/          API client + endpoint helpers
  components/   Layout, navigation, badges, guards
  features/
    auth/         Login + register, AuthContext
    dashboard/    Dashboard landing
    game-builder/ Prompt → MCQ → generate flow
    game-preview/ Iframe sandbox renderer
    games/        List + detail + edit + download
    health/       Backend/OpenAI status
    stats/        Admin analytics
  styles/       Global CSS
  types/        API contract types
  App.tsx
  main.tsx
```

## Build

```bash
npm run typecheck
npm run build
```

Output goes to `dist/`.
