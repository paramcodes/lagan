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
- [ ] P1.8 Public author profile
- [x] P1.9 App shell layout (search + category filter)

## Phase 2 — Course authoring
- [x] P2.1 Course/module/lesson schema
- [x] P2.2 TipTap editor + sanitizer
- [x] P2.3 Mux upload + webhook
- [x] P2.4 IndexedDB draft store
- [x] P2.5 @dnd-kit wrappers
- [x] P2.6 Course CRUD actions
- [x] P2.7 Module/lesson CRUD + ordering
- [ ] P2.8 Course builder UI (cards/list toggle)
- [ ] P2.9 Draft autosave
- [ ] P2.10 Publish + version bump

## Phase 3 — Discovery + purchase + enrollment
- [x] P3.1 Browse + search + category filter
- [ ] P3.2 Course detail
- [x] P3.3 Stripe checkout + webhook
- [ ] P3.4 Entitlements/enrollment
- [x] P3.5 View toggle component
- [ ] P3.6 Buy -> enroll flow
- [ ] P3.7 My Learning
- [ ] P3.8 Free course path

## Phase 4 — Player + progress
- [x] P4.1 Mux Player wrapper
- [x] P4.2 lesson_progress schema
- [ ] P4.3 Progress tracking hook
- [ ] P4.4 Lesson page + auto-advance
- [ ] P4.5 Course progress aggregation

## Phase 5 — Author analytics
- [x] P5.1 course_event schema
- [x] P5.2 Aggregation queries
- [ ] P5.3 Analytics dashboard UI
- [x] P5.4 Chart components

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
- [x] D3 features/payments + features/discovery
- [x] D4 features/player-progress
- [x] D5 features/analytics
- [ ] D6 features/notifications
- [ ] D7 Final pass + diagrams + link check

## Batch queue

Rule: keep >=3 in flight; refill the moment one finishes.

| In flight | Issue | Worktree | Depends on |
|---|---|---|---|
| [ ] | P2.8 Course builder UI (cards/list toggle) | `/home/param/Work/lagan-wt/p2-8` (`feat/p2-8-builder-ui`) | P2.5, P2.6, P3.5 (merged) |
| [ ] | P6.1 Notification schema | `/home/param/Work/lagan-wt/p6-1` (`feat/p6-1-notification-schema`) | P0.8 (merged) |
| [ ] | P6.4 Email sending | `/home/param/Work/lagan-wt/p6-4` (`feat/p6-4-email`) | None |
| [ ] | P7.2 axe a11y + SR checklist | `/home/param/Work/lagan-wt/p7-2` (`feat/p7-2-a11y-audit`) | None |
| [ ] | D6 features/notifications | `/home/param/Work/lagan-wt/d6` (`docs/d6-notifications`) | P6.1 |

Merged so far: P0.1-P0.8, P1.1-P1.7, P1.9, P2.1-P2.7, P3.1, P3.3, P3.5, P4.1, P4.2, P5.1, P5.2, P5.4, D0-D5.

### Ready (independent, safe to run concurrently)

Each item owns a distinct package or file set, so these can all start now.

- P1.8 Public author profile — profile route only
- P2.9 Draft autosave — `packages/ui` / `apps/web`; P2.4 and P2.6 merged
- P3.2 Course detail — discovery route; P3.1 merged
- P3.4 Entitlements/enrollment — `packages/db` + server action / route; P3.3 merged
- P4.3 Progress tracking hook — `packages/ui` / `apps/web`; P4.2 merged
- P4.5 Course progress aggregation — `packages/db`; P4.2 merged
- P5.3 Analytics dashboard UI — `apps/web`; P5.2 merged

### Blocked (waiting on a merge)

- P2.10 Publish + version bump — after P2.6, P2.8, P2.9
- P3.6 Buy -> enroll flow — after P3.3 (merged) and P3.4
- P3.7 My Learning — after P3.4 (entitlements)
- P3.8 Free course path — after P3.4 (entitlements)
- P4.4 Lesson page + auto-advance — after P4.1 (merged) and P4.3 (progress hook)
- P6.2 SSE route + hook — after P6.1 (notification schema)
- P6.3 New-content detection + notify — after P6.1 (notification schema)
- P6.5 Notification center UI — after P6.2 (SSE route)
- P7.1 Playwright E2E — after phases 3-6 land
- P7.3 Rate limiting + validation audit — after P2.6, P3.3, P3.4 stop editing API routes
- P7.4 Docs final pass — after D1-D6
- D7 Final pass + diagrams + link check — after D1-D6
