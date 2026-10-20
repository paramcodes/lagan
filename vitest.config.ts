import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Minimal `.env` reader. `vite` is not resolvable from the repository root, so
 * `loadEnv` is unavailable; CI has no `.env` file and takes `DATABASE_URL`
 * from the job environment instead.
 */
function readDotEnv(path: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#")) continue;
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

/**
 * Only `DATABASE_URL` reaches the test environment. The rest of the `.env`
 * configures the dev server: exposing it changes the behaviour under test and
 * would hand real Stripe and Mux credentials to the suite.
 */
const dotEnv = readDotEnv(".env");
const testEnv = dotEnv.DATABASE_URL ? { DATABASE_URL: dotEnv.DATABASE_URL } : {};

export default defineConfig({
  // tsconfig.base.json sets `jsx: "preserve"` for Next.js, so the test
  // transform has to compile JSX itself.
  plugins: [react()],
  test: {
    globals: true,
    testTimeout: 15_000,
    setupFiles: ["./vitest.setup.ts"],
    env: testEnv,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["packages/{config,db,types,email}/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "packages/db/src/access.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "apps/**/*.test.{ts,tsx}",
            "packages/ui/**/*.test.{ts,tsx}",
            "packages/db/src/access.test.ts",
          ],
        },
      },
    ],
  },
});
