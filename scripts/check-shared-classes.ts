#!/usr/bin/env bun
/**
 * Guards the production CSS against classes that only a shared workspace
 * package uses.
 *
 * Tailwind scans the directory of the stylesheet, so a package outside
 * apps/web stays invisible to the build unless the stylesheet registers it
 * with `@source`. The check compiles the stylesheet for the candidates found in
 * the shared packages and compares the class names Tailwind emits for them
 * with the class names in the built CSS. Tailwind drops the candidates it does
 * not recognise, so the comparison only ever reports real utilities.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Shared packages whose classes the app renders. Keep in step with the `@source` entries in the stylesheet. */
export const SHARED_PACKAGE_DIRS = ["packages/ui/src"];

/** The app that owns the stylesheet and the build output. */
export const APP_DIRS = ["apps/web"];

export const STYLESHEET = "apps/web/app/globals.css";

export const BUILD_DIR = "apps/web/.next";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"]);

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

/** Characters that end a Tailwind candidate outside of an arbitrary value. */
const CANDIDATE_TERMINATORS = new Set([
  '"',
  "#",
  "$",
  "%",
  "&",
  "(",
  ")",
  "*",
  "+",
  ",",
  ";",
  "<",
  "=",
  ">",
  "?",
  "@",
  "~",
  "`",
]);

/** Characters that end a CSS class name. */
const CSS_NAME_STOP = new Set([
  '"',
  "#",
  "%",
  "&",
  "(",
  ")",
  "*",
  "+",
  ",",
  "/",
  ";",
  ":",
  "<",
  "=",
  ">",
  "[",
  "]",
  "^",
  "{",
  "|",
  "}",
  "~",
  "!",
  " ",
  "\t",
  "\n",
  "\r",
  "\f",
]);

/** Characters that may follow a CSS class name in a selector. */
const CSS_SELECTOR_BOUNDARY = new Set([
  "{",
  ",",
  ":",
  ".",
  ">",
  "+",
  "~",
  ")",
  "]",
  " ",
  "\t",
  "\n",
]);

export interface SharedClassCheckResult {
  ok: boolean;
  missing: string[];
  cssFiles: string[];
  sharedCandidates: number;
  sharedOnlyCandidates: number;
}

/** Reads the contents of every string literal, including the parts of a template literal. */
export function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index);
      if (index === -1) break;
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const start = ++index;
      while (index < source.length && source[index] !== char) {
        if (source[index] === "\\") index++;
        index++;
      }
      literals.push(source.slice(start, index));
      index++;
      continue;
    }

    if (char === "`") {
      index = readTemplateLiteral(source, index + 1, literals);
      continue;
    }

    index++;
  }

  return literals;
}

function readTemplateLiteral(source: string, index: number, literals: string[]): number {
  let chunkStart = index;

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }

    if (source[index] === "`") {
      literals.push(source.slice(chunkStart, index));
      return index + 1;
    }

    if (source[index] === "$" && source[index + 1] === "{") {
      literals.push(source.slice(chunkStart, index));
      const expressionStart = index + 2;
      let depth = 1;
      index = expressionStart;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (char === "{") depth++;
        else if (char === "}") depth--;
        else if (char === '"' || char === "'" || char === "`") {
          const quote = char;
          index++;
          while (index < source.length && source[index] !== quote) {
            if (source[index] === "\\") index++;
            index++;
          }
        }
        if (depth > 0) index++;
      }
      literals.push(...extractStringLiterals(source.slice(expressionStart, index)));
      index++;
      chunkStart = index;
      continue;
    }

    index++;
  }

  literals.push(source.slice(chunkStart, index));
  return index;
}

/**
 * Splits a literal into Tailwind candidates.
 *
 * A candidate never holds whitespace, so an arbitrary value that contains one
 * is not a candidate. Anything Tailwind would reject outright, such as a
 * candidate holding a comma or a quote, is dropped rather than reported.
 */
