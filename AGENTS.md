# Lagan — agent orchestration rules

These rules apply to every agent session in this repo. They encode how work must be
executed so progress stays parallel, reviewable, and conflict-free.

## Roles

- The main agent is a **coordinator**, not an implementer. It plans, spawns subagents,
  tracks state, and reports. It does not write feature code when a subagent can.
- Implementation goes to background subagents. Each subagent owns one issue and one
  worktree.

## Workflow per issue

1. Cut a branch from `origin/master` (never from a stale local `master`).
2. Work in its own worktree under `/home/param/Work/lagan-wt/<item>`.
3. Commit in small focused commits. A commit must stay under 5000 tokens of diff
   (lockfiles excluded). The lefthook `size-guard` enforces this.
4. No comments except where technically required. Explain "why" in the PR, not the code.
5. Run gates. In the edit loop, run only the tests for the files you changed, for
   example `bunx vitest run apps/web/app/(app)/courses/page.test.tsx`. Before opening
   the pull request, run the full `bun run test` once, plus `bun install` and
   `bun run lint`. CI still runs typecheck, test, lint and build on every pull
   request, so dropping the local duplicates loses nothing.
6. Push the branch and open a PR with `gh pr create`, body containing What / Why / How,
   and `Closes #<issue>`.
7. A separate reviewer subagent inspects the diff, re-runs gates on the rebased branch,
   then squash-merges via `gh pr merge <n> --squash` and deletes the remote branch.
8. After merge, a reconciler subagent fast-forwards local `master` to `origin/master`
   and updates `todos.md`.

## Parallelism rules

- Keep at least three subagents in flight. Refill the queue the moment one finishes.
- On a small machine, at most one heavy gate runs at a time: the full test suite,
  `next build`, and a Playwright or browser run.
- Pre-create the worktrees and install the dependencies before dispatching the
  subagents, so three agents do not compete on `bun install` at the same time.
- Never run two subagents that edit the same file or package at the same time.
- Independent items (different packages/files) run concurrently; dependent items wait
  for their parent merge.
- The queue lives in `todos.md`; completed items move to `[x]` only after merge.

## Concurrency safety

- Branches are created from `origin/master`, not local `master`, to avoid divergence.
- Remote merges are squash merges; local `master` is only ever fast-forwarded.
- Never force-push. Never commit directly to `master`.
- If `master` diverges from `origin/master`, a reconciler subagent resolves it before
  any new branch is cut.

## Commit hygiene

- One logical change per commit.
- Size guard: <= 5000 tokens of diff, lockfiles excluded.
- Keep code comments to a minimum; prefer clear names and small functions.
- Conventional commit messages.

## Tests and evidence

- Every change carries tests or an explicit reason it cannot.
- Visual changes need a screenshot or GIF; perf changes need measured numbers.
- Evidence is attached to the PR as a comment before merge.

## Delegation

- Merges, todo updates, issue creation, PR descriptions, and evidence collection are
  delegated to subagents.
- The coordinator keeps responses short: status, blockers, next batch.
