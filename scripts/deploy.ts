/**
 * Build the application, restart it, and prove the running process serves what
 * was just built.
 *
 * The build is the thing `next start` serves. It does not compile from source,
 * so without a build the server keeps serving the previous one and a merged
 * change is invisible.
 *
 * Two identities are recorded. The build id comes from the commit, so the same
 * source always produces the same asset URLs. The deployment id is passed
 * through `NEXT_DEPLOYMENT_ID`, so a browser still holding a page from the
 * previous deployment gets a full page load instead of a broken client
 * navigation.
 *
 * The build goes into a directory named after the commit and the server starts
 * from that directory, so a failed build cannot damage the directory the
 * running server is serving from. A rollback reuses the previous directory.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describeDatabaseTarget, resolveDatabaseUrl } from "../apps/web/lib/env";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(REPO_ROOT, "apps", "web");
const DEPLOY_DIR_PREFIX = ".next-deploy-";

/**
 * Text that only appears when a page failed to render. A process that is up
 * and serving one of these is not a successful deployment, so the check
 * rejects them rather than looking for a positive marker alone.
 */
const ERROR_MARKERS = ["This page couldn't load", "Application error", "Internal Server Error"];

export interface DeployOptions {
  port: number;
  logPath: string;
  healthPath: string;
  expect: string;
  timeoutMs: number;
  reuseDistDir: string | null;
}

export const DEFAULT_OPTIONS: DeployOptions = {
  port: 3100,
  logPath: "/tmp/lagan-prod.log",
  healthPath: "/courses",
  expect: "published courses",
  timeoutMs: 30_000,
  reuseDistDir: null,
};

export interface RunningServer {
  pid: number;
  commit: string;
  distDir: string;
  port: number;
}

export function parseArgs(argv: string[]): DeployOptions {
  const options: DeployOptions = { ...DEFAULT_OPTIONS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    switch (arg) {
      case "--port":
        options.port = Number.parseInt(value ?? "", 10);
        index += 1;
        break;
      case "--log":
        options.logPath = resolve(value ?? DEFAULT_OPTIONS.logPath);
        index += 1;
        break;
      case "--path":
        options.healthPath = value ?? DEFAULT_OPTIONS.healthPath;
        index += 1;
        break;
      case "--expect":
        options.expect = value ?? DEFAULT_OPTIONS.expect;
        index += 1;
        break;
      case "--timeout":
        options.timeoutMs = Number.parseInt(value ?? "", 10) * 1000;
        index += 1;
        break;
      case "--reuse":
        options.reuseDistDir = value ?? null;
        index += 1;
        break;
      default:
        break;
    }
  }
  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new Error(`--port must be a positive number, got ${String(options.port)}`);
  }
  return options;
}

export function commitHash(cwd: string = REPO_ROOT): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const hash = result.stdout.trim();
  if (result.status !== 0 || !hash) {
    throw new Error(`Could not read the git commit in ${cwd}. Is this a git repository?`);
  }
  return hash;
}

/** The directory a commit builds into, so two deployments never share one. */
export function distDirFor(commit: string): string {
  return `${DEPLOY_DIR_PREFIX}${commit.slice(0, 12)}`;
}

export function readBuildId(distDir: string, cwd: string = REPO_ROOT): string | null {
  const buildIdPath = join(cwd, "apps", "web", distDir, "BUILD_ID");
  if (!existsSync(buildIdPath)) return null;
  return readFileSync(buildIdPath, "utf8").trim() || null;
}

export function pidFilePath(logPath: string): string {
  return `${logPath}.pid`;
}

export function readRunningServer(logPath: string): RunningServer | null {
  const path = pidFilePath(logPath);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<RunningServer>;
    if (typeof parsed.pid !== "number" || typeof parsed.commit !== "string") return null;
    return {
      pid: parsed.pid,
      commit: parsed.commit,
      distDir: typeof parsed.distDir === "string" ? parsed.distDir : ".next",
      port: typeof parsed.port === "number" ? parsed.port : 0,
    };
  } catch {
    return null;
  }
}

