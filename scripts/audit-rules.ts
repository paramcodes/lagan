#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const RULE_LAYERS = ["type", "primitive", "runtime", "test", "lint", "ci", "prose"] as const;

export type RuleLayer = (typeof RULE_LAYERS)[number];

export const ARTIFACT_LOCATORS = ["pr:", "ci:", "git:"] as const;

export interface Enforcement {
  path: string;
  match?: string;
}

export interface ArtifactRef {
  path: string;
  note?: string;
}

export interface ProtectedPath {
  path: string;
  protection?: string;
}

export interface Rule {
  id: string;
  title: string;
  layer: RuleLayer | null;
  enforced_by: Enforcement[];
  artifact: ArtifactRef[];
  failure: string;
  owner: string;
  protects: ProtectedPath[];
}

export type FindingSeverity = "error" | "warning";

export interface Finding {
  code: string;
  severity: FindingSeverity;
  rule: string;
  message: string;
}

export interface AuditSummary {
  rules: number;
  enforced: number;
  unenforced: number;
  unearned: number;
}

export interface AuditResult {
  ok: boolean;
  root: string;
  rules: Rule[];
  findings: Finding[];
  summary: AuditSummary;
}

export const RULES_DIR = "docs/ai/rules";
export const PROTECTED_PATHS_FILE = "docs/ai/protected-paths.md";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "this",
  "those",
  "to",
  "was",
  "were",
  "when",
  "which",
  "while",
  "with",
]);

const NEGATION_WORDS = new Set([
  "never",
  "not",
  "none",
  "nobody",
  "nothing",
  "neither",
  "cannot",
  "without",
  "avoid",
  "avoided",
  "avoids",
  "forbid",
  "forbidden",
  "forbids",
  "prohibit",
  "prohibited",
  "prohibits",
  "disallow",
  "disallowed",
  "disallows",
  "exclude",
  "excluded",
  "excludes",
  "prevent",
  "prevented",
  "prevents",
]);

const ANTONYM_PAIRS: [string, string][] = [
  ["always", "never"],
  ["allow", "deny"],
  ["allow", "block"],
  ["allow", "forbid"],
  ["allow", "prevent"],
  ["enable", "disable"],
  ["include", "exclude"],
  ["add", "remove"],
  ["before", "after"],
  ["same", "different"],
  ["first", "last"],
  ["start", "stop"],
  ["accept", "reject"],
  ["require", "optional"],
  ["upper", "lower"],
  ["max", "min"],
  ["with", "without"],
  ["must", "may"],
  ["open", "close"],
  ["show", "hide"],
  ["commit", "discard"],
];

const WINDOW = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLocator(value: string): boolean {
  return ARTIFACT_LOCATORS.some((prefix) => value.startsWith(prefix));
}

function singular(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function significantTokens(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const token of tokens) {
    if (token.length < 4) continue;
    if (STOP_WORDS.has(token)) continue;
    if (NEGATION_WORDS.has(token)) continue;
    out.add(singular(token));
  }
  return out;
}

function occurrences(tokens: string[], word: string): number[] {
  const found: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (singular(tokens[index] as string) === word) found.push(index);
  }
  return found;
}

function windowAround(tokens: string[], index: number): string[] {
  const start = Math.max(0, index - WINDOW);
  const end = Math.min(tokens.length, index + WINDOW + 1);
  return tokens.slice(start, end);
}

function hasNegation(window: string[]): boolean {
  return window.some((token) => NEGATION_WORDS.has(token));
}

function antonymBetween(left: string[], right: string[]): boolean {
  const leftWords = new Set(left.map(singular));
  const rightWords = new Set(right.map(singular));
  for (const [a, b] of ANTONYM_PAIRS) {
    if (leftWords.has(a) && rightWords.has(b)) return true;
    if (leftWords.has(b) && rightWords.has(a)) return true;
  }
  return false;
}

/**
 * Contradiction check.
 *
 * It compares two rule titles that share an enforcing path. A shared path is not a
 * contradiction, so the titles must also share a significant word, and that word must sit
 * next to opposite polarity: a negation on one side only, or an antonym pair across the two
 * sides.
 *
 * It does not attempt semantic comparison, does not read the failure text, and cannot tell
 * that "no test skips silently" and "the full suite runs once" talk about different senses of
 * the word "test". A false positive is a review conversation, not a silent pass.
 */