export function splitCandidates(literal: string): string[] {
  const candidates: string[] = [];

  for (const chunk of literal.split(/\s+/)) {
    if (chunk.length > 0 && isCandidate(chunk)) candidates.push(chunk);
  }

  return candidates;
}

function isCandidate(chunk: string): boolean {
  let depth = 0;

  for (let index = 0; index < chunk.length; index++) {
    const char = chunk[index] ?? "";

    if (char === "[") {
      depth++;
      continue;
    }

    if (char === "]") {
      depth--;
      if (depth < 0) return false;
      continue;
    }

    if (depth > 0) {
      if (char === '"' || char === "'" || char === "`") return false;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") return false;
    if (CANDIDATE_TERMINATORS.has(char)) return false;
    if (char === "." && !isDecimalPoint(chunk, index)) return false;
  }

  return depth === 0;
}

function isDecimalPoint(chunk: string, index: number): boolean {
  const before = chunk[index - 1];
  const after = chunk[index + 1];
  return before !== undefined && after !== undefined && /\d/.test(before) && /\d/.test(after);
}

/** Every Tailwind candidate the source text holds. */
export function extractCandidates(source: string): string[] {
  const candidates: string[] = [];
  for (const literal of extractStringLiterals(source)) candidates.push(...splitCandidates(literal));
  return candidates;
}

/** Every class name the stylesheet selects, with the CSS escapes resolved. */
export function parseCssClassNames(css: string): Set<string> {
  const names = new Set<string>();
  let index = 0;

  while (index < css.length) {
    if (css[index] !== ".") {
      index++;
      continue;
    }

    let end = index + 1;
    let raw = "";
    while (end < css.length) {
      const char = css[end] ?? "";
      if (char === "\\") {
        raw += css.slice(end, end + 2);
        end += 2;
        continue;
      }
      if (CSS_NAME_STOP.has(char)) break;
      raw += char;
      end++;
    }

    if (raw.length > 0 && CSS_SELECTOR_BOUNDARY.has(css[end] ?? "")) {
      names.add(unescapeCssName(raw));
    }

    index = end === index + 1 ? index + 1 : end;
  }

  return names;
}

function unescapeCssName(raw: string): string {
  return raw
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, "$1");
}

/** Every source file below the directory that Tailwind scans. */
export function listSourceFiles(root: string, directory: string): string[] {
  const files: string[] = [];
  const start = resolve(root, directory);
  if (!existsSync(start)) return files;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(full);
    }
  };

  walk(start);
  return files.sort();
}

/** Every Tailwind candidate the directories hold. */
export async function collectCandidates(root: string, directories: string[]): Promise<string[]> {
  const candidates = new Set<string>();
  for (const directory of directories) {
    for (const file of listSourceFiles(root, directory)) {
      for (const candidate of extractCandidates(await readFile(file, "utf8"))) {
        candidates.add(candidate);
      }
    }
  }
  return [...candidates].sort();
}

/** Every stylesheet the production build wrote. The dev output is not part of a build. */
export function findProductionCssFiles(buildDir: string): string[] {
  const files: string[] = [];
  if (!existsSync(buildDir)) return files;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "dev" || entry.name === "cache") continue;
        walk(full);
        continue;
      }
      if (extname(entry.name) === ".css") files.push(full);
    }
  };

  walk(buildDir);
  return files.sort();
}

interface TailwindCompiler {
  compile(
    css: string,
    options: {
      base: string;
      loadStylesheet: (
        id: string,
        base: string,
      ) => Promise<{ path: string; base: string; content: string }>;
    },
  ): Promise<{ build(candidates: string[]): string }>;
}

