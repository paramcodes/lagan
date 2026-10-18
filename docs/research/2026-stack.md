# Lagan — 2026 technology stack research

Decision-first research for a new higher-education LMS. Scope: areas A–S below.
Method: primary sources only (official docs, specs, changelogs, regulator pages).
Every version is the one shipping today; release dates are given where the source states them.
Claim I could not confirm against a primary source is marked `UNVERIFIED:`.

Read the **Recommendation summary** (A–S) first, then the **Open questions**.

Conventions:

- "Pick" = default choice. "Runner-up" = the alternative you would switch to under a stated condition.
- "Trap" = the thing that will bite us and that we should design around now.
- Dates are the source's own publication/release dates.

---

## A. Framework and rendering

**Pick:** Next.js 16.2 (Mar 18 2026) — App Router, React Server Components, streaming, server actions.
**Runner-up:** TanStack Start 1.0 (stable Oct 13 2026) if we want a client-centric, type-safe router with no RSC coupling.

- React 19 is stable (Dec 5 2024). React Compiler 1.0 shipped **stable on Oct 7 2025**; it is an opt-in build plugin for existing apps and is enabled by default in new `create-next-app` templates ([react.dev blog](https://react.dev/blog/2025/10/07/react-compiler-1)). Meta reports up to 12% faster initial loads and >2.5× faster interactions, neutral memory.
- Alternatives on the same tier: SvelteKit 3 (Oct 1 2026), React Router v8.0.1 (2026-06-18), Astro 7 (alpha — not for an authenticated app shell).
- LMS workload is authenticated, low-SEO, interaction-heavy. RSC buys little SEO and adds a client/server boundary we must teach. That argues for **TanStack Start or a React Router SPA** unless we specifically want server components for the authoring/reading surfaces.

**Trap:** Next.js couples build semantics to one vendor and its caching model has churned repeatedly (v15 "use cache" / Cache Components). Self-hosting Next.js works but you inherit the coupling. React Compiler changes memoization; the docs themselves warn that if test coverage is thin you should **pin the exact compiler version** and upgrade deliberately ([react.dev](https://react.dev/blog/2025/10/07/react-compiler-1)).

---

## B. Styling and design tokens

**Pick:** Tailwind CSS v4.3 (May 8 2026) plus W3C DTCG-format design tokens.
**Runner-up:** vanilla-extract or CSS Modules if we want zero utility-class churn and typed styles.

- Tailwind v4 is CSS-first: theme lives in `@theme` in CSS, the build moved to the Oxide engine, and there are breaking config changes from v3. Treat v4 adoption as a migration, not a bump.
- **DTCG:** the Design Tokens Community Group shipped the **first stable spec version "2025.10"** ([designtokens.org](https://www.designtokens.org/)). DTCG JSON is the format to store tokens in; Tailwind/CSS variables become a build output, not the source of truth.

**Trap:** Putting tokens only in `tailwind.config` locks us to Tailwind and blocks design→code handoff. Keep DTCG JSON as the source and generate the CSS layer. Also budget for a real contrast check: the ADA rule tests contrast at 4.5:1 and noncompliant contrast is the most common failure.

---

## C. Headless components

**Pick:** React Aria Components 1.22.1 (Adobe) for a11y-critical widgets (combobox, grid, date picker, drag-and-drop). It carries the strongest AT test story.
**Runner-up:** Base UI v1.9.0 (Oct 9 2026) from the MUI/Radix lineage for ordinary components (dialog, menu, popover).

- Ark UI 6.0.0-next.0 (Oct 6 2026) is **pre-release** — do not ship on it.
- We need a data grid for gradebooks and rosters; that is the single hardest component and worth an explicit spike before committing.

**Trap:** Radix-style libraries have moved maintainers between projects; check maintenance status per component before adoption. Headless does not mean accessible — it means unopinionated. A11y conformance is still on us (see M and L).

---

## D. Language and runtime

**Pick:** TypeScript 5.8+ targeting the Node.js type-stripping feature set now; move to **TypeScript 7.0 after GA**. **Node.js 24 LTS** (24.22.0, Oct 14 2026) for production.
**Runner-up:** Node.js 26 (26.12.0, Oct 14 2026) on non-critical services to soak the current line.

- TypeScript 7.0 is the Go port, reported ~10x faster than TS 6.0; it was at **RC on Jun 18 2026** — not GA. Evidence it is imminent: current `kysely` devDependencies pin `typescript: 7.0.2` alongside `typescript-6: npm:typescript@6.0.3` ([npm registry](https://registry.npmjs.org/kysely/latest)).
- Node's built-in TypeScript support (type stripping) is **Stability 2 – Stable**, added in v22.6.0 and present in v26 ([Node docs: Modules: TypeScript](https://nodejs.org/api/typescript.html)). It strips types only: **no `enum`, no runtime `namespace`, no parameter properties, no decorators, no `tsconfig.json` paths**, and `.tsx` is unsupported.
- Node release policy: even/odd distinction ends at Node 26; **from Node 27 the cycle is annual and every major becomes LTS**, with 30 months of support ([nodejs.org releases](https://nodejs.org/en/about/previous-releases)).

**Trap:** Team will reach for `enum` and decorators out of habit. Enforce `erasableSyntaxOnly` + `verbatimModuleSyntax` in tsconfig so the code we write is exactly what Node can strip. Do not ship production on a TS RC.

---

## E. Data layer

**Pick:** PostgreSQL 18 (stable 2025-09-25; async I/O, `uuidv7()`) as the system of record. Query layer: **Kysely 0.29.7** for typed SQL with no codegen.
**Runner-up:** Drizzle ORM 0.45.4 if the team prefers schema-as-code with generated migrations; Prisma 8 (+ managed "Prisma Compute", GA Aug 28 2026) if we want a batteries-included ORM.

- PostgreSQL 19 is at **RC 1 (released Oct 15 2026)** — plan the upgrade, do not ship on it.
- Extensions we will want early: **pgvector 0.8.7** (2026-10-01) for embeddings; **ParadeDB `pg_search` v0.26.2** (Oct 16 2026) for BM25-class full-text search inside Postgres, so we can defer a separate search cluster.
- Kysely requires Node ≥ 22 and is ESM-first ([npm](https://registry.npmjs.org/kysely/latest)).

**Trap:** Connection pooling. PgBouncer in transaction mode breaks session state, prepared statements, and `LISTEN/NOTIFY` (which pg-boss and realtime depend on — see G and I). Decide pooling mode before anyone writes a job or a subscription. Also: migration tooling and ORM type generation both get expensive on a large schema; prefer reviewed SQL migrations.

---

## F. Identity

**Pick:** Self-hosted **Better Auth** with its SSO plugin (SAML 2.0 + OIDC) for institutional login, plus SCIM-style rostering.
**Runner-up:** **WorkOS** if we would rather buy enterprise SSO/Directory Sync than run it. AuthKit's first **1M MAUs are free**; SSO and Directory Sync bill **per connection (~$125 each)**.

- Auth.js has folded into the Better Auth project; v5 still publishes as `next-auth@beta`. Treat Auth.js as legacy for new work.
- **Keycloak 26.7.0** (Jul 9 2026) is the option if we want to run a full IdP/identity broker ourselves (multi-tenant institutions, protocol translation).
- LMS-specific: LTI 1.3 launches are an OIDC third-party-login flow and must coexist with institutional SAML/OIDC. See K.

**Trap:** LTI tools run in an iframe. Third-party cookie restrictions across modern browsers break naive session cookies in that iframe; you need the LTI/1EdTech postMessage cookie flow. Also: each institution wants its own SAML metadata and attribute mapping; budget for a per-tenant config surface.

---

## G. Jobs and workflows

**Pick:** **pg-boss 12.38.0** (Oct 13 2026) for queues on the Postgres we already run — no Redis to operate.
**Runner-up:** **Temporal TypeScript SDK v1.24.0** (Sep 15 2026) for durable, long-running, resumable workflows (SIS imports, bulk grade passback, multi-day enrollment syncs).

- pg-boss 12.38 batches maintenance/expiry and bulk deletes per transaction; a schema migration runs on upgrade (**schema version 46**) ([release notes](https://github.com/timgit/pg-boss/releases/tag/12.38.0)). Plan the upgrade window.
- Temporal's value is exactly what pgboss does not give: durable execution across process restarts, retries with backoff, and visibility into long runs. Cost is running the Temporal server (or paying Temporal Cloud).

**Trap:** "Just run it in a background task" dies at the first deploy. Grade passback and roster sync must be idempotent and resumable (retries will replay). Choose the durable engine **before** the first sync integration, because retrofitting idempotency is expensive.

---

## H. Files and media

**Pick:** S3-compatible object storage with **versioning enabled**, **presigned URLs** for direct client upload/download, and **lifecycle rules** to expire noncurrent versions.
**Runner-up:** Cloudflare R2 (S3 API, no egress fees) or MinIO on-prem where data residency rules out a public cloud.

- S3 Versioning is off by default; each version is a **full object, not a diff**, and you are billed for all of them. A delete inserts a delete marker. You must add a noncurrent-expiration lifecycle rule or storage grows without bound ([AWS S3 docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)).
- Video: use a managed adaptive-streaming service (Cloudflare Stream or Mux) for HLS + captions rather than serving MP4 from S3. WCAG 2.1 requires captions for prerecorded media (see L).

**Trap:** Versioning + FERPA is a records-retention problem, not just a cost problem. Education records must be retained and disclosed under 34 CFR Part 99; a "delete" that leaves data as a noncurrent version is fine for recovery but must not defeat a legitimate erasure or retention policy. Get legal to define retention before enabling lifecycle expiry. Also scan uploads for malware and never serve user files from the app origin.

---

## I. Realtime and notifications

**Pick:** **SSE** for one-way server→client (notifications, grade-posted events, AI token streaming); **WebSocket** only for genuine bidirectional use (live co-editing, presence).
**Runner-up:** **Centrifugo 6.9.7** (Sep 29 2026) if we want a language-agnostic pub/sub server handling WebSocket, HTTP-streaming, SSE, gRPC, and WebTransport with recovery/positioning built in.

- SSE is browser-native (`EventSource`), auto-reconnects, and carries named events and `retry`. Its one classic limit is **6 concurrent connections per origin over HTTP/1.1**; over **HTTP/2 the limit is negotiated (default 100 streams)** ([MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)). For the wire format itself the normative source is the WHATWG HTML spec (§ "Server-sent events").
- Centrifugo publishes at 28µs average / 46µs p99 into a channel with 100 subscribers after its 6.9.7 recovery rework ([release notes](https://github.com/centrifugal/centrifugo/releases/tag/v6.9.7)).
- Web Push (service worker + Push API) for out-of-tab notifications.

**Trap:** Long-lived connections need a **stateful tier**. Serverless functions with short timeouts cannot hold them. Also pick a delivery semantic deliberately: SSE reconnects and can replay via `Last-Event-ID`, but fan-out to hundreds of subscribers in a course needs a real pub/sub layer, not a loop over sockets.

---

## J. Email

**Pick:** a transactional email API with dedicated sending domain + enforced authentication — Resend is representative ([docs](https://resend.com/docs/introduction)); Postmark and Amazon SES are the alternatives.
**Runner-up:** Postmark for the strongest transactional deliverability reputation.

- Authenticate with **SPF + DKIM + DMARC**. **BIMI** (brand logo in the inbox) requires DMARC to pass, an SVG Tiny PS logo, and a DNS BIMI record; commercial mailboxes additionally want a Verified Mark Certificate ([bimigroup.org](https://bimigroup.org/)).
- Scheduling/invites: use **iCalendar (RFC 5545)** for `.ics` payloads and **CalDAV (RFC 4791)** if we ever sync calendars both ways.

**Trap:** Deliverability from a shared IP is a reputation problem you inherit. DMARC `p=reject` is a prerequisite for BIMI and is a project in itself. Student-facing deadlines and grade notifications are high-stakes email; build a fallback (in-app notification) and never make email the only delivery channel.

---

## K. Standards and interoperability

**Pick:** LTI 1.3 + **LTI Advantage** (AGS 2.0, NRPS 2.0, Deep Linking 2.0) as the primary tool-integration surface. Add **OneRoster 1.2** for rostering and **Caliper 1.2** for analytics events.
**Runner-up:** Edu-API for direct SIS exchange if an institution's SIS speaks it.

- LTI 1.3 replaces shared-secret OAuth with the **1EdTech Security Framework (OAuth2 + JWT)**; AGS creates gradebook columns and posts grades, NRPS exposes users/roles, Deep Linking lets a teacher pick content ([1edtech.org/standards/lti](https://www.1edtech.org/standards/lti)). Conformance is certified through the LTI Advantage certification suite.
- Adjacent standards to plan for: **QTI 3.0** (assessment content), **CASE** (competencies/standards), **CLR** (Comprehensive Learner Record), **Open Badges 3.0**, **Caliper Analytics** ([1EdTech standards](https://www.1edtech.org/standards/lti)).
- **xAPI** (ADL) for learning-activity statements beyond Caliper. `UNVERIFIED:` exact current xAPI version and spec URL — the ADL spec pages did not resolve during this research.

**Trap:** 1EdTech certification is periodic and required for conformance claims; budget the annual process, not just the first certification. OneRoster versions in the wild are fragmented (1.1 and 1.2) — plan to accept both. Do not invent a bespoke tool-integration API; LTI is the interoperability floor institutions will require in an RFP.

---

## L. Accessibility law

**Pick:** build to **WCAG 2.2 AA** as the internal bar, and prove conformance to **WCAG 2.1 AA** (the US legal floor).
**Runner-up:** none — this is a legal requirement, not a preference.

- **US, ADA Title II:** the DOJ rule adopts **WCAG 2.1 Level AA**. An **Interim Final Rule published Apr 20 2026** extended the compliance dates: **April 26, 2027** for public entities serving ≥ 50,000 people; **April 26, 2028** for smaller entities and special districts ([ada.gov fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/), Federal Register 2026-07663). School districts are covered via the state/local-government scope.
- **US, Section 508:** the Revised 508 Standards (final rule Jan 18 2017, effective Jan 18 2018) require federal agencies to procure/build accessible ICT, harmonized with **WCAG 2.0** AA ([section508.gov](https://www.section508.gov/manage/laws-and-policies/)).
- **EU/UK context:** the EU Web and Mobile Accessibility Directive (2016/2102) is based on **WCAG 2.1**; the European Accessibility Act (2019, applies from 2025) references **WCAG 2.2**; EN 301 549 is the harmonized standard that operationalizes both ([W3C WAI policies](https://www.w3.org/WAI/policies/)). `UNVERIFIED:` the exact current EN 301 549 edition and ETSI URL (the ETSI landing page moved during research).

**Trap:** The rule's exceptions (archived content, preexisting documents, third-party posts) are narrow and most do **not** cover interactive forms, tools, or platforms we build. "Conforming alternate versions" are only allowed under a genuine technical/legal limitation — not as a next-best option. The cheapest path is designing WCAG in from the start; retrofitting a data grid or an editor is brutal.

---

## M. Testing and QA

**Pick:** **Vitest 5.0.5** for unit/component tests and **Playwright 1.64** for E2E, visual, and a11y tests.
**Runner-up:** Jest if we must match an existing config; Cypress is not needed on Playwright.

- Vitest 5.0.5 requires Node `^22.12 || ^24 || >=26` and Vite `^6.4 || ^7 || ^8` ([npm](https://registry.npmjs.org/vitest/latest)).
- Playwright 1.64 (WebMCP, video fps, `locator.within()`, WebP snapshots) — browser bundles Chromium 156 / Firefox 157 / WebKit 27.2. Accessibility testing runs through `@axe-core/playwright`. **Component testing moved to a stories-and-galleries model**; the old `@playwright/experimental-ct-*` packages are frozen ([release notes](https://playwright.dev/docs/release-notes)). Playwright also ships a `trace` CLI and MCP server for agent-assisted debugging.
- Contract testing: **Pact** for consumer-driven contracts on LTI/AGS/SIS integrations. Load testing: **k6** (Grafana).

**Trap:** E2E on an LMS is inherently flaky (async grade passback, realtime, LTI iframes). Invest in hermetic test data and Playwright's new test locks / isolated retries rather than retrying blindly. Also: axe catches maybe a third of WCAG failures — pair automated checks with manual screen-reader passes.

---

## N. Observability and hosting

**Pick:** **OpenTelemetry** for traces/metrics/logs (semantic conventions **v1.44.0**, Aug 4 2026) and **OpenTofu v1.13.1** (Oct 1 2026, CNCF) or Terraform for IaC.
**Runner-up:** a managed observability vendor (Grafana Cloud, Datadog) to skip running Prometheus/Tempo/Loki.

- Semconv v1.44.0 promotes K8s container/pod memory metrics and reworks the `browser.web_vital` event ([release notes](https://github.com/open-telemetry/semantic-conventions/releases/tag/v1.44.0)).
- Managed Postgres (Neon, AWS RDS/Aurora, Supabase) is the pragmatic default; self-host only under a residency mandate.

**Trap:** **Data residency and FERPA/DPA.** Student records in an EU/UK region or on-prem may be required by contract. Decide the region model per tenant before choosing a host, and confirm each subprocessor's data-training and retention terms. Also: OTel collector and log volume are a real line item; sample from day one.

---

## O. Mobile

**Pick:** responsive **PWA** first, one codebase, no app-store gatekeeping.
**Runner-up:** **Expo SDK 58** (`expo` 58.0.14, React Native 0.88, React Compiler on by default) if a native app becomes a hard requirement.

- Expo SDK 54+ enabled the React Compiler by default, so new Expo apps get it from the start ([react.dev](https://react.dev/blog/2025/10/07/react-compiler-1)).
- PWA installs are available across platforms; Web Push works on iOS for installed PWAs. `UNVERIFIED:` iOS PWA limitations such as Background Sync — sources are secondary/developer-forum, not a spec.

**Trap:** Do not build a native app to escape the browser. Campus audiences live in a browser; a PWA keeps one code path and avoids two store-review cycles per release. Only go native for capabilities the web genuinely cannot provide and that the product actually needs.

---

## P. Analytics and reporting

**Pick:** **ClickHouse 26.9** (Sep 21 2026) for event analytics; product analytics via self-hosted PostHog.
**Runner-up:** **DuckDB v2.0** (preview, Aug 17 2026) for embedded/offline analysis; dbt for transforms.

- ClickHouse 26.9 changes the default compression to ZSTD(3), removes the CatBoost integration, and removes experimental `WINDOW VIEW` ([changelog](https://clickhouse.com/docs/whats-new/changelog)).
- Accreditation/regulatory reporting needs queryable, auditable, retained data. Keep a durable raw event table separate from the aggregating warehouse.

**Trap:** Analytics must not become a shadow copy of FERPA-protected records. Pseudonymize before the warehouse, keep the join keys in the system of record, and document retention. Regulatory reports also need reproducible point-in-time snapshots, not "whatever the dashboard showed."

---

## Q. Authoring, docs, and content

**Pick:** **TipTap 3.0** on ProseMirror with **Hocuspocus 4** on Yjs for collaborative editing (both stable May 8 2026).
**Runner-up:** a plain ProseMirror integration if we want to avoid an editor vendor; KaTeX or MathJax for math.

- Content exchange: **Common Cartridge** (1EdTech) and **QTI 3.0** for importing/exporting course content and assessments. Pandoc covers many document conversions. Store authoring assets in S3 with versioning (H).

**Trap:** Collaboration is a **CRDT** problem, not a WebSocket problem — get Yjs document shape right early. Sanitize all authored HTML (stored XSS is the classic LMS breach). TipTap/Hocuspocus are commercial-backed; confirm license and support terms before betting the authoring surface on them.

---

## R. AI features

**Pick:** a provider-agnostic LLM gateway in front of hosted models that contractually **do not train on customer data**, with a self-hosted open-weight path for anything that must never leave our boundary.
**Runner-up:** self-hosted open-weight models only, if legal prohibits external processing of education records.

- FERPA frames student work as an **education record** under 34 CFR Part 99 ([eCFR](https://www.ecfr.gov/current/title-34/subtitle-A/part-99)); third-party processors must be under our direct control and bound to use/redisclosure limits (§ 99.31(a)(1)(i)(B), § 99.33). That constrains which AI vendors are usable and under what terms.
- `UNVERIFIED:` exact current data-retention / no-training clauses for specific AI vendors — cite each vendor's own legal page at decision time, not a summary.

**Trap:** Never ship AI-generated grades or unverified feedback as authoritative. Prompt injection from learner-submitted content is a live attack. Anything AI-generated that learners read is content and must meet the same accessibility bar (L). Get the DPA and zero-retention terms in writing before any student data touches a model.

---

## S. Anything missed

- **Search:** start with `pg_search` (E) so search lives in Postgres; graduate to Meilisearch/OpenSearch only if relevance work demands it.
- **Feature flags:** needed for safe rollout of AI features and grading changes; pick one early (OpenFeature-compatible).
- **i18n:** LMS deployments are often multilingual; choose a framework with routing-level i18n before the URL structure is frozen.
- **Payments:** Stripe for any store/billing; keep PCI out of scope with hosted checkout.
- **Audit logging:** who viewed or changed which education record is both a FERPA and a support necessity; design append-only audit from the start.
- **Backups and DR:** point-in-time recovery on the primary Postgres; test restores.
- **Licensing caution:** several operationally attractive tools are AGPL or source-available (e.g. Grafana, MinIO). Confirm license terms before embedding them in a commercial product.
- **Security:** threat model the LTI launch, the file upload path (H), and the authoring sanitizer (Q) first — those are the three highest-value breach routes.

---

## Recommendation summary

| Area | Pick | Runner-up | Biggest risk |
|---|---|---|---|
| A Framework | Next.js 16.2 or TanStack Start 1.0 | SvelteKit 3 | Vendor coupling + RSC/cache churn; React Compiler memoization changes |
| B Styling | Tailwind v4.3 + DTCG 2025.10 tokens | vanilla-extract | v4 breaking migration; tokens locked in Tailwind config |
| C Components | React Aria Components 1.22.1 | Base UI 1.9.0 | Ark UI is pre-release; headless ≠ accessible |
| D Language | TypeScript 7 after GA (5.8+ now), Node 24 LTS | Node 26 | Shipping on TS RC; `enum`/decorators break Node stripping |
| E Data | PostgreSQL 18 + Kysely 0.29.7 | Drizzle 0.45.4 / Prisma 8 | Pooling mode breaks `LISTEN/NOTIFY` and prepared statements |
| F Identity | Better Auth SSO plugin | WorkOS ($125/connection) | SAML/SCIM per-tenant config; LTI iframe third-party cookies |
| G Jobs | pg-boss 12.38.0 | Temporal TS SDK 1.24.0 | Non-idempotent grade/roster sync; pg-boss schema upgrade |
| H Files | S3 + versioning + presigned URLs | R2 / MinIO | Version billing; retention/erasure vs FERPA |
| I Realtime | SSE, WebSocket only when needed | Centrifugo 6.9.7 | Needs stateful tier; unbounded fan-out |
| J Email | Transactional API (Resend/Postmark) | SES | Deliverability; DMARC/BIMI setup effort |
| K Standards | LTI 1.3 Advantage + OneRoster 1.2 + Caliper | Edu-API | Annual certification cost; OneRoster 1.1/1.2 fragmentation |
| L Accessibility | Build WCAG 2.2 AA; prove WCAG 2.1 AA | — | Retrofitting grid/editor; narrow legal exceptions |
| M Testing | Vitest 5.0.5 + Playwright 1.64 | Jest | E2E flakiness on async/LTI/realtime |
| N Observability | OpenTelemetry v1.44.0 + OpenTofu 1.13.1 | Managed vendor | Data residency; OTel log cost |
| O Mobile | PWA first | Expo SDK 58 | Building native for no reason; iOS PWA gaps |
| P Analytics | ClickHouse 26.9 (+ PostHog) | DuckDB 2.0 / dbt | PII in warehouse; non-reproducible regulatory reports |
| Q Authoring | TipTap 3.0 + Hocuspocus 4 (Yjs) | raw ProseMirror | CRDT design; stored XSS; vendor license terms |
| R AI | Provider-agnostic gateway, no-training terms | Self-hosted weights | FERPA scope; prompt injection; authoritative AI grades |
| S Misc | `pg_search`, OpenFeature flags, Stripe, audit log | — | AGPL/source-available licensing; untested restores |

---

## Open questions for the decision

1. **Hosting sovereignty.** Do any target institutions require EU/UK or on-prem data residency? This decides N (host), H (storage), and R (AI processing) at once, and is expensive to change later.
2. **Team size and skills.** Is the team comfortable owning a stateful realtime tier and a durable job engine (I, G), or does budget favor managed services (WorkOS, Temporal Cloud, managed Postgres)?
3. **Budget envelope.** Are recurring lines acceptable for enterprise SSO per connection (F), 1EdTech certification (K), VMC/BIMI (J), and an observability vendor (N)?
4. **Campus IdP and SIS.** Which IdP (SAML vs OIDC) and which SIS (OneRoster vs Edu-API vs custom) must we integrate first? This sets F and K concretely.
5. **Accessibility posture.** Do we commit to WCAG 2.2 AA internally (ahead of the US 2.1 floor), and do we fund periodic 1EdTech/accessibility conformance work?
6. **Rendering model.** RSC-first (Next.js) or client-first (TanStack Start/React Router)? This is the hardest thing to reverse and shapes A, C, and Q.
7. **Data model for authoring.** CRDT-based collaborative editing from day one (Q), or single-author editing first?
8. **AI scope.** Which features may see student data, under what vendor terms, and what is explicitly out of bounds (R)?
9. **Retention and erasure policy.** What is the legal retention schedule for education records, and how does it map to S3 lifecycle and analytics retention (H, P)?
10. **Analytics truth source.** Is the reporting warehouse the system of record for accreditation, or a derived copy? This changes P's design.

---

*Research method note: all versions and legal dates above come from primary sources linked inline. Items marked `UNVERIFIED:` (xAPI version/spec URL, EN 301 549 edition/URL, iOS PWA Background Sync, vendor AI retention clauses) were not confirmed against a primary source during this pass and must be re-checked before they carry weight in the decision.*
