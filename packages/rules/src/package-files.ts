import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A file the package ships.
 *
 * The path is resolved from the package, not from the working directory, because the
 * package is run from wherever the human ran it.
 */
export function packageFile(relativePath: string): string {
  return readFileSync(join(PACKAGE_ROOT, relativePath), "utf8");
}

/**
 * A template with its values filled in.
 *
 * A placeholder the caller did not supply is an error, because a half-filled template
 * would write a file that says nothing.
 */
export function renderTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`The template needs the value "${key}".`);
    return value;
  });
}
