import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncAgentRules } from "./sync-agent-rules";

const README = `# Lagan

A systems-engineering LMS with one Next.js app and shared packages.

---

## Quick start

\`\`\`bash
bun install
bun run dev
\`\`\`

### Gates

\`\`\`bash
bun run test
\`\`\`
`;

const RULE = `id: sample-rule
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
protects:
  - path: src/guard.ts
    protection: The guard is the mechanism behind the sample rule.
`;

const MULTILINE_RULE = `id: multiline-rule
title: The multiline rule holds.
layer: runtime
enforced_by:
  - path: src/guard.ts
    match: |
      export const guard = true;
      export const other = true;
artifact:
  - path: src/guard.test.ts
failure: |
  2026-10-20. The guard was missing, so the sample broke.
owner: "@paramcodes"
protects:
  - path: src/guard.ts
    protection: The multiline guard is the mechanism behind the sample rule.
`;

describe("syncAgentRules", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lagan-sync-"));
    write("README.md", README);
    write("docs/ai/rules/sample-rule.yaml", RULE);
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  function write(relativePath: string, contents: string): void {
    const file = join(root, relativePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents, "utf8");
  }

  function read(relativePath: string): string {
    return readFileSync(join(root, relativePath), "utf8");
  }

  it("writes the three projections", () => {
    const result = syncAgentRules({ root, check: false });

    expect(result.changed).toEqual([
      "AGENTS.md",
      ".github/CODEOWNERS",
      "docs/ai/protected-paths.md",
    ]);
    expect(read("AGENTS.md")).toContain("GENERATED FILE");
    expect(read(".github/CODEOWNERS")).toContain("src/guard.ts @paramcodes");
    expect(read("docs/ai/protected-paths.md")).toContain("repository-enforced");
  });

  it("passes the check right after generating", () => {
    syncAgentRules({ root, check: false });

    const result = syncAgentRules({ root, check: true });

    expect(result.changed).toEqual([]);
  });

  it("fails the check when a projection is edited by hand", () => {
    syncAgentRules({ root, check: false });
    write("docs/ai/protected-paths.md", `${read("docs/ai/protected-paths.md")}\nhand edited\n`);

    const result = syncAgentRules({ root, check: true });

    expect(result.changed).toEqual(["docs/ai/protected-paths.md"]);
  });

  it("writes nothing in check mode", () => {
    syncAgentRules({ root, check: false });
    write("AGENTS.md", "hand edited\n");

    syncAgentRules({ root, check: true });

    expect(read("AGENTS.md")).toBe("hand edited\n");
  });

  it("keeps what a human wrote outside the CODEOWNERS block", () => {
    write(".github/CODEOWNERS", "# written by a human\n\n* @paramcodes\n");

    syncAgentRules({ root, check: false });

    const codeowners = read(".github/CODEOWNERS");
    expect(codeowners).toContain("# written by a human");
    expect(codeowners).toContain("* @paramcodes");
    expect(codeowners).toContain("src/guard.ts @paramcodes");
  });

  it("keeps the generated CODEOWNERS block when it runs twice", () => {
    syncAgentRules({ root, check: false });
    syncAgentRules({ root, check: false });

    const codeowners = read(".github/CODEOWNERS");
    expect(codeowners.match(/BEGIN: generated/g)).toHaveLength(1);
  });

  it("says how to regenerate the routing file and does not restate the rules", () => {
    syncAgentRules({ root, check: false });

    const agents = read("AGENTS.md");
    expect(agents).toContain("bun scripts/sync-agent-rules.ts");
    expect(agents).toContain("docs/ai/rules/");
    expect(agents).toContain("There are 1 rules");
    expect(agents).not.toContain("The sample rule holds.");
  });

  it("refuses to project a table that does not parse", () => {
    write("docs/ai/rules/broken.yaml", "id: broken\n  title: broken\n");

    expect(() => syncAgentRules({ root, check: false })).toThrow(/does not parse/);
    expect(() => read("AGENTS.md")).toThrow();
  });

  it("keeps a multi-line marker in one valid table row", () => {
    write("src/guard.ts", "export const guard = true;\nexport const other = true;\n");
    write("docs/ai/rules/multiline-rule.yaml", MULTILINE_RULE);

    syncAgentRules({ root, check: false });

    const table = read("docs/ai/protected-paths.md");
    const rows = tableRows(table);
    expect(rows.every((row) => row.length === 4)).toBe(true);
    expect(table).toContain("`export const guard = true;`<br>`export const other = true;`");
    expect(
      table.split("\n").filter((line) => line.includes("export const guard = true;`<br>")),
    ).toHaveLength(1);
  });
});

function tableRows(markdown: string): string[][] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}
