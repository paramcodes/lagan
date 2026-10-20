---
name: agent-rules
description: Write, review and explain the rules in a machine-checkable rule table. Use when adding a rule after a failure class repeats, when checking a proposed rule table for contradictions, unenforced rules or rules with no failure story, or when explaining what an audit finding means and how to fix it.
---

# Agent rules

A repository where several coding agents work in parallel needs its operating rules to be
**checked**, not trusted. This skill is the judgement work: writing a rule, reviewing a table
and explaining a finding.

## The one idea

**A rule is only real when a mechanism acts on it. A rule with no artefact cannot be checked, so
it cannot be enforced, so it is a wish.**

Everything below follows from that.

## Why prose is not the answer

The measured position, from the research recorded in `docs/research/2026-agent-workflow.md` when
that file exists.

- Context files do not improve task success on average and cost more than 20% extra inference.
  Developer-written files gained 2.4%, which is not significant. Agents **follow** the
  instructions they are given, so obedience is not the problem and the instruction file is the
  wrong place for the rule.
- 62% of real repositories restate what their linter already enforces. That is lint leakage, and
  it costs inference for nothing.
- Instruction files grow about 4.9 instructions per commit, regrow to 91.5% of their previous size
  within 10 commits of a rewrite, and older instructions are *less* likely to be deleted, because
  each carries latent reasoning that is expensive to recover.

So the answer is not a better-written `AGENTS.md`. It is a rule table plus a check.

## The shape

Five pieces. Each is small and each does one job.

1. **The rule table.** One YAML file per rule, in a directory. A rule names its enforcement layer,
   the path and marker that enforce it, the artefact that proves it, the failure that caused it,
   and its owner.
2. **The auditor.** A deterministic script. It fails when a rule's enforcing path or marker is
   gone, when a rule has no artefact, when a rule has no failure, when two rules contradict, and
   when a protected path has no owner. It never edits anything and never needs a model.
3. **The projector.** Generates the files that are derived from the table, the thin instruction
   file, the code owners file, and the protected-path table. A check mode fails when a projection
   was hand-edited.
4. **The context file.** The repository's orientation facts, as opposed to its constraints. Which
   branch to cut from, which queue file to update, what the merge policy is. A generated
   instruction file that drops these loses ten rules in one edit.
5. **The ownership.** Code owners plus branch protection, so an agent cannot change the rules
   without a human who owns them.

## The enforcement layer

Each rule names one layer. Pick the strongest that works.

| Layer | What it is | Example |
|---|---|---|
| `type` | Types and signatures | A branded id type so the wrong id does not compile |
| `primitive` | A library primitive | One wrapper around the dangerous call |
| `runtime` | A runtime invariant | An error boundary, a boot assertion |
| `test` | A behavioural test | An integration test that runs against a real database |
| `lint` | A lint rule | A rule that bans the structural anti-pattern |
| `ci` | A CI job | A job that fails when the mechanism is removed |
| `prose` | A sentence in the instruction file | Only when enforcement would be unreliable |

A rule with `prose` and no mechanism is unenforced. The auditor counts those, and the count is the
signal. It should go down, not up.

## The marker

The part that makes a rule checkable is the marker, a string that must still appear in the file
that enforces the rule.

```yaml
id: no-blank-app-page
layer: runtime
enforced_by:
  - path: apps/web/app/(app)/error.tsx
    match: 'role="alert"'
artifact:
  - path: apps/web/e2e/app-shell.spec.ts
failure: |
  2026-10-20. The app route group had no error boundary, so a failing query
  rendered Next's generic error page: a near-blank white screen with no app
  chrome and no way back.
owner: "@your-org"
```

A marker must be **specific enough that deleting the mechanism takes the marker with it**. A
marker of `bun run test` survives deleting the job that runs it, because `bun run test:e2e`
contains it. When one marker cannot scope a mechanism to one place, use a list of markers, where
the first anchors a block and the rest must sit inside it.

The `failure` field is not decoration. It is the reason the rule exists, and it is what makes the
rule safe to delete later. A rule without a failure is an unearned preference.

## Writing a rule

The order matters. A rule written in the wrong order is a rule nobody can check.

1. **Name the failure.** If it cannot be named, there is no rule to write. Write it in one
   sentence with the date: what broke, and what it cost. A rule whose failure is "best practice"
   is a preference, and the safe thing to do with a preference is to leave it out.
2. **Count the strikes.** One strike is a bug. Fix it, note it in the commit, write no rule. Two
   strikes means the class recurred: change the shape of the code so it cannot happen again, and
   the rule points at that new shape. Three strikes means it is a pattern: write a lint rule or a
   hook that forbids it, and the rule points at that.
3. **Choose the layer.** The earliest reliable place the rule can be enforced. A rule that can be
   a type is better as a type than as a paragraph.
