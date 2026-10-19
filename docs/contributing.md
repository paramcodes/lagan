# Contributing

## Setup

1. Install Bun 1.4+.
2. `bun install`
3. `docker compose up -d` (Postgres 18 + MinIO).
4. Set `DATABASE_URL`.
5. `bun run gen:tokens`.
6. `bun run dev`.

## Workflow

- Branch from `master`. Worktrees under `/home/param/Work/lagan-wt/` are the convention.
- Keep commits small (lefthook size guard ~5000 tokens).
- Run before pushing: `bun run typecheck && bun run lint && bun run test`.

## Code style

- TypeScript strict; `erasableSyntaxOnly` on — no `enum`, no decorators.
- Biome for lint + format (2 spaces, 100 cols). `bun run format`.
- No `any`; prefer explicit types at boundaries.

## Database

- Schema lives in `packages/db/src/schema` (Drizzle). `drizzle.config.ts` at the repo root
  points at `./packages/db/src/schema` and writes SQL to `packages/db/drizzle/`.
- Generate a migration after every schema change, then review the SQL before committing:
  `bun run db:generate`. Commit both the new `packages/db/drizzle/*.sql` file and `packages/db/drizzle/meta/`.
- Apply pending migrations with `bun run db:migrate`. It reads `DATABASE_URL`; if unset it
  falls back to the docker-compose Postgres:
  `postgres://lagan:lagan@localhost:5432/lagan`.
- Connection: `docker compose up -d postgres` starts Postgres 18 with user/password/db all
  `lagan` on `localhost:5432` (see `docker-compose.yml`). Wait until it accepts connections
  (`docker compose exec postgres pg_isready -U lagan`) before migrating.
- `db:push` is intentionally not wired up: it skips the migration files that CI and deploys
  replay, so schema changes would drift. Use `db:generate` + `db:migrate` instead.
- Every table holding institution data carries `tenant_id` from migration one.

## Tokens

- Edit `tokens/tokens.json` only. Regenerate via `bun run gen:tokens`; CI fails on drift.
- Two line tokens: `--line` (decoration), `--edge` (operable boundaries).

## Tests

- Unit: Vitest (`packages/**/*.test.ts`, `apps/**/*.test.tsx`).
- E2E: Playwright in `apps/web/e2e`.
- Accessibility: axe in Playwright + manual screen-reader pass per release.

## Commits

- Conventional-ish messages seen in history: `feat(scope): ...`, `chore: ...`, `test: ...`.
- Hooks (lefthook) run format, lint, typecheck, size guard on commit; tests on push.