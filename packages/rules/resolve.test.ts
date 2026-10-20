import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadRuleTable, runAudit, type AuditResult } from "../../scripts/audit-rules";
import { buildProtectedPaths } from "../../scripts/sync-agent-rules";
import {
  detectFacts,
  detectOwner,
  loadCatalogue,
  parseCatalogue,
  resolveCatalogue,
  writeRules,
  type Catalogue,
} from "./resolve";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOGUE_DIR = join(REPO_ROOT, "packages/rules/catalogues");
const BARE_PACKAGE = {
  name: "bare-app",
  private: true,
  dependencies: { next: "16.4.2", react: "19.3.0", "react-dom": "19.3.0" },
};

function catalogue(name: string): Catalogue {
  return loadCatalogue(join(CATALOGUE_DIR, name));
}

function mirrorRepository(root: string, source: string): void {
  for (const name of readdirSync(source)) {
    if (name === "docs" || name === ".git") continue;
    symlinkSync(join(source, name), join(root, name), "dir");
  }
}

describe("resolveCatalogue", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "lagan-rules-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  function audit(resolved: Catalogue, source: string): AuditResult {
    const facts = detectFacts(source, resolved.stack);
    const resolution = resolveCatalogue(resolved, {
      root: source,
      facts,
      owner: detectOwner(REPO_ROOT),
    });
    mirrorRepository(workspace, source);
    const target = join(workspace, "docs/ai/rules");
    writeRules(resolution.rules, target);
    const table = loadRuleTable(workspace);
    writeFileSync(
      join(workspace, "docs/ai/protected-paths.md"),
      buildProtectedPaths(table.rules),
      "utf8",
    );
    return runAudit(workspace);
  }

  it("writes a table the auditor accepts for this repository", () => {
    const resolved = catalogue("nextjs-bun.yaml");
    const result = audit(resolved, REPO_ROOT);

    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary.rules).toBe(17);
  });

  it("writes a table the auditor accepts for the Postgres catalogue", () => {
    const resolved = catalogue("nextjs-bun-postgres.yaml");
    const result = audit(resolved, REPO_ROOT);

    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary.rules).toBe(21);
  });

  it("gives every policy an artifact, so no policy is a rule with no evidence", () => {
    const resolved = catalogue("nextjs-bun.yaml");
    const facts = detectFacts(REPO_ROOT, resolved.stack);
    const resolution = resolveCatalogue(resolved, {
      root: REPO_ROOT,
      facts,
      owner: detectOwner(REPO_ROOT),
    });
    const policies = resolution.rules.filter((rule) =>
      resolved.policies.some((policy) => policy.id === rule.id),
    );

    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.artifact.length).toBeGreaterThan(0);
      expect(policy.document).toContain("artifact:");
    }
  });

  it("writes the owner with the at sign the codeowners file needs", () => {
    const resolved = catalogue("nextjs-bun.yaml");
    const facts = detectFacts(REPO_ROOT, resolved.stack);
    const resolution = resolveCatalogue(resolved, {
      root: REPO_ROOT,
      facts,
      owner: detectOwner(REPO_ROOT),
    });

    expect(detectOwner(REPO_ROOT)).toBe("@paramcodes");
    for (const rule of resolution.rules) {
      expect(rule.document).toContain('owner: "@paramcodes"');
    }
  });

  it("resolves a bare repository to the policies alone", () => {
    const bare = join(workspace, "bare");
    mkdirSync(bare, { recursive: true });
    writeFileSync(join(bare, "package.json"), JSON.stringify(BARE_PACKAGE, null, 2), "utf8");

    const resolved = catalogue("nextjs-bun.yaml");
    const facts = detectFacts(bare, resolved.stack);
    const resolution = resolveCatalogue(resolved, { root: bare, facts, owner: "@paramcodes" });

    expect(Object.keys(facts)).toEqual(["framework_version"]);
    expect(resolution.derived).toBe(0);
    expect(resolution.policies).toBe(4);
    expect(resolution.rules).toHaveLength(4);
    for (const rule of resolution.rules) {
      expect(resolved.policies.some((policy) => policy.id === rule.id)).toBe(true);
    }
  });

  it("audits the table a bare repository produces", () => {
    const bare = join(workspace, "bare");
    mkdirSync(bare, { recursive: true });
    writeFileSync(join(bare, "package.json"), JSON.stringify(BARE_PACKAGE, null, 2), "utf8");

    const resolved = catalogue("nextjs-bun.yaml");
    const result = audit(resolved, bare);

    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary.rules).toBe(4);
  });

  it("resolves the same counts the readme states", () => {
    const bare = join(workspace, "bare");
    mkdirSync(bare, { recursive: true });
    writeFileSync(join(bare, "package.json"), JSON.stringify(BARE_PACKAGE, null, 2), "utf8");

    for (const name of ["nextjs-bun.yaml", "nextjs-bun-postgres.yaml"]) {
      const resolved = catalogue(name);
      const here = resolveCatalogue(resolved, {
        root: REPO_ROOT,
        facts: detectFacts(REPO_ROOT, resolved.stack),
        owner: "@paramcodes",
      });
      const there = resolveCatalogue(resolved, {
        root: bare,
        facts: detectFacts(bare, resolved.stack),
        owner: "@paramcodes",
      });

      expect(here.derived + here.policies).toBe(name === "nextjs-bun.yaml" ? 17 : 21);
      expect(there.derived + there.policies).toBe(4);
    }
  });
});

describe("parseCatalogue", () => {
  it("rejects a fact that is not in the set", () => {
    const { problems } = parseCatalogue(
      `id: broken
stack:
  framework: next
  package_manager: bun
rules:
  - id: broken-rule
    title: A rule.
    derive:
      - fact: the_coffee_is_ready
    layer: prose
    note: A note.
`,
      "broken.yaml",
    );

    expect(problems.join("\n")).toContain("the_coffee_is_ready");
  });

  it("rejects a derived rule with no condition", () => {
    const { problems } = parseCatalogue(
      `id: broken
stack:
  framework: next
  package_manager: bun
rules:
  - id: broken-rule
    title: A rule.
    layer: prose
    note: A note.
`,
      "broken.yaml",
    );

    expect(problems.join("\n")).toContain("needs at least one condition");
  });

  it("rejects a policy with a condition", () => {
    const { problems } = parseCatalogue(
      `id: broken
stack:
  framework: next
  package_manager: bun
policies:
  - id: broken-policy
    title: A policy.
    derive:
      - fact: has_lockfile
    layer: prose
    note: A note.
`,
      "broken.yaml",
    );

    expect(problems.join("\n")).toContain("a policy is unconditional");
  });

  it("rejects a layer outside the closed set", () => {
    const { problems } = parseCatalogue(
      `id: broken
stack:
  framework: next
  package_manager: bun
rules:
  - id: broken-rule
    title: A rule.
    derive:
      - fact: has_lockfile
    layer: runtime-ish
    note: A note.
`,
      "broken.yaml",
    );

    expect(problems.join("\n")).toContain("is not one of");
  });
});
