import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const DEFAULT_DATABASE_URL = "postgres://lagan:lagan@localhost:5432/lagan";

const ENV_FILE_NAME = ".env";
const MAX_ENV_FILE_SEARCH_DEPTH = 6;

export type DatabaseUrlSource = "process" | "file" | "default";

export interface DatabaseUrlResolution {
  url: string;
  source: DatabaseUrlSource;
  origin: string;
}

export interface DatabaseUrlOptions {
  env?: Record<string, string | undefined>;
  envFilePath?: string | null;
  defaultUrl?: string | null;
  startDir?: string;
}

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
}

export function readEnvFile(filePath: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    return {};
  }

  const values: Record<string, string> = {};
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignment = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = assignment.indexOf("=");
    if (separator === -1) continue;

    const key = assignment.slice(0, separator).trim();
    if (!key) continue;

    let value = assignment.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length > 1) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function findEnvFile(startDir: string = process.cwd()): string | null {
  let directory = resolve(/*turbopackIgnore: true*/ startDir);

  for (let depth = 0; depth <= MAX_ENV_FILE_SEARCH_DEPTH; depth += 1) {
    const candidate = join(directory, ENV_FILE_NAME);
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(directory, ".git"))) return null;

    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }

  return null;
}

export function resolveDatabaseUrl(options: DatabaseUrlOptions = {}): DatabaseUrlResolution {
  const env = options.env ?? process.env;

  const fromProcess = env.DATABASE_URL?.trim();
  if (fromProcess) {
    return { url: fromProcess, source: "process", origin: "process.env.DATABASE_URL" };
  }

  const envFilePath =
    options.envFilePath === undefined ? findEnvFile(options.startDir) : options.envFilePath;
  if (envFilePath) {
    const fromFile = readEnvFile(envFilePath).DATABASE_URL?.trim();
    if (fromFile) {
      return { url: fromFile, source: "file", origin: envFilePath };
    }
  }

  const defaultUrl = options.defaultUrl?.trim();
  if (defaultUrl) {
    return { url: defaultUrl, source: "default", origin: "built-in default" };
  }

  throw new Error(
    "DATABASE_URL is not set. Export DATABASE_URL before starting the app, or add a " +
      `DATABASE_URL entry to the ${ENV_FILE_NAME} file at the repository root. ` +
      "See .env.example for the expected format.",
  );
}

export function describeDatabaseTarget(url: string): DatabaseTarget {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "unknown",
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "unknown",
    };
  } catch {
    return { host: "unknown", port: "unknown", database: "unknown" };
  }
}

let hasLoggedDatabaseTarget = false;

export function logDatabaseTarget(resolution: DatabaseUrlResolution): void {
  if (hasLoggedDatabaseTarget) return;
  hasLoggedDatabaseTarget = true;

  const target = describeDatabaseTarget(resolution.url);
  console.log(
    `[lagan] database target host=${target.host} port=${target.port} ` +
      `database=${target.database} source=${resolution.source}`,
  );

  if (resolution.source === "default") {
    console.warn(
      "[lagan] DATABASE_URL is not set, so the built-in default database target is used. " +
        "Set DATABASE_URL to point the app at the intended database.",
    );
  }
}
