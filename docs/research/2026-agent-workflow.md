# Lagan — 2026 agent workflow research

Decision-first research on how to structure a repository and its rules so that many agents can
work in parallel without ambiguity and without shipping wrong code.

Method: primary sources only for external claims. Local findings are measured on this repository.
Every external claim cites the source that owns it, with its publication date. A claim I could
not trace to a primary source is marked `UNVERIFIED:`.

This file is the research record. The recommendation for the next project is in
[the working note](./2026-agent-workflow-recommendation.md).

---

## Recommendation summary

**Pick:** Rules that name the artifact that proves they were followed, backed by the cheapest
mechanism that can check that artifact. Prose only where enforcement would be unreliable.

**Runner-up:** A written spec per change, with machine-checkable acceptance criteria, generated
before implementation. Stronger intent control, much more author cost.

**Trap:** A sensor that can silently disable itself. A test suite that skips is worse than no
test suite, because it converts an unknown into a false yes.

**Second trap:** A rule with no artifact. "Keep three agents in flight" and "no two agents touch
the same file" cannot be checked, so they cannot be enforced, so they are wishes. Every rule
worth keeping must name what proves it was followed.

**Third trap, and the one with the strongest evidence.** Writing rules into an instruction file
is not neutral. The measured result from ETH Zurich is that context files do not improve task
success on average and cost more than 20% more inference, and that agents follow the
instructions they are given. So every sentence in the file is a commitment to extra agent steps,
and obedience to a rule that does not help is still a cost. The fix is not better prose. It is
moving the rule out of the file and into a mechanism.

---

## A. The failure class the team actually hit

Measured on this repository, 2026-10-20.

The report was "Explore Courses shows nothing". The catalogue route was exercised in every path
that could be driven: landing to courses by the header link, the hero link and the footer link, a
direct load, a reload, a back-then-forward navigation, signed out and signed in, light and dark,
1440px and 390px, on a production build and a dev server, and over the LAN address. The RSC
payload was failed and aborted on purpose, and the catalogue still rendered, because Next.js
falls back to a full browser navigation. A stale client was simulated by failing every chunk
request, and the page still rendered.

Every automated gate passed throughout. The pre-commit hook ran format, lint, typecheck and a
diff size guard. The unit suite passed. The e2e suite passed. The axe accessibility suite
passed. The visual evidence capture produced screenshots.

The reachable defects were all below the gate line.

| Defect | Why the gates missed it | Enforcement layer that was missing |
|---|---|---|
| `(app)` route group has no error boundary, so a server failure renders a blank page | No test asserts that a failing query produces a usable page | Runtime invariant at the boundary |
| `lib/db.ts` falls back to a hard-coded database URL when `DATABASE_URL` is unset, and the root `.env` is never read by `next start` inside `apps/web` | No test asserts which database the app talks to | Runtime invariant, plus one canonical config source |
| The four Postgres integration test files skip when `DATABASE_URL` is unset, and the CI `verify` job does not set it | The skip was silent, so the suite reported success while covering nothing | Sensor that cannot silently disable |

The third row is the transferable one. An enforcement mechanism that can turn itself off without
failing gives false confidence, and false confidence is worse than no mechanism because it
removes the pressure to look.

---

## B. Enforcement layers

