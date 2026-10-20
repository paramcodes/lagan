#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

export const CATALOGUE_DIR = "packages/rules/catalogues";
export const RULES_DIR = "docs/ai/rules";
export const PR_COMMENT = "pr:comment";

export const FACTS = [
  "linter_config_exists",
  "ci_workflow_exists",
  "test_script_exists",
  "typecheck_script_exists",
  "build_script_exists",
  "format_script_exists",
  "lint_script_exists",
  "framework_version",
  "database_configured",
  "monorepo_with_packages",
  "e2e_suite_exists",
  "precommit_hook_exists",
  "has_lockfile",
] as const;

export type Fact = (typeof FACTS)[number];

export const LAYERS = ["type", "primitive", "runtime", "test", "lint", "ci", "prose"] as const;

export type Layer = (typeof LAYERS)[number];

export interface FactCondition {
  fact: Fact;
  value?: string;
}

export interface PathCondition {
  path: string;
  match?: string;
}

export type Condition = FactCondition | PathCondition;

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

export interface Derivation {
  id: string;
  title: string;
  derive: Condition[];
  layer: Layer;
  enforced_by: Enforcement[];
  artifact: ArtifactRef[];
  owner: string;
  protects: ProtectedPath[];
  note: string;
}

export interface Stack {
  framework: string;
  package_manager: string;
}

export interface Catalogue {
  id: string;
  title: string;
  applies_to: string;
  stack: Stack;
  rules: Derivation[];
  policies: Derivation[];
}

export interface ResolvedRule {
  id: string;
  document: string;
  enforced_by: Enforcement[];
  artifact: ArtifactRef[];
  protects: ProtectedPath[];
}

export interface Skipped {
  id: string;
  reason: string;
}

export interface Resolution {
  catalogue: string;
  rules: ResolvedRule[];
  skipped: Skipped[];
  derived: number;
  policies: number;
}

export type Facts = Partial<Record<Fact, string>>;

const LINTER_CONFIGS = [
  "biome.json",
  "biome.jsonc",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.ts",
  ".eslintrc.json",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

const E2E_CONFIGS = [
  "playwright.config.ts",
  "playwright.config.js",
  "cypress.config.ts",
  "cypress.config.js",
];

const HOOK_CONFIGS = [
  "lefthook.yml",
  ".lefthook.yml",
  ".pre-commit-config.yaml",
  ".husky/pre-commit",
];

const LOCKFILES: Record<string, string[]> = {
  bun: ["bun.lock", "bun.lockb"],
  npm: ["package-lock.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
};

const SCRIPT_FACTS: [Fact, string][] = [
  ["test_script_exists", "test"],
  ["typecheck_script_exists", "typecheck"],
  ["build_script_exists", "build"],
  ["format_script_exists", "format"],
  ["lint_script_exists", "lint"],
];

const DATABASE_NAME = /(?:^|_)(?:DATABASE|POSTGRES|PG|DB)(?:_|$)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function readJson(path: string): Record<string, unknown> | undefined {
  const raw = readText(path);
  if (raw.length === 0) return undefined;
  try {
    const parsed = parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNonEmptyString);
}

function parseConditions(value: unknown, problems: string[], owner: string): Condition[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${owner}: derive must be a list of conditions.`);
    return [];
  }
  const conditions: Condition[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      problems.push(`${owner}: derive[${index}] must be a mapping.`);
      continue;
    }
    if (isNonEmptyString(item.fact)) {
      if (!(FACTS as readonly string[]).includes(item.fact)) {
        problems.push(
          `${owner}: derive[${index}] uses the fact "${item.fact}", which is not one of ${FACTS.join(", ")}.`,
        );
        continue;
      }
      const condition: FactCondition = { fact: item.fact as Fact };
      if (item.value !== undefined) {
        if (!isNonEmptyString(item.value)) {
          problems.push(`${owner}: derive[${index}].value must be a non-empty string.`);
          continue;
        }
        condition.value = item.value;
      }
      conditions.push(condition);
      continue;
    }
    if (isNonEmptyString(item.path)) {
      const condition: PathCondition = { path: item.path };
      if (item.match !== undefined) {
        if (!isNonEmptyString(item.match)) {
          problems.push(`${owner}: derive[${index}].match must be a non-empty string.`);
          continue;
        }
        condition.match = item.match;
      }
      conditions.push(condition);
      continue;
    }
    problems.push(`${owner}: derive[${index}] must name a fact or a path.`);
  }
  return conditions;
}

function parseEnforcement(value: unknown, problems: string[], owner: string): Enforcement[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${owner}: enforced_by must be a list.`);
    return [];
  }
  const entries: Enforcement[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.path)) {
      problems.push(`${owner}: enforced_by[${index}] must name a path.`);
      continue;
    }
    const entry: Enforcement = { path: item.path };
    if (item.match !== undefined) {
      if (!isNonEmptyString(item.match)) {
        problems.push(`${owner}: enforced_by[${index}].match must be a non-empty string.`);
        continue;
      }
      entry.match = item.match;
    }
    entries.push(entry);
  }
  return entries;
}

