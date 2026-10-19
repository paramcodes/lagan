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
- [x] P0.8 Drizzle config + migrations

## Phase 1 — Auth, roles, profile, shell
- [x] P1.1 Better Auth setup
- [x] P1.2 Role model + guards
- [x] P1.3 Tokens + base styles + dark mode
- [x] P1.4 shadcn Sidebar (collapsed rail)
- [x] P1.5 Profile schema + migration
- [x] P1.6 Auth pages
- [x] P1.7 Profile view/edit
- [x] P1.8 Public author profile
- [x] P1.9 App shell layout (search + category filter)

## Phase 2 — Course authoring
- [x] P2.1 Course/module/lesson schema
- [x] P2.2 TipTap editor + sanitizer
- [x] P2.3 Mux upload + webhook
- [x] P2.4 IndexedDB draft store
- [x] P2.5 @dnd-kit wrappers
- [x] P2.6 Course CRUD actions
- [x] P2.7 Module/lesson CRUD + ordering
- [x] P2.8 Course builder UI (cards/list toggle)
- [x] P2.9 Draft autosave
- [ ] P2.10 Publish + version bump

## Phase 3 — Discovery + purchase + enrollment
- [x] P3.1 Browse + search + category filter
- [ ] P3.2 Course detail
- [x] P3.3 Stripe checkout + webhook
- [x] P3.4 Entitlements/enrollment
- [x] P3.5 View toggle component
- [ ] P3.6 Buy -> enroll flow
- [ ] P3.7 My Learning
- [ ] P3.8 Free course path

## Phase 4 — Player + progress
- [x] P4.1 Mux Player wrapper
- [x] P4.2 lesson_progress schema
- [x] P4.3 Progress tracking hook
- [ ] P4.4 Lesson page + auto-advance
- [x] P4.5 Course progress aggregation

## Phase 5 — Author analytics
- [x] P5.1 course_event schema
- [x] P5.2 Aggregation queries
- [ ] P5.3 Analytics dashboard UI
- [x] P5.4 Chart components

## Phase 6 — Notifications
- [x] P6.1 Notification schema
- [ ] P6.2 SSE route + hook
- [ ] P6.3 New-content detection + notify
- [x] P6.4 Email sending
- [ ] P6.5 Notification center UI

## Phase 7 — Hardening
- [ ] P7.1 Playwright E2E
- [x] P7.2 axe a11y + SR checklist
- [ ] P7.3 Rate limiting + validation audit
- [ ] P7.4 Docs final pass

## Docs track (parallel)
- [x] D0 Docs skeleton + README + contributing + stack ADR index
- [x] D1 Architecture + design-system + data-model
- [x] D2 features/authoring + features/profiles
- [x] D3 features/payments + features/discovery
- [x] D4 features/player-progress
- [x] D5 features/analytics
- [x] D6 features/notifications
- [x] D7 Final pass + diagrams + link check

## Batch queue

Rule: keep >=3 in flight; refill the moment one finishes.

| In flight | Issue | Worktree | Depends on |
|---|---|---|---|
| [ ] | P2.10 Publish + version bump | `/home/param/Work/lagan-wt/p2-10` (`feat/p2-10-publish-version`) | P2.6, P2.8, P2.9 (merged) |
| [ ] | P6.3 New-content detection + notify | `/home/param/Work/lagan-wt/p6-3` (`feat/p6-3-new-content-notify`) | P6.1, P6.4 (merged) |

Merged so far: P0.1-P0.8, P1.1-P1.7, P1.9, P2.1-P2.9, P3.1, P3.3-P3.5, P4.1-P4.3, P4.5, P5.1, P5.2, P5.4, P6.1, P6.4, P7.2, D0-D7.

### Ready (independent, safe to run concurrently)

Each item owns a distinct package or file set, so these can all start now.

- P1.8 Public author profile — profile route only
- P3.2 Course detail — discovery route; P3.1 merged
- P3.6 Buy -> enroll flow — after P3.3, P3.4 merged
- P3.7 My Learning — after P3.4 merged
- P3.8 Free course path — after P3.4 merged
- P4.4 Lesson page + auto-advance — `apps/web`; P4.1, P4.3 merged
- P5.3 Analytics dashboard UI — `apps/web`; P5.2, P5.4 merged
- P6.2 SSE route + hook — `apps/web`; P6.1 merged
- P7.4 Docs final pass — docs only; D0-D7 merged

### Blocked (waiting on a merge)

- P6.5 Notification center UI — after P6.2 (SSE route)
- P7.1 Playwright E2E — after phases 3-6 land
- P7.3 Rate limiting + validation audit — after P2.6, P3.3, P3.4 stop editing API routes
