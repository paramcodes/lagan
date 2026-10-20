---
description: Set this repository up for coding agents. Detects the facts, proposes the rules, asks four questions, writes the rule table, the auditor, the projector and the code owners, then proves the check fails.
agent: build
---
Load and follow the `agent-rules` skill, then apply it. A project that ran `rules init` has it at
`.opencode/skills/agent-rules/SKILL.md`.

Set up the current repository for coding agents. Detect the facts from the repository rather than
asking for them, propose the rules with the evidence that produced each one, and ask only the four
questions the detector cannot answer.

If the `@lagan/rules` package is available, use its `init` command. If it is not, build the same
structure by hand, following the format documented in the skill.

Before you write anything, state what you detected and what you propose, and wait for the go.

Request: $ARGUMENTS
