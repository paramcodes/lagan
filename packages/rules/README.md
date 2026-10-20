# Rule catalogues

A catalogue is a list of derivations. Each derivation says: if these facts hold about the
repository, then this rule applies. A bootstrap detects the facts, resolves the derivations
against them, and writes only the rules that apply.

| Path | What it is |
| --- | --- |
| `packages/rules/catalogues/*.yaml` | The catalogues. One file per stack. |
| `packages/rules/README.md` | This file. The format, the fact set and the contract with the bootstrap. |

The catalogues are the input to a bootstrap, not the rule table. The rule table is written in
the repository, one YAML file per rule, in the format documented in `docs/ai/README.md`, and the
bootstrap is what carries the applicable derivations across.

## Why this is not a list of rules

A catalogue of plain rules produces the same fixed set everywhere, and most of it is wrong for
most projects. That is the failure mode the ETH Zurich study measured: an LLM-generated context
file scored minus 3 percent on task success, and removing the README turned it positive at plus
2.7 percent, which shows the file mostly restated the README. A fixed rule set is the same
thing in a different shape.

The measured cost of the wrong rules is not abstract. SCAM 2026 found lint leakage, a rule that
restates what the linter already enforces, in 62 percent of the 100 repositories it studied, and
the ETH Zurich study measured that context files cost more than 20 percent extra inference for
no gain in success. Agents follow the instructions they are given, so an unnecessary rule is a
commitment to extra work, not a free sentence.

A derivation fixes that, because the condition does the filtering. "If you have a linter, then
this rule" produces a rule only for the repositories that have a linter. The same catalogue
produces seventeen rules for a configured Next.js repository and six for a bare one, and the
six are the right six. The counts are measured; see the end of this file.

## The catalogue format

A catalogue is a YAML mapping with five keys.

```yaml
id: nextjs-bun
title: Next.js on Bun in a Bun workspace
applies_to: >
  A Bun workspace with the Next.js app under apps/web and the shared packages under packages/*.

stack:
  framework: next
  package_manager: bun

rules:
  - id: style-enforced-by-linter
    title: Style is enforced by {linter}, not by prose.
    derive:
      - fact: linter_config_exists
        value: biome.json
    layer: lint
    enforced_by:
      - path: biome.json
    note: |
      A rule that restates a linter is lint leakage. SCAM 2026 found it in 62 percent of real
      repositories, and the ETH Zurich study measured that context files cost more than 20
      percent extra inference for no gain.

policies:
  - id: never-commit-to-the-default-branch
    title: Nothing is committed directly to the default branch.
    layer: prose
    note: |
      2026-10-20. A queue-file update was pushed straight to master and had to be rebased after
      a concurrent push landed.
```

| Key | What it is |
| --- | --- |
| `id` | The catalogue id. One catalogue is applied to one repository. |
| `title` | One sentence naming the stack. |
| `applies_to` | The layout the catalogue assumes. The paths it names are the paths of that layout. |
| `stack` | The framework and the package manager. The `framework_version` and `has_lockfile` facts read them. |
| `rules` | The derivations. Each one is conditional. |
| `policies` | The rules that are choices rather than consequences. Each one is unconditional. |

### A derivation

| Field | Required | What it means |
| --- | --- | --- |
| `id` | yes | The rule id. The bootstrap writes the rule under this id. |
| `title` | yes | The rule as one sentence. The text the contradiction check compares. |
| `derive` | yes | The conditions. All of them must hold. A derivation with no `derive` is invalid. |
| `layer` | yes | The layer that enforces the rule. The closed set is below. |
| `enforced_by` | no | The mechanism. A list of `path`, each with an optional `match`. |
| `note` | yes | Why the derivation exists and the evidence behind it. It becomes the rule's `failure`. |
| `artifact` | no | Where a reviewer looks. The bootstrap derives it when it is absent. |
| `owner` | no | A GitHub handle. The bootstrap derives it when it is absent. |

`derive` is a list of conditions and every condition must hold.

```yaml
    derive:
      - fact: has_lockfile
      - fact: ci_workflow_exists
```

`value` narrows a condition. A condition with no `value` matches any detected value of that
fact. A condition with a `value` matches only that value.

```yaml
    derive:
      - fact: linter_config_exists
        value: biome.json
```

