import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, readEnvFile, resolveDatabaseUrl } from "./env";

const FILE_URL = "postgres://file:file@file-host:5433/file-db";
const PROCESS_URL = "postgres://process:process@process-host:5434/process-db";

describe("resolveDatabaseUrl", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "lagan-env-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  function writeEnvFile(contents: string): string {
    const filePath = join(directory, ".env");
    writeFileSync(filePath, contents, "utf8");
    return filePath;
  }

  it("prefers the process environment over the .env file", () => {
    const envFilePath = writeEnvFile(`DATABASE_URL=${FILE_URL}\n`);

    const resolution = resolveDatabaseUrl({
      env: { DATABASE_URL: PROCESS_URL },
      envFilePath,
    });

    expect(resolution.url).toBe(PROCESS_URL);
    expect(resolution.source).toBe("process");
  });

  it("uses the .env file when the process environment lacks the variable", () => {
    const envFilePath = writeEnvFile(`DATABASE_URL=${FILE_URL}\n`);

    const resolution = resolveDatabaseUrl({ env: {}, envFilePath });

    expect(resolution.url).toBe(FILE_URL);
    expect(resolution.source).toBe("file");
    expect(resolution.origin).toBe(envFilePath);
  });

  it("falls back to the documented default when nothing else provides the variable", () => {
    const resolution = resolveDatabaseUrl({
      env: {},
      envFilePath: null,
      defaultUrl: DEFAULT_DATABASE_URL,
    });

    expect(resolution.url).toBe(DEFAULT_DATABASE_URL);
    expect(resolution.source).toBe("default");
  });

  it("throws an actionable error when a missing file and a missing variable leave nothing to resolve", () => {
    const missingFile = join(directory, "does-not-exist.env");

    expect(() => resolveDatabaseUrl({ env: {}, envFilePath: missingFile })).toThrowError(
      /DATABASE_URL is not set/,
    );
    expect(() => resolveDatabaseUrl({ env: {}, envFilePath: missingFile })).toThrowError(/\.env/);
  });
});

describe("readEnvFile", () => {
  it("reads KEY=VALUE lines and skips comments and blank lines", () => {
    const directory = mkdtempSync(join(tmpdir(), "lagan-env-"));
    const filePath = join(directory, ".env");
    writeFileSync(
      filePath,
      [
        "# a comment",
        "",
        "DATABASE_URL=postgres://user:pass@localhost:5433/lagan",
        'OTHER="quoted"',
      ].join("\n"),
      "utf8",
    );

    const values = readEnvFile(filePath);

    expect(values.DATABASE_URL).toBe("postgres://user:pass@localhost:5433/lagan");
    expect(values.OTHER).toBe("quoted");

    rmSync(directory, { force: true, recursive: true });
  });

  it("returns nothing for a file that does not exist", () => {
    const directory = mkdtempSync(join(tmpdir(), "lagan-env-"));

    expect(readEnvFile(join(directory, "missing.env"))).toEqual({});

    rmSync(directory, { force: true, recursive: true });
  });
});