4. **Name the mechanism and the marker.** The path, and the marker inside it. If the honest
   answer is that nothing enforces it, use `prose` and leave `enforced_by` out. Say how you
   checked that the marker is specific enough.
5. **Name the artefact.** What a reviewer looks at. A path in the repository, or a locator such as
   `pr:comment` for evidence that lives outside it.
6. **Write the file.** One YAML file per rule, named after the rule id, with the id in it.
7. **Run the auditor.** It must pass. Then run the projector and commit the projections it
   changed.

The failure story is the part that needs the human. The agent knows the technical symptom and
the human knows whether it was a bad deploy, a missing migration, or a Tuesday. Draft the story
and ask for the correction before the rule is written.

## Reviewing a proposed table

Read the table as a reviewer, not as its author. For each rule ask:

- **Does the failure name something that happened?** A rule with no failure is unearned, and the
  auditor reports it. Do not defend it by saying it is good practice.
- **Does the mechanism exist?** The path has to be there, and the marker has to be in it. A marker
  that is a prefix of another command is not a check.
- **Is the artefact somewhere a reviewer looks?** An artefact that does not exist is a finding.
- **Do two rules contradict?** Two rules naming the same path are not a contradiction. A
  contradiction is two titles that share a significant word and sit next to opposite polarity, and
  the auditor reports that.
- **Is the layer the strongest one that works?** A `prose` rule that could have been a `test` rule
  is a rule that will not hold.
- **Does it restate a linter?** A rule that says "run the formatter" when the formatter is
  configured is lint leakage. It costs inference and adds nothing.
- **Is it in the table at all?** A fact that is not a rule belongs in the context file.

Review the count as well. The unenforced count is the signal, and it should go down.

## Explaining a finding

An audit finding is a sentence about a mechanism, and the explanation is the mechanism.

| Finding | What it means | What to do |
|---|---|---|
| `enforcement-path-missing` | The file that enforced the rule is gone. | Restore the file, or move the rule to the mechanism that replaced it. |
| `enforcement-marker-missing` | The file is there and the check is not in it. | The check was renamed or removed. Put the check back, or drop the rule. |
| `artifact-missing` | The rule has no evidence a reviewer can look at. | Name the artefact, or accept that the rule is a wish. |
| `artifact-path-missing` | The artefact path does not exist. | Correct the path, or name a locator such as `pr:comment`. |
| `failure-missing` | The rule has no story. | Write the failure, or delete the rule. |
| `owner-missing` | Nobody owns the rule. | Name the owner, so the code owners file can guard it. |
| `unenforced` | The rule names no mechanism. | Move it to the context file, or build the mechanism. |
| `unenforced-layer` | The rule claims a layer and names no mechanism. | The layer is a claim the rule does not back. Fix one of the two. |
| `contradiction` | Two rules on the same path read as opposite. | One of them is wrong. A contradiction is a review conversation, not a silent pass. |
| `protected-path-undocumented` | A guarded path is missing from the protected paths table. | Run the projector. |
| `rules-dir-missing` | The table is not where the auditor looks. | Check the path. |

Say the finding plainly, name the file and the line, and offer the two fixes: restore the
mechanism, or weaken the rule. Do not silence a finding with a comment.

## Two checks that earn their keep

**The oracle.** A test whose expected value came from the same prompt as the code repeats the
code's mistakes. It passes and it proves nothing. Either assert on a value the agent could not
invent, hold the oracle in a file the agent does not own, or verify against the real thing.

**The runtime surface.** A change is not done because a test passed. It is done when the surface
it touched was observed in the running application. A route change means the route was driven in
a real browser. A query change means the query ran against the real database. A configuration
change means the process was started with it and logged its resolved target.

Every DOM assertion passes on a page a human cannot read. Only a screenshot or a bounding box
shows that.

## Where the files are

```
docs/ai/rules/*.yaml       the table, one file per rule
docs/ai/context.yaml       the orientation facts
docs/ai/protected-paths.md the generated path table
scripts/audit-rules.ts     the auditor
scripts/sync-agent-rules.ts the projector
```

The auditor and the projector are **project-local copies**. The tooling that creates them is a
package, and the package is not a runtime dependency. CI does not change when the package updates,
a compromised package cannot change a build, and a project can fork the scripts and never hear from
the package again.

## The instruction file

Keep it thin. Under a hundred to two hundred and fifty lines, or under five hundred tokens. What
belongs in it: the repository overview, the setup and command lines, the validation ladder, the
definition of done, and a pointer to the table. What does not: the rules themselves.

Scope the file by directory, not by a list of files. A nested file per package, each holding only
its subtree's additions, and the parent wording not repeated.

Two hazards to know. A rules file can be silently truncated by the harness, and a truncated file
produces exactly the symptom of rules that do not hold. And the precedence between instruction
files differs between tools, some replacing and some concatenating, so the root file must be
self-contained.
