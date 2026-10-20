---
description: Run the rule auditor and report which rules are still real, which are unenforced, and which are unearned.
agent: build
---
Load and follow the `agent-rules` skill, then apply it. A project that ran `rules init` has it at
`.opencode/skills/agent-rules/SKILL.md`.

Run the rule auditor for this repository and report the result. Say which rules are enforced, which
name no mechanism, and which carry no failure story. For anything unenforced, say plainly that it
is decorative and offer to move it to the context file or drop it.

Do not edit the rule table. Report and let the human decide.

Rule table state:

!`bun scripts/audit-rules.ts --json 2>/dev/null || bun run rules:audit --json 2>/dev/null || echo "auditor not found; run bun run rules:audit if the project has one"`

Request: $ARGUMENTS
