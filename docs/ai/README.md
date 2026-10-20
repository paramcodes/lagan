# Agent rules

The operating rules of this repository live here, one YAML file per rule, and every rule names
the check that enforces it.

The reason is a measurement, not a preference. An instruction file costs more than 20% extra
inference and does not improve task success, because agents follow the instructions they are
given, so obedience is not the problem and the instruction file is the wrong place for the rule.
What was missing is the link between a stated rule and the check that enforces it. This
directory is that link.

| Path | What it is |
| --- | --- |
| `docs/ai/rules/*.yaml` | The rule table. One file per rule, and the file name is the rule id. |
| `docs/ai/context.yaml` | The facts about the repository that are not constraints. The projector renders them into `AGENTS.md`. |
| `docs/ai/protected-paths.md` | Generated. The paths the rules guard, and what guards each one. |
| `scripts/audit-rules.ts` | The auditor. Fails when a rule loses its mechanism, its artifact or its failure. |
| `scripts/sync-agent-rules.ts` | The projector. Writes `AGENTS.md`, `.github/CODEOWNERS` and `docs/ai/protected-paths.md`. |

The rules themselves are not restated in `AGENTS.md`. `AGENTS.md` is a generated routing file:
it carries the overview, the setup, the gate commands and the facts from
`docs/ai/context.yaml`, and it points here.

## The format

A rule is a YAML mapping. The file name is the rule id, and the `id` field must match it.

```yaml
id: no-blank-app-page
title: The app route group renders a usable error state, never a blank page.
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
owner: "@paramcodes"
```

### Fields

| Field | Required | What it means |
| --- | --- | --- |
| `id` | yes | The rule id. Must equal the file name without the extension. |
| `title` | yes | The rule as one sentence. This is the text the contradiction check compares. |
| `layer` | yes | The layer that enforces the rule. One of the seven values below. |
| `enforced_by` | no | The mechanism. A list of `path`, each with an optional `match`. |
| `artifact` | yes | What a reviewer looks at. A list of `path`, each with an optional `note`. |
| `failure` | yes | The failure that caused the rule. The latent reasoning. |
| `owner` | yes | A GitHub handle. It becomes a `CODEOWNERS` entry for the paths the rule protects. |
| `protects` | no | The paths the rule guards. A list of `path`, each with an optional `protection`. |

`enforced_by` is a list of objects:

```yaml
enforced_by:
  - path: lefthook.yml
    match: size-guard
```

`path` is a repository path relative to the root. It must exist, or the auditor fails. `match` is
a string or a list of strings. The `match` is what makes the check about the mechanism and not
about the file name: a rule that points at `lefthook.yml` without a marker passes as long as a
file of that name exists, and a rule with the marker fails the moment the guard is renamed or
deleted.

Every entry has to match, so one rule can pin a mechanism with more than one marker. A marker
also has to be specific enough that deleting the mechanism takes the marker with it.
`bun run test` is a prefix of `bun run test:e2e`, so a rule that means one CI job pins the step
name as well as the command. A marker that still matches after the mechanism is gone is not a
check.

A list of markers scopes a mechanism to one block. The first marker in the list anchors a
block: the lines from the line that holds it to the next line indented no further. Every other
marker has to be inside that block, and a marker at the left margin has no block to open, so its
scope is the whole file. That is what scopes a rule to one job of a workflow file. A marker of
`DATABASE_URL` on its own matches the occurrence in any job, so a rule that claimed the verify
job runs the database backed tests passed while the mechanism was absent. The rule that does it
is `no-silent-test-skip`:

```yaml
enforced_by:
  - path: .github/workflows/ci.yml
    match:
      - "  verify:"
      - "      postgres:"
      - "      DATABASE_URL: postgres://"
      - "        run: bun run db:migrate"
      - "      - name: Test\n        run: bun run test\n"
```

The job key anchors the block and every other marker has to be inside it, so removing the
service, the url, the migrations or the test step turns the audit red.

A marker can hold a newline, and it can end with one. A marker that ends with a newline pins
the end of a line, so `run: bun run test` is not a prefix of `run: bun run test:e2e`. The
generated table escapes a newline and a pipe, so a multi-line marker stays one row.

`artifact` is where the reviewer looks, and it is what makes a rule checkable. A `path` that
starts with `pr:`, `ci:` or `git:` is a locator for evidence that lives outside the repository,
such as a pull request comment. Every other `path` must exist in the repository.

`failure` records what actually went wrong. A rule without it is unearned: it is a preference
with no history, and the safe thing to do with a preference is to leave it out. This is also the
field that makes a rule safe to delete later, because the next reader can see whether the
failure it prevents is still live.

`protects` lists the paths a rule guards, usually the mechanism itself. Those paths become
`CODEOWNERS` entries and rows in `docs/ai/protected-paths.md`.

### Layers

`layer` is a closed set. It is the constraint escalation ladder: the earliest reliable place
the rule can be enforced.

