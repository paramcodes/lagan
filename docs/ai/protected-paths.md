<!-- GENERATED FILE. DO NOT EDIT BY HAND. -->
<!-- Regenerate with: bun scripts/sync-agent-rules.ts -->

# Protected paths

The paths the rule table guards, and the evidence that guards each one.

`documented` means a rule file states the protection and nothing in the repository checks it.
`repository-enforced` means a mechanism in the repository enforces it.

| Path pattern | Protection | Controlling evidence | Kind |
| --- | --- | --- | --- |
| `.github/PULL_REQUEST_TEMPLATE.md` | The template is the mechanism behind the pull request body. | `docs/ai/rules/pr-body-has-what-why-how.yaml`; `.github/PULL_REQUEST_TEMPLATE.md` (`## What`, `## Why`, `## How`) | repository-enforced |
| `.github/workflows/ci.yml` | The verify job is where the full suite runs for every pull request. | `docs/ai/rules/full-suite-before-pr.yaml`; `.github/workflows/ci.yml` (`bun run test`); `.github/workflows/ci.yml` (`- name: Test`) | repository-enforced |
| `.github/workflows/ci.yml` | The database service and its DATABASE_URL are what keep the integration tests from skipping. | `docs/ai/rules/no-silent-test-skip.yaml` | documented |
| `apps/web/app/(app)/error.tsx` | The error boundary is the mechanism behind the usable error state. | `docs/ai/rules/app-error-boundary.yaml`; `apps/web/app/(app)/error.tsx` (`role="alert"`) | repository-enforced |
| `apps/web/lib/env.ts` | The resolver is the one place that decides which database the app talks to. | `docs/ai/rules/database-url-has-one-source.yaml`; `apps/web/lib/env.ts` (`resolveDatabaseUrl`) | repository-enforced |
| `docs/evidence/` | The recorded evidence is regenerated from the running app, never hand-edited. | `docs/ai/rules/visual-change-carries-screenshot.yaml` | documented |
| `package.json` | The full-suite command is one heavy gate, and two of them at once is the oversubscription. | `docs/ai/rules/budget-the-machine.yaml` | documented |
