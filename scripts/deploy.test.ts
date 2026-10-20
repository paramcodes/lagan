import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  distDirFor,
  parseArgs,
  pidFilePath,
  readRunningServer,
  responseIsHealthy,
  isDeployDirInUse,
  staleDeployDirs,
} from "./deploy";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("parseArgs", () => {
  it("falls back to the defaults", () => {
    expect(parseArgs([])).toEqual(DEFAULT_OPTIONS);
  });

  it("reads the port, log, path, expectation and timeout", () => {
    const options = parseArgs([
      "--port",
      "4200",
      "--log",
      "/tmp/lagan-test.log",
      "--path",
      "/learn",
      "--expect",
      "My Learning",
      "--timeout",
      "5",
    ]);
    expect(options.port).toBe(4200);
    expect(options.logPath).toBe("/tmp/lagan-test.log");
    expect(options.healthPath).toBe("/learn");
    expect(options.expect).toBe("My Learning");
    expect(options.timeoutMs).toBe(5000);
  });

  it("reads the build directory to reuse", () => {
    expect(parseArgs(["--reuse", ".next-deploy-abc123"]).reuseDistDir).toBe(".next-deploy-abc123");
  });

  it("rejects a port that is not a number", () => {
    expect(() => parseArgs(["--port", "nonsense"])).toThrow(/--port/);
  });
});

describe("distDirFor", () => {
  it("gives each build attempt its own directory", () => {
    expect(distDirFor("abcdef1234567890", "m0")).toBe(".next-deploy-abcdef123456-m0");
  });

  it("gives two attempts at the same commit different directories", () => {
    expect(distDirFor("aaaa1111", "one")).not.toBe(distDirFor("aaaa1111", "two"));
  });
});

describe("pidFilePath", () => {
  it("sits beside the log file", () => {
    expect(pidFilePath("/tmp/lagan-prod.log")).toBe("/tmp/lagan-prod.log.pid");
  });
});

describe("readRunningServer", () => {
  it("reads a recorded server", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-test-"));
    const logPath = join(dir, "lagan.log");
    writeFileSync(
      pidFilePath(logPath),
      JSON.stringify({ pid: 42, commit: "abc", distDir: ".next-deploy-abc", port: 3100 }),
    );
    expect(readRunningServer(logPath)).toEqual({
      pid: 42,
      commit: "abc",
      distDir: ".next-deploy-abc",
      port: 3100,
    });
  });

  it("returns null when there is no pid file", () => {
    expect(readRunningServer("/tmp/does-not-exist-lagan.log")).toBeNull();
  });

  it("returns null when the pid file is not a server record", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-test-"));
    const logPath = join(dir, "lagan.log");
    writeFileSync(pidFilePath(logPath), "not json");
    expect(readRunningServer(logPath)).toBeNull();
  });
});

describe("staleDeployDirs", () => {
  it("lists the deploy directories that are not being kept", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-test-"));
    const webDir = join(dir, "apps", "web");
    mkdirSync(join(webDir, ".next-deploy-keep"), { recursive: true });
    mkdirSync(join(webDir, ".next-deploy-old"), { recursive: true });
    mkdirSync(join(webDir, ".next"), { recursive: true });
    expect(staleDeployDirs([".next-deploy-keep"], dir)).toEqual([".next-deploy-old"]);
  });

  it("ignores a directory that is not a deploy directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-test-"));
    const webDir = join(dir, "apps", "web");
    mkdirSync(webDir, { recursive: true });
    expect(staleDeployDirs([], dir)).toEqual([]);
  });
});

describe("responseIsHealthy", () => {
  it("accepts a page that carries the expected content", () => {
    expect(responseIsHealthy(200, "<p>7 published courses</p>", "published courses")).toBe(true);
  });

  it("rejects a non-200 response", () => {
    expect(responseIsHealthy(500, "7 published courses", "published courses")).toBe(false);
  });

  it("rejects a page that is missing the expected content", () => {
    expect(responseIsHealthy(200, "<p>Nothing here</p>", "published courses")).toBe(false);
  });

  it("rejects an error page even when it carries the expected content", () => {
    const body = "<p>published courses</p><h1>This page couldn't load</h1>";
    expect(responseIsHealthy(200, body, "published courses")).toBe(false);
  });

  it("rejects a server error page", () => {
    expect(responseIsHealthy(200, "Application error", "")).toBe(false);
  });
});
