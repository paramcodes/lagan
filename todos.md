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

## Phase 1 — Auth, roles, profile, shell
- [x] P1.1 Better Auth setup
- [x] P1.2 Role model + guards
- [ ] P1.3 Tokens + base styles + dark mode
- [x] P1.4 shadcn Sidebar (collapsed rail)
- [x] P1.5 Profile schema + migration
- [ ] P1.6 Auth pages
- [x] P1.7 Profile view/edit
- [ ] P1.8 Public author profile
- [x] P1.9 App shell layout (search + category filter)

## Phase 2 — Course authoring
- [ ] P2.1 Course/module/lesson schema
- [ ] P2.2 TipTap editor + sanitizer
- [ ] P2.3 Mux upload + webhook
- [ ] P2.4 IndexedDB draft store
- [ ] P2.5 @dnd-kit wrappers
- [ ] P2.6 Course CRUD actions
- [ ] P2.7 Module/lesson CRUD + ordering
- [ ] P2.8 Course builder UI (cards/list toggle)
- [ ] P2.9 Draft autosave
- [ ] P2.10 Publish + version bump

## Phase 3 — Discovery + purchase + enrollment
- [ ] P3.1 Browse + search + category filter
- [ ] P3.2 Course detail
- [ ] P3.3 Stripe checkout + webhook
- [ ] P3.4 Entitlements/enrollment
- [ ] P3.5 View toggle component
- [ ] P3.6 Buy -> enroll flow
- [ ] P3.7 My Learning
- [ ] P3.8 Free course path

## Phase 4 — Player + progress
- [ ] P4.1 Mux Player wrapper
- [ ] P4.2 lesson_progress schema
- [ ] P4.3 Progress tracking hook
- [ ] P4.4 Lesson page + auto-advance
- [ ] P4.5 Course progress aggregation

## Phase 5 — Author analytics
- [ ] P5.1 course_event schema
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
- [ ] D1 Architecture + design-system + data-model
- [ ] D2 features/authoring + features/profiles
- [ ] D3 features/payments + features/discovery
- [ ] D4 features/player-progress
- [ ] D5 features/analytics
- [ ] D6 features/notifications
- [ ] D7 Final pass + diagrams + link check