/** The pid listening on a port, or null. Uses `ss`, which is present on Linux. */
export function findPortPid(port: number): number | null {
  const result = spawnSync("ss", ["-tlnp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  for (const line of result.stdout.split("\n")) {
    if (!line.includes(`:${port} `)) continue;
    const match = /pid=(\d+)/.exec(line);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  }
  return null;
}

export function responseIsHealthy(status: number, body: string, expect: string): boolean {
  if (status !== 200) return false;
  if (ERROR_MARKERS.some((marker) => body.includes(marker))) return false;
  if (!expect) return true;
  return body.includes(expect);
}

export async function waitForHealth(
  url: string,
  expect: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      const body = await response.text();
      if (responseIsHealthy(response.status, body, expect)) return true;
    } catch {
      // The server is not listening yet.
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

/** Deploy directories other than the ones that matter: the current and the one being replaced. */
export function staleDeployDirs(keep: string[], cwd: string = REPO_ROOT): string[] {
  const webDir = join(cwd, "apps", "web");
  if (!existsSync(webDir)) return [];
  return readdirSync(webDir).filter(
    (name) => name.startsWith(DEPLOY_DIR_PREFIX) && !keep.includes(name),
  );
}

function runBuild(commit: string, distDir: string): boolean {
  console.log(`[deploy] building ${commit} into ${distDir}`);
  const result = spawnSync("bun", ["run", "build"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_DEPLOYMENT_ID: commit, NEXT_DIST_DIR: distDir },
  });
  if (result.status !== 0) {
    console.error(result.stdout ?? "");
    console.error(result.stderr ?? "");
    return false;
  }
  return true;
}

function stopPreviousServer(options: DeployOptions): RunningServer | null {
  const running = readRunningServer(options.logPath);

  if (!running) {
    const onPort = findPortPid(options.port);
    if (onPort !== null) {
      console.error(
        `[deploy] port ${options.port} is already held by pid ${onPort} and there is no pid file at ` +
          `${pidFilePath(options.logPath)}. Stop that process, or point --log at the file it was ` +
          "started with.",
      );
      return null;
    }
    return null;
  }

  try {
    process.kill(running.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
  rmSync(pidFilePath(options.logPath), { force: true });
  console.log(`[deploy] stopped pid ${running.pid} serving ${running.commit}`);
  return running;
}

function startServer(
  options: DeployOptions,
  commit: string,
  distDir: string,
  databaseUrl: string,
): number | null {
  mkdirSync(dirname(options.logPath), { recursive: true });
  const out = openSync(options.logPath, "a");
  const child = spawn("bun", ["run", "start", "-p", String(options.port)], {
    cwd: WEB_DIR,
    detached: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NEXT_DEPLOYMENT_ID: commit,
      NEXT_DIST_DIR: distDir,
    },
  });
  child.unref();
  if (child.pid === undefined) return null;
  const running: RunningServer = { pid: child.pid, commit, distDir, port: options.port };
  writeFileSync(pidFilePath(options.logPath), `${JSON.stringify(running, null, 2)}\n`);
  return child.pid;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const database = resolveDatabaseUrl();
  if (database.source === "default") {
    console.error(
      "[deploy] DATABASE_URL is not set, so the built-in default database would be used. Set it in " +
        "the environment or in the .env file at the repository root, so the deployment cannot " +
        "point at a different database than the tests.",
    );
    process.exit(1);
  }
  const target = describeDatabaseTarget(database.url);
  console.log(
    `[deploy] database host=${target.host} port=${target.port} database=${target.database} ` +
      `source=${database.source}`,
  );

  let commit: string;
  let distDir: string;

  if (options.reuseDistDir) {
    distDir = options.reuseDistDir;
    const buildId = readBuildId(distDir);
    if (!buildId) {
      console.error(`[deploy] there is no build in ${distDir}, so there is nothing to reuse`);
      process.exit(1);
    }
    commit = buildId;
    console.log(`[deploy] reusing the existing build ${commit} in ${distDir}`);
  } else {
    commit = commitHash();
    distDir = distDirFor(commit);
    if (!runBuild(commit, distDir)) {
      console.error(
        "[deploy] the build failed, so the running server was left alone. It is still serving from " +
          "its own build directory.",
      );
      process.exit(1);
    }
    const buildId = readBuildId(distDir);
    if (buildId !== commit) {
      console.error(
        `[deploy] the build id is ${String(buildId)} but the commit is ${commit}. The build did not ` +
          "record the commit it was built from, so the running version would not be identifiable.",
      );
      process.exit(1);
    }
  }

  const previous = stopPreviousServer(options);

  const pid = startServer(options, commit, distDir, database.url);
  if (pid === null) {
    console.error("[deploy] the server did not start");
    process.exit(1);
  }
  console.log(`[deploy] started pid ${pid} on port ${options.port}`);

  const url = `http://localhost:${options.port}${options.healthPath}`;
  const healthy = await waitForHealth(url, options.expect, options.timeoutMs);
  if (!healthy) {
    console.error(`[deploy] ${url} did not answer with the expected content within the timeout`);
    console.error(`[deploy] the server log is at ${options.logPath}`);
    process.exit(1);
  }

  for (const stale of staleDeployDirs([distDir, previous?.distDir ?? ""])) {
    rmSync(join(WEB_DIR, stale), { recursive: true, force: true });
    console.log(`[deploy] removed the build directory ${stale}`);
  }

  console.log(`[deploy] commit    ${commit}`);
  console.log(`[deploy] build id  ${readBuildId(distDir) ?? "unknown"}`);
  console.log(`[deploy] deploy id ${commit}`);
  console.log(`[deploy] serving   ${url}`);
  if (previous) {
    console.log(
      `[deploy] rollback  bun run deploy --reuse ${previous.distDir} --port ${options.port} ` +
        `--log ${options.logPath}`,
    );
  }
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  await main();
}
