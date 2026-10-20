import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractCandidates,
  extractStringLiterals,
  findProductionCssFiles,
  parseCssClassNames,
  runSharedClassCheck,
  splitCandidates,
} from "./check-shared-classes";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("extractStringLiterals", () => {
  it("reads the contents of quoted and backtick literals", () => {
    const literals = extractStringLiterals(
      "const a = \"one\"; const b = 'two'; const c = `three`;",
    );
    expect(literals).toEqual(["one", "two", "three"]);
  });

  it("reads the parts of a template literal around an interpolation", () => {
    const literals = extractStringLiterals(
      `const a = \`flex \${open ? 'gap-1' : 'gap-2'} items-center\`;`,
    );
    expect(literals).toEqual(["flex ", "gap-1", "gap-2", " items-center"]);
  });

  it("skips comments", () => {
    expect(extractStringLiterals('// "comment"\n/* "block" */ const a = "kept";')).toEqual([
      "kept",
    ]);
  });
});

describe("splitCandidates", () => {
  it("keeps a variant prefix with its utility", () => {
    expect(splitCandidates("dark:hover:bg-zinc-100")).toEqual(["dark:hover:bg-zinc-100"]);
  });

  it("keeps an arbitrary value with its utility", () => {
    expect(splitCandidates("w-[260px] transition-[width] text-[var(--color-ink)]")).toEqual([
      "w-[260px]",
      "transition-[width]",
      "text-[var(--color-ink)]",
    ]);
  });

  it("keeps a decimal value", () => {
    expect(splitCandidates("p-1.5 mt-0.5")).toEqual(["p-1.5", "mt-0.5"]);
  });

  it("drops a candidate that holds a space inside an arbitrary value", () => {
    expect(splitCandidates("bg-[url(a b.png)]")).toEqual([]);
  });

  it("drops a candidate that holds a character Tailwind rejects", () => {
    expect(splitCandidates('foo,bar baz"qux')).toEqual([]);
  });
});

describe("extractCandidates", () => {
  it("reads the classes out of a component", () => {
    const source = [
      'const BASE = "inline-flex items-center gap-1.5 rounded-[var(--radius-chip)]";',
      "export function Badge({ className }) {",
      '  const classes = [BASE, className].filter(Boolean).join(" ");',
      `  return <span className={\`shrink-0 rounded-full bg-current opacity-85 \${BASE}\`} />;`,
      "}",
    ].join("\n");

    expect(extractCandidates(source)).toEqual(
      expect.arrayContaining([
        "inline-flex",
        "items-center",
        "gap-1.5",
        "rounded-[var(--radius-chip)]",
        "shrink-0",
        "rounded-full",
        "bg-current",
        "opacity-85",
      ]),
    );
  });
});

describe("parseCssClassNames", () => {
  it("resolves the escapes of a class name", () => {
    const names = parseCssClassNames(
      ".transition-\\[width\\]{transition-property:width}.dark\\:border-zinc-800{border-color:#000}",
    );
    expect(names.has("transition-[width]")).toBe(true);
    expect(names.has("dark:border-zinc-800")).toBe(true);
  });

  it("does not read a declaration value as a class name", () => {
    const names = parseCssClassNames(".rounded{border-radius:.25rem}.text-sm{font-size:.875rem}");
    expect(names.has("rounded")).toBe(true);
    expect(names.has("text-sm")).toBe(true);
    expect(names.has("border-radius")).toBe(false);
    expect(names.has(".25rem")).toBe(false);
  });
});

describe("findProductionCssFiles", () => {
  let buildDir: string;

  beforeEach(() => {
    buildDir = mkdtempSync(join(tmpdir(), "lagan-build-"));
  });

  afterEach(() => {
    rmSync(buildDir, { force: true, recursive: true });
  });

  it("finds the stylesheets of a build and leaves the dev output alone", () => {
    mkdirSync(join(buildDir, "static/chunks"), { recursive: true });
    mkdirSync(join(buildDir, "dev/static/chunks"), { recursive: true });
    writeFileSync(join(buildDir, "static/chunks/app.css"), ".flex{display:flex}");
    writeFileSync(join(buildDir, "dev/static/chunks/app.css"), ".flex{display:flex}");

    expect(findProductionCssFiles(buildDir)).toEqual([join(buildDir, "static/chunks/app.css")]);
  });
});

describe("runSharedClassCheck", () => {
  let buildDir: string;

  beforeEach(() => {
    buildDir = mkdtempSync(join(tmpdir(), "lagan-build-"));
  });

  afterEach(() => {
    rmSync(buildDir, { force: true, recursive: true });
  });

  it("reports the shared package classes that the built CSS lacks", async () => {
    writeFileSync(join(buildDir, "app.css"), "");

    const result = await runSharedClassCheck({ root: ROOT, buildDir });

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("transition-[width]");
    expect(result.missing).toContain("ease-out");
    expect(result.missing).toContain("w-[64px]");
  });

  it("passes once the built CSS holds every shared package class", async () => {
    writeFileSync(join(buildDir, "app.css"), "");

    const missing = await runSharedClassCheck({ root: ROOT, buildDir });
    const css = missing.missing.map((name) => `.${escapeCssName(name)}{}`).join("\n");
    writeFileSync(join(buildDir, "app.css"), css);

    const result = await runSharedClassCheck({ root: ROOT, buildDir });

    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

function escapeCssName(name: string): string {
  return name.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}
