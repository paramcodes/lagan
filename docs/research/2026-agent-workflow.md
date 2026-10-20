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
`go build`, because the Makefile supplies linker flags an experienced Go developer would still
get wrong.

The same source states the definition-of-done problem.

> "Run the tests" and "make sure everything works" are weak definitions of done.

And the fix, drawn from Rails, which offers commands for a component's tests, one test file, an
individual test or line.

> For changes under `apps/web`, run the relevant Vitest file while iterating. Before completing
> the task, run `pnpm --filter web test`. Run the full workspace test suite only when the change
> touches a shared package under `packages/`.

### The rule that decides what stays out

[charlielabs, AGENTS.md instructions](https://docs.charlielabs.ai/llms-full.txt) states the
inclusion test and the pruning discipline.

> Add content when at least one of these tests is met: it has demonstrated behavioral value, or
> its absence has caused observable mistakes or wasted work. It defines a historically
> misunderstood or rare but high-consequence boundary. It provides durable company, product,
> customer, system, or operating context that changes which otherwise valid decision is best. It
> routes work correctly or reveals a valuable tool, workflow, entrypoint, or source an agent may
> not discover on its own.

> "Important information" alone is not an inclusion test. [...] Tune instructions to observed
> behavior rather than accumulating generic best practices. One low-consequence mistake rarely
> justifies another permanent rule; a recurring or high-consequence failure may.

It also states the ordering that decides the whole design.

> Use the earliest reliable intervention. Prefer code structure, types, linting, formatting,
> tests, or CI when they can enforce an invariant effectively. Keep a concise instruction when
> enforcement is late, partial, expensive, unreliable, or unclear enough that an agent still
> needs guidance.

And the governance rule that keeps instruction files from becoming a dumping ground.

> Keep authoring governance outside runtime files. Runtime content tells agents how to operate in
> the repository. The process for authoring, evaluating, and maintaining that content belongs in
> an external policy or review workflow.

> Do not paste meta-instructions such as "keep this file short," "avoid duplication," "maintain
> `AGENTS.md`," or "update this file when behavior changes" into runtime files. Size is a review
> signal, not the objective; retrieval and correct behavior are the objective.

That last one is a warning about this document. A research file that tells agents how to write
instruction files is authoring governance, and it belongs outside the runtime file.

---

## D. Structured specifications

[GitHub Spec Kit](https://github.github.io/spec-kit/reference/overview.html) ships a process
rather than a file, and the process is the interesting part.

Specify, clarify, plan, checklist, tasks, analyze, implement, converge. The artifacts are
Markdown files that feed each other, so the agent gets structured context instead of ad-hoc
prompts. The constitution is established once per project and every later phase is evaluated
against it.

Two parts are worth copying even without the toolkit.

`/speckit-analyze` is a read-only cross-artifact consistency check that reports a task with no
matching requirement, or a plan choice that contradicts the spec, and never edits files. The
instruction is to run it before implementing, while the artifacts are still cheap to change, and
to return to the earlier step that owns the problem rather than patching downstream.

`/speckit-converge` checks the codebase against the spec, the plan and the tasks. If it finds
gaps it appends new tasks and the implement step runs again, until it reports Converged. That is
a completeness loop an agent can run without a human, and it is the closest thing found to an
answer for "the agent said it was done and it was not".

[GitHub's blog post on Spec Kit, 2025-09-02](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
describes the change in reviewer role. The reviewer stops reading code dumps and starts
validating artifacts, at each phase, before the next one starts.

[Microsoft's walkthrough, 2025-09-15](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/)
adds the phasing rule that maps directly onto parallel work. Setup, then Foundational as
blocking prerequisites, then one phase per user story in priority order, then Polish for
cross-cutting concerns. Tasks inside a story phase are marked for parallel execution where
possible.

---

## E. Parallel work and collisions

### E1. The brief format

[The Anthropic multi-agent research system post, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system)
states what a worker needs, and what happens without it.

> Each subagent needs an objective, an output format, guidance on the tools and sources to use,
> and clear task boundaries. Without detailed task descriptions, agents duplicate work, leave
> gaps, or fail to find necessary information. [...] We started by allowing the lead agent to
> give simple, short instructions like "research the semiconductor shortage," but found these
> instructions often were vague enough that subagents misinterpreted the task or performed the
> exact same searches as other agents.

Four required fields. Objective, output format, tool and source guidance, task boundaries. The
failure it names, two agents running the same searches because nobody said which was which, is
the same failure as two agents editing the same package.

The same post also separates what multi-agent systems are good at from what they are not.

> Multi-agent systems work mainly because they help spend enough tokens to solve the problem.
> [...] some domains that require all agents to share the same context or involve many
> dependencies between agents are not a good fit for multi-agent systems today. For instance,
> most coding tasks involve fewer truly parallelizable tasks than research.

And its evaluation principle, which is the right frame for a review rule.

> We found success focusing on end-state evaluation rather than turn-by-turn analysis. Instead
> of judging whether the agent followed a specific process, evaluate whether it achieved the
> correct final state.

### E2. The strongest primary source on the whole problem

[Anthropic, "Building a C compiler with a team of parallel Claudes", 2026-02-05](https://www.anthropic.com/engineering/building-c-compiler).
Sixteen agents, roughly 2,000 Claude Code sessions, $20,000, two weeks, and a 100,000-line C
compiler that builds Linux 6.9. This is the closest published account of many agents writing
code on one repository.

The lock mechanism is the part to copy.

> To prevent two agents from trying to solve the same problem at the same time, the harness uses
> a simple synchronization algorithm: Claude takes a "lock" on a task by writing a text file to
> `current_tasks/` (e.g., one agent might lock `current_tasks/parse_if_statement.txt`, while
> another locks `current_tasks/codegen_function_definition.txt`). If two agents try to claim the
> same task, git's synchronization forces the second agent to pick a different one.

A file in a directory, arbitrated by git. Not a coordination service. And the source is honest
about the cost: "Merge conflicts are frequent, but Claude is smart enough to figure that out."

The finding that explains the slow fan-out, in the source's words.

> Make parallelism easy. When there are many distinct failing tests, parallelization is trivial:
> each agent picks a different failing test to work on. [...] But when agents started to compile
> the Linux kernel, they got stuck. Unlike a test suite with hundreds of independent tests,
> compiling the Linux kernel is one giant task. Every agent would hit the same bug, fix that bug,
> and then overwrite each other's changes. Having 16 agents running didn't help because each was
> stuck solving the same task.

The fix was not more coordination. It was to restructure the task so it decomposes, using an
external known-good oracle.

> The fix was to use GCC as an online known-good compiler oracle to compare against. [...] This
> let each agent work in parallel, fixing different bugs in different files.

Two rules fall out of that. A task that does not decompose into independent units gets no
speedup from agents and causes overwrites. Parallel work needs a shared reference that is not
produced by any of the agents.

The verification-quality finding is the one that indicts a green build.

> Write extremely high-quality tests. Claude will work autonomously to solve whatever problem I
> give it. So it's important that the task verifier is nearly perfect, otherwise Claude will
> solve the wrong problem.

And the closing warning.

> When a human sits with Claude during development, they can ensure consistent quality and catch
> errors in real time. For autonomous systems, it is easy to see tests pass and assume the job
> is done, when this is rarely the case.

The same source is candid about what it did not do. "I don't use an orchestration agent. Instead,
I leave it up to each Claude agent to decide how to act."

### E3. A machine-readable task list with pass and fail state

[Anthropic, "Effective harnesses for long-running agents", 2025-11-26](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
describes a two-role split, an initializer that writes the task file and a coding agent that
executes it.

> We prompted the initializer agent to write a comprehensive file of feature requirements
> expanding on the user's initial prompt. In the claude.ai clone example, this meant over 200
> features, such as "a user can open a new chat, type in a query, press enter, and see an AI
> response." These features were all initially marked as "failing" so that later coding agents
> would have a clear outline of what full functionality looked like.

> We prompt coding agents to edit this file only by changing the status of a passes field, and we
> use strongly-worded instructions like "It is unacceptable to remove or edit tests because this
> could lead to missing or buggy functionality." After some experimentation, we landed on using
> JSON for this, as the model is less likely to inappropriately change or overwrite JSON files
> compared to Markdown files.

Three design decisions worth copying. The file is JSON, because a model overwrites Markdown
more readily. The only legal edit is a boolean flag, so the artifact cannot be rewritten to
claim success. And tests are explicitly protected.

The failure mode it names is this repository's exact failure mode.

> One final major failure mode that we observed was Claude's tendency to mark a feature as
> complete without proper testing. Absent explicit prompting, Claude tended to make code
> changes, and even do testing with unit tests or `curl` commands against a development server,
> but would fail recognize that the feature didn't work end-to-end.

And the orientation procedure every session runs, which answers the "each agent wakes up blind"
problem.

> 1. Run `pwd` to see the directory you're working in. 2. Read the git logs and progress files
> to get up to speed on what was recently worked on. 3. Read the features list file and choose
> the highest-priority feature that is not yet done to work on.

### E4. The grader must not be the worker

[Anthropic, "Harness design for long-running application development", 2026-03-24](https://www.anthropic.com/engineering/harness-design-long-running-apps)
states the separation and the reason.

> When asked to evaluate work they've produced, agents tend to respond by confidently praising
> the work, even when, to a human observer, the quality is obviously mediocre. [...] Separating
> the agent doing the work from the agent judging it proves to be a strong lever.

> Out of the box, Claude is a poor QA agent. In early runs, I watched it identify legitimate
> issues, then talk itself into deciding they weren't a big deal and approve the work anyway.

The contract mechanism is a negotiated per-chunk agreement, written before the code.

> Before each sprint, the generator and evaluator negotiated a sprint contract: agreeing on what
> "done" looked like for that chunk of work before any code was written.

And the source's own example of a bug that only end-to-end evaluation caught, a FastAPI route
declared after a parameterised route so the parameter swallowed the literal. It is the same
shape as this repository's blank catalogue page, and it is invisible to a unit test.

The cost, stated plainly. A full harness with a separate evaluator ran 6 hours and $200 against
20 minutes and $9 for a solo run, and the source calls it over 20x more expensive. The
difference in output quality was, in the source's word, immediately apparent.

The source also names the property that matters for a rule set.

> Every component in a harness encodes an assumption about what the model can't do on its own,
> and those assumptions are worth stress testing, both because they may be incorrect, and
> because they can quickly go stale as models improve.

### E5. The benchmark contract

[OpenAI, "Introducing SWE-bench Verified", 2024-08-13](https://openai.com/index/introducing-swe-bench-verified/)
defines the grading contract every harness in this space borrows.

> These unit tests fail before the solution code in the PR is added, but pass afterwards, and
> are therefore called FAIL_TO_PASS tests. Each sample also has associated PASS_TO_PASS tests,
> which pass both before and after the PR is merged, and are used to check that existing
> unrelated functionality in the codebase has not been broken by the PR.

> The tests are not shown to the agent. A proposed edit is evaluated by running both the
> FAIL_TO_PASS and PASS_TO_PASS tests. [...] Both sets of tests are required to pass for the
> edit to fully resolve the original GitHub issue.

Three consequences. A test must fail before the fix, or it proves nothing. A test that passed
before must still pass, or the change broke something. And the grader's tests are hidden from
the agent, which is the oracle separation in mechanical form.

The same source's measurement of issue quality is the argument for writing issues carefully.
38.3% of samples were flagged for underspecified problem statements, 61.1% for unit tests that
may unfairly mark valid solutions incorrect, and 68.3% of the original dataset was filtered
out for those reasons. The agent can be right and fail.

### E6. How often "the tests pass" is wrong

The three numbers that make the case.

[SWE-Bench+, arXiv:2410.06992, 2024-10-09](https://arxiv.org/abs/2410.06992). 32.67% of
successful patches involved solution leakage, and 31.08% of the passed patches are suspicious
because of weak test cases.

[UTBoost, arXiv:2506.09289, 2025-06-10](https://arxiv.org/abs/2506.09289). 345 erroneous
patches were incorrectly labelled as passed, affecting 24.4% of SWE-bench Verified
leaderboard entries and 40.9% of SWE-bench Lite.

[Anthropic, "Demystifying evals for AI agents", 2026-01-09](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
gives the vocabulary and the diagnostic. The outcome is the state in the environment, not the
agent's claim. A 0% pass rate across many trials is most often a signal of a broken task rather
than an incapable agent. And a grader needs a reference solution, a known-good output that
passes it, which proves the task is solvable and the grader is configured correctly.

### E7. The live disagreement about parallel writers

Cognition's [argument against multi-agents](https://cognition.ai/blog/dont-build-multi-agents),
2025-06-12, rests on two principles. Share context and share full agent traces, not just
