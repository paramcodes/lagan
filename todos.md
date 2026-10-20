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
- [x] P2.10 Publish + version bump

## Phase 3 — Discovery + purchase + enrollment
- [x] P3.1 Browse + search + category filter
- [x] P3.2 Course detail
- [x] P3.3 Stripe checkout + webhook
- [x] P3.4 Entitlements/enrollment
- [x] P3.5 View toggle component
- [x] P3.6 Buy -> enroll flow
- [x] P3.7 My Learning
- [x] P3.8 Free course path

## Phase 4 — Player + progress
- [x] P4.1 Mux Player wrapper
- [x] P4.2 lesson_progress schema
- [x] P4.3 Progress tracking hook
- [x] P4.4 Lesson page + auto-advance
- [x] P4.5 Course progress aggregation

## Phase 5 — Author analytics
- [x] P5.1 course_event schema
- [x] P5.2 Aggregation queries
- [x] P5.3 Analytics dashboard UI
- [x] P5.4 Chart components

## Phase 6 — Notifications
- [x] P6.1 Notification schema
- [x] P6.2 SSE route + hook
- [x] P6.3 New-content detection + notify
- [x] P6.4 Email sending
- [x] P6.5 Notification center UI

## Phase 7 — Hardening
- [x] P7.1 Playwright E2E
- [x] P7.2 axe a11y + SR checklist
- [x] P7.3 Rate limiting + validation audit
- [x] P7.4 Docs final pass

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
| [x] | All 49 MVP issues complete & merged | — | — |
| [x] | #96 (PR #100) demo seed and clean command (`bun run seed:demo`, `bun run seed:demo:clean`) | — | — |
| [x] | #98 (PR #103) cut the local gate cost and serialize the heavy gates | — | — |
| [x] | #95 (PR #102) app error boundary and shell fallback | — | — |
| [x] | #97 (PR #101) smooth in-page scrolling on the landing page | — | — |
| [x] | #106 (PR #107) correct the hook descriptions and land the agent workflow research | — | — |
| [x] | #108 (PR #110) machine-checkable rule table, an auditor and a projector | — | — |
| [x] | #105 (PR #113) split the demo seed into a data module and a command surface | — | — |
| [x] | #99 (PR #114) vitest environment split and Postgres test coverage | — | — |
| [x] | #104 (PR #109) app shell usable below 768px | — | — |

Merged: P0.1-P0.8, P1.1-P1.9, P2.1-P2.10, P3.1-P3.8, P4.1-P4.5, P5.1-P5.4, P6.1-P6.5, P7.1-P7.4, D0-D7, #95, #96, #97, #98, #99, #104, #105, #106, #108.

### Status
**100% MVP Complete across all phases.** All quality gates, accessibility audits, security audits, and E2E core journeys are passing green on main.