The constraint escalation ladder from
[understandingdata.com, "The Constraint Escalation Ladder: Choosing the Right Prevention Layer",
2026-02-27](https://understandingdata.com/posts/constraint-escalation-ladder/) orders the
prevention options from strongest to weakest.

| Level | Mechanism | Cost | Catches |
|---|---|---|---|
| 1 | Types and signatures | Upfront design | Category errors, wrong shapes |
| 2 | Library primitives | One wrapper | Dangerous calls scattered across the codebase |
| 3 | Runtime invariants | Small, at boundaries | Constraints types cannot express |
| 4 | Tests | Per behaviour | Behavioural regressions |
| 5 | Lint rules | Fast, structural only | Repeated structural anti-patterns |

The same source gives the escalation discipline that matters most here, the three strikes rule.

- Strike 1. Fix it locally. Note that it happened.
- Strike 2. The same class of bug appeared twice. Invest in a type or a primitive.
- Strike 3. Three times means it is a pattern. Ban it with a lint rule that points at the
  blessed primitive.

[MAGE, "Constraints, Sensors, Validators, and Gates"](https://davisjam.github.io/model-based-agentic-software-engineering/book/mage-book/3.3-constraints-sensors-validators-gates.html)
gives the vocabulary the same way, and states the rule that decides everything else in this
document.

> An instruction is enforced only when a mechanism in the environment acts on it. If a brief must
> contain a required section, check for that section before launch and refuse the launch when it
> is absent.

It separates four roles. A constraint removes or narrows an action the agent is allowed to
express. A sensor observes what happened and produces evidence. A validator evaluates that
evidence against an obligation. A gate controls whether the work crosses a boundary.

The preference the source states is explicit. Prefer a constraint where the unwanted state can be
excluded cheaply and reliably. Otherwise expose enough evidence for the obligation to be
evaluated at a later boundary.

It also notes that a CI test suite usually bundles three of the four roles. Executing the code
is the sensor, the assertion is the validator, the failing build is the gate.

### The oracle problem

[Specstory, "How to test AI-generated code"](https://specstory.com/learning/verification/ai-generated-code-testing)
adds the concept that explains a whole class of false passes.

> Each check needs a test oracle, the source of the expected result, that the agent did not
> write. A test that the agent wrote from the same prompt tends to repeat its mistakes.

This repository's catalogue test is a textbook case. `apps/web/app/(app)/courses/page.test.tsx`
mocks `./query` and asserts the page renders the mock. The agent wrote the mock, the test and
the page. The oracle was the agent's own, so the check could only confirm that the agent was
consistent with itself. The real query, against a real database, ran in no test at all.

The same source's table of which check catches which failure is the most directly actionable
artifact found in this research.

| Agent failure | Caught by | Missed by |
|---|---|---|
| A test edited or deleted so the suite passes | Reading the diff | Running the tests |
| Tests that assert almost nothing | Reading the tests, or mutation testing | Running the tests |
| A "done" report with no passing run | Running the tests yourself | Reading the agent's summary |
| A broken workflow next to the change | Running the software | Tests that do not cover it |
| A package that only the agent's machine had | A fresh environment | The agent's own session |
| An edit the request did not ask for | Reading the diff | Running the software |
| An added dependency that is not the intended package | Checking each added package in the registry | Running the tests |

The first two rows are the ones that turn a green build into a false signal. A test with no real
assertion passes on broken code. A test the agent wrote from the same prompt repeats the
agent's mistake.

### What this repository had

Predominantly sensors. The pre-commit hook, the unit suite, the e2e suite, the axe suite and the
visual evidence capture are all sensors with validators attached. The gates were the pre-push
hook and the CI job. Almost nothing was a constraint, because nothing constrained the agent at
the point of writing.

The one genuinely mechanical constraint in the repository was the diff size guard in
`lefthook.yml`. It held on every commit. It also produced a worse outcome than the rule wanted,
because the 1914-line seed script had to be split into six commits that told a reviewer
nothing. Enforcement can be mechanically correct and still work against the goal. The rule it
encoded, a commit that stays under 5000 tokens, was aimed at reviewability, and it optimised the
wrong quantity.

---

## B2. Definition of done

[Specstory, "Definition of done for AI coding agents", 2026-09-29](https://specstory.com/learning/verification/definition-of-done-for-coding-agents)
states the problem as a measurement, and the numbers below are that source's, reported rather
than independently reproduced here.

> One developer audited 516 such claims from his own sessions and found no passing test run
> behind 65 to 69% of them, depending on how strictly they were counted.

> A coding agent's final message can say "done" when nothing has checked the final code.

The same source gives the failure mode of a definition of done, and the reason it must live
outside the agent's reach.

> Checks the agent can edit are weak. If the agent can change the checklist, the hook, or the
> existing tests, it can make items pass without fixing the code. A safer setup keeps the
> checklist and the hook in files the agent cannot change, and checks the diff for edits to
> existing tests.

> An item can pass without checking anything. A test with no real assertion passes on broken
> code, which is a false pass. Items that name the behavior to check, not only the command to
> run, are harder to pass with an empty test.

The two-shape rule for a done item. Name the behaviour to check, not only the command to run.
`bun run test` is a command. `the catalogue renders the three published courses with the author
name of each` is a behaviour. Only the second can fail for the right reason.

[Learn Harness Engineering, lecture 9](https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-09-why-agents-declare-victory-too-early/)
gives the same idea a name and a shape. Premature completion declaration, where the agent
judges from local code-level confidence while system-level correctness needs global
verification. The fix is to externalize the termination judgement, so the harness runs the
termination validation rather than the agent asserting it.

Its three layers map cleanly onto a repository layout.

| Layer | Question | Cost |
|---|---|---|
| Syntax and static analysis | Is it well formed | Lowest |
| Runtime behaviour verification | Does it run and do the critical path | The core evidence |
| System-level confirmation | Does the user journey work end to end | Highest |

The [Tarmac write-up, 2026-07-30](https://www.tarmac.io/resources/definition-of-done-humans-and-agents/)
states the contract in one line.

> Done is not a state of mind. It is a set of checks that returned green. If you cannot name the
> command that proves a change works, the change is not done, and "I ran it locally" is the
> confession, not the defense.

Its four gates are ordered by cost, so the expensive ones only see what the cheap ones could
not. Local pre-flight behind one command, then the pull request, then CI on a clean checkout,
then deploy.

The vendor answer now ships as a tool. [Claude Code v2.1.145](https://wmedia.es/en/tips/claude-code-run-verify-app)
bundles a `/verify` skill whose own instruction is.

> Verification is runtime observation. Don't run tests. Don't typecheck. Running them here proves
> you can run CI, not that the change works.

and a `/run-skill-generator` that records the project's build and launch recipe so the run step
never guesses. The skill resolves the change scope from the diff, builds, launches, drives to
the surface where the change manifests, and captures the response and a screenshot. It reports
`SKIP, no runtime surface` for documentation and type-only changes, which is the honest answer
for those.

The practical rule to copy. Record the build and launch recipe once, as a script. Then "run the
app and look at the change" becomes a command rather than an instruction.

### The measured size of the problem

Reported by [Specstory](https://specstory.com/learning/verification/ai-generated-code-testing),
which cites the underlying studies. These are the source's figures, not reproduced here.

- 2026 study of 86,156 changes to test files by five coding agents. 80.2% had weak or no
  explicit oracle signals. Many of those tests ran code while checking little or nothing about
  its output.
- 2026 study of 33,596 pull requests opened by coding agents. Failing CI or tests was the most
  common code-level reason for rejection, 17.6% of rejected pull requests analysed.
- Stack Overflow 2025 survey. 66% of the developers who answered had hit AI output that was
  almost right but still wrong.

Caveat worth stating. Most of the advice in this section is a rule, not a measurement. The
sources say so directly: "The sources contain no measurements of the effect: only rules and
instructions, with no data on the result." The three numbers above are the exception.

---

## C. Instruction files

[agents.md](https://agents.md/) is the open format, used by over 60k repositories, and the
documented advice is deliberately minimal. Project overview, build and test commands, code
style, testing instructions, security considerations, and anything else a new teammate would
need to know.

[OpenAI Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
documents the precedence chain. Global scope first, then the project scope walking down from the
repository root to the current working directory. In each directory Codex reads
`AGENTS.override.md`, then `AGENTS.md`, then fallback names, at most one file per directory.
Files concatenate from the root down, so the closest file wins. The combined size stops at
`project_doc_max_bytes`, 32 KiB by default.

The same page records scope as the unit rather than the file, and points at nesting an
`AGENTS.md` per package in a large monorepo. The widely repeated figure of 88 nested files in
one large repository is `UNVERIFIED:` the site names no repository, and the count could not be
reproduced across the public OpenAI repositories on 2026-10-20. The mechanism is verified. The
number is not.

### The rule that decides what goes in the file

[AAIF, "Writing an effective AGENTS.md for Coding Agents", Steve Kearns, 2026-08-13](https://aaif.io/blog/writing-an-effective-agents-md)
states it as a test for every instruction.

> For each instruction, ask whether knowing it would change what the agent does. If not, the
> information may belong somewhere else.

It gives the concrete version of the same idea, a vague instruction versus a usable one.

| Vague | What is missing | Usable |
|---|---|---|
| Run the tests. | Which tests, where and when | From `services/api`, run the affected test file while iterating. Run `pytest tests/` before completing an API change. |
| Do not edit generated code. | Which code is generated | Do not edit `packages/client/generated/`. Change `schemas/openapi.yaml`, then run `pnpm generate:client`. |
| Follow the existing architecture. | Which boundary | `packages/core` must not import from `packages/ui`. Shared code belongs in `packages/core`. |
| Use the standard build process. | What is standard here | Run `make build` from the repository root. Do not use `go build`; the wrapper supplies required build metadata. |

It draws the conclusion that Kubo's `AGENTS.md` shows by pointing at `make build` instead of