function parseArtifacts(value: unknown, problems: string[], owner: string): ArtifactRef[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${owner}: artifact must be a list.`);
    return [];
  }
  const entries: ArtifactRef[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.path)) {
      problems.push(`${owner}: artifact[${index}] must name a path.`);
      continue;
    }
    const entry: ArtifactRef = { path: item.path };
    if (item.note !== undefined) {
      if (!isNonEmptyString(item.note)) {
        problems.push(`${owner}: artifact[${index}].note must be a non-empty string.`);
        continue;
      }
      entry.note = item.note;
    }
    entries.push(entry);
  }
  return entries;
}

function parseProtects(value: unknown, problems: string[], owner: string): ProtectedPath[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${owner}: protects must be a list.`);
    return [];
  }
  const entries: ProtectedPath[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.path)) {
      problems.push(`${owner}: protects[${index}] must name a path.`);
      continue;
    }
    const entry: ProtectedPath = { path: item.path };
    if (item.protection !== undefined) {
      if (!isNonEmptyString(item.protection)) {
        problems.push(`${owner}: protects[${index}].protection must be a non-empty string.`);
        continue;
      }
      entry.protection = item.protection;
    }
    entries.push(entry);
  }
  return entries;
}

function emptyDerivation(): Derivation {
  return {
    id: "",
    title: "",
    derive: [],
    layer: "prose",
    enforced_by: [],
    artifact: [],
    owner: "",
    protects: [],
    note: "",
  };
}

function parseDerivation(
  value: unknown,
  problems: string[],
  context: string,
  isPolicy: boolean,
): Derivation {
  if (!isRecord(value)) {
    problems.push(`${context}: a rule must be a mapping.`);
    return emptyDerivation();
  }
  const id = isNonEmptyString(value.id) ? value.id.trim() : "";
  const owner = `${context}:${id || "?"}`;
  if (!id) problems.push(`${owner}: id must be a non-empty string.`);

  const title = isNonEmptyString(value.title) ? value.title.trim() : "";
  if (!title) problems.push(`${owner}: title must be a non-empty string.`);

  const note = isNonEmptyString(value.note) ? value.note.trim() : "";
  if (!note) problems.push(`${owner}: note must be a non-empty string.`);

  let layer: Layer = "prose";
  if (!isNonEmptyString(value.layer)) {
    problems.push(`${owner}: layer must be a non-empty string.`);
  } else if (!(LAYERS as readonly string[]).includes(value.layer)) {
    problems.push(`${owner}: layer "${value.layer}" is not one of ${LAYERS.join(", ")}.`);
  } else {
    layer = value.layer as Layer;
  }

  const derive = parseConditions(value.derive, problems, owner);
  if (!isPolicy && derive.length === 0) {
    problems.push(`${owner}: a derived rule needs at least one condition.`);
  }
  if (isPolicy && derive.length > 0) {
    problems.push(`${owner}: a policy is unconditional and must not have conditions.`);
  }

  return {
    id,
    title,
    derive,
    layer,
    enforced_by: parseEnforcement(value.enforced_by, problems, owner),
    artifact: parseArtifacts(value.artifact, problems, owner),
    owner: isNonEmptyString(value.owner) ? value.owner.trim() : "",
    protects: parseProtects(value.protects, problems, owner),
    note,
  };
}