The detected value also substitutes into the title, so a rule can name what was detected rather
than a fixed name.

| Placeholder | Filled with |
| --- | --- |
| `{linter}` | The linter config file name detected for `linter_config_exists`. |
| `{framework}` | The framework name detected for `framework_version`. |
| `{version}` | The framework version detected for `framework_version`. |
| `{value}` | The raw detected value of the first condition that carries one. |

`layer` is the same closed set the rule table uses, and it is the constraint escalation ladder:
the earliest reliable place the rule can be enforced.

| Layer | The mechanism is |
| --- | --- |
| `type` | A type or a signature. |
| `primitive` | A shared library primitive. |
| `runtime` | Runtime code at a boundary. |
| `test` | A test. |
| `lint` | A lint rule or a static check. |
| `ci` | A CI job. |
| `prose` | Nothing. |

The command derivations take the layer of the check the command performs. The build and the test
suite are CI gates, the typecheck is the type layer, and the format and the lint are the lint
layer. A derivation that names a command the repository does not have is not written at all,
which is why the command derivations key on the script facts rather than on the framework.

`enforced_by` is the point of the whole design. It names the path, and optionally the marker,
that makes the rule true. A rule that points at nothing is decorative, so a derivation whose
layer is not `prose` names at least one mechanism.

```yaml
    enforced_by:
      - path: .github/workflows/ci.yml
        match: bun run test
```

`note` records why the derivation exists and what evidence motivated it. It becomes the rule's
`failure` field, which is the field that makes a rule safe to delete later: the next reader can
see whether the failure it prevents is still live. A note cites a measured source where one
exists.

## The facts

A derivation keys on facts, and the set of facts is fixed. A fact is a statement about the
repository that a bootstrap can decide on its own. A fact that cannot be decided mechanically
does not belong in the set, because a derivation on it is a guess.

| Fact | What it means | How it is detected | The value it carries |
| --- | --- | --- | --- |
| `linter_config_exists` | A linter is configured. | A linter config file exists at the root or in a workspace package: `biome.json`, `biome.jsonc`, `eslint.config.*`, `.eslintrc*`, `ruff.toml`. | The config file name. |
| `ci_workflow_exists` | CI runs on pull requests. | A workflow under `.github/workflows/` that triggers on `pull_request`. | The workflow path. |
| `test_script_exists` | The root manifest has a `test` script. | The `scripts.test` key of the root `package.json`. | The script name. |
| `typecheck_script_exists` | The root manifest has a `typecheck` script. | The `scripts.typecheck` key of the root `package.json`. | The script name. |
| `build_script_exists` | The root manifest has a `build` script. | The `scripts.build` key of the root `package.json`. | The script name. |
| `format_script_exists` | The root manifest has a `format` script. | The `scripts.format` key of the root `package.json`. | The script name. |
| `lint_script_exists` | The root manifest has a `lint` script. | The `scripts.lint` key of the root `package.json`. | The script name. |
| `framework_version` | The stack's framework is declared at a pinned version. | The dependency named by `stack.framework` appears in a workspace manifest. | `name@version`, for example `next@16.4.2`. |
| `database_configured` | A database is configured. | A database URL variable is declared in `.env.example`, or a database service is declared in `docker-compose.yml`, or a database client is a dependency. | The variable name, for example `DATABASE_URL`. |
| `monorepo_with_packages` | The repository is a workspace with shared packages. | The root manifest declares `workspaces` and the workspace package directory is not empty. | The package directory. |
| `e2e_suite_exists` | A browser suite exists. | A Playwright or Cypress config exists at the root. | The config path. |
| `precommit_hook_exists` | A pre-commit hook is installed. | `lefthook.yml`, `.lefthook.yml`, `.pre-commit-config.yaml` or a `.husky` directory exists. | The hook config path. |
| `has_lockfile` | The lockfile of the stack's package manager is committed. | The lockfile named by `stack.package_manager` exists: `bun.lock`, `bun.lockb`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`. | The lockfile name. |

Two facts need one extra word of contract.

`framework_version` matches on the framework name or on the exact `name@version`. A derivation
with `value: next` matches any pinned Next.js; a derivation with `value: next@16.4.2` matches
only that version.

The script facts match the root manifest only. A script inside a package is a different command
with a different dependency graph, and the root script is the one CI runs.

