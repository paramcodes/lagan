# Agent-ready repository setup

A checklist for starting a new project so that many coding agents can work on it in parallel
without ambiguity, and so that a wrong change cannot reach production.

The reasoning and the sources are in [2026-agent-workflow.md](./2026-agent-workflow.md). This file
is the practice. Apply it before the first agent runs, not after the first incident.

---

## The one idea

**A rule is only real when a mechanism acts on it. A rule with no artefact cannot be checked, so
it cannot be enforced, so it is a wish.**

And the measured reason this matters more than it sounds.
[ETH Zurich's evaluation of AGENTS.md](https://arxiv.org/abs/2602.11988) found that context
files do not improve task success on average and cost more than 20% more inference, and that
agents follow the instructions they are given. The agents obey. Obedience to a rule that does
not help is still a cost, because every sentence in the file is a commitment to extra agent
steps.

So the question is never "what should I write in the file". It is "what belongs in the file
rather than in a mechanism". Everything in this document is an answer to that question.

Your current repository is not short of rules. It is short of mechanisms, and of artefacts that
show whether a rule was followed.

---

## Step 1. Write the rule table, not the rules file

Before writing `AGENTS.md`, write a table. One row per rule. Four columns.

| Rule | Layer | Artefact that proves it | Observed failure that caused it |
|---|---|---|---|
| Branches are cut from `origin/master` | Git procedure | The branch's merge base | A stale local master produced a divergent branch |
| Visual changes carry a screenshot | Review artefact | The pull request comment | A layout regression shipped after the e2e suite passed |

Rules that cannot fill the last two columns are preferences. They belong in a design document,
not in the agent's runtime file. A rule with no failure behind it has not earned its place.

**Layer** is the mechanism, strongest first. Types and signatures, library primitives, runtime
invariants at a boundary, tests, lint rules, CI, prose. Put the rule at the strongest layer that
works for it. Prose is the last resort, and it is the right layer only when enforcement would be
late, partial, expensive or unreliable.

### The three strikes rule

Every incident increments a counter for its class.

- Strike one. Fix it locally. Write it in the incident log.
- Strike two. The class recurred. Change a type, or wrap the dangerous call in a primitive.
- Strike three. It is a pattern. Write a lint rule that points at the blessed primitive.

One low-consequence mistake does not justify a permanent rule. A recurring or high-consequence
failure does.

---

## Step 2. Make every check able to fail

A check that can silently disable itself is worse than no check, because it converts an unknown
into a false yes.

- No test file may skip silently in CI. Either it runs, or the build fails saying which file
  skipped and why.
- If a test needs a database, the CI job gets a database service. If it needs a credential, the
  job gets the credential.
- Print the count of skipped tests as a build summary line, not as a footnote.
- A linter rule that cannot autofix must still fail the build. A warning that nobody reads is
  a sensor with no gate.

Concretely, a check like this is a defect:

```ts
describe.skipIf(!process.env.DATABASE_URL)("queries against Postgres", () => { ... });
```

It is fine as a local convenience. It is not fine as the only coverage, because the environment
variable that enables it is exactly the thing that is missing when the deployment is wrong.

---

## Step 3. One canonical configuration source

One file. One loader. Every entry point uses it: the dev server, the build, the production
server, the test runner, and every script.

- No silent defaults that point at a plausible host. A default database URL is how a deployment
  talks to the wrong database without a single log line.
- A missing value fails at startup with a message naming the file and the variable.
- Log the resolved target once, at startup, so a mis-pointed deployment is visible in the first
  lines of the log. Never log a secret.
- The same loader must be reachable from the test runner, or the tests and the app can silently
  disagree about which database they are using.

---

## Step 4. Make the impossible thing impossible

For each recurring failure, ask which layer can remove the wrong state entirely rather than
detect it later.

- A page that must never render blank gets an error boundary. A blank page has no code path.
- A value that must come from a validated source gets a branded type, so the wrong one does not
  compile.
- A dangerous call gets wrapped once in a primitive, so the second and third call sites cannot
  get it wrong.
- A package boundary becomes a dependency rule a linter checks, not a paragraph in a document.

A runtime check that says "reject if wrong" leaves a path to forget. A type that cannot hold the
wrong value leaves nothing.

A rule that is only about packages needs a package-level tool. "Do not import from `packages/ui`
inside `packages/db`" is a paragraph until a tool checks it, at which point it is a constraint.
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) does this for JavaScript
and TypeScript, and [ArchUnit](https://www.archunit.org/userguide/html/000_Index.html) does it
for the JVM. Both enforce at module or package granularity, and both have a freeze mechanism
for grandfathering the violations a repository already carries.

---

## Step 5. Scope validation to the change

A flat gate list makes every small change pay the cost of the largest possible change. Replace
it with a ladder, and put the ladder in `AGENTS.md` so the agent knows which rung to use.

| Change touches | Run while iterating | Run before the pull request |
|---|---|---|
| Documentation | lint | lint |
| One package, no shared code | the affected test file | that package's tests, typecheck, lint |
| A shared package under `packages/` | the affected test file | the full suite, typecheck, lint |
| A route or a screen | the affected test file | the browser journey for that route |
| A schema or a migration | the affected test file | the full suite against a migrated database |

Say it the way the sources say it. "Run the tests" is a weak definition of done. "From
`apps/web`, run the affected Vitest file while iterating. Run the full workspace suite only when
the change touches a shared package under `packages/`" is a usable one.

---

## Step 6. Define done against the running artifact

A change is not done because a test passed. It is done when the surface it touched has been
observed in the running application.

- A route change means the route was driven in a real browser, not asserted on in a unit test.
- A query change means the query ran against the real database.
- A configuration change means the deployed process was started with it and logged its resolved
  target.
- A visual change means a screenshot exists. A performance change means two numbers with a unit.

Keep that journey as a checked-in script so the next agent runs the same one. A script in
`scripts/` that drives the real app is worth more than a paragraph in a document.

### Shape each done item as a behaviour, not a command

`bun run test` is a command. `the catalogue renders the three published courses with the author
name of each` is a behaviour. Only the second fails for the right reason, because a command with
a weak assertion under it passes on broken code.

### Write the check somewhere the agent cannot edit

The checklist, the hook and the existing tests live in files the agent does not own. A check the
agent can change is a check the agent can make pass without fixing anything.

### Record the build and launch recipe once

A script that builds, launches and drives the app to a named surface. Then "run the app and look
at the change" is a command, and the agent does not have to guess how the project starts.

### Use three layers, and require them in order

1. Static analysis, typecheck, lint. Cheapest, least information, must pass.
2. Runtime behaviour. Does it start, and does the critical path work.
3. System-level confirmation. Does the user journey work end to end.

An agent that passes layer 1 and declares done has declared victory too early. The harness
decides that, not the agent.

---

## Step 6b. Give every test an oracle the agent did not write

This is the single highest-leverage change to a test suite, and it is invisible until you look.

A test whose expected value came from the same prompt as the code repeats the code's mistakes.
It passes, and it proves nothing.

Three ways out, in increasing order of cost.

- **Assert on a value the agent cannot invent.** A literal expected string in the test, checked
  against a real value, beats a snapshot the agent also generated.
- **Hold the oracle in a file the agent does not own.** A fixture directory, a golden file, a
  reference database state.
- **Verify against the real thing.** A query test against a real database, with a literal
  expected row set.

The check to apply when reading a test. If the expected value could only have come from running
the code under test, the test has no oracle.

The published numbers for why this matters. [SWE-Bench+](https://arxiv.org/abs/2410.06992) found
31.08% of passed patches were suspicious because of weak test cases.
[UTBoost](https://arxiv.org/abs/2506.09289) found 345 erroneous patches labelled as passed,
touching 24.4% of SWE-bench Verified leaderboard entries.

SWE-bench's own contract gives the mechanical form. A test must fail before the fix and pass
after, which is called a FAIL_TO_PASS test. A test that passed before must still pass, which
is called PASS_TO_PASS. And the grader's tests are not shown to the agent at all.

For the diff review, read the changed tests with three questions. Does each one assert a value,
or only that the code ran. Did the diff weaken or delete an existing test. Does any expected
value look like it was produced by the same run as the code.

---

## Step 6c. Keep a task list with a pass and fail flag

[Anthropic's long-running harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
gives the shape.

> We prompted the initializer agent to write a comprehensive file of feature requirements
> expanding on the user's initial prompt. [...] These features were all initially marked as
> "failing" so that later coding agents would have a clear outline of what full functionality
> looked like.

> We prompt coding agents to edit this file only by changing the status of a passes field, and
> we use strongly-worded instructions like "It is unacceptable to remove or edit tests because
> this could lead to missing or buggy functionality." After some experimentation, we landed on
> using JSON for this, as the model is less likely to inappropriately change or overwrite JSON
> files compared to Markdown files.

Three decisions to copy. JSON, because a model overwrites Markdown more readily. The only
legal edit is a boolean, so the artifact cannot be rewritten to claim success. And tests are
explicitly protected by instruction.

The orientation procedure each agent runs, so no agent wakes up blind.

> 1. Run `pwd` to see the directory you're working in. 2. Read the git logs and progress files
> to get up to speed on what was recently worked on. 3. Read the features list file and choose
> the highest-priority feature that is not yet done to work on.

For a repository, the list is a feature file with one entry per user-visible behaviour, each
with a `passes` boolean, and a rule that the only permitted edit is flipping that boolean.

---

## Step 6d. Separate the worker from the grader

[Anthropic's harness design post](https://www.anthropic.com/engineering/harness-design-long-running-apps)
states why the reviewer has to be a different agent.

> When asked to evaluate work they've produced, agents tend to respond by confidently praising
> the work, even when, to a human observer, the quality is obviously mediocre. [...] Separating
> the agent doing the work from the agent judging it proves to be a strong lever.

> Out of the box, Claude is a poor QA agent. In early runs, I watched it identify legitimate
> issues, then talk itself into deciding they weren't a big deal and approve the work anyway.

Two things to do. The reviewer runs in a fresh context, so it is not anchored to the reasoning
that produced the change. And the contract is negotiated before the code, so both sides agree
what done means.

For a repository, that means a reviewer prompt that asks for gaps rather than for approval, a
fresh context per review, and the risk that a gap-seeking reviewer over-reports. Anthropic says
so, and the mitigation is to judge each finding on its merits rather than chasing all of them.

---

## Step 7. Ownership that the tooling can see

The rule "never two agents on the same file" only worked in a recent session because the
coordinator wrote an explicit per-item file manifest into every brief. The manifest was the
enforcement. The rule was not.

Replace it with three things.

- **Package-level ownership claims**, machine readable, that the tooling reads. A claim names a
  directory, not a list of files.
- **A pull request check** that reports files or packages also touched by another open pull
  request. A collision is then caught before the merge, not during it.
- **A named serial list** for the shared seams every change touches. The barrel file that
  re-exports a package. The migration folder. The lockfile. The token source. The workspace
  manifest. These are the files agents collide on most, and they are the files nobody thinks to
  exclude because they are one line long.

Ownership claims are per directory, because that is the granularity the instruction files use
and the granularity the tooling can check.

### The lock mechanism, which is what actually works

[Anthropic's C compiler post](https://www.anthropic.com/engineering/building-c-compiler) reports
the working answer to "two agents, one file" and it is almost too simple.

> Claude takes a "lock" on a task by writing a text file to `current_tasks/` (e.g., one agent
> might lock `current_tasks/parse_if_statement.txt`, while another locks
> `current_tasks/codegen_function_definition.txt`). If two agents try to claim the same task,
> git's synchronization forces the second agent to pick a different one.

A file in a directory, arbitrated by git. No coordination service, no database, no lock manager.
The claim is a file. The conflict is a push rejection. The agent already knows how to resolve a
push rejection, so the mechanism teaches nothing new.

The same source is honest about the cost. Merge conflicts are frequent, and the agents resolve
them.

### Parallelise only what decomposes

> When there are many distinct failing tests, parallelization is trivial: each agent picks a
> different failing test to work on. [...] But when agents started to compile the Linux kernel,
> they got stuck. [...] Every agent would hit the same bug, fix that bug, and then overwrite each
> other's changes. Having 16 agents running didn't help because each was stuck solving the same
> task.

So the rule for splitting work is not "find independent files". It is "find independent
problems". Two changes that both touch the same failing test are not parallel work, they are
the same work twice. Two changes that touch different files but the same root cause are the
same work twice.

When the work does not decompose, restructure it until it does, using a reference no agent
produced. Anthropic's fix was to compile most of the kernel with GCC and only the remaining
files with their own compiler, so each agent could tell whether the failure was in their files
or somewhere else.

For a repository, the equivalent is a known-good reference the agents compare against. The
production build. The database fixture. The reference screenshot.

### Do not build a merge queue

[Anthropic's source control post](https://www.anthropic.com/engineering/redesigning-source-control)
reports that at their scale, roughly 30,000 merged changes per day, a merge queue stops making
sense, and the check moves to after the merge and before the deploy. A rule built on a merge
queue will not hold once the agents scale, so build on post-merge verification instead.

---

## Step 8. Budget the machine, not the agent count

"Keep at least three agents in flight" is a rule written for a bigger machine. On a four-core
box it makes three agents wait on each other's builds.

Write the rule in terms of the scarce resource instead.

- Name the heavy gates: the full test suite, a production build, a browser run.
- Say how many may run at once on the stated hardware. One, on four cores.
- Say that the other agents keep editing while a heavy gate runs.
- Say that worktrees and dependency installs are prepared before the agents are dispatched, so
  three agents never compete on the install.
- Say how long a heavy gate takes on this machine, so an agent can tell a slow run from a hung
  one.

---

## Step 9. Keep an incident log

A single file, one row per incident, four columns.

| Date | What went wrong | Which rule would have caught it | What was added to make it structural | Strike count for the class |
|---|---|---|---|---|

Every "the gate passed and it was still wrong" gets a row. Every row either produces a rule with
a layer and an artefact, or is closed with a note that it did not earn one. The strike counter
lives in the last column.

Without this log the instruction file can only grow, and every rule in it has to be re-litigated
by whoever reads it next.

---

## Step 10. Layer the instruction files by scope

- The root `AGENTS.md` holds repository-wide context, the rule table, the validation ladder and
  the definition of done. It stays short. Anthropic's guidance is under 200 lines, and the
  practitioner convergence is 100 to 250 lines or under 500 tokens. Codex caps the combined chain
  at 32 KiB, and the practical ceiling for a file an agent reads on every single task is far
  lower.
- A nested `AGENTS.md` holds only subtree-specific additions and overrides. Scope is the unit.
  The pattern to copy is one nested file per package. The widely repeated figure of 88 such files
  in one large repository is unverified, the site names no repository, so treat the mechanism as
  the evidence and the number as folklore.
- Never repeat the parent's wording in a child. Review the combined chain, not each file alone.
- Keep the process for authoring and pruning these files out of the files themselves. A runtime
  file that tells agents how to maintain runtime files is a policy document in the wrong place.

---

## Step 11. Give every rule a comment, so it can be deleted later

[arXiv:2608.11095](https://arxiv.org/abs/2608.11095) measured why instruction files grow without
bound. Every instruction carries latent reasoning, the failure that motivated it, the hypothesis
and the outcome. At write time that reasoning is free. Months later, recovering it is
exponentially costly, so deletion feels unsafe, and the measurement confirms it. Older
instructions are *less* likely to be deleted, not more. A wholesale rewrite regrows to 91.5% of
its previous size within 10 commits.

The fix, measured in the same paper. An HTML comment on each instruction recording the failure
history, the hypothesis and the outcome removes 99.3% of the excess growth, taking +211.3% down
to +1.4%, and improves instruction following by up to 23.1%. The comment is invisible to the
model. It exists so a human can decide, weeks later, whether the rule still earns its place.

The paper's closing line. "If English is the new code, why don't we have comments yet?"

```markdown
- Commit with `--only <paths>`, never a plain `git commit`.
  <!-- 2026-04-11: a sibling session staged its own work between my `git add` and
       `git commit`, and my commit swept it in. Happened twice in one day.
       Hypothesis: the index is one shared file, so there is a race window.
       Outcome: `--only` has no window. No recurrence in 4 months. -->
```

Prune by ablation, and by contradiction rather than length. Archive the file, record which
mistakes actually repeat, restore only the lines that prevent them, move the rest into scoped
files and hooks, and re-run on each model change. The trigger for trimming is a rule that fights
another rule, because the model then picks a different one each session and the behaviour
becomes random and undebuggable.

---

## Step 12. Plan before code, in a file, as a checkable artifact

[CooperBench](https://arxiv.org/abs/2601.13295) measured this, and it is the cheapest win in
this document. A planning message in the very first turn nearly halves the conflict rate, 29.4%
against 51.5%, and the effect is larger for harder tasks, 39% at the highest difficulty bucket.

The practitioner economics are the reason it matters to you, not just to the agents. From a
review thread.

> What actually cut my review time: make the agent produce the plan first, in a file, before
> code. What's changing, what's out of scope, what should break if it's wrong. Then the diff gets
> read against that instead of against nothing. Half the time the plan is wrong and I kill it
> before any code exists, which is the cheapest review there is.

So the plan file has three parts. What is changing. What is out of scope. What should break if
it is wrong. That third part is the one agents skip, and it is the one that makes a plan
checkable.

---

## Step 13. Isolate the runtime, not just the code

Worktrees solve the code collision. Almost nobody stops there, and the runtime is where the
work is.

For each worktree, give it its own compose project name, its own ports derived from the branch,
its own seeded database, never a shared dump, and a teardown that is part of the task
definition rather than something you remember. Then the acceptance step is a single command
whose exit code the agent can read.

The rule that decides whether a task is parallelisable at all.

> If it can't self-verify in isolation, it isn't parallelizable.

Two things everyone forgets. Redis and queues, not just Postgres, because the cache and the
broker are shared state. And orphaned background workers, because a worker still running from
an earlier session will pick up another session's jobs and run them against old code. The fix
people use for that is a rule you have to remember, "which means it is not really fixed".

One warning from a production postmortem in the same corpus. Worktree isolation can remove
accidental shared state that the whole team was relying on. One team had a `node_modules` shared
by every worktree, and isolating it broke builds that "had worked locally for months". If your
worktrees each run their own install, that is a cost you pay on every agent. Symlink the
dependency directory to one shared location instead, and never commit the symlink.

---

## Step 14. Parallel feature work, serialised integration

The step most teams miss, and the one that would have caught the two agents in this session that
each believed they owned the test configuration.

- Feature work runs in parallel, in isolated worktrees, each with its own runtime.
- Integration is serialised. One merge at a time, in dependency order.
- The checks are run again on the combined tree, not only inside each worktree.

The pattern to use for the serialised part comes from Anthropic's source control post. A merge
queue does not survive agent scale, so the check moves to after the merge and before the
deploy.

---

## The order to do it in

1. The rule table, with the layer, artefact and failure columns. Nothing else until this exists.
2. The checks that can fail, and the configuration source that cannot be silently wrong.
3. The validation ladder and the definition of done.
4. The plan file, so a change is reviewed against an intent rather than against nothing.
5. The ownership claims, the runtime isolation, and the pull request check.
6. The incident log, kept from then on.
7. The instruction files, written last, from the rule table, with a comment on every rule.

Doing it in the other order, which is what most repositories do, produces a long instruction file
that describes a process nobody has made enforceable, and a set of checks that pass while the
layer they cover never runs.
