import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAudit, titlesContradict, type AuditResult } from "./audit-rules";

const VALID_RULE = `id: sample-rule
title: The sample rule holds.
layer: runtime
enforced_by:
  - path: src/guard.ts
    match: 'export const guard = true'
artifact:
  - path: src/guard.test.ts
failure: |
  2026-10-20. The guard was missing, so the sample broke.
owner: "@paramcodes"
`;

const CI_WORKFLOW = `name: CI

jobs:
  verify:
    name: Typecheck, test, lint, build
    steps:
      - name: Test
        run: bun run test

  a11y-e2e:
    name: E2E and accessibility
    env:
      DATABASE_URL: postgres://lagan@localhost:5432/lagan
    steps:
      - name: Run E2E
        run: bun run test:e2e
`;

const SCOPED_RULE = `id: scoped-rule
title: The verify job runs the database backed tests.
layer: ci
enforced_by:
  - path: .github/workflows/ci.yml
    match:
      - "  verify:"
      - "DATABASE_URL"
artifact:
  - path: .github/workflows/ci.yml
failure: |
  2026-10-20. The verify job had no database, so the integration tests skipped.
owner: "@paramcodes"
`;

describe("runAudit", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lagan-audit-"));
    write(
      "docs/ai/protected-paths.md",
      "# Protected paths\n\n| Path pattern | Kind |\n| --- | --- |\n",
    );
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  function write(relativePath: string, contents: string): void {
    const file = join(root, relativePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents, "utf8");
  }

  function writeRule(id: string, contents: string): void {
    write(`docs/ai/rules/${id}.yaml`, contents);
  }

  function codes(result: AuditResult): string[] {
    return result.findings.map((finding) => finding.code);
  }

  it("passes a valid table", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ rules: 1, enforced: 1, unenforced: 0, unearned: 0 });
  });

  it("fails when the enforcing path does not exist", () => {
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("enforcement-path-missing");
  });

  it("fails when the marker is no longer in the enforcing file", () => {
    write("src/guard.ts", "export const other = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("enforcement-marker-missing");
  });

  it("fails when the rule has no artifact", () => {
    write("src/guard.ts", "export const guard = true;\n");
    writeRule("sample-rule", VALID_RULE.replace("artifact:\n  - path: src/guard.test.ts\n", ""));

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("artifact-missing");
  });

  it("fails when an artifact path does not exist", () => {
    write("src/guard.ts", "export const guard = true;\n");
    writeRule("sample-rule", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("artifact-path-missing");
  });

  it("fails when the rule records no failure and counts it as unearned", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE.replace(/failure: \|[\s\S]*?owner:/, "owner:"));

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("failure-missing");
    expect(result.summary.unearned).toBe(1);
  });

  it("fails when the id does not match the file name", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("other-name", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("id-filename-mismatch");
  });

  it("fails when the owner is missing", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE.replace('owner: "@paramcodes"\n', ""));

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("owner-missing");
  });

  it("fails when the file is not valid YAML", () => {
    writeRule("sample-rule", "id: sample-rule\n  title: broken\n");

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("invalid-yaml");
  });

  it("fails when the layer is outside the closed set", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE.replace("layer: runtime", "layer: runtime-invariant"));

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("unknown-layer");
  });

  it("reports a prose rule without a mechanism as unenforced rather than as an error", () => {
    writeRule(
      "prose-rule",
      `id: prose-rule
title: A prose rule is read, not checked.
layer: prose
artifact:
  - path: pr:comment
failure: |
  2026-10-20. The rule had no mechanism, so nothing enforced it.
owner: "@paramcodes"
`,
    );

    const result = runAudit(root);

    expect(result.ok).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe("unenforced");
    expect(result.findings[0]?.severity).toBe("warning");
    expect(result.summary).toEqual({ rules: 1, enforced: 0, unenforced: 1, unearned: 0 });
  });

  it("fails when a rule that is not prose names no mechanism", () => {
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule(
      "sample-rule",
      `id: sample-rule
title: The sample rule holds.
layer: runtime
artifact:
  - path: src/guard.test.ts
failure: |
  2026-10-20. The guard was missing, so the sample broke.
owner: "@paramcodes"
`,
    );

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("unenforced-layer");
  });

  it("fails when two rules share an enforcing path and their titles contradict", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);
    writeRule(
      "other-rule",
      `id: other-rule
title: The sample rule never holds.
layer: runtime
enforced_by:
  - path: src/guard.ts
    match: 'export const guard = true'
artifact:
  - path: src/guard.test.ts
failure: |
  2026-10-20. The other guard was missing, so the sample broke.
owner: "@paramcodes"
`,
    );

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("contradiction");
  });

  it("does not report a contradiction for two rules that share a path and agree", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);
    writeRule(
      "other-rule",
      `id: other-rule
title: The other rule holds.
layer: runtime
enforced_by:
  - path: src/guard.ts
    match: 'export const guard = true'
artifact:
  - path: src/guard.test.ts
failure: |
  2026-10-20. The other guard was missing, so the sample broke.
owner: "@paramcodes"
`,
    );

    const result = runAudit(root);

    expect(codes(result)).not.toContain("contradiction");
    expect(result.ok).toBe(true);
  });

  it("fails when a marker in the list is missing", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule(
      "sample-rule",
      VALID_RULE.replace(
        "    match: 'export const guard = true'",
        "    match:\n      - 'export const guard = true'\n      - 'export const other = true'",
      ),
    );

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("enforcement-marker-missing");
  });

  it("fails when a list marker is not a string", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule(
      "sample-rule",
      VALID_RULE.replace(
        "    match: 'export const guard = true'",
        "    match:\n      - 'export const guard = true'\n      - 42",
      ),
    );

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("schema");
  });

  it("fails when a scoped marker sits in another job", () => {
    write(".github/workflows/ci.yml", CI_WORKFLOW);
    writeRule("scoped-rule", SCOPED_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("enforcement-marker-missing");
    expect(result.findings[0]?.message).toContain('not in the block opened by "  verify:"');
  });

  it("passes when every scoped marker sits in the block the first marker opens", () => {
    write(
      ".github/workflows/ci.yml",
      CI_WORKFLOW.replace(
        "  verify:\n    name: Typecheck, test, lint, build",
        "  verify:\n    name: Typecheck, test, lint, build\n    env:\n      DATABASE_URL: postgres://lagan@localhost:5432/lagan",
      ),
    );
    writeRule("scoped-rule", SCOPED_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("fails when the protected paths table is missing", () => {
    rmSync(join(root, "docs/ai/protected-paths.md"), { force: true });
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", VALID_RULE);

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("protected-paths-missing");
  });

  it("fails when a protected path is missing from the protected paths table", () => {
    write("src/guard.ts", "export const guard = true;\n");
    write("src/guard.test.ts", "it('guards', () => {});\n");
    writeRule("sample-rule", `${VALID_RULE}protects:\n  - path: src/guard.ts\n`);
    write(
      "docs/ai/protected-paths.md",
      "# Protected paths\n\n| Path pattern | Kind |\n| --- | --- |\n",
    );

    const result = runAudit(root);

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("protected-path-undocumented");
  });
});

describe("titlesContradict", () => {
  it("detects a negation on one side only", () => {
    expect(
      titlesContradict(
        "The app route group renders a usable error state, never a blank page.",
        "The app route group renders a blank page.",
      ),
    ).toBe(true);
  });

  it("does not flag a shared path with compatible titles", () => {
    expect(
      titlesContradict(
        "The full suite runs once before the pull request is opened.",
        "The Postgres integration job runs against a real database.",
      ),
    ).toBe(false);
  });

  it("does not flag titles that share no significant word", () => {
    expect(titlesContradict("A branch is never force-pushed.", "The suite runs.")).toBe(false);
  });
});