export function titlesContradict(left: string, right: string): boolean {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const leftSignificant = significantTokens(leftTokens);
  const rightSignificant = significantTokens(rightTokens);
  const shared = [...leftSignificant].filter((word) => rightSignificant.has(word));
  if (shared.length === 0) return false;

  for (const word of shared) {
    const leftWindows = occurrences(leftTokens, word).map((index) =>
      windowAround(leftTokens, index),
    );
    const rightWindows = occurrences(rightTokens, word).map((index) =>
      windowAround(rightTokens, index),
    );
    const leftNegated = leftWindows.some(hasNegation);
    const rightNegated = rightWindows.some(hasNegation);
    if (leftNegated !== rightNegated) return true;
    for (const leftWindow of leftWindows) {
      for (const rightWindow of rightWindows) {
        if (antonymBetween(leftWindow, rightWindow)) return true;
      }
    }
  }

  return false;
}

function finding(code: string, severity: FindingSeverity, rule: string, message: string): Finding {
  return { code, severity, rule, message };
}

function parseEnforcement(value: unknown): { entries: Enforcement[]; errors: string[] } {
  if (value === undefined || value === null) return { entries: [], errors: [] };
  if (!Array.isArray(value)) return { entries: [], errors: ["enforced_by must be a list"] };
  const entries: Enforcement[] = [];
  const errors: string[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      errors.push(`enforced_by[${index}] must be an object with a path`);
      continue;
    }
    if (!isNonEmptyString(item.path)) {
      errors.push(`enforced_by[${index}].path must be a non-empty string`);
      continue;
    }
    const entry: Enforcement = { path: item.path };
    if (item.match !== undefined) {
      if (!isNonEmptyString(item.match)) {
        errors.push(`enforced_by[${index}].match must be a non-empty string`);
        continue;
      }
      entry.match = item.match;
    }
    entries.push(entry);
  }
  return { entries, errors };
}

function parseArtifacts(value: unknown): { entries: ArtifactRef[]; errors: string[] } {
  if (!Array.isArray(value)) return { entries: [], errors: ["artifact must be a list"] };
  const entries: ArtifactRef[] = [];
  const errors: string[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      errors.push(`artifact[${index}] must be an object with a path`);
      continue;
    }
    if (!isNonEmptyString(item.path)) {
      errors.push(`artifact[${index}].path must be a non-empty string`);
      continue;
    }
    const entry: ArtifactRef = { path: item.path };
    if (item.note !== undefined) {
      if (!isNonEmptyString(item.note)) {
        errors.push(`artifact[${index}].note must be a non-empty string`);
        continue;
      }
      entry.note = item.note;
    }
    entries.push(entry);
  }
  return { entries, errors };
}

function parseProtects(value: unknown): { entries: ProtectedPath[]; errors: string[] } {
  if (value === undefined || value === null) return { entries: [], errors: [] };
  if (!Array.isArray(value)) return { entries: [], errors: ["protects must be a list"] };
  const entries: ProtectedPath[] = [];
  const errors: string[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      errors.push(`protects[${index}] must be an object with a path`);
      continue;
    }
    if (!isNonEmptyString(item.path)) {
      errors.push(`protects[${index}].path must be a non-empty string`);
      continue;
    }
    const entry: ProtectedPath = { path: item.path };
    if (item.protection !== undefined) {
      if (!isNonEmptyString(item.protection)) {
        errors.push(`protects[${index}].protection must be a non-empty string`);
        continue;
      }
      entry.protection = item.protection;
    }
    entries.push(entry);
  }
  return { entries, errors };
}