| Layer | The mechanism is | Examples |
| --- | --- | --- |
| `type` | A type or a signature. | A value that cannot be represented in the wrong shape. |
| `primitive` | A shared library primitive. | One wrapper that every caller goes through. |
| `runtime` | Runtime code at a boundary. | An error boundary, a guard that throws. |
| `test` | A test. | A behaviour the suite asserts. |
| `lint` | A lint rule or a static check. | The `lefthook.yml` size guard. |
| `ci` | A CI job. | The `verify` job that runs the suite. |
| `prose` | Nothing. | A rule a human or an agent reads and follows. |

`prose` is the layer for a mechanism that is a document rather than code: the pull request
template, a guide a contributor reads. A `prose` rule may name that document, and the auditor
then checks that the document still carries the marker. A `prose` rule that names no document
has no mechanism behind it, and the auditor reports it as unenforced rather than as an error.
The count in the summary is the point: it shows how much of the rule set is a wish, so the
coordinator can delete it or build a mechanism for it. A rule that declares another layer and
names no mechanism is an error, because the layer claims an enforcement that does not exist.

## The auditor

```bash
bun scripts/audit-rules.ts          # human table, exits non-zero on a finding
bun scripts/audit-rules.ts --json   # the same result as JSON
```

It reads the table and the repository, and it never writes anything. It fails when:

- an `enforced_by` path does not exist,
- an `enforced_by` marker is no longer in its file, or is no longer in the block that the
  first marker of its list anchors,
- a rule has no `artifact`,
- an `artifact` path does not exist,
- a rule has no `failure`,
- a rule has no `owner`,
- a rule file is not valid YAML, or does not match the schema,
- a rule file `id` does not match its file name,
- a rule declares a layer outside the closed set,
- a rule declares a layer other than `prose` and names no mechanism,
- two rules name the same `enforced_by` path and their titles read as opposite,
- `docs/ai/protected-paths.md` does not exist,
- `docs/ai/protected-paths.md` is missing a path that a rule marks as protected.

The summary counts the rules, how many are enforced, how many are unenforced, and how many are
unearned.

### The contradiction check

Two rules naming the same `enforced_by` path is not a contradiction. Most rules share a
mechanism on purpose. The check only reports a contradiction when the two titles share a
significant word and that word sits next to opposite polarity: a negation on one side and not
the other, or an antonym pair across the two sides.

It does not attempt semantic comparison. It does not read the failure text, and it cannot tell
that "no test skips silently" and "the full suite runs once" use the word "test" in different
senses. A false positive is a review conversation, not a silent pass.

## The projector

```bash
bun scripts/sync-agent-rules.ts          # write the projections
bun scripts/sync-agent-rules.ts --check  # fail when a projection is stale
```

It writes three files:

- `AGENTS.md`, the thin routing file. The overview and the commands come from `README.md`, the
  facts about the repository come from `docs/ai/context.yaml`, and the rules come from a
  pointer to this directory. It carries a header saying it is generated and a line saying how
  to regenerate it.
- `.github/CODEOWNERS`, one line per protected path, carrying the owner of every rule that
  protects it. The lines live in a marked block, and anything a human wrote outside the block
  is kept.
- `docs/ai/protected-paths.md`, the table of guarded paths with the controlling evidence and
  the `kind`, which is `documented` when a rule file states the protection and
  `repository-enforced` when a mechanism in the repository enforces it. A path guarded by two
  rules has one row per rule.

`--check` writes nothing. It compares each file with what would be generated, prints a diff and
exits non-zero when they differ, which is how a hand-edited projection is caught.

## The context file

`docs/ai/context.yaml` holds the facts about this repository that are not constraints: the
branch to cut from, the queue file to update, the merge policy, the commit convention. The
rule table holds the constraints, the things that must hold and that something checks. The
context file holds the orientation, the things an agent needs in order to act correctly and
that no check holds on its own.

```yaml
sections:
  - title: Concurrency safety
    body: |
      - Remote merges are squash merges. The local `master` is only ever fast-forwarded.
```

Each section is a title and a body of markdown. The projector renders them into `AGENTS.md` in
the order they are written, so the file is what a human edits when the workflow changes. A
fact belongs here; a constraint with a failure behind it belongs in the rule table.

## Adding a rule

1. Write the failure first. If you cannot name the failure, there is no rule to add.
2. Create `docs/ai/rules/<id>.yaml` with the fields above. The `id` must match the file name.
3. Give it a mechanism. If the honest answer is that nothing enforces it, use `layer: prose` and
   leave `enforced_by` out.
4. Run `bun scripts/audit-rules.ts`. It must pass.
5. Run `bun scripts/sync-agent-rules.ts` and commit the projections it changes.

A fact that is not a rule does not belong in the table. It belongs in `docs/ai/context.yaml`,
which holds the orientation an agent needs to act correctly: the branch to cut from, the queue
file to update, the merge policy. The projector renders that file into `AGENTS.md`, so an edit
there is what changes what every agent reads.

The auditor fails the moment the mechanism moves, so a rule does not have to be kept alive by
hand.
