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

- Schema lives in `packages/db` (Drizzle). Migrations are generated then reviewed SQL.
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