<!-- GENERATED FILE. DO NOT EDIT BY HAND. -->
<!-- Regenerate with: bun scripts/sync-agent-rules.ts -->

# Lagan

A systems-engineering LMS. Authors build courses with a block-based outline builder, publish them
with versioned releases, and watch enrolment and drop-off analytics; learners buy or enrol for
free, stream lessons, and track progress through the curriculum.

Monorepo: one Next.js 16 app plus shared packages, Bun workspaces, Drizzle on Postgres.

## Setup

```bash
bun install
docker compose up -d                                  # Postgres 18 + MinIO
cp .env.example .env                                  # then edit DATABASE_URL
bun run db:migrate                                    # apply schema migrations
bun run gen:tokens                                    # regenerate apps/web/app/tokens.css
bun run dev                                           # http://localhost:3000
```

## Gates

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # biome
bun run test          # vitest
bun run test:e2e      # playwright (needs Postgres + a dev server)
```

## Workflow per issue

1. Cut a branch from `origin/master`.
2. Work in its own worktree under `/home/param/Work/lagan-wt/<item>`.
3. Commit in small focused commits, one logical change per commit, with a conventional
   commit message.
4. Run gates. In the edit loop, run only the tests for the files you changed, for
   example `bunx vitest run "apps/web/app/(app)/courses/page.test.tsx"`. Before opening
   the pull request, run the full `bun run test` once, plus `bun install` and
   `bun run lint`. CI still runs typecheck, test, lint and build on every pull request,
   so dropping the local duplicates loses nothing.
5. Push the branch and open the pull request with `gh pr create`. The body carries
   What, Why and How, and ends with `Closes #<issue>`.
6. A separate reviewer subagent inspects the diff, re-runs the gates on the rebased
   branch, then squash-merges with `gh pr merge <n> --squash` and deletes the remote
   branch.
7. After the merge, a reconciler subagent fast-forwards the local `master` to
   `origin/master` and updates `todos.md`.

## Parallelism

- Independent items, in different packages or files, run concurrently. Dependent items
  wait for their parent merge.
- Keep at least three subagents in flight, and refill the queue the moment one
  finishes.
- The queue lives in `todos.md`. A completed item moves to `[x]` only after its merge.
- The heavy gates are the full test suite, `next build` and a Playwright or browser run.
  At most one of them runs at a time on this four-core box, and the other agents keep
  editing while it runs.
- Pre-create the worktrees and install the dependencies before dispatching the
  subagents, so three agents do not compete on `bun install` at the same time.

## Concurrency safety

- Remote merges are squash merges. The local `master` is only ever fast-forwarded.
- If the local `master` has diverged from `origin/master`, the reconciler subagent
  resolves the divergence before any new branch is cut.

## Commit hygiene

- One logical change per commit.
- Conventional commit messages.

## Tests and evidence

- Every change carries tests, or an explicit reason it cannot.
- A visual change needs a screenshot or a GIF. A performance change needs measured
  numbers and the command that produced them.
- Evidence is attached to the pull request as a comment before the merge.

## Delegation

- Merges, todo updates, issue creation, pull request descriptions and evidence
  collection are delegated to subagents.
- The coordinator keeps its responses short: status, blockers, next batch.

## Preferences

These are preferences, not rules. No failure has produced them, so they have no rule
file: the brief, the checklist or the skill of the work carries them, and the
coordinator's brief carries the ones that keep a merge safe.

- Never force-push.
- Two subagents never edit the same file or package at the same time. The per-item file
  manifest in each brief is what keeps them apart.
- Keep code comments to a minimum, and explain why in the pull request rather than in
  the source. Prefer clear names and small functions.

## Rules

The operating rules live in `docs/ai/rules/`, one YAML file per rule. There are 12 rules: 4 enforced, 8 unenforced.

- `docs/ai/README.md` documents the format, the layers and how to add a rule.
- `docs/ai/protected-paths.md` lists the guarded paths and what enforces each one.
- `bun scripts/audit-rules.ts` checks the table.

Read the rule file when a rule is in question. This file routes to the table and does not
restate it, because a restatement is a second copy that drifts.
