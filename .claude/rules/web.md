---
paths:
  - "apps/web/**"
---

# SolidJS 2 rules

Solid 2 is a release candidate and differs from 1.x. Do NOT use Solid 1.x patterns from memory. If unsure about an API, check the official 2.0 docs / MIGRATION.md and say so instead of guessing.

- Packages: `solid-js` (core, stores) and `@solidjs/web` (render, JSX). `tsconfig` uses `"jsxImportSource": "@solidjs/web"`. There are no `solid-js/web` or `solid-js/store` subpaths in 2.0.
- Build: Vite with `@solidjs/vite-plugin`.
- Components run once. Never destructure props; read reactive values inside JSX or computations.
- Data loading: return a Promise from a computation (e.g. `createMemo(async () => api.getCampaign(id()))`). No fetch-in-effect patterns.
- Wrap every async panel in `<Loading>` (initial readiness) and `<Errored>` (failure). One boundary per independent panel.
- Use `isPending(() => expr)` for "refreshing…" indicators instead of hand-rolled loading flags.
- Writes go through mutations; optimistic updates must roll back on API error.
- Stores use the 2.0 draft-style setters.
- Effects are split-phase in 2.0; keep effects for genuine side effects only (e.g. SSE subscription), never for deriving state.
- API calls only through `src/api/client.ts`, typed with DTOs from `packages/shared`.
- Pin exact versions of every `solid-js` / `@solidjs/*` package.