## Derived rules and policy rules

| | A derived rule | A policy rule |
| --- | --- | --- |
| Lives in | `rules` | `policies` |
| Has a `derive` | Yes, and every condition must hold | No |
| Why it exists | The stack implies it, and the repository shows the fact | The repository chose it |
| Applies to | The repositories whose facts match | Every repository the catalogue is applied to |
| Layer | The layer the mechanism enforces it | `prose`, unless a mechanism exists |

A derivation is a consequence. The repository has a linter, so the rule about style follows,
and the rule would be wrong in a repository without one. A policy is a choice. The worktree
convention, the rule table as the source of truth, the default branch and the definition of done
are choices this repository made, and they hold whether or not a fact was detected.

The distinction matters because the two are pruned differently. A derivation that stops matching
is dead and comes out with the next bootstrap. A policy is only removed when the choice is
reversed, and the choice is recorded in the note.

The definition of done is a policy, and it is the one that would have caught the unreadable
mobile layout: every DOM assertion passed, and only a screenshot showed the page as a human sees
it. It is written as a policy because it is a standard of work rather than a fact about the
stack, and it is written in terms of surfaces, so it survives contact with a real project. A
route is observed in a browser and captured as a screenshot, a query is observed against the
real database, a configuration change is observed in a process started with the new value. The
evidence has to live outside the change, because a check the agent can edit is a check the
agent can pass.

## How a derivation becomes a rule

The bootstrap resolves a catalogue against a repository in these steps.

1. Detect the facts. Every fact in the set is decided, and each detected fact carries a value.
2. Keep the derivation when every one of its `derive` conditions holds. A condition with no
   `value` holds when the fact was detected. A condition with a `value` holds when the detected
   value equals it.
3. Keep the `enforced_by` entries whose `path` exists, and whose `match` is still in that file.
   An entry with a marker is what makes the check about the mechanism and not about the file
   name.
4. Drop the derivation when no mechanism survives and the layer is not `prose`. A rule that
   declares a layer and names no mechanism is an error in the auditor, and it is a rule that
   claims an enforcement that does not exist.
5. Write the rule. `title` is the title with the placeholders filled, `layer` is the layer,
   `enforced_by` is the surviving mechanisms, `failure` is the note, `artifact` is the declared
   artifact or the surviving mechanisms, and `owner` is the declared owner or the repository
   owner from the git remote.
6. Write the policies unchanged, apart from the same mechanism check. A policy that loses its
   mechanism is written as a `prose` rule, and the auditor reports it as unenforced rather than
   as an error.

One catalogue is applied to one repository. The Postgres catalogue contains the derivations of
the base catalogue plus the database ones, so applying both writes the same rule id twice.

## Adding a derivation for a new stack

1. Copy the catalogue of the closest stack and change the `stack` block and the paths in
   `applies_to`.
2. Write the derivation only when a fact makes it apply. A rule that would be right in every
   repository of the stack is a policy, or it is a rule with no measured basis, and both belong
   outside the catalogue.
3. Give every derivation a mechanism. If the honest answer is that nothing enforces it, the
   derivation belongs under `policies` with the layer `prose`.
4. Write the note first. If the failure cannot be named, the derivation has no reason to exist
   and the safe thing to do with it is to leave it out.
5. Measure. Resolve the new catalogue against a configured repository and against a bare one,
   and check that the difference is the argument: a configured repository gets the rules that
   fit it and a bare one gets almost nothing.

## The measured counts

Resolved against this repository and against a deliberately bare one: a `package.json` with
`next`, `react` and `react-dom`, no scripts, no linter, no CI, no lockfile, no database, no
browser suite and no pre-commit hook.

| Catalogue | Derivations | Policies | Rules against this repository | Rules against the bare repository |
| --- | --- | --- | --- | --- |
| `nextjs-bun.yaml` | 13 | 4 | 13 + 4 = 17 | 2 + 4 = 6 |
| `nextjs-bun-postgres.yaml` | 17 | 4 | 17 + 4 = 21 | 2 + 4 = 6 |

The bare repository gets two derived rules, the pinned framework version and the environment
configuration, and the four policies, because those are the only derivations whose facts hold
and because the policies are choices rather than consequences. The configured repository gets
all of them, and each one names a mechanism that exists in it.
