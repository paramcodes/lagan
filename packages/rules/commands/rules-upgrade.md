---
description: Report the rule catalogue entries this repository has not adopted yet, and the ones that changed. Never edits the table by itself.
agent: build
---
Load and follow the `agent-rules` skill, then apply it. A project that ran `rules init` has it at
`.opencode/skills/agent-rules/SKILL.md`.

Compare the rule catalogue against this repository's rule table and report the difference. For each
new or changed entry, show the rule, the fact it keys on, and the evidence that the fact holds
here.

Do not edit the rule table. A change to the rules needs a human who owns them, so report and stop.

If the `@lagan/rules` package is available, run its `upgrade` command in report mode. If it is
not, compare `docs/ai/rules/*.yaml` against the catalogue files in the package by hand.

Request: $ARGUMENTS
