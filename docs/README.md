# Lagan

A higher-education LMS (learning management system). Monorepo: one Next.js app plus shared packages.

## Structure

- `apps/web` — Next.js 16 App Router application (the only deployable).
- `packages/{config,db,types,ui}` — shared modules; populated as needed.
- `tokens/tokens.json` — DTCG design tokens (source of truth).
- `scripts/gen-tokens.ts` — generates `apps/web/app/tokens.css`.
- `prototype/` — clickable design prototype (static HTML).
- `docs/` — this directory.

## Stack (short)

- Runtime: Bun 1.4.x, Node-compatible.
- Framework: Next.js 16.4.2, React 19.3, App Router, Turbopack.
- Data: PostgreSQL 18, Drizzle ORM 0.45, `pg`.
- Auth: Better Auth 1.7 (local accounts, passkeys; SAML/OIDC later).
- Jobs: pg-boss 12 on Postgres.
- Styling: Tailwind 4 via generated CSS vars from DTCG tokens.
- UI behaviour: Base UI + React Aria Components (unstyled).
- Video: managed HLS service (Mux or Cloudflare Stream) — decision pending (see `stack.md`).
- Storage: S3-compatible (MinIO locally) with versioning.
- Tooling: Biome 2.5, TypeScript 5.9, Vitest 5, Playwright 1.64, lefthook.

## Getting started

```bash
bun install
docker compose up -d           # Postgres 18 + MinIO
# set DATABASE_URL=postgres://lagan:lagan@localhost:5432/lagan
bun run db:migrate             # apply schema migrations
bun run gen:tokens             # regenerate tokens.css
bun run dev                    # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Next.js dev server |
| `bun run build` | Production build |
| `bun run typecheck` | `tsc --noEmit` over `tsconfig.base.json` |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format |
| `bun run gen:tokens` | Regenerate CSS from tokens |
| `bun run check:contrast` | Enforce WCAG 2.2 AA token contrast rules |
| `bun run db:generate` | Generate SQL migrations from schema |
| `bun run db:migrate` | Apply pending SQL migrations to database |
| `bun run test` | Vitest |
| `bun run test:e2e` | Playwright (includes axe WCAG 2.2 AA checks) |
## Local services

`docker-compose.yml` provides Postgres 18 (`lagan`/`lagan`, db `lagan`) and MinIO on 9000/9001.

## Docs

Start here:

- [`architecture.md`](architecture.md) — monorepo layout, request path, routes, guards, planned SSE work.
- [`design-system.md`](design-system.md) — DTCG token pipeline, `@theme`, palette, dark mode, sidebar.
- [`data-model.md`](data-model.md) — every table, column, key, constraint, and what is still missing.

Features:

- [`features/authoring.md`](features/authoring.md) — course authoring pipeline, draft store, TipTap editor, Mux uploads.
- [`features/profiles.md`](features/profiles.md) — learner and author profile edit surface, schema, upsert writes.
- [`features/payments.md`](features/payments.md) — Stripe checkout, webhook signature verification, replay idempotency, enrollments schema.
- [`features/discovery.md`](features/discovery.md) — course catalog, search architecture, category filtering, free vs paid paths.
- [`features/player-progress.md`](features/player-progress.md) — video player wrapper, progress tracking grain, auto-advance, and completion aggregation.
- [`features/analytics.md`](features/analytics.md) — author analytics metrics, course event ingestion, aggregation windowing, and accessible chart visualization.
- [`features/notifications.md`](features/notifications.md) — notification data model, SSE delivery stream, fan-out event dispatch, email integration, and notification center UI.

Reference:
- [`stack.md`](stack.md) — condensed stack decision log.
- [`contributing.md`](contributing.md) — how to contribute.
- [`testing/screen-reader-checklist.md`](testing/screen-reader-checklist.md) — VoiceOver and NVDA manual verification flows.
- [`adr/`](adr/index.md) — architecture decision records (index).
- [`decisions/`](decisions/2026-stack-decisions.md) — full stack decision document.
- `research/` — background research.