export function parseRuleDocument(
  source: string,
  fileName: string,
): {
  rule: Rule;
  findings: Finding[];
} {
  const findings: Finding[] = [];
  const fileId = fileName.replace(/\.ya?ml$/, "");
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    findings.push(
      finding(
        "invalid-yaml",
        "error",
        fileId,
        `The file is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return {
      rule: {
        id: fileId,
        title: "",
        layer: null,
        enforced_by: [],
        artifact: [],
        failure: "",
        owner: "",
        protects: [],
      },
      findings,
    };
  }

  if (!isRecord(raw)) {
    findings.push(finding("schema", "error", fileId, "The document must be a mapping."));
    return {
      rule: {
        id: fileId,
        title: "",
        layer: null,
        enforced_by: [],
        artifact: [],
        failure: "",
        owner: "",
        protects: [],
      },
      findings,
    };
  }

  const id = isNonEmptyString(raw.id) ? raw.id.trim() : "";
  if (!id) findings.push(finding("schema", "error", fileId, "id must be a non-empty string."));
  else if (id !== fileId)
    findings.push(
      finding("id-filename-mismatch", "error", fileId, `id "${id}" does not match the file name.`),
    );

  const title = isNonEmptyString(raw.title) ? raw.title.trim() : "";
  if (!title)
    findings.push(finding("schema", "error", fileId, "title must be a non-empty string."));

  let layer: RuleLayer | null = null;
  if (!isNonEmptyString(raw.layer)) {
    findings.push(finding("schema", "error", fileId, "layer must be a non-empty string."));
  } else if (!(RULE_LAYERS as readonly string[]).includes(raw.layer)) {
    findings.push(
      finding(
        "unknown-layer",
        "error",
        fileId,
        `layer "${raw.layer}" is not one of ${RULE_LAYERS.join(", ")}.`,
      ),
    );
  } else {
    layer = raw.layer as RuleLayer;
  }

  const enforcement = parseEnforcement(raw.enforced_by);
  const artifacts = parseArtifacts(raw.artifact);
  const protects = parseProtects(raw.protects);
  for (const message of [...enforcement.errors, ...artifacts.errors, ...protects.errors]) {
    findings.push(finding("schema", "error", fileId, message));
  }

  const failure = isNonEmptyString(raw.failure) ? raw.failure.trim() : "";
  const owner = isNonEmptyString(raw.owner) ? raw.owner.trim() : "";

  return {
    rule: {
      id: id || fileId,
      title,
      layer,
      enforced_by: enforcement.entries,
      artifact: artifacts.entries,
      failure,
      owner,
      protects: protects.entries,
    },
    findings,
  };
}

function readRuleFiles(root: string): { fileNames: string[]; error: string | null } {
  const directory = join(root, RULES_DIR);
  if (!existsSync(directory)) return { fileNames: [], error: `${RULES_DIR} does not exist` };
  const fileNames = readdirSync(directory)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
  return { fileNames, error: null };
}

function readProtectedPathCells(root: string): string[] | null {
  const file = join(root, PROTECTED_PATHS_FILE);
  if (!existsSync(file)) return null;
  const cells: string[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const columns = trimmed.split("|").slice(1, -1);
    const first = (columns[0] ?? "").trim().replace(/`/g, "");
    if (first.length === 0) continue;
    cells.push(first);
  }
  return cells;
}

