# Stack — condensed decision log

Full detail: `docs/decisions/2026-stack-decisions.md`. Research: `docs/research/`.

## Settled (A1–A10)

- **A1 Monolith.** Next.js 16.4.2 (App Router), React 19.3. One deployable, no microservices.
- **A2 Postgres.** PostgreSQL 18 + Drizzle 0.45, generated-then-reviewed SQL migrations. `tenant_id` on every institution table from migration one; RLS.
- **A3 Auth.** Better Auth 1.7 (local, passkeys, email). SAML/OIDC via vendor in phase two. Roles first-class: student, instructor, TA, admin, external examiner.
- **A4 Tokens.** DTCG JSON is source of truth; Tailwind 4 `@theme` is generated output. `--line` vs `--edge`.
- **A5 UI libs.** Base UI 1.9 for ordinary widgets; React Aria Components 1.22 for hard ones (gradebook grid, roster, date picker, DnD). shadcn CLI is a registry, not a theme.
- **A6 Jobs.** pg-boss 12 on primary DB. Temporal 1.24 only when a durable multi-step workflow exists.
- **A7 Video.** Default: managed HLS (Mux or Cloudflare Stream). Captions required for WCAG 2.1 AA. Decision pending (F1).
- **A8 Submissions.** S3-compatible, versioned, content-hashed, write-once. Virus scan async, blocks release not upload.
- **A9 Tooling.** Bun, TS 5.9, Biome 2.5, lefthook 2.2, Docker Compose, Vitest 5, Playwright 1.64. One package, directories, path aliases. No Turborepo/Nx yet.
- **A10 A11y.** WCAG 2.2 AA build target; provable 2.1 AA legal floor. Contrast in CI.

## Open forks

- **F1 Video route** — managed API vs campus LTI vs DIY. Biggest cost/lock-in.
- **F2 Hosting/sovereignty** — in-region/on-prem demands.
- **F3 AI data boundary** — AI only on authored content until decided.
- **F4 Tenancy** — single institution with tenant column (assumed) vs multi-tenant.

## Consequences worth remembering

- Every job idempotent and resumable (retries replay).
- Avoid `enum`/decorators (`erasableSyntaxOnly`).
- Analytics/search start in Postgres (`pg_search`, `pgvector`).
- Retention schedule still undefined — default to keeping.