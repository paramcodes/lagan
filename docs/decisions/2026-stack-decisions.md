# Lagan — stack decisions

Status: **proposed**, 2026-10-18. Companion to `docs/research/2026-stack.md` (areas A–S) and
`docs/research/2026-tooling.md` (areas T–Z). Every version below was re-read from the npm
registry or nodejs.org on 2026-10-18, not copied from the research notes.

Constraints this answers to, given by the product owner:

- One developer plus AI agents. Every extra runtime is a maintenance bill.
- Ship fast in year one: managed services over self-hosted infrastructure.
- v1 scope: roster, assignments, gradebook, **recorded course video**.
- SIS and identity provider are known but integrate in phase two.
- Accessibility is a legal floor, not a differentiator (see A10).

Reading order: A1–A9 are the settled calls. A10–A12 are open forks that change the shape and
need a decision before code lands on them.

---

## A1. One TypeScript monolith, Next.js, no microservices

**Decision.** Next.js 16.4.2 (App Router) as the single deployable. React 19.3.1. Server
components for the read-heavy surfaces (course pages, library, rubric display); client
components for the interactive ones (gradebook, submission upload, calendar). No separate API
service, no gateway, no message broker.

**Why over the research pick.** The research leaned toward TanStack Start or a React Router SPA
on the grounds that an authenticated LMS gets little from RSC. That reasoning is right about
RSC and wrong about total cost: the decisive factor here is that a solo developer's throughput
is bounded by how well the agent ecosystem writes the framework in front of it, and that is
Next.js by a wide margin today. TanStack Start's real current version is 1.169.3 — a fast-moving
line, which is a second reason not to bet a five-year product on it as the base.

**Consequences.** We inherit a vendor-coupled build (mitigated: it runs in a container) and a
caching model that has churned across majors. Pin the exact minor. Avoid the experimental
caching directives until we need them: with `dynamic = "force-dynamic"` on authenticated
routes, caching is not the problem worth solving yet.

---

## A2. One Postgres, one schema, tenancy from migration one

**Decision.** PostgreSQL 18 as the system of record. Drizzle ORM 0.45.4 for typed queries with
migrations generated as reviewed SQL. A `tenant_id` column on every table that holds
institution data, from the first migration, with row-level security policies. Single
institution at launch; the column is not optional even so.

**Why over the research pick.** The research picked Kysely 0.29.7 with Drizzle as runner-up.
Both are 0.x, so version risk is a wash; the tiebreak is that generated-then-reviewed SQL
migrations and a schema file are a smaller surface for an agent to reason about than
hand-written query builders plus a separate migration discipline. Drizzle emits plain SQL
either way, so the escape hatch Kysely offers stays open.

**Consequences.** Every future sign of a second institution is a data problem, not a rewrite.
Analytics and search start inside Postgres: `pg_search` for full text, `pgvector` for
embeddings. No separate search cluster until relevance work demands it. Local Postgres image
pinned to the same major as production, because pooling mode and `LISTEN/NOTIFY` behaviour
differ between hosts and the job queue depends on the latter.

---

## A3. Auth now, SSO later, and the seam built now

**Decision.** Better Auth 1.7.10 for launch: local accounts, passkeys, email. Phase two puts
institutional SAML/OIDC and SCIM provisioning behind a vendor (WorkOS or equivalent) rather
than self-hosting Keycloak. Roles as a first-class model from the start: student, instructor,
teaching assistant, administrator, external examiner, with delegation rather than role
impersonation.

**Why.** A university's identity provider is the last integration you want to hand-roll, and the
first thing a procurement questionnaire asks about. Keeping launch auth self-contained and
portable means the SAML decision is bought, not built, when the first institution needs it.

**Consequences.** Model the user record so an external subject identifier and an institution
per tenant can be added without a migration of identity. LTI launches are an OIDC third-party
flow that must coexist with institutional login — including the iframe cookie situation, which
is a browser-policy problem, not a config problem.

---

## A4. Tokens are the source of truth; Tailwind is a compile target

**Decision.** The locked design system ships as DTCG-format JSON, versioned in the repo. Tailwind
4.3.3 `@theme` variables and any native client consume that JSON as generated output. Two line
tokens stay distinct: `--line` for decoration, `--edge` for the boundary of anything operable.

**Why.** The research's trap is exact: a design system defined inside a tool config is a system
that tool owns. The prototype already proved the token set works; the JSON freezes it.

**Consequences.** A build step generates CSS from tokens, and CI fails if the generated output
drifts from the JSON. Someone will try to add a one-off colour; the answer is that the token
file is the only place a colour exists.

---

## A5. Behaviour from libraries, appearance from us

**Decision.** Base UI 1.9.0 (package `@base-ui/react`) as the unstyled foundation for ordinary
widgets. React Aria Components 1.22.1 for the widgets where accessibility is hardest and most
consequential: the gradebook grid, the roster table, the date picker, drag-and-drop reordering.
The shadcn CLI is a registry mechanism for copying source in and restyling, never a theme.

**Why.** No component kit earns its place against a locked bespoke design; every kit is a second
token system and a year of override fights. The two libraries above supply behaviour we cannot
afford to write (focus management, virtualisation, screen-reader semantics) and no opinion about
appearance.

**Consequences.** We own every copied component forever, and upgrades mean re-adding and
re-stripping. Confine copying to the hard widgets. The data grid needs an explicit spike before
we commit to either library for it — it is the hardest component in the product.

---

## A6. Jobs live in Postgres

**Decision.** pg-boss 12.38.0 on the primary database for queues and scheduling. Durable,
multi-step workflows (SIS roster sync, bulk grade passback) get Temporal 1.24.0 only when one
actually exists — not before.

