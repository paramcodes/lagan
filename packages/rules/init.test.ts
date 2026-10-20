import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAudit } from "./src/audit";
import { runInit } from "./src/init";

const BARE_PACKAGE = {
  name: "bare-app",
  private: true,
  dependencies: { next: "16.4.2", react: "19.3.0", "react-dom": "19.3.0" },
};

describe("runInit", () => {
  let root: string;
  let output: string[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lagan-init-"));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify(BARE_PACKAGE, null, 2), "utf8");
    output = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      output.push(String(line));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  function text(relativePath: string): string {
    return readFileSync(join(root, relativePath), "utf8");
  }

  it("writes the project local files and proves the check works", async () => {
    const code = await runInit({ root, yes: true, owner: "acme" });

    expect(code).toBe(0);
    expect(existsSync(join(root, "docs/ai/rules/never-commit-to-the-default-branch.yaml"))).toBe(
      true,
    );
    expect(existsSync(join(root, "scripts/audit-rules.ts"))).toBe(true);
    expect(existsSync(join(root, "scripts/sync-agent-rules.ts"))).toBe(true);
    expect(existsSync(join(root, "docs/ai/context.yaml"))).toBe(true);
    expect(existsSync(join(root, ".opencode/skills/agent-rules/SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".opencode/command/rules-audit.md"))).toBe(true);
  });

  it("writes the four rules a bare repository gets", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    const table = output.join("\n");
    expect(table).toContain("Candidates (4)");
    expect(table).toContain("Failure-derived rules: 0");
    expect(table).toContain("This project has not had a failure yet");
  });

  it("owns the rule table and the code owners file with the answer", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    expect(text(".github/CODEOWNERS")).toContain("docs/ai/rules/ @acme");
    expect(text(".github/CODEOWNERS")).toContain(".github/CODEOWNERS @acme");
    expect(text("docs/ai/rules/never-commit-to-the-default-branch.yaml")).toContain(
      'owner: "@acme"',
    );
  });

  it("keeps what a human wrote outside the code owners block", async () => {
    mkdirSync(join(root, ".github"), { recursive: true });
    writeFileSync(join(root, ".github/CODEOWNERS"), "# written by a human\n\n* @acme\n", "utf8");

    await runInit({ root, yes: true, owner: "acme" });

    expect(text(".github/CODEOWNERS")).toContain("# written by a human");
    expect(text(".github/CODEOWNERS")).toContain("docs/ai/rules/ @acme");
  });

  it("writes a CI job that audits the table", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    const workflow = text(".github/workflows/ci.yml");
    expect(workflow).toContain("jobs:");
    expect(workflow).toContain("agent-rules:");
    expect(workflow).toContain("bun run rules:audit");
    expect(workflow).toContain("bun run rules:sync:check");
  });

  it("adds the scripts the project needs", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    const manifest = JSON.parse(text("package.json")) as { scripts: Record<string, string> };
    expect(manifest.scripts["rules:audit"]).toBe("bun scripts/audit-rules.ts");
    expect(manifest.scripts["rules:sync:check"]).toBe("bun scripts/sync-agent-rules.ts --check");
  });

  it("leaves a table the auditor accepts", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    expect(runAudit(root)).toBe(0);
  });

  it("breaks a rule on purpose and puts it back", async () => {
    await runInit({ root, yes: true, owner: "acme" });

    const table = output.join("\n");
    expect(table).toContain("The check works");
    expect(table).toContain("the audit failed");
    expect(table).toContain("the audit passed");
  });
});

describe("runAudit", () => {
  it("says so when the project has no copy of the auditor", () => {
    const root = mkdtempSync(join(tmpdir(), "lagan-noaudit-"));
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((line) => String(line)).join(" "));
    });

    const code = runAudit(root);

    expect(code).toBe(1);
    expect(errors.join(" ")).toContain("This project has no auditor");
    expect(errors.join(" ")).toContain("check the package instead of the project");
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
});
