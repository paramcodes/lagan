import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compare, runUpgrade } from "./src/upgrade";

const RULE = `id: local-rule
title: Nothing is committed directly to the default branch.
layer: prose
artifact:
  - path: pr:comment
failure: |
  2026-10-20. A queue file update was pushed straight to master.
owner: "@acme"
`;

describe("compare", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lagan-upgrade-"));
    mkdirSync(join(root, "docs/ai/rules"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "bare-app", private: true, dependencies: { next: "16.4.2" } }),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports the catalogue entries the table does not have", () => {
    const report = compare(root);

    expect(report).toBeDefined();
    expect(report?.added).toContain("never-commit-to-the-default-branch");
    expect(report?.dropped).toEqual([]);
  });

  it("reports the rules the catalogue no longer produces", () => {
    writeFileSync(join(root, "docs/ai/rules/local-rule.yaml"), RULE, "utf8");

    const report = compare(root);

    expect(report?.dropped).toContain("local-rule");
    expect(report?.added).toContain("never-commit-to-the-default-branch");
  });

  it("reports a rule that changed", () => {
    writeFileSync(
      join(root, "docs/ai/rules/never-commit-to-the-default-branch.yaml"),
      `id: never-commit-to-the-default-branch
title: Nothing lands directly to the default branch.
layer: prose
artifact:
  - path: pr:comment
failure: |
  2026-10-20. A queue file update was pushed straight to master.
owner: "@acme"
`,
      "utf8",
    );

    const report = compare(root);

    expect(report?.changed.map((difference) => difference.field)).toContain("title");
  });

  it("does not write anything", () => {
    writeFileSync(join(root, "docs/ai/rules/local-rule.yaml"), RULE, "utf8");

    expect(runUpgrade(root)).toBe(0);

    expect(existsSync(join(root, "docs/ai/rules/never-commit-to-the-default-branch.yaml"))).toBe(
      false,
    );
    expect(readFileSync(join(root, "docs/ai/rules/local-rule.yaml"), "utf8")).toBe(RULE);
  });
});