**Why.** A second datastore to operate is the kind of decision that looks free and costs a week
a year. Grade release, deadline reminders, bulk imports, file conversion and retryable
passback all fit a table-based queue at our scale.

**Consequences.** Every job must be idempotent and resumable, because retries replay. That is a
design rule, not a library feature: write the operations so a second run converges. Decide the
durable engine **before** the first SIS integration, since retrofitted idempotency is expensive.

---

## A7. Video is a managed service, and it is the biggest cost in the product

**Decision.** Not settled — this is fork F1 below, and it drives more of the budget than
everything else combined. Default position: a managed HLS service (Mux or Cloudflare Stream) for
transcoding, adaptive delivery, signed per-user playback and automatic captions.

**Why.** Recorded lecture video is the one workload where doing it yourself (S3 plus a
transcoder plus a CDN plus a caption pipeline) costs a month of build time and then keeps
costing. Captions are not a feature: prerecorded media requires them for WCAG 2.1 AA, and ASR
output needs a correction interface before students can rely on it.

**Consequences.** Egress is the line item that decides whether this product is viable at scale.
If a target institution already pays for Panopto, Echo360 or Kaltura, launching into that
platform over LTI moves the cost to their budget — which is a phase-two option worth keeping
open in the storage design.

---

## A8. Submissions are immutable evidence

**Decision.** S3-compatible object storage with versioning on, lifecycle rules for noncurrent
versions, and presigned multipart uploads direct from the client. Submissions are content-hashed
and write-once. Virus scanning is asynchronous and blocks release, not upload. User files are
never served from the application origin.

**Why.** An academic-integrity dispute asks what was submitted, when, and unchanged. Versioning
plus hashes answers it; a mutable row does not. Retention is a legal question before it is a
storage question.

**Consequences.** Somebody (legal, eventually) has to define the retention schedule, because
"delete" in a versioned bucket leaves noncurrent objects behind. Until that exists, default to
keeping, and make the hash the thing you can point at.

---

## A9. Tooling: five tools, one package, no monorepo

**Decision.** npm 12.2.0 (ships with Node, no install step). TypeScript 7.0.2 as the type gate
via `tsc --noEmit`. Biome 2.5.15 for lint and format in one tool. lefthook 2.2.2 for hooks,
scoped to staged files and fast enough that nobody reaches for `--no-verify`. Docker Compose v2
for local Postgres and S3-compatible storage, no Docker Desktop. Vitest 5.0.5 and Playwright
1.64.1. GitHub Actions plus Dependabot as the single external check on agent work.

**Why.** Each addition has to earn its maintenance. Rejected with reasons: Husky (no release
since November 2024), lint-staged (lefthook does it), commitlint (nothing consumes the
messages yet), oxfmt (0.x formatter that reformats between releases, and most diffs here are
machine-written), ESLint and Prettier (overlap with Biome), Renovate (AGPL plus a hosted app for
what Dependabot does), Turborepo and Nx (a task runner with one package buys nothing), Yarn
(stale `latest` dist-tag).

**Consequences.** One package, directories, path aliases. A `packages/` directory adds a
configuration axis to lint, type, test, container and CI at once, so it waits for a real second
consumer: a marketing site, the LTI tool, or a mobile client. Triggers for later additions are
recorded in `docs/research/2026-tooling.md`. Avoid `enum` and decorators so the code stays
erasable — `erasableSyntaxOnly` in tsconfig enforces it.

---

## A10. Accessibility is the floor, measured not asserted

**Decision.** Build to WCAG 2.2 AA; be able to prove WCAG 2.1 AA, which is the US legal floor.
Contrast measured in code, with the check in CI. Automated axe checks in Playwright, plus a
manual screen-reader pass per release. Reduced motion honoured everywhere.

**Why.** ADA Title II adopts WCAG 2.1 AA, and the DOJ's April 2026 interim final rule set
compliance dates of 26 April 2027 (entities over 50,000 people) and 26 April 2028 (smaller
entities). The rule binds the institution, which makes conformance a procurement requirement on
us, not a preference.

**Consequences.** Retrofitting a data grid or an editor is brutal, so both get built
accessibly the first time. The locked palette already passed one audit with two fixes applied;
the open item is the Student/Teaching switch, whose selected state differs by a fill at 1.26:1
with no non-colour cue.

---

# Open forks

## F1. Video route — the largest cost and the largest lock-in

| Route | Cost model | Risk |
|---|---|---|
| Managed API (Mux, Cloudflare Stream) | Per minute stored and delivered | Vendor lock-in on the playback path |
| Campus platform via LTI (Panopto, Echo360, Kaltura) | Institution already pays | Needs LTI in phase two; playback outside our product |
| DIY (S3 + transcoder + CDN) | Cheapest per gigabyte at scale | A month of build time and permanent operational cost |

Needs: an estimate of lecture hours per term per course, and whether the first target
institution already licenses a video platform. Everything in A8 changes shape depending on the
answer.

## F2. Hosting and sovereignty

"Whatever ships fastest" answered this for year one, and it assumes no institution demands
in-region or on-premise hosting. If one does, it decides the database host, the object store,
the video service and the AI path at once. Cheapest mitigation: pick an EU/UK region now, even
if nobody has asked.

## F3. What AI is allowed to see

Not a v1 feature, but it determines schema choices now: whether student work may leave our
boundary at all, which constrains feedback drafting, tutoring and semantic search. Until the
answer exists, keep AI on content we author and never on learner submissions.

## F4. Tenancy model

Single institution with a tenant column (assumed) or multi-tenant from day one. The assumption
is cheap to keep and expensive to add, which is why A2 makes it non-optional.
