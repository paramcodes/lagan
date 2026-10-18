# Lagan — 2026 developer-tooling research

Decision-first research, second pass. Scope: areas T–Z below.
First pass (A–S: framework, data, auth, jobs, files, realtime, email, standards,
accessibility law, testing, observability, mobile, analytics, authoring, AI) is in
[`2026-stack.md`](./2026-stack.md); this file does not repeat it.

Method: primary sources only (official docs, release notes, npm/GitHub registry metadata,
specs). Every version is the one resolving on the package registry or release feed today,
2026-10-18. Claim I could not confirm against a primary source is marked `UNVERIFIED:`.

**Context that decides most of these calls:** one developer plus AI agents; one deployable;
managed hosting and managed Postgres; a bespoke, locked CSS-token design system (near-black
ink, chalk yellow, one typeface, hairline panels, deliberately not a component-kit look);
v1 = roster + assignments + gradebook + recorded video; WCAG 2.2 AA + FERPA.

Conventions as in the first pass:

- "Pick" = default choice. "Runner-up" = the alternative under a stated condition.
- "Trap" = the thing that will bite us and that we should design around now.
- Every item ends in a verdict: **adopt now**, **adopt later**, or **reject**.

---

## T. UI kit and component-library landscape

We already chose the foundation in C: **React Aria Components 1.22.1** for a11y-critical
widgets, Base UI as runner-up. T answers a different question — do we also take a *kit* on
top? The locked design direction says no: a kit is a styling contract we would spend the
whole project overriding.

