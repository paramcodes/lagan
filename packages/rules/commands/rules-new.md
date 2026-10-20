---
description: Draft a new rule after a failure class repeats. Walks through the strike count, the enforcement layer and the failure story, then writes the rule file.
agent: build
---
Load and follow the `agent-rules` skill, then apply it. A project that ran `rules init` has it at
`.opencode/skills/agent-rules/SKILL.md`.

Draft one new rule for this repository.

Ask what broke, and what class it belongs to. Look for the class in the incident log and count the
strikes. The strike count decides the layer. One strike is a local fix and no rule. Two strikes
means the shape of the code changes and the rule points at the new shape. Three strikes means a
lint rule or a hook, and the rule points at that.

Then, in this order:

1. Name the enforcement layer and the exact path and marker that enforce it. The marker must be
   specific enough that deleting the mechanism takes the marker with it. Say how you checked.
2. Name the artefact a reviewer can look at.
3. Write the failure story. This is the part that needs the human, so draft it and ask for the
   correction, because the agent knows the symptom and the human knows the incident.
4. Write the rule file, one YAML file per rule, named after the rule id.

Do not write the rule before the human has seen the failure story.

If the `@lagan/rules` package is available, its `new` command writes the file once the story is
agreed. If it is not, write the file in the format the skill documents.

Request: $ARGUMENTS
