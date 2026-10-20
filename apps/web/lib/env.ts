export const DEFAULT_DATABASE_URL = "postgres://lagan:lagan@localhost:5432/lagan";

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
  void filePath;
  throw new Error("readEnvFile is not implemented yet");
}

export function findEnvFile(startDir?: string): string | null {
  void startDir;
  throw new Error("findEnvFile is not implemented yet");
}

export function resolveDatabaseUrl(options?: DatabaseUrlOptions): DatabaseUrlResolution {
  void options;
  throw new Error("resolveDatabaseUrl is not implemented yet");
}

export function describeDatabaseTarget(url: string): DatabaseTarget {
  void url;
  throw new Error("describeDatabaseTarget is not implemented yet");
}

export function logDatabaseTarget(resolution: DatabaseUrlResolution): void {
  void resolution;
  throw new Error("logDatabaseTarget is not implemented yet");
}