- **shadcn CLI** `shadcn` **4.22.0** ([npm](https://registry.npmjs.org/shadcn/latest)). Its
  own docs refuse the label "a component library" and call it "how you build your component
  library" ([ui.shadcn.com](https://ui.shadcn.com/docs)). It is a **copy-in registry**: you
  own the emitted files, there is no upstream upgrade path (re-running `add` re-emits). Since
  July 2026 the default base is **Base UI** ([changelog](https://ui.shadcn.com/docs/changelog));
  React Aria and Radix bases are also supported. Since Sept 2026 components import `cn` from
  the [`cn` package](https://github.com/shadcn-ui/cn) instead of a local util (`shadcn migrate cn`).
- **Base UI** `@base-ui/react` **1.9.0** (2026-10-09) — the package **renamed** from
  `@base-ui-components/react`, which stopped at `1.0.0-rc.0` (2025-12-04)
  ([npm](https://registry.npmjs.org/@base-ui/react/latest)). Maintained by people who came
  from Radix, MUI, and Floating UI. Unstyled, WAI-ARIA-annotated, MIT
  (© 2019 Material-UI SAS).
- **Radix Primitives** — unified `radix-ui` **1.8.1** (2026-10-12)
  ([npm](https://registry.npmjs.org/radix-ui/latest)); MIT (© 2022 WorkOS). Active, but the
  maintainer overlap with Base UI means one lineage, not two independent bets.
- **Ark UI** `@ark-ui/react` **5.39.3** stable / **6.0.0-next.0** pre-release
  ([npm](https://registry.npmjs.org/@ark-ui/react/latest)) — "a project by Chakra Systems".
  Cooling toward pre-release on a new major; do not ship on `next`. **Park UI**
  `@park-ui/panda-preset` is still **0.43.1** (0.x, pre-1.0), Ark UI + Panda CSS, now inside
  the Chakra org.
- **HeroUI** `@heroui/react` **3.2.6** (2026-09-17) — v3 stable, rebuilt on
  **React Aria Components + Tailwind v4** ([npm](https://registry.npmjs.org/@heroui/react/latest)).
  License is the trap: v3 branch is **Apache-2.0**, but the repository's default LICENSE is
  still MIT (v2). Read the branch you vendor.
- Opinionated kits: **daisyUI 5.7.50** (2026-10-13), **MUI `@mui/material` 9.5.0**
  (2026-10-09, still Material Design 2), **Chakra UI 3.37.0** (2026-08-28, slower cadence,
  runtime Emotion), **Mantine 9.7.3** (2026-10-17; v9.0.0 on 2026-03-31; needs React 19.2+).
  Mantine is the one with a genuinely interesting part: `@mantine/schedule` ships
  day/week/month/year calendar views with drag-and-drop — adjacent to an LMS calendar.

| Kit | Look it imposes | Verdict |
|---|---|---|
| shadcn CLI (`shadcn` 4.22.0) | none — copies source | **adopt later** as a *distribution* channel for a handful of primitives, restyled to tokens |
| Base UI 1.9.0 / Radix 1.8.1 | none (unstyled) | **adopt now** as unstyled foundation (C already says so) |
| HeroUI 3.2.6 | Tailwind theme + its own look | **reject** — kit styling we would strip; branch license ambiguity |
| Ark UI 5.39.3 | none, but 6.0 pre-release | **reject** — mid-major transition, cross-framework breadth we do not need |
| Park UI 0.43.1 | Panda CSS preset | **reject** — pre-1.0, adds Panda alongside Tailwind |
| daisyUI 5.7.50 | utility-class component themes | **reject** — the exact "component-kit look" the design rejects |
| MUI 9.5.0 | Material Design 2 | **reject** — heaviest possible override fight |
| Chakra 3.37.0 | Emotion runtime theme | **reject** — runtime CSS-in-JS cost, slate slower than peers |
| Mantine 9.7.3 | its own token system | **reject kit; steal the idea** — calendar UX is worth reading, not installing |

**Trap:** if we take shadcn at all, we own every emitted file forever and there is no upstream
update path — the honest answer to "how do I get upgrades" is "you re-run `add` and re-strip
the styling". With one bespoke design system, the win is a *registry mechanism* (typed,
diffable, agent-readable components), not a component set. Any kit that ships its own theme
tokens is a second source of truth for the palette; that is the fight, and we should not
start it.

---

## U. Motion and animation

The design system is deliberately quiet: hairline panels, no card shadows, chalk reserved for
position. Motion here is feedback, not decoration. That makes the browser's own platform the
right first choice.

- **Motion** (formerly Framer Motion) — `motion` and `framer-motion` both **14.3.0**
  (2026-10-15) ([npm](https://registry.npmjs.org/motion/latest)), imported from `motion/react`.
  Hybrid engine uses the Web Animations API and ScrollTimeline, falling back to JS for springs
  and interruptible keyframes. Library is MIT; **Motion+ is a separate paid product** (Solo
  tier listed at **$399 one-time** via the site's schema.org offer). `UNVERIFIED:` a specific
  bundle-size figure — the docs give none, so treat any KB number as unconfirmed.
- Platform primitives, browser support per MDN browser-compat-data (fetched 2026-10-18):
  - `Document.startViewTransition` (SPA): Chrome **111**, Firefox **144**, Safari **18**.
  - `@view-transition` at-rule + `PageRevealEvent` (cross-document): Chrome **126**/123,
    Safari **18.2**, **Firefox `false`** — unsupported.
  - Element-scoped `Element.startViewTransition`: Chrome **147** only (Firefox/Safari false).
  - CSS scroll-driven animations (`animation-timeline`, `view-timeline`): Chrome **115**,
    Firefox **159**, Safari **26**.
  - [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
    (page last modified 2026-09-28) covers SPA + MPA, `::view-transition-*`,
    `view-transition-class`, `view-transition-scope`.
- `prefers-reduced-motion` is **Baseline Widely available**; normative source is
  [Media Queries Level 5 § prefers-reduced-motion](https://drafts.csswg.org/mediaqueries-5/#prefers-reduced-motion).

**Verdict — reject Motion as a dependency now; adopt later only if a measured interaction
needs physics.** CSS transitions cover hover/focus/panel states; scroll-driven animations and
view transitions cover page and list transitions where supported. `prefers-reduced-motion` is
mandatory, not optional, and it is our own code either way.

**Trap:** view-transition support is *staggered*, not uniform — cross-document transitions
silently do nothing in Firefox today, and element-scoped transitions are Chrome-only. Any
transition must be guarded so an unsupported browser gets the instant, correct end state.
Also: a motion library is the single easiest place to break WCAG 2.2 AA (2.3.3 Animation from
Interactions, 2.2.2 Pause/Stop/Hide). If we adopt Motion later, `useReducedMotion` must gate
every animation, and Motion's docs no longer publish a dedicated reduced-motion page, so
verify the current API before citing it.

---

## V. Linter and formatter

One tool with one config beats two tools with overlapping rules. The repository is TypeScript
end to end and mostly one app, so this is the simplest section to decide.

- **Biome** `@biomejs/biome` **2.5.15** (2026-09-30)
  ([npm](https://registry.npmjs.org/@biomejs/biome/latest)). v2.5 crossed **500 lint rules**,
  added GritQL plugin fixes, cross-file linting, a watcher mode, and a concise reporter; v2.4
  added embedded CSS/GraphQL formatting plus 15 HTML a11y rules. MIT. Biome implements **its
  own type inference** rather than driving the TypeScript compiler, so type-aware coverage is
  narrower than Oxlint's `tsgo` path.
- **Oxlint** `oxlint` **1.88.0** (2026-10-13) ([npm](https://registry.npmjs.org/oxlint/latest)),
  Oxc crates 0.154.0. Docs claim **871 built-in rules**, 50–100× faster than ESLint, and
  **type-aware linting via `tsgo`** (the TypeScript 7 native port). JS plugins are alpha.
  Docs list the semver carve-outs: nursery rules, JS plugins, and type-aware linting are **not**
  covered by semver, and new lint errors are not counted as breaking.
- **oxfmt** `oxfmt` **0.73.0** (2026-10-13) ([npm](https://registry.npmjs.org/oxfmt/latest)) —
  **0.x, effectively experimental**. Prettier-compatible, ~30× faster than Prettier, tested
  against Prettier's own suite, known divergences documented.
- **ESLint** **10.13.0** (2026-10-16) ([npm](https://registry.npmjs.org/eslint/latest)); the 9.x
  line reached **EOL 2026-08-06**. Flat config is the default.
- **Prettier** **3.9.10** (2026-10-10) ([npm](https://registry.npmjs.org/prettier/latest)); its
  docs recommend **pinning the exact version** because patch releases can reformat output.
- **Stylelint** **17.16.0** (2026-10-01) — only relevant if we keep hand-written CSS beyond
  Tailwind's `@theme`.
- Type gate: TypeScript `latest` is **7.0.2** on npm, so **TS 7 is GA** (the first pass, D,
  assumed RC). `UNVERIFIED:` the exact GA announcement date — the npm `latest` tag is the
  primary evidence here, and the TypeScript docs release notes still top out at 6.0.

**Verdict:** **adopt now** — Biome 2.5.15 as the single lint+format tool, plus `tsc --noEmit`
(project references) as the type gate. **Reject ESLint, Prettier, Stylelint, and Oxlint for v1.**
Reconsider Oxlint only if CI lint time becomes a measured problem, and Oxfmt only once it
reaches 1.0 — a 0.x formatter that can reformat on any release is a diff-churn trap on a repo
where agents open most PRs.

**Trap:** whichever tool we pick, the type-aware layer is not the TypeScript compiler. Biome
infers; Oxlint delegates to `tsgo`; neither is a substitute for `tsc --noEmit`. And a formatter
that changes its output between releases turns every agent PR into a mixed diff. Pin exact
versions and let the format check fail CI rather than reformat on the fly.

---

## W. Git hooks and commit hygiene

Hooks run on the developer's machine and, for a solo-plus-agents repo, they are the cheapest
place to stop a bad commit before it ever reaches CI. The risk is a hook tool that stops
shipping.

- **Husky** `husky` **9.1.7**, last release **2024-11-18**
  ([npm](https://registry.npmjs.org/husky/latest)) — roughly two years stale. That is the
  maintenance-risk signal, not a reason to switch on its own.
- **lefthook** `lefthook` **2.2.2** (2026-10-13)
  ([npm](https://registry.npmjs.org/lefthook/latest)) — MIT, actively maintained by Evil
  Martians. Runs hooks in parallel, globs/filters staged files itself (so `lint-staged` is
  redundant), single Go binary.
- **simple-git-hooks** **2.14.0** (2026-08-28)
  ([npm](https://registry.npmjs.org/simple-git-hooks/latest)) — the zero-runtime option: it
  writes the hook files and gets out of the way.
- **lint-staged** **17.6.0** (2026-09-26) — only needed if the hook runner lacks staged-file
  filtering. lefthook has it.
- **commitlint** `@commitlint/cli` **21.2.4** (2026-10-18)
  ([npm](https://registry.npmjs.org/@commitlint/cli/latest)) — very active, Conventional
  Commits enforcement.
- Baseline alternative: git's own `core.hooksPath` (no dependency at all).

**Verdict:** **adopt now** — lefthook 2.2.2 for pre-commit (format, lint, type-check on staged
files) and pre-push (unit tests). **Reject Husky** (stale), **reject lint-staged** (redundant
with lefthook). **commitlint: adopt later** — adopt Conventional Commits as a *convention* in
agent instructions now, and only wire commitlint once commit messages drive automation
(changelog, releases).

**Trap:** a pre-commit hook that runs the full test suite gets bypassed with `--no-verify` within
a week. Keep pre-commit to what finishes in a second or two on changed files, and put anything
slow in pre-push or CI. Agents will also happily commit a message like "fix" — commitlint earns
its place only when something downstream reads the message, so do not add the gate before the
consumer exists.

---

## X. Containers and local dev

Managed Postgres and managed object storage mean local dev needs *something* for Postgres,
object storage, and possibly the async worker — and nothing more.

- **Docker Compose v2** ships as the `docker compose` plugin; the docs describe one YAML file
  and lifecycle commands for a multi-container app ([docs.docker.com/compose](https://docs.docker.com/compose/)).
  The npm package `docker-compose` is the **legacy v1 shim** at 1.5.0 (2026-09-17) — not the
  thing we want.
- **Docker Desktop license** ([docs.docker.com/subscription/desktop-license](https://docs.docker.com/subscription/desktop-license)):
  free for small businesses (**<250 employees and <$10M revenue**), personal use, education, and
  non-commercial OSS; paid above that. Docker Engine and Moby licensing is unchanged — the paid
  term is the *Desktop* app.
- **Testcontainers for Node.js** `testcontainers` **12.2.1** (2026-10-13)
  ([npm](https://registry.npmjs.org/testcontainers/latest)), with a **PostgreSQL** module and a
  **MinIO** module. This is what gives integration tests a real Postgres and a real S3 API.

**Verdict:** **adopt now** — Docker Engine (via the CLI) + Compose v2 for local services;
**Testcontainers 12.2.1** for integration tests. **Reject Docker Desktop** — the license is a
recurring compliance question for no capability we need. Podman or Colima is the
Docker-Desktop-free path; both exist specifically to run the same containers.

**Trap:** the local Postgres version must match the managed one, or a migration that passes
locally fails in production. Pin the image tag. And Testcontainers needs a working container
runtime in CI too — deciding "we only containerize locally" now means the integration tests
cannot run in CI later, which is exactly where agents need them.

---

## Y. Package manager and monorepo

One deployable and one app means the monorepo tooling question is mostly *not yet*, and the
honest answer for several of these is "it would cost a build system to save nothing".

- **npm** `12.2.0` ([npm](https://registry.npmjs.org/npm/latest)) — always present, no install
  step, adequate for a single package.
- **pnpm** **12.14.0** ([npm](https://registry.npmjs.org/pnpm/latest)) — its **Catalogs** feature
  (`catalog:` / `catalogs:` in `pnpm-workspace.yaml`, with `catalogMode` manual/strict/prefer)
  is the best answer to "many packages, one version per dependency". Workspace deps in catalogs
  landed in v12.2.0, `file:`/`link:` in v12.6.0.
- **Bun** **1.4.3** ([npm](https://registry.npmjs.org/bun/latest)) — mature *as a package
  manager*: `bun.lock`, workspace globs, `workspace:` protocol, `--filter`, its own catalogs,
  isolated linker. `UNVERIFIED:` the "28× faster than npm install" claim — it is a vendor
  benchmark, not an independent measurement.
- **Yarn:** the npm `latest` tag is still **1.22.22** (Classic); Yarn 4 ships via Corepack and
  GitHub releases, not the registry dist-tags. A stale dist-tag is a footgun for anyone
  installing without Corepack.
- **Turborepo** `turbo` **2.11.9** (2026-10-16)
  ([npm](https://registry.npmjs.org/turbo/latest)) — MIT (© 2026 Vercel). Offers a **remote
  cache**, and its docs explicitly cover
  [single-package workspaces](https://turborepo.com/docs/guides/single-package-workspaces).
- **Nx** 23.3.0; **moon** `@moonrepo/cli` **2.6.2** (2026-10-14).
- **Changesets** `@changesets/cli` **3.0.3** (2026-09-14) — versioning and changelogs for
  published packages.

**Verdict:** **adopt now** — **npm** as the package manager and **no monorepo tool**. **pnpm
adopt later** if a second package appears (extract the design tokens), and then use pnpm
Catalogs, not a version-drift script. **Reject Turborepo, Nx, and moon for v1** — a task runner
with one package buys a cache and a config file and costs an abstraction every agent must learn.
**Reject Yarn.** **Changesets: adopt later**, only when we publish a package other repos consume.

**Trap:** the monorepo decision is easy to make accidentally and hard to reverse. The moment
`packages/` exists, every tool (lint, type, test, container, CI) gains a second configuration
axis. Keep the deployable a single package with a clear internal module layout; if the token set
needs sharing, publish it as a versioned package rather than growing a workspace by default.

---

## Z. CI, release, and repo hygiene

CI is the only place an agent's work is checked by something other than an agent. Keep it one
workflow that does exactly the four things the local hooks cannot: install clean, lint, test,
build.

- **GitHub Actions.** Required checks for a merge queue only trigger on the **`merge_group`**
  event ([docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue));
  without it, queued merges hang forever. `actions/cache@v4` and `setup-node`'s built-in
  caching handle dependencies: **10 GB per repo** default, **7-day eviction**, extra storage is
  billed (50 GB ≈ $2.80/mo, 200 GB ≈ $13.30, 1000 GB ≈ $69.30), with upload/download rate limits
  of 200/min and 1500/min.
- **Dependabot** — config in `.dependabot.yml`; handles **security and version** updates,
  updates GitHub Actions refs and workflow lockfiles, and applies a **default 3-day cooldown**
  on version updates (not on security updates). It **auto-pauses** if maintainers stop
  interacting. Covered by GitHub's own ToS. ([docs](https://docs.github.com/en/code-security/dependabot))
- **Renovate** **44.167.1** ([docs](https://docs.renovatebot.com/)) — license **AGPL-3.0-only**;
  Mend hosts a GitHub app. Its own release notes state "Renovate 44 was accidentally released as
  a major version, even though the changes were non-breaking" — a fair signal of release
  discipline. Preset configs and monorepo auto-detection are its real advantages.
- **semantic-release** — npm `latest` is **25.0.9**; the repo shows **26.0.0-beta.2** — v26 is in
  beta ([github.com/semantic-release/semantic-release/releases](https://github.com/semantic-release/semantic-release/releases)).
- Type gate in CI: `tsc --noEmit` with project references, as in V.

**Verdict:** **adopt now** — GitHub Actions (one workflow: install → Biome check → `tsc --noEmit`
→ Vitest → build) and **Dependabot**. **Reject Renovate** — AGPL and a hosted dependency for a
job Dependabot already does inside a repo we already pay GitHub for. **Reject semantic-release**
with v26 in beta and no publish target; if we ever publish, Changesets (Y) covers it.

**Trap:** required checks plus a merge queue is the combination that bites — if the checks are
not wired to `merge_group`, merges stall with no error an agent can read. Separately, dependency
automation producing a stream of one-line PRs is a review tax on one developer; the 3-day
cooldown and grouped updates matter more than which bot we pick. Finally, do not let CI be the
first place a type error is found — that pushes the feedback loop from seconds to minutes and
agents burn tokens waiting.

---

## Verdict table

| # | Item | Version (date) | Verdict | One-line reason |
|---|---|---|---|---|
| T | shadcn CLI | 4.22.0 (2026-10-16) | **adopt later** | registry mechanism yes, component kit no |
| T | Base UI `@base-ui/react` | 1.9.0 (2026-10-09) | **adopt now** | unstyled foundation; renamed package, pin new name |
| T | Radix `radix-ui` | 1.8.1 (2026-10-12) | **adopt later** | same lineage as Base UI; only if a specific primitive is missing |
| T | HeroUI | 3.2.6 (2026-09-17) | **reject** | Tailwind theme to strip; v3-branch Apache vs repo MIT ambiguity |
| T | Ark UI | 5.39.3 / 6.0.0-next.0 | **reject** | pre-release major mid-flight, cross-framework breadth unused |
| T | Park UI | 0.43.1 | **reject** | pre-1.0; adds Panda CSS beside Tailwind |
| T | daisyUI | 5.7.50 (2026-10-13) | **reject** | the component-kit look the design explicitly rejects |
| T | MUI | 9.5.0 (2026-10-09) | **reject** | Material Design 2 override fight |
| T | Chakra UI | 3.37.0 (2026-08-28) | **reject** | runtime Emotion; slower cadence |
| T | Mantine | 9.7.3 (2026-10-17) | **reject** | second token system; borrow calendar ideas only |
| U | Motion | 14.3.0 (2026-10-15) | **reject for now** | CSS transitions + scroll/view transitions cover our motion |
| U | `prefers-reduced-motion` gating | Baseline | **adopt now** | WCAG 2.2 AA requirement, our code either way |
| V | Biome | 2.5.15 (2026-09-30) | **adopt now** | one tool for lint + format, 500+ rules |
| V | Oxlint / oxfmt | 1.88.0 / 0.73.0 | **reject for v1** | Oxfmt is 0.x and reformats between releases |
| V | ESLint / Prettier / Stylelint | 10.13.0 / 3.9.10 / 17.16.0 | **reject** | overlapping rules with Biome; ESLint 9 is EOL |
| V | TypeScript type gate | npm `latest` 7.0.2 | **adopt now** | `tsc --noEmit` — TS 7 is GA |
| W | lefthook | 2.2.2 (2026-10-13) | **adopt now** | active, parallel, staged-file filtering built in |
| W | simple-git-hooks | 2.14.0 (2026-08-28) | **adopt later** | fallback if lefthook is more than we want |
| W | Husky | 9.1.7 (2024-11-18) | **reject** | ~2 years without a release |
| W | lint-staged | 17.6.0 (2026-09-26) | **reject** | redundant with lefthook |
| W | commitlint | 21.2.4 (2026-10-18) | **adopt later** | gate only once messages drive automation |
| X | Docker Engine + Compose v2 | `docker compose` plugin | **adopt now** | local Postgres + S3 stand-in |
| X | Docker Desktop | licensed product | **reject** | license tier for no capability we need |
| X | Testcontainers (Node) | 12.2.1 (2026-10-13) | **adopt now** | real Postgres/MinIO in integration tests |
| Y | npm | 12.2.0 | **adopt now** | one package, zero setup |
| Y | pnpm (+ Catalogs) | 12.14.0 | **adopt later** | only when a second package exists |
| Y | Bun | 1.4.3 | **adopt later** | fast install; benchmark claims unverified |
| Y | Yarn | latest tag 1.22.22 | **reject** | stale dist-tag vs Corepack-installed v4 |
| Y | Turborepo / Nx / moon | 2.11.9 / 23.3.0 / 2.6.2 | **reject for v1** | task runner with one package buys nothing |
| Y | Changesets | 3.0.3 (2026-09-14) | **adopt later** | only when we publish a package |
| Z | GitHub Actions | — | **adopt now** | the one external check on agent work |
| Z | Dependabot | — | **adopt now** | in-repo, security + version updates, free |
| Z | Renovate | 44.167.1 | **reject** | AGPL + hosted app for what Dependabot does |
| Z | semantic-release | 25.0.9 (26 in beta) | **reject** | beta major, no publish target |

---

## The minimal tooling set

Smallest set that covers lint, format, test, hooks, local dev, and CI — in adoption order:

1. **npm 12.2.0** — package manager, no install step (Y).
2. **TypeScript 7 (`tsc --noEmit`)** — the type gate; runs in hooks and CI (D, V).
3. **Biome 2.5.15** — lint **and** format, one config, one pinned version (V).
4. **Vitest 5.0.5 + Playwright 1.64** — unit and E2E, already chosen (M).
5. **lefthook 2.2.2** — pre-commit (format/lint/type on staged files), pre-push (tests) (W).
6. **Docker Engine + Compose v2** — local Postgres and S3-compatible storage (X).
7. **GitHub Actions** — one workflow: install, Biome check, type check, test, build (Z).
8. **Dependabot** — dependency and Actions-ref updates with the default cooldown (Z).

That is seven tools plus the runtime, and it satisfies every area T–Z without a component kit,
a motion library, a monorepo build system, or a dependency bot we have to host.

Add later, each on a trigger: **Testcontainers** when integration tests must run in CI (X);
**pnpm with Catalogs** when a second package appears (Y); **commitlint** when messages drive
automation (W); **Motion** if a measured interaction needs physics (U); **Changesets** when we
publish a package (Y); **shadcn CLI** as a source of a few restyled primitives (T).

---

## Traps that will bite a solo agent-driven repo

1. **Copy-in components have no upgrade path.** shadcn-style emit means we own every file
   forever. Decide that up front, because "why didn't we get the fix" is answered by "re-run
   `add` and re-strip the styling" (T).
2. **Two token systems.** Any kit that ships its own theme is a second source of truth for the
   palette. The locked design system wins, or the kit does; never both (T).
3. **Staggered platform support passes as working code.** Cross-document view transitions do
   nothing in Firefox today and element-scoped ones are Chrome-only. Guard every transition so
   the unsupported path is the correct instant state (U).
4. **Reduced motion is a legal requirement, not a nicety.** WCAG 2.2 AA 2.3.3 and 2.2.2 apply
   to anything we animate; agents will add motion without a reduced-motion branch unless the
   rule is enforced in the lint config (U, L).
5. **A 0.x formatter is diff churn.** oxfmt at 0.73.0 can change output on any release, and
   most PRs here are machine-written. Pin exact versions; fail CI on format rather than
   reformat locally (V).
6. **Lint is not the type gate.** Biome infers types; Oxlint delegates to `tsgo`. Neither
   replaces `tsc --noEmit`, and only CI catches the difference (V).
7. **Hooks that take too long get bypassed.** Keep pre-commit to seconds on changed files, or
   `--no-verify` becomes the habit — including for the agent (W).
8. **Required checks plus a merge queue stall silently** unless the checks listen on
   `merge_group`. The failure looks like nothing happening (Z).
9. **Local and managed Postgres drift.** An unpinned local image means migrations that pass
   locally and fail in production; Testcontainers only helps if the runtime exists in CI too
   (X).
10. **The accidental monorepo.** A `packages/` directory adds a configuration axis to lint,
    type, test, container, and CI at once, for a solo developer who does not need it yet (Y).
11. **Dependency-bot PR fatigue.** One developer reviewing a stream of one-line PRs will start
    rubber-stamping; group updates and rely on the 3-day cooldown (Z).
12. **Stale dist-tags mislead installs.** Yarn's `latest` is still 1.22.22 (Classic) while v4
    ships via Corepack; never trust `latest` without checking the release feed (Y).

---

*Research method note: versions come from npm registry `latest`/`dist-tags` metadata and GitHub
release feeds read on 2026-10-18, with dates as published by those sources; browser support
comes from MDN browser-compat-data. Items marked `UNVERIFIED:` (Motion bundle size, Bun's
speed claim, TypeScript 7 GA announcement date) were not confirmed against a primary source
this pass and must be re-checked before they carry weight. No package was installed and no code
was executed during this research.*
