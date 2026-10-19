# LMS MVP — todo tracker

Mark [x] when merged to main. One worktree per item.

## Phase 0 — Scaffold
- [x] P0.1 Init monorepo + bun workspaces
- [x] P0.2 Next.js app scaffold
- [x] P0.3 Shared packages
- [x] P0.4 Biome + lefthook + size-guard
- [x] P0.5 Vitest + Playwright + CI
- [x] P0.6 Docker Compose (Postgres, MinIO)
- [x] P0.7 DTCG tokens + generator
- [ ] P0.8 Drizzle config + migrations

## Phase 1 — Auth, roles, profile, shell
- [x] P1.1 Better Auth setup
- [x] P1.2 Role model + guards
- [x] P1.3 Tokens + base styles + dark mode
- [x] P1.4 shadcn Sidebar (collapsed rail)
- [x] P1.5 Profile schema + migration
- [x] P1.6 Auth pages
- [x] P1.7 Profile view/edit
- [ ] P1.8 Public author profile
- [x] P1.9 App shell layout (search + category filter)

## Phase 2 — Course authoring
- [x] P2.1 Course/module/lesson schema
- [x] P2.2 TipTap editor + sanitizer
- [x] P2.3 Mux upload + webhook
- [x] P2.4 IndexedDB draft store
- [x] P2.5 @dnd-kit wrappers
- [x] P2.6 Course CRUD actions
- [ ] P2.7 Module/lesson CRUD + ordering
- [ ] P2.8 Course builder UI (cards/list toggle)
- [ ] P2.9 Draft autosave
- [ ] P2.10 Publish + version bump

## Phase 3 — Discovery + purchase + enrollment
- [ ] P3.1 Browse + search + category filter
- [ ] P3.2 Course detail
- [x] P3.3 Stripe checkout + webhook
- [ ] P3.4 Entitlements/enrollment
- [ ] P3.5 View toggle component
- [ ] P3.6 Buy -> enroll flow
- [ ] P3.7 My Learning
- [ ] P3.8 Free course path

## Phase 4 — Player + progress
- [x] P4.1 Mux Player wrapper
- [ ] P4.2 lesson_progress schema
- [ ] P4.3 Progress tracking hook
- [ ] P4.4 Lesson page + auto-advance
- [ ] P4.5 Course progress aggregation

## Phase 5 — Author analytics
- [x] P5.1 course_event schema
- [ ] P5.2 Aggregation queries
- [ ] P5.3 Analytics dashboard UI
- [ ] P5.4 Chart components

## Phase 6 — Notifications
- [ ] P6.1 Notification schema
- [ ] P6.2 SSE route + hook
- [ ] P6.3 New-content detection + notify
- [ ] P6.4 Email sending
- [ ] P6.5 Notification center UI

## Phase 7 — Hardening
- [ ] P7.1 Playwright E2E
- [ ] P7.2 axe a11y + SR checklist
- [ ] P7.3 Rate limiting + validation audit
- [ ] P7.4 Docs final pass

## Docs track (parallel)
- [x] D0 Docs skeleton + README + contributing + stack ADR index
- [x] D1 Architecture + design-system + data-model
- [x] D2 features/authoring + features/profiles
- [ ] D3 features/payments + features/discovery
- [ ] D4 features/player-progress
- [ ] D5 features/analytics
- [ ] D6 features/notifications
- [ ] D7 Final pass + diagrams + link check

## Batch queue

Rule: keep >=3 in flight; refill the moment one finishes.

| In flight | Issue | Worktree | Depends on |
|---|---|---|---|
| [ ] | P0.8 Drizzle config + migrations | `/home/param/Work/lagan-wt/p0-8` (`feat/p0-8-migrations`) | P0.6 (merged) |
| [ ] | P2.7 Module/lesson CRUD + ordering | `/home/param/Work/lagan-wt/p2-7` (`feat/p2-7-module-lesson-crud`) | P2.1, P2.6 (merged) |
| [ ] | P3.1 Browse + search + category filter | `/home/param/Work/lagan-wt/p3-1` (`feat/p3-1-browse`) | P1.9, P2.1 (merged) |

Merged so far: P0.1-P0.7, P1.1-P1.7, P1.9, P2.1-P2.6, P3.3, P4.1, P5.1, D0-D2.

### Ready (independent, safe to run concurrently)

Each item owns a distinct package or file set, so these can all start now.

- P1.8 Public author profile — profile route only
- P2.8 Course builder UI (cards/list toggle) — `apps/web`; P2.5 and P2.6 merged
- P2.9 Draft autosave — `packages/ui` / `apps/web`; P2.4 and P2.6 merged
- P3.2 Course detail — discovery route; coordinate with P3.1 on the shared route folder
- P3.4 Entitlements/enrollment — `packages/db` + server action / route; P3.3 merged
- P3.5 View toggle component — `packages/ui` only
- P4.2 lesson_progress schema — new schema file; P2.1 merged
- P5.2 Aggregation queries — `packages/db`; P5.1 merged
- P5.4 Chart components — `packages/ui` only
- P6.1 Notification schema — new schema file
- P6.4 Email sending — `packages/email` (new), no UI
- P7.2 axe a11y + SR checklist — test config + static audit

### Blocked (waiting on a merge)

- P2.10 Publish + version bump — after P2.6, P2.8, P2.9
- P3.6 Buy -> enroll flow — after P3.3 (merged) and P3.4
- P3.7 My Learning — after P3.4 (entitlements)
- P3.8 Free course path — after P3.4 (entitlements)
- P4.3 Progress tracking hook — after P4.2 (lesson_progress schema)
- P4.4 Lesson page + auto-advance — after P4.1 (merged) and P4.3 (progress hook)
- P4.5 Course progress aggregation — after P4.2 (lesson_progress schema)
- P5.3 Analytics dashboard UI — after P5.2 (aggregation queries)
- P6.2 SSE route + hook — after P6.1 (notification schema)
- P6.3 New-content detection + notify — after P6.1 (notification schema)
- P6.5 Notification center UI — after P6.2 (SSE route)
- P7.1 Playwright E2E — after phases 3-6 land
- P7.3 Rate limiting + validation audit — after P2.6, P3.3, P3.4 stop editing API routes
- P7.4 Docs final pass — after D1-D6
- D3 features/payments + features/discovery — after P3.3 (merged) and P3.4
- D4 features/player-progress — after P4.1 (merged), P4.2 and P4.4
- D5 features/analytics — after P5.1 (merged) and P5.2
- D6 features/notifications — after P6.1
- D7 Final pass + diagrams + link check — after D1-D6