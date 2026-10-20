# Handoff

Standing instructions for any agent working in this repository. Read this first, then the issue,
then the rule table.

If a brief you were given contradicts this file, say so and stop. Do not guess which one wins.

---

## Read these, in this order

1. This file.
2. The GitHub issue, with `gh issue view <n>`. The issue states the problem and the acceptance.
3. `docs/ai/rules/` for the operating rules, and `docs/ai/README.md` for the format. A rule is in
   force whether or not you read it, so read the ones your change touches.

Do not re-derive any of this from the repository. It is written down. Reading the codebase to
rediscover what the issue already says is wasted time.

---

## What you are given

- An issue number.
- The files you own. Nothing else is yours.
- The specific thing you are being asked to decide or produce.

If the brief does not say what to do, ask. Do not infer a larger task.

---

## The gate policy

**CI runs the full suite, the typecheck, the lint and the build on every pull request. Do not
re-run them locally unless you changed the thing that runs them.**

| You changed | Run locally |
|---|---|
| A source file | The test file for it. `bunx vitest run "<path>"` |
| A test file | That test file |
| A config file | The command that reads it, once |
| Documentation | Nothing |
| A script under `scripts/` | That script, once, against a scratch path or port |

The full `bun run test` takes over 400 seconds on this box and it is the single biggest source of
contention. Three agents running it at once is what pushed the load average past 17 and made
reviews time out. Run it once, at the end, only if your change plausibly affects it.

---

## Heavy gates

The full test suite, `next build` and any browser or Playwright run are heavy gates. **At most one
heavy gate runs at a time on this machine.** If one is running, wait for it. Do not start a second.

The coordinator owns the deployment on port 3100 and the dev server on port 3000. Do not stop,
restart or reconfigure either one, and do not start a server on those ports. Use a different port
and say which one you used.

---

## Working rules

- Work in the worktree you were given, on the branch you were given. Never edit the main
  checkout. Never touch another agent's worktree.
- Do not stage anything in the main checkout. Stage explicit paths, never `git add -A`.
- Do not commit to `master`. Do not force-push. If a branch needs to be brought up to date, merge
  `origin/master` into it rather than rebasing.
- The size guard in `lefthook.yml` measures the staged diff and cannot tell a merge commit from a
  feature commit, so it blocks merges over the limit. If you must commit a merge, commit it with
  `--no-verify` and say so in your report.
- Do not commit `todo.md`. It is git-ignored on purpose.
- Conventional commit messages, one logical change per commit, each under the 5000 token diff
  guard.
- Comments only where the code cannot show why. Explain why in the pull request, not in the code.
- Never add a suppression comment, an `any`, or a skipped test to make a check pass.
- Never edit a generated file by hand. Edit its source and regenerate.

---

## What actually protects the rules here, and what does not

This repository has one GitHub account. The agent and the human are the same identity, so the
owner of the rules is also whoever pushed the change.

That has two consequences you must know before you touch anything.

**There is no identity-based gate, and there cannot be one.** The ruleset on `master` requires a
pull request, green CI, no force pushes, and resolved conversations. It deliberately does not
require an approving review, because there is nobody who can give one that the pusher cannot
give. A gate every merge has to bypass with `--admin` is worse than no gate, because it teaches
the bypass.

**The real protection is the content check.** `bun scripts/audit-rules.ts` fails when a rule's
enforcing path or marker is gone. That works regardless of who is pushing, because it looks at
the repository, not at the identity. It is why the rules cannot be quietly deleted: deleting the
error boundary removes the marker, and the audit goes red.

So when a change touches the rules, the enforcement is the audit. Make sure it still passes. Do
not assume the platform is holding the line for you.

---

## Reporting

Report these, and nothing else:

1. The verdict. For a review, that is the finding that matters most, first.
2. Findings, each with a file and a line, and what to do about it.
3. What you changed, if you changed anything.
4. What you deliberately left, and why.
5. Anything you could not verify.

A finding you cannot back with a file, a line or a run is a question, not a finding. Say which it
is.

Do not summarise the change back to the reader. They wrote the brief.

---

## Judging a change

- The claim to check is the acceptance in the issue, not the pull request body. The body is what
  the author believes, and the point of a review is to disagree with it if it is wrong.
- Check the evidence in the pull request. A screenshot, a captured output, a measured number. If
  the evidence does not support the claim, that is the finding.
- Where a check can be made to fail, make it fail. A guardrail that has never fired is not proven.
- Do not fix what you were not asked about. Report it.
- Say plainly when something is fine. Padding a review with findings a reviewer had to dismiss
  costs the next reader the same time it cost you.
