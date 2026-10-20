# Visual Verification Evidence

Visual evidence captured by driving a running instance of Lagan with Playwright: screenshots of every
product surface in light and dark color schemes, plus screen recordings of the two core journeys.
Used to verify design-token fidelity, layout integrity and visual accessibility.

## Capture Specifications

All artifacts are captured under standardised conditions using headless Chromium via Playwright:

| Parameter | Specification | Notes |
|---|---|---|
| **Engine** | Chromium (Playwright Headless) | Sandboxed automated browser |
| **Viewport** | 1440 × 900 px (screenshots), 1280 × 720 px (recordings), 390 × 844 px and 768 × 1024 px (narrow-viewport screenshots) | Desktop layout baseline, plus the narrow viewports the app shell has to work at |
| **Device Scale Factor** | 2.0 (HiDPI / Retina) | Screenshots render at 2880 × 1800 px |
| **Color Schemes** | Light & Dark | Explicit `colorScheme` context and `.dark` class toggle |
| **Font Rendering** | Web font settle synchronisation | Waits for `document.fonts.ready` prior to capture |
| **Stylesheet** | Applied before capture | Waits until the linked stylesheet has parsed rules |
| **Capture Scope** | Full page (`fullPage: true`) | Captures the entire scrollable route height |
| **Target** | Production build (`next build` + `next start`) | Avoids dev-compile races and hydration-only differences |
| **Output Directory** | `docs/evidence/` | Content-addressed visual verification artifacts |

## Artifact Inventory

### Screenshots

| Screenshot | Route | Session | Color scheme |
|---|---|---|---|
| `landing-light.png` / `landing-dark.png` | `/` | public | light / dark |
| `sign-in-light.png` / `sign-in-dark.png` | `/sign-in` | public | light / dark |
| `sign-up-light.png` / `sign-up-dark.png` | `/sign-up` | public | light / dark |
| `courses-cards-light.png` / `courses-cards-dark.png` | `/courses?view=cards` | public | light / dark |
| `courses-ledger-light.png` / `courses-ledger-dark.png` | `/courses?view=ledger` | public | light / dark |
| `course-detail-light.png` / `course-detail-dark.png` | `/courses/course_distributed` | public | light / dark |
| `lesson-player-light.png` / `lesson-player-dark.png` | `/courses/course_distributed/lessons/les_raft` | author | light / dark |
| `author-profile-light.png` / `author-profile-dark.png` | `/authors/author_evelyn` | public | light / dark |
| `learn-cards-light.png` / `learn-cards-dark.png` | `/learn?view=cards` | author | light / dark |
| `learn-ledger-light.png` / `learn-ledger-dark.png` | `/learn?view=ledger` | author | light / dark |
| `profile-light.png` / `profile-dark.png` | `/profile` | author | light / dark |
| `teach-analytics-light.png` / `teach-analytics-dark.png` | `/teach/analytics` | author | light / dark |
| `course-builder-light.png` / `course-builder-dark.png` | `/teach/courses/course_distributed/builder` | author | light / dark |
| `notifications-light.png` / `notifications-dark.png` | `/courses?view=cards` (bell opened) | author | light / dark |
| `courses-390-before.png` / `courses-390-after.png` | `/courses` | public | light |
| `courses-768-after.png` | `/courses` | public | light |
| `issue-119-courses-1440-before.png` / `-after.png` | `/courses` | public | light |
| `issue-119-courses-1440-diff.png` | `/courses` | public | light |

The three narrow-viewport captures were taken by hand rather than by the capture script, and they
record the app shell below 768 pixels, where the sidebar collapses to a rail and the topbar
wraps. `courses-390-before.png` is the state that made the catalogue unreadable on a phone.

The `issue-119-*` set records the shared-package Tailwind regression. The two 1440 captures are
pixel-identical, because the missing classes only show on a card row with mixed heights, which
that capture does not have. The difference is in the sidebar transition, recorded in the two GIFs:
before, the browser animated every property with the default easing, because the transition
properties themselves were never emitted. After, it animates the width with the intended curve.
The `issue-119-sidebar-toggle-before.gif` and `-after.gif` are the two states.

### Recordings

| Artifact | Flow | Duration |
|---|---|---|
| `learner.mp4` / `learner.gif` | Landing → sign-up → catalogue → search → course detail → free enrolment → My Learning → lesson player → mark complete → auto-advance → notifications | ~22 s |
| `author.mp4` / `author.gif` | Sign in → course builder → analytics dashboard → My Learning (list) | ~9 s |

GIFs are 900 px wide, 10 fps, palette-dithered. MP4s are H.264 (`yuv420p`, faststart) for embedding.

## Verified Surfaces

- **Landing page** — hero hierarchy, primary and secondary CTAs, four feature pillars, semantic
  landmarks (`header`/`main`/`section`/`footer`), strict DTCG token usage.
- **Authentication** — centred card layout, labelled inputs, focus boundary, contrast against the
  canvas token, no theme bleed.
- **Catalogue (cards)** — responsive card grid, course metadata badges, difficulty, author
  attribution, price and discount, active state on the view toggle.
- **Catalogue (ledger)** — compact tabular rows with aligned columns, dividers, hover feedback.
- **Course detail** — two-column layout with a sticky pricing card, formatted price with discount,
  collapsible syllabus outline, lesson types and runtimes, contextual CTA (Buy Now / Enroll for
  Free / Continue Learning).
- **Lesson player** — embedded video surface, module/lesson navigation sidebar with completion
  marks, progress persistence, completion and auto-advance banner.
- **My Learning** — enrolled course cards with progress bars, next-lesson deep links, cards and
  ledger views.
- **Profile** — editable bio, website, avatar and social links.
- **Author profile** — public page with bio, links, published-course count, enrolled-learner count
  and the author's catalogue.
- **Course builder** — module and lesson cards, drag handles, per-lesson status, publish/archive
  actions, cards and list views, draft autosave state.
- **Analytics** — enrolment/completion overview cards, enrolment trend chart, lesson drop-off
  chart, per-course performance table, course selector and date-range filter.
- **Notification centre** — live SSE indicator, unread badge, notification types, relative
  timestamps, mark-as-read affordances.

## Reproduction

```bash
export DATABASE_URL=postgres://lagan:lagan@localhost:5433/lagan
bun run db:migrate
bun run build
bun --cwd apps/web start -p 3000 &

bun scripts/capture-visual-evidence.ts        # screenshots (light + dark)
bun scripts/capture-journey-video.ts learner  # learner journey recording
bun scripts/capture-journey-video.ts author   # author journey recording
bash scripts/build-evidence-media.sh          # webm -> mp4 + gif
```

The capture script owns a deterministic demo dataset: the author `Dr. Evelyn Reed`, three published
courses, four modules, seven lessons, two enrolments, lesson progress, 25 days of course events
and three notifications. It authenticates against the real Better Auth endpoint and rebinds the
session to the seeded author, so authenticated screens render real data rather than a mocked
header. Public routes are captured in a separate signed-out context, because the middleware
redirects `/sign-in` and `/sign-up` to `/learn` for authenticated sessions.
