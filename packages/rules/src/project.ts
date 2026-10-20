import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const RULES_DIR = "docs/ai/rules";
export const CONTEXT_FILE = "docs/ai/context.yaml";
export const PROTECTED_PATHS_FILE = "docs/ai/protected-paths.md";
export const CODEOWNERS_FILE = ".github/CODEOWNERS";
export const CI_FILE = ".github/workflows/ci.yml";
export const AUDITOR_FILE = "scripts/audit-rules.ts";
export const PROJECTOR_FILE = "scripts/sync-agent-rules.ts";
export const SKILL_FILE = ".opencode/skills/agent-rules/SKILL.md";
export const COMMAND_DIR = ".opencode/command";

/**
 * Where a project's own copy of the auditor can be.
 *
 * The package's own template is on the list because the repository that publishes the
 * package uses it in place. The package must never fall back to auditing itself, because
 * that would check the package instead of the project.
 */
export const AUDITOR_CANDIDATES = [AUDITOR_FILE, "packages/rules/templates/audit-rules.ts"];

/**
 * Where a project's own copy of the projector can be.
 */
export const PROJECTOR_CANDIDATES = [PROJECTOR_FILE, "packages/rules/templates/sync-agent-rules.ts"];

export const COMMANDS = ["rules-init.md", "rules-audit.md", "rules-new.md", "rules-upgrade.md"];

export function findLocalScript(root: string, candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(join(root, candidate)));
}

export function readProjectFile(root: string, relativePath: string): string | undefined {
  const file = join(root, relativePath);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

export function writeProjectFile(root: string, relativePath: string, contents: string): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents, "utf8");
}

export interface Manifest {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export function readManifest(root: string): Manifest {
  const source = readProjectFile(root, "package.json");
  if (source === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(source);
    return typeof parsed === "object" && parsed !== null ? (parsed as Manifest) : {};
  } catch {
    return {};
  }
}

export function writeManifest(root: string, manifest: Manifest): void {
  writeProjectFile(root, "package.json", `${JSON.stringify(manifest, null, 2)}\n`);
}
