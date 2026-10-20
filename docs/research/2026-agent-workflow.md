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
individual messages. And actions carry implicit decisions, and conflicting decisions carry bad
results.

[LangChain, 2025-06-16](https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems)
splits the disagreement usefully. Multi-agent systems that primarily read are easier than those
that write, because read actions are inherently more parallelizable and write actions need
context shared and outputs merged coherently.

[OpenAI, "A practical guide to building agents", 2025-04](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
says to maximize a single agent first, and gives the two split criteria. Complex logic, and
tool overload, which it defines as similarity between tools rather than their number.

[Codex subagents documentation](https://developers.openai.com/codex/subagents) makes the
distinction operational. Use parallel agents for read-heavy tasks, be more careful with parallel
write-heavy workflows.

Both tool authors have since shipped write-heavy parallel agents, which changes the shape of the
argument. Anthropic's C compiler, with file locks and an external oracle.
[Cognition's "Manage Devins", 2026-03-19](https://cognition.ai/blog/manage-devins), where each
managed Devin runs in its own isolated virtual machine and the main session acts as a
coordinator that scopes the work, assigns pieces, monitors progress, resolves conflicts, and
compiles the results. Cognition's stated reason is that a single agent handling too much
accumulates context and degrades focus, so each managed Devin gets a clean slate and a narrow
focus.

What the disagreement turns on is whether the shared decision surface is one codebase whose
artifacts must be mutually consistent, or a set of independent units with an external
reference. Anthropic converted the first into the second with a known-good oracle. Cognition
re-centralises the decisions in a coordinator. Neither claim is independently measured.

The rule that follows for a repository. Parallelise read-heavy and independent-direction work
freely. Parallelise write-heavy work only when the units are genuinely independent and
verified against a reference no agent produced.

### E8. Merge queues do not survive agent scale

[Anthropic, "Redesigning source control at Anthropic", 2026-10-13](https://www.anthropic.com/engineering/redesigning-source-control)
reports the scale. Around 2,500 code changes merged per day in May 2026, over 30,000 per day
by September, and on the order of 25 million code checkouts per day for CI. Replacing git with
Scion made checkouts two orders of magnitude faster, and CI alone realised a 25% CPU capacity
win.

The part that matters for a fan-out rule.

> A proper merge queue, for example, doesn't make much sense at agent scale. What does CI even
> mean when hundreds or even thousands of changes can merge while tests are running? [...] so
> instead, we've invested in post-merge and pre-deploy automated testing. This does mean that
> concurrent changes can conflict, but Claude can typically fix these conflicts faster than
> humans can even identify them.

Two takeaways. A merge queue is a poor coordination mechanism at agent scale, so a rule built
on one will not hold. And the check moves to after the merge, not before it.

### E9. Phasing

[Microsoft's walkthrough, 2025-09-15](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/)
adds the phasing rule that maps directly onto parallel work. Setup, then Foundational as
blocking prerequisites, then one phase per user story in priority order, then Polish for
cross-cutting concerns. Tasks inside a story phase are marked for parallel execution where
possible.

---

## F. Local audit of the current rules

Every rule in this repository's `AGENTS.md`, scored against what actually happened.

| Rule | Layer | Artifact that proves it | Verdict |
|---|---|---|---|
| Main agent coordinates, does not implement | Prose | None | Low value for small changes, no way to check |
| One issue and one worktree per subagent | Prose plus a real worktree | The worktree path | Held |
| Branch from `origin/master` | Convention | The branch's merge base | Held |
| Commit under 5000 tokens of diff | **Lint, mechanical** | The size guard output | Held, and made the history worse |
| No comments except where required | Prose | None | Held, low stakes |
| Run install, typecheck, test, lint | **Sensor, unscoped** | The gate output | Cost 30 min of contention, caught nothing |
| PR body has What, Why, How | Artefact | The PR body | Held |
| Reviewer re-runs gates, then squash-merges | Prose plus a role | The merge commit | Duplicated the gate cost |
| Keep at least three subagents in flight | Prose | **None** | Caused the oversubscription, no way to check |
| Never two agents on the same file or package | Prose | **None** | Held only because the coordinator wrote an explicit per-item file manifest |
| Never force-push, never commit to master | Prose | None | Was broken once for a coordination file, at no cost |
| Every change carries tests | Prose | The test file | **False compliance.** Four test files existed and skipped |
| Visual changes need a screenshot | Artefact, checked at review | The PR comment | Highest-value rule in the file |
| Perf changes need measured numbers | Artefact, checked at review | The PR comment | Held |

The pattern is consistent. Every rule that produced value was tied to an artefact that a
reviewer could look at. Every rule that produced nothing was tied to a process state, and a
process state has no artefact, so there is nothing to check.

**A rule that produces no artifact cannot be enforced and cannot be audited.** The fix is to
give every surviving rule an artefact column.

---

## G. What to do differently

### G1. Give every rule an artefact column

A rule table with four columns. The rule, the layer that enforces it, the artefact that proves it
was followed, and the observed failure that caused it to exist. A rule that cannot fill the
artefact and the failure columns is a preference, and belongs in a design document, not in
`AGENTS.md`.

### G2. Enforce at the earliest reliable layer

The escalation ladder, applied in order. A database URL that must be present becomes a
primitive that throws, not a README line. A page that must not render blank becomes an error
boundary, not a review reminder. A repeated structural mistake becomes a lint rule, not a third
prose paragraph.

### G3. Make every check able to fail

A test that skips must be visible. Options that work: fail the build when the expected number of
tests ran, print a loud summary line naming the skipped files, or run a strict mode in CI where
a skip is a failure. The rule is that a sensor reports its own coverage, and a silent skip is a
defect in the sensor.

### G4. One canonical configuration source

One file, one loader, used by the dev server, the build, the production server, the test runner
and every script. No silent defaults that point at a plausible host. When the value is missing,
fail at startup with a message that names the file and the variable.

### G5. Scope validation to the change

Replace the flat gate list with a ladder. A documentation change needs lint. A change inside one
package runs that package's tests. A change to a shared package runs the full suite. A change to
a route runs the browser journey for that route. The current flat rule made every small change
pay the 6.7-minute floor.

### G6. Make ownership machine-readable

The current rule names files, and it held in this session only because the coordinator wrote an
explicit per-item file manifest into every brief. That manifest was the enforcement, not the
rule.

Replace the rule with three things. A package-level ownership claim that the tooling reads. A
CI check on each pull request that reports files or packages touched by another open pull
request, so a collision is caught before merge rather than during. And an explicit serialised
list for the shared seams that every change touches, the barrel files, the migration folder, the
lockfile, the token source.

### G7. Budget the machine, not the agent count

Replace "keep at least three subagents in flight" with a resource rule. Name the heavy gates,
the full test suite, a production build, a browser run. Say that at most one runs at a time on a
four-core machine, and that the other agents keep editing. Say that worktrees and dependency
installs are prepared before dispatch, so three agents do not compete on the install.

### G8. Define done against the running artifact

A change is not done because a test passed. It is done when the surface it touched has been
observed in the running application. A route change means the route was driven in a browser. A
query change means the query ran against the real database. A configuration change means the
deployed process was started with it. This is the check the current repository was missing, and
it is the one that would have caught the blank catalogue page.

### G9. Keep an incident log

Every near miss and every "the gate passed and it was still wrong" gets an entry. Each entry
either produces a rule with a layer and an artefact, or is closed as not worth a rule. The
three-strikes counter lives here. Without this log the instruction file can only grow.

---

## I. The measured evidence

This section carries the studies that quantify the claims in the sections above. Everything here
is either peer-reviewed, benchmarked, or large-n telemetry. Sources that are opinion pieces or
single anecdotes are excluded here and handled in section J.

### I1. Instruction files do not improve success, and they cost

[ETH Zurich SRI Lab, "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding
Agents?", arXiv:2602.11988, v1 2026-02-12, v3 2026-09-29](https://arxiv.org/abs/2602.11988)

> we find that providing context files does not generally improve task success rates, while
> increasing inference cost by over 20% on average. This observation holds across different
> LLMs, coding agents, and for both LLM-generated and developer-committed context files.
> Specifically, we find that while instructions in the context files are well followed by coding
> agents, repository overviews, although popular and recommended by model providers, are not
> helpful.

This is the finding that reframes the whole question, and it is worth stating the logic
explicitly, because the instinct it contradicts is strong.

The failure mode is not disobedience. The agents follow the instructions. The failure mode is
that the instruction is the wrong place for the rule. Obedience to an unnecessary rule is not
free. It is a commitment to extra agent steps, and the paper measures the cost of those steps.

The companion reading of the same study, by [Daniel Vaughan, "The AGENTS.md Bloat Problem",
2026-03-27](https://codex.danielvaughan.com/2026/03/27/agents-md-bloat-problem/), puts the
consequence in one phrase. "Coding agents are too obedient." An instruction that says "run the
full test suite before each commit" is followed religiously, even on a task where running tests
is entirely irrelevant.

The practitioner convergence is the same finding in a postmortem. From r/ClaudeAI, "What's the
one line in your CLAUDE.md that made the biggest difference?", 1.4k votes, 185 comments:

> The biggest difference for me came from moving a line out of it. A "never run rm -rf, never
> force push" line is a request, and when I replayed two months of my sessions the agent had
> still tried rm -rf 117 times. What actually holds for the never-list is a PreToolUse hook: a
> small script that checks the Bash command before it runs and exits 2 on a match. Claude can't
> talk its way past exit 2, and CLAUDE.md goes back to being about style and taste, which is what
> it's actually good at.

117 attempts. The prose was ignored, and the mechanism holds.

### I2. Two agents on overlapping work is worse than one agent doing both

[CooperBench, "Why Coding Agents Cannot be Your Teammates Yet", Khatua, Zhu, Yang, Stanford and
SAP, arXiv:2601.13295, 2026-01-19](https://arxiv.org/abs/2601.13295)

> leading agents achieve only 25% with two-agent cooperation on CooperBench, which is around 50%
> lower than a "Solo" baseline which uses one agent to implement both features.

Three failure classes, all of which this repository has exhibited. Expectation failures, where
the work overlaps and overwrites silently. Commitment failures, where one agent makes an
unverifiable claim. Communication failures.

And the measured cost of the conversation itself. Agents spent as much as 20% of their steps in
communication, within which planning, questioning and updating each took about a third of the
steps.

[Anthropic, "Patterns and problems in emerging multiagent systems", 2026-08-13](https://www.anthropic.com/research/multiagent-systems)
reaches a compatible conclusion from a different direction. Newer models reduced conflicts by
maintaining very high ownership of each of their files, "reducing the potential for conflict",
and only the most recent model both shared files and kept PR throughput. The conflict problem
was solved by not working together.

One finding from the same paper is the cheapest win available. A planning message in the first
turn nearly halves the conflict rate, 29.4% against 51.5%, and the effect is larger for harder
tasks, 39% at the highest difficulty bucket.

### I3. The instruction file grows without bound and cannot be pruned by discipline

[Chakrabarti, "Why Does CLAUDE.md Keep Growing? Catastrophic Remembering in Agentic Coding",
arXiv:2608.11095, 2026-08-11](https://arxiv.org/abs/2608.11095). 247,694 instruction lifetimes
across 1,867 public repositories.

- Median instructions per file, final snapshot: 39. 90th percentile: 131.
- Lifetime growth in instruction count: +226%. Net +4.9 instructions per commit.
- After a wholesale rewrite the file regrows to 91.5% of its previous size within 10 commits,
  and regrows faster than before the rewrite.
- Deletion hazard: log slope −0.032 per commit. Older instructions are *less* likely to be
  deleted, not more, which rules out staleness as the driver.

The mechanism explains the deletion hazard. Every instruction carries latent reasoning, the
failure that motivated it, the hypothesis, the outcome. At write time that reasoning is free. At
read time, months later, recovering it is exponentially costly, so deletion feels unsafe.

The measured fix. An HTML comment on each instruction recording the failure history, the
hypothesis and the outcome removes 99.3% of excess instruction growth, taking +211.3% down to
+1.4%, and improves real-world agentic instruction following by up to 23.1%. The comment is
invisible to the model. It exists so a human can decide, weeks later, whether the rule still
earns its place.

The paper's closing line. "If English is the new code, why don't we have comments yet?"

### I4. The most common configuration smell is restating the linter

[dos Santos, Costa, Montandon, Silva, Valente, "Configuration Smells in AGENTS.md Files",
SCAM 2026, arXiv:2606.15828, v5 2026-07-30](https://arxiv.org/abs/2606.15828). Peer reviewed,
validated on 100 popular repositories.

> configuration smells are widespread. Lint Leakage was the most common smell, affecting 62% of
> the files, followed by Context Bloat (42%) and Skill Leakage (35%).

Lint Leakage is the config file restating what a linter already enforces. 62% of real
repositories do it, and the ETH result says it costs 20% more inference for no success gain.

[Coldtea's field study of the 100 most-starred repositories with an AGENTS.md, 2026-08-21](https://www.coldtea.ai/blog/agents-md-field-study)
gives the shape of a real file. Median 1,198 words, barbell distributed with 37% past 1,500
words and one in ten under 150. 90% use must, always or never. 784 explicit don't-bullets