async function loadTailwind(root: string): Promise<TailwindCompiler> {
  const require = createRequire(join(root, "apps/web/package.json"));
  const entry = require.resolve("tailwindcss");
  const imported = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
  const candidates = [imported, imported["module.exports"], imported.default];
  const compiler = candidates.find(
    (candidate): candidate is TailwindCompiler =>
      typeof candidate === "object" &&
      candidate !== null &&
      typeof (candidate as TailwindCompiler).compile === "function",
  );
  if (!compiler) throw new Error(`Could not load the Tailwind compiler from ${entry}`);
  return compiler;
}

function resolvePackageStylesheet(id: string, require: NodeRequire): string {
  const manifestPath = require.resolve(`${id}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    style?: string;
    exports?: { "."?: { style?: string } | string };
  };
  const entry = manifest.exports?.["."];
  const style =
    (typeof entry === "object" ? entry?.style : undefined) ?? manifest.style ?? "index.css";
  return resolve(dirname(manifestPath), style);
}

async function createStylesheetLoader(root: string) {
  const require = createRequire(join(root, "apps/web/package.json"));
  return async (id: string, base: string) => {
    const path =
      id.startsWith(".") || id.startsWith("/")
        ? resolve(base, id)
        : resolvePackageStylesheet(id, require);
    return { path, base: dirname(path), content: await readFile(path, "utf8") };
  };
}

/** The class names Tailwind emits for the candidates, which is the set the build owes the page. */
export async function compileReferenceClassNames(
  root: string,
  candidates: string[],
): Promise<Set<string>> {
  const stylesheetPath = resolve(root, STYLESHEET);
  const tailwind = await loadTailwind(root);
  const compiler = await tailwind.compile(await readFile(stylesheetPath, "utf8"), {
    base: dirname(stylesheetPath),
    loadStylesheet: await createStylesheetLoader(root),
  });
  return parseCssClassNames(compiler.build(candidates));
}

export interface SharedClassCheckOptions {
  root: string;
  buildDir?: string;
}

/** Fails when a class the shared packages use never reaches the built CSS. */
export async function runSharedClassCheck(
  options: SharedClassCheckOptions,
): Promise<SharedClassCheckResult> {
  const root = options.root;
  const buildDir = options.buildDir ?? resolve(root, BUILD_DIR);

  const cssFiles = findProductionCssFiles(buildDir);
  if (cssFiles.length === 0) {
    throw new Error(`No production CSS found in ${relative(root, buildDir)}. Run the build first.`);
  }

  const sharedCandidates = await collectCandidates(root, SHARED_PACKAGE_DIRS);
  const appCandidates = new Set(await collectCandidates(root, APP_DIRS));
  const sharedOnly = sharedCandidates.filter((candidate) => !appCandidates.has(candidate));

  const reference = await compileReferenceClassNames(root, sharedOnly);
  const expected = sharedOnly.filter((candidate) => reference.has(candidate));

  const built = new Set<string>();
  for (const file of cssFiles) {
    for (const name of parseCssClassNames(await readFile(file, "utf8"))) built.add(name);
  }

  const missing = expected.filter((candidate) => !built.has(candidate)).sort();

  return {
    ok: missing.length === 0,
    missing,
    cssFiles,
    sharedCandidates: sharedCandidates.length,
    sharedOnlyCandidates: sharedOnly.length,
  };
}

function formatReport(result: SharedClassCheckResult, root: string): string {
  const lines = [
    `Shared package classes missing from the production CSS (${result.missing.length}):`,
    ...result.missing.map((name) => `  ${name}`),
    "",
    `Shared package candidates: ${result.sharedCandidates}`,
    `Shared only candidates: ${result.sharedOnlyCandidates}`,
    `Built CSS: ${result.cssFiles.map((file) => relative(root, file)).join(", ")}`,
  ];
  return lines.join("\n");
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await runSharedClassCheck({ root });
  if (result.ok) {
    console.log(
      `Every shared package class reaches the production CSS (${result.sharedOnlyCandidates} shared only candidates).`,
    );
    process.exit(0);
  }
  console.error(formatReport(result, root));
  process.exit(1);
}
