# Lagan

A systems-engineering LMS. Authors build courses with a block-based outline builder, publish them
with versioned releases, and watch enrolment and drop-off analytics; learners buy or enrol for
free, stream lessons, and track progress through the curriculum.

Monorepo: one Next.js 16 app plus shared packages, Bun workspaces, Drizzle on Postgres.

---

## Screens

### Landing page

| Light | Dark |
|---|---|
| ![Landing page, light](docs/evidence/landing-light.png) | ![Landing page, dark](docs/evidence/landing-dark.png) |

### Course catalogue and detail

| Catalogue (cards) | Course detail |
|---|---|
| ![Course catalogue](docs/evidence/courses-cards-light.png) | ![Course detail](docs/evidence/course-detail-light.png) |

### Authoring, learning and analytics

| Course builder | Lesson player | Analytics |
|---|---|---|
| ![Course builder](docs/evidence/course-builder-light.png) | ![Lesson player](docs/evidence/lesson-player-dark.png) | ![Analytics](docs/evidence/teach-analytics-light.png) |

### Live notifications

![Notification centre](docs/evidence/notifications-light.png)

---

## Demo

**Learner journey** — sign up, browse, search, enrol, play a lesson, mark it complete, auto-advance.

![Learner journey](docs/evidence/learner.gif)

**Author journey** — sign in, edit the outline, read the analytics dashboard.

![Author journey](docs/evidence/author.gif)

Videos (H.264 MP4): [learner.mp4](docs/evidence/learner.mp4) · [author.mp4](docs/evidence/author.mp4)

Every asset above is generated from the running app by
[`scripts/capture-visual-evidence.ts`](scripts/capture-visual-evidence.ts) and
[`scripts/capture-journey-video.ts`](scripts/capture-journey-video.ts) — see
[Regenerating the evidence](#regenerating-the-evidence).

---

## Features

| Area | What ships |
|---|---|
| Auth | Better Auth email/password, session cookies, role-aware guards, public author profiles. |
| Authoring | Course → module → lesson outline, drag-and-drop ordering, TiPTap editor, IndexedDB draft autosave, publish with version bump. |
| Discovery | Catalogue with search, category filter and cards/ledger view toggle, public course pages with syllabus preview. |
| Commerce | Stripe checkout + webhook, entitlement records, free enrolment path, "My Learning" dashboard. |
| Player | Mux player wrapper, per-lesson progress persistence, completion, auto-advance to the next lesson. |
| Analytics | Enrolment trend, lesson drop-off, per-course breakdown, date-range and course filters. |
| Notifications | In-app centre with SSE live updates, unread badge, e-mail delivery queue, new-content fan-out. |
| Platform | DTCG design tokens, light/dark themes, axe accessibility audit, rate limiting, input validation, Playwright E2E suite. |

---

## Quick start

```bash
bun install
docker compose up -d                                  # Postgres 18 + MinIO
cp .env.example .env                                  # then edit DATABASE_URL
bun run db:migrate                                    # apply schema migrations
bun run gen:tokens                                    # regenerate apps/web/app/tokens.css
bun run dev                                           # http://localhost:3000
```

`DATABASE_URL` defaults to `postgres://lagan:lagan@localhost:5432/lagan`. If Postgres already
occupies that port, publish it elsewhere and point `DATABASE_URL` at the new host port:

```bash
docker run -d --name lagan-pg -p 5433:5432 \
  -e POSTGRES_USER=lagan -e POSTGRES_PASSWORD=lagan -e POSTGRES_DB=lagan postgres:18
export DATABASE_URL=postgres://lagan:lagan@localhost:5433/lagan
```

### Gates

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # biome
bun run test          # vitest
bun run test:e2e      # playwright (needs Postgres + a dev server)
```

---

## Layout

```
apps/web          Next.js 16 App Router application (the only deployable)
packages/db       Drizzle schema, migrations, progress/analytics/notification queries
packages/ui       Shared UI: charts, editor, player, sidebar, cards, primitives
packages/email    Transactional e-mail queue and provider adapters
packages/types    Shared domain types
packages/config   Shared TypeScript/Biome configuration
tokens/           DTCG design tokens (source of truth for the theme)
scripts/          Token generation, contrast check, evidence capture
docs/             Architecture, data model, feature guides, ADRs, visual evidence
```

## Documentation

- [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) · [Design system](docs/design-system.md)
- [Stack decisions](docs/stack.md) · [ADR index](docs/adr/index.md)
- Feature guides: [authoring](docs/features/authoring.md) · [discovery](docs/features/discovery.md) ·
  [payments](docs/features/payments.md) · [player & progress](docs/features/player-progress.md) ·
  [analytics](docs/features/analytics.md) · [notifications](docs/features/notifications.md) ·
  [profiles](docs/features/profiles.md)
- [Contributing](docs/contributing.md) · [Visual evidence log](docs/evidence/README.md)

---

## Regenerating the evidence

Screenshots, GIFs and videos are produced by driving a real instance of the app with Playwright.

```bash
# 1. Postgres with the schema applied
export DATABASE_URL=postgres://lagan:lagan@localhost:5433/lagan
bun run db:migrate

# 2. Production build (stable asset names, no dev-compile races)
bun run build
bun --cwd apps/web start -p 3000 &

# 3. Screenshots (light + dark, public and authenticated routes)
bun scripts/capture-visual-evidence.ts

# 4. Journey recordings
bun scripts/capture-journey-video.ts learner
bun scripts/capture-journey-video.ts author
bash scripts/build-evidence-media.sh     # webm -> mp4 + gif
```

The capture script seeds a deterministic demo dataset (author, three courses, modules, lessons,
enrolments, progress, events and notifications), then authenticates against the real Better Auth
endpoint so the authenticated screens show real data.

## License

Private project. All rights reserved.