export function loadRuleTable(root: string): { rules: Rule[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const rules: Rule[] = [];
  const { fileNames, error } = readRuleFiles(root);
  if (error) {
    findings.push(finding("rules-dir-missing", "error", "-", error));
  }

  for (const fileName of fileNames) {
    const source = readFileSync(join(root, RULES_DIR, fileName), "utf8");
    const { rule, findings: parseFindings } = parseRuleDocument(source, fileName);
    rules.push(rule);
    findings.push(...parseFindings);
  }

  return { rules, findings };
}

export function runAudit(root: string): AuditResult {
  const { rules, findings } = loadRuleTable(root);

  for (const rule of rules) {
    for (const enforcement of rule.enforced_by) {
      const target = join(root, enforcement.path);
      if (!existsSync(target)) {
        findings.push(
          finding(
            "enforcement-path-missing",
            "error",
            rule.id,
            `The enforcing path "${enforcement.path}" does not exist.`,
          ),
        );
        continue;
      }
      if (enforcement.match === undefined) continue;
      const contents = readFileSync(target, "utf8");
      if (!contents.includes(enforcement.match)) {
        findings.push(
          finding(
            "enforcement-marker-missing",
            "error",
            rule.id,
            `The marker "${enforcement.match}" is no longer in "${enforcement.path}".`,
          ),
        );
      }
    }

    if (rule.artifact.length === 0) {
      findings.push(finding("artifact-missing", "error", rule.id, "The rule has no artifact."));
    }
    for (const artifact of rule.artifact) {
      if (isLocator(artifact.path)) continue;
      if (!existsSync(join(root, artifact.path))) {
        findings.push(
          finding(
            "artifact-path-missing",
            "error",
            rule.id,
            `The artifact path "${artifact.path}" does not exist.`,
          ),
        );
      }
    }

    if (!rule.failure) {
      findings.push(finding("failure-missing", "error", rule.id, "The rule records no failure."));
    }

    if (!rule.owner) {
      findings.push(finding("owner-missing", "error", rule.id, "The rule has no owner."));
    }

    if (rule.enforced_by.length === 0) {
      findings.push(
        finding(
          "unenforced",
          "warning",
          rule.id,
          "The rule names no mechanism, so nothing enforces it.",
        ),
      );
      if (rule.layer !== null && rule.layer !== "prose") {
        findings.push(
          finding(
            "unenforced-layer",
            "error",
            rule.id,
            `The rule declares layer "${rule.layer}" but names no mechanism.`,
          ),
        );
      }
    }
  }

  findings.push(...findContradictions(rules));

  const protectedCells = readProtectedPathCells(root);
  if (protectedCells !== null) {
    for (const rule of rules) {
      for (const protectedPath of rule.protects) {
        if (!protectedCells.includes(protectedPath.path)) {
          findings.push(
            finding(
              "protected-path-undocumented",
              "error",
              rule.id,
              `The protected path "${protectedPath.path}" is missing from ${PROTECTED_PATHS_FILE}.`,
            ),
          );
        }
      }
    }
  }

  const summary: AuditSummary = {
    rules: rules.length,
    enforced: rules.filter((rule) => rule.enforced_by.length > 0).length,
    unenforced: rules.filter((rule) => rule.enforced_by.length === 0).length,
    unearned: rules.filter((rule) => !rule.failure).length,
  };

  return {
    ok: !findings.some((item) => item.severity === "error"),
    root,
    rules,
    findings,
    summary,
  };
}

function findContradictions(rules: Rule[]): Finding[] {
  const byPath = new Map<string, Rule[]>();
  for (const rule of rules) {
    for (const enforcement of rule.enforced_by) {
      const list = byPath.get(enforcement.path) ?? [];
      list.push(rule);
      byPath.set(enforcement.path, list);
    }
  }

  const findings: Finding[] = [];
  for (const [path, sharing] of byPath) {
    for (let i = 0; i < sharing.length; i += 1) {
      for (let j = i + 1; j < sharing.length; j += 1) {
        const left = sharing[i] as Rule;
        const right = sharing[j] as Rule;
        if (!titlesContradict(left.title, right.title)) continue;
        findings.push(
          finding(
            "contradiction",
            "error",
            left.id,
            `"${left.title}" and "${right.title}" share the enforcing path "${path}" and read as opposite.`,
          ),
        );
      }
    }
  }
  return findings;
}

function formatTable(result: AuditResult): string {
  const headers = ["ID", "LAYER", "ENFORCED", "ARTIFACTS", "OWNER", "TITLE"];
  const rows = result.rules.map((rule) => [
    rule.id,
    rule.layer ?? "-",
    rule.enforced_by.length > 0 ? "yes" : "no",
    String(rule.artifact.length),
    rule.owner || "-",
    rule.title || "-",
  ]);
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join("  ")
      .trimEnd();

  const lines = [
    `Rule table: ${RULES_DIR} (${result.summary.rules} rules)`,
    "",
    line(headers),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
    "",
  ];

  const errors = result.findings.filter((item) => item.severity === "error");
  const warnings = result.findings.filter((item) => item.severity === "warning");
  lines.push(`Findings (${errors.length} errors, ${warnings.length} warnings)`);
  if (result.findings.length === 0) {
    lines.push("  none");
  }
  for (const item of [...errors, ...warnings]) {
    lines.push(
      `  ${item.severity.padEnd(7)} ${item.code.padEnd(28)} ${item.rule.padEnd(34)} ${item.message}`,
    );
  }
  lines.push("");
  lines.push("Summary");
  lines.push(`  rules      ${result.summary.rules}`);
  lines.push(`  enforced   ${result.summary.enforced}`);
  lines.push(`  unenforced ${result.summary.unenforced}`);
  lines.push(`  unearned   ${result.summary.unearned}`);
  return lines.join("\n");
}

function parseArgs(argv: string[]): { json: boolean; root: string } {
  let json = false;
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") json = true;
    else if (arg === "--root") {
      const next = argv[index + 1];
      if (next) {
        root = resolve(next);
        index += 1;
      }
    }
  }
  return { json, root };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const options = parseArgs(process.argv.slice(2));
  const result = runAudit(options.root);
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          root: relative(process.cwd(), result.root) || ".",
          summary: result.summary,
          findings: result.findings,
          rules: result.rules.map((rule) => ({
            id: rule.id,
            title: rule.title,
            layer: rule.layer,
            owner: rule.owner,
            enforcedBy: rule.enforced_by,
            artifacts: rule.artifact,
            protects: rule.protects,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatTable(result));
  }
  process.exit(result.ok ? 0 : 1);
}