export function parseCatalogue(
  source: string,
  fileName: string,
): { catalogue: Catalogue; problems: string[] } {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    return {
      catalogue: {
        id: "",
        title: "",
        applies_to: "",
        stack: { framework: "", package_manager: "" },
        rules: [],
        policies: [],
      },
      problems: [
        `${fileName}: the file is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  if (!isRecord(raw)) {
    return {
      catalogue: {
        id: "",
        title: "",
        applies_to: "",
        stack: { framework: "", package_manager: "" },
        rules: [],
        policies: [],
      },
      problems: [`${fileName}: the catalogue must be a mapping.`],
    };
  }

  const stack = asRecord(raw.stack);
  const rules = Array.isArray(raw.rules)
    ? raw.rules.map((item, index) =>
        parseDerivation(item, problems, `${fileName}:rules[${index}]`, false),
      )
    : [];
  const policies = Array.isArray(raw.policies)
    ? raw.policies.map((item, index) =>
        parseDerivation(item, problems, `${fileName}:policies[${index}]`, true),
      )
    : [];

  const seen = new Set<string>();
  for (const rule of [...rules, ...policies]) {
    if (rule.id.length === 0) continue;
    if (seen.has(rule.id)) problems.push(`${fileName}: the rule id "${rule.id}" appears twice.`);
    seen.add(rule.id);
  }

  return {
    catalogue: {
      id: isNonEmptyString(raw.id) ? raw.id.trim() : "",
      title: isNonEmptyString(raw.title) ? raw.title.trim() : "",
      applies_to: isNonEmptyString(raw.applies_to) ? raw.applies_to.trim() : "",
      stack: {
        framework: isNonEmptyString(stack.framework) ? stack.framework.trim() : "",
        package_manager: isNonEmptyString(stack.package_manager)
          ? stack.package_manager.trim()
          : "",
      },
      rules,
      policies,
    },
    problems,
  };
}

export function loadCatalogue(path: string): Catalogue {
  const { catalogue, problems } = parseCatalogue(readText(path), path);
  if (problems.length > 0) {
    throw new Error(
      `The catalogue is not valid:\n${problems.map((problem) => `  ${problem}`).join("\n")}`,
    );
  }
  return catalogue;
}

export function workspaceManifests(root: string): string[] {
  const manifests = ["package.json"];
  for (const group of ["apps", "packages"]) {
    const directory = join(root, group);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory).sort()) {
      const candidate = join(group, name, "package.json");
      if (existsSync(join(root, candidate))) manifests.push(candidate);
    }
  }
  return manifests;
}

function databaseVariable(text: string): string | undefined {
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=/);
    const name = match?.[1];
    if (name && DATABASE_NAME.test(name)) return name;
  }
  return undefined;
}

function databaseVariableIn(root: string): string | undefined {
  for (const source of [".env.example", ".env"]) {
    const found = databaseVariable(readText(join(root, source)));
    if (found) return found;
  }
  const workflows = join(root, ".github/workflows");
  if (existsSync(workflows)) {
    for (const name of readdirSync(workflows).sort()) {
      const found = databaseVariable(readText(join(workflows, name)));
      if (found) return found;
    }
  }
  return undefined;
}

export function detectFacts(root: string, stack: Stack): Facts {
  const facts: Facts = {};

  for (const candidate of LINTER_CONFIGS) {
    if (existsSync(join(root, candidate))) {
      facts.linter_config_exists = candidate;
      break;
    }
  }

  const workflows = join(root, ".github/workflows");
  if (existsSync(workflows)) {
    for (const name of readdirSync(workflows).sort()) {
      if (!/\.ya?ml$/.test(name)) continue;
      if (readText(join(workflows, name)).includes("pull_request")) {
        facts.ci_workflow_exists = `.github/workflows/${name}`;
        break;
      }
    }
  }

  const manifest = readJson(join(root, "package.json"));
  const scripts = asRecord(manifest?.scripts);
  for (const [fact, key] of SCRIPT_FACTS) {
    if (isNonEmptyString(scripts[key])) facts[fact] = key;
  }

  if (stack.framework.length > 0) {
    for (const manifestPath of workspaceManifests(root)) {
      const workspace = readJson(join(root, manifestPath));
      const dependencies = asRecord(workspace?.dependencies);
      const devDependencies = asRecord(workspace?.devDependencies);
      const version = dependencies[stack.framework] ?? devDependencies[stack.framework];
      if (isNonEmptyString(version)) {
        facts.framework_version = `${stack.framework}@${version}`;
        break;
      }
    }
  }

  const database = databaseVariableIn(root);
  if (database) facts.database_configured = database;

  const workspaces = manifest?.workspaces;
  const patterns = Array.isArray(workspaces)
    ? workspaces
    : asStringList(asRecord(workspaces).packages);
  const roots = new Set<string>();
  for (const pattern of patterns) {
    const group = pattern.replace(/\/\*$/, "");
    if (group.length === 0) continue;
    const directory = join(root, group);
    if (!existsSync(directory)) continue;
    const hasPackage = readdirSync(directory).some((name) =>
      existsSync(join(directory, name, "package.json")),
    );
    if (hasPackage) roots.add(group);
  }
  if (roots.size > 0) facts.monorepo_with_packages = [...roots].sort().join(",");

  for (const candidate of E2E_CONFIGS) {
    if (existsSync(join(root, candidate))) {
      facts.e2e_suite_exists = candidate;
      break;
    }
  }

  for (const candidate of HOOK_CONFIGS) {
    if (existsSync(join(root, candidate))) {
      facts.precommit_hook_exists = candidate;
      break;
    }
  }

  for (const candidate of LOCKFILES[stack.package_manager] ?? []) {
    if (existsSync(join(root, candidate))) {
      facts.has_lockfile = candidate;
      break;
    }
  }

  return facts;
}

function factMatches(condition: FactCondition, facts: Facts): boolean {
  const detected = facts[condition.fact];
  if (detected === undefined) return false;
  if (condition.value === undefined) return true;
  if (condition.fact === "framework_version") {
    return detected === condition.value || detected.startsWith(`${condition.value}@`);
  }
  return detected === condition.value;
}

function pathMatches(condition: PathCondition, root: string): boolean {
  const target = join(root, condition.path);
  if (!existsSync(target)) return false;
  if (condition.match === undefined) return true;
  return readText(target).includes(condition.match);
}

export function fillTitle(title: string, facts: Facts): string {
  const framework = facts.framework_version ?? "";
  const separator = framework.indexOf("@");
  const name = separator === -1 ? framework : framework.slice(0, separator);
  const version = separator === -1 ? "" : framework.slice(separator + 1);
  return title
    .replaceAll("{linter}", facts.linter_config_exists ?? "")
    .replaceAll("{framework}", name)
    .replaceAll("{version}", version)
    .replaceAll("{value}", framework);
}

export function detectOwner(root: string): string {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = remote.match(/[:/]([^/:]+)\/[^/]+?(?:\.git)?$/);
    const owner = match?.[1];
    return owner ? `@${owner}` : "";
  } catch {
    return "";
  }
}

function artifactsFor(derivation: Derivation, mechanisms: Enforcement[]): ArtifactRef[] {
  if (derivation.artifact.length > 0) return derivation.artifact;
  if (mechanisms.length > 0) return mechanisms.map((mechanism) => ({ path: mechanism.path }));
  return [{ path: PR_COMMENT }];
}

function protectsFor(derivation: Derivation, mechanisms: Enforcement[]): ProtectedPath[] {
  if (derivation.protects.length > 0) return derivation.protects;
  return mechanisms.map((mechanism) => ({ path: mechanism.path }));
}

export function ruleDocument(
  derivation: Derivation,
  mechanisms: Enforcement[],
  artifacts: ArtifactRef[],
  protects: ProtectedPath[],
  owner: string,
  facts: Facts,
): string {
  const document: Record<string, unknown> = {
    id: derivation.id,
    title: fillTitle(derivation.title, facts),
    layer: derivation.layer,
  };
  if (mechanisms.length > 0) document.enforced_by = mechanisms;
  document.artifact = artifacts;
  document.failure = derivation.note;
  document.owner = owner;
  if (protects.length > 0) document.protects = protects;
  return stringify(document, { lineWidth: 0 });
}

export interface ResolveOptions {
  root: string;
  facts: Facts;
  owner: string;
}

function conditionFailure(condition: Condition, facts: Facts, root: string): string | undefined {
  if ("fact" in condition) {
    if (factMatches(condition, facts)) return undefined;
    return `the fact ${condition.fact} does not hold`;
  }
  if (pathMatches(condition, root)) return undefined;
  return `the path ${condition.path} is not in the repository`;
}

export function resolveCatalogue(catalogue: Catalogue, options: ResolveOptions): Resolution {
  const rules: ResolvedRule[] = [];
  const skipped: Skipped[] = [];
  let derived = 0;
  let policies = 0;

  for (const [index, derivation] of [...catalogue.rules, ...catalogue.policies].entries()) {
    const isPolicy = index >= catalogue.rules.length;
    if (!isPolicy) {
      let failure: string | undefined;
      for (const condition of derivation.derive) {
        failure = conditionFailure(condition, options.facts, options.root);
        if (failure) break;
      }
      if (failure) {
        skipped.push({ id: derivation.id, reason: failure });
        continue;
      }
    }

    const mechanisms = survivingMechanisms(derivation, options.root);
    if (mechanisms.length === 0 && derivation.layer !== "prose") {
      skipped.push({ id: derivation.id, reason: "no mechanism survives in the repository" });
      continue;
    }

    const artifacts = artifactsFor(derivation, mechanisms);
    const protects = protectsFor(derivation, mechanisms);
    const owner = derivation.owner || options.owner;

    rules.push({
      id: derivation.id,
      document: ruleDocument(derivation, mechanisms, artifacts, protects, owner, options.facts),
      enforced_by: mechanisms,
      artifact: artifacts,
      protects,
    });
    if (isPolicy) policies += 1;
    else derived += 1;
  }

  return { catalogue: catalogue.id, rules, skipped, derived, policies };
}

function survivingMechanisms(derivation: Derivation, root: string): Enforcement[] {
  return derivation.enforced_by.filter((entry) => pathMatches(entry, root));
}

export function writeRules(rules: ResolvedRule[], directory: string): string[] {
  const written: string[] = [];
  for (const rule of rules) {
    const path = join(directory, `${rule.id}.yaml`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, rule.document, "utf8");
    written.push(path);
  }
  return written;
}

export function cataloguePaths(root: string): string[] {
  return cataloguePathsIn(join(root, CATALOGUE_DIR));
}

export function cataloguePathsIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort()
    .map((name) => join(directory, name));
}

export function defaultCataloguePaths(): string[] {
  return cataloguePathsIn(join(dirname(fileURLToPath(import.meta.url)), "catalogues"));
}

export interface CliOptions {
  root: string;
  catalogue: string | undefined;
  write: string | undefined;
  owner: string | undefined;
  verbose: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    root: process.cwd(),
    catalogue: undefined,
    write: undefined,
    owner: undefined,
    verbose: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === "--root" && next) {
      options.root = next;
      index += 1;
    } else if (argument === "--catalogue" && next) {
      options.catalogue = next;
      index += 1;
    } else if (argument === "--write" && next) {
      options.write = next;
      index += 1;
    } else if (argument === "--owner" && next) {
      options.owner = next.startsWith("@") ? next : `@${next}`;
      index += 1;
    } else if (argument === "--verbose") {
      options.verbose = true;
    }
  }
  return options;
}

export function main(argv: string[]): number {
  const options = parseArgs(argv);
  const owner = options.owner || detectOwner(options.root);
  const paths = options.catalogue ? [options.catalogue] : defaultCataloguePaths();
  if (paths.length === 0) {
    console.error(`No catalogue was found in ${join(CATALOGUE_DIR, ".")}.`);
    return 1;
  }

  for (const path of paths) {
    const catalogue = loadCatalogue(path);
    const facts = detectFacts(options.root, catalogue.stack);
    const resolution = resolveCatalogue(catalogue, { root: options.root, facts, owner });
    console.log(`${catalogue.id} against ${options.root}`);
    console.log(
      `  derived ${resolution.derived}  policies ${resolution.policies}  total ${resolution.rules.length}`,
    );
    for (const rule of resolution.rules) {
      if (!options.verbose) continue;
      console.log(`  applied ${rule.id}`);
    }
    for (const entry of resolution.skipped) {
      console.log(`  skipped ${entry.id}: ${entry.reason}`);
    }
    if (options.write) {
      const written = writeRules(resolution.rules, options.write);
      console.log(`  wrote ${written.length} rule files to ${options.write}`);
    }
  }
  return 0;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return join(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
