import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { resolveDatabaseUrl } from "./apps/web/lib/env";

/**
 * The suite resolves the database target through the same resolver the app
 * uses, so the tests and the app cannot drift onto different databases. Only
 * `DATABASE_URL` reaches the test environment: the rest of the `.env`
 * configures the dev server, exposing it changes the behaviour under test and
 * would hand real Stripe and Mux credentials to the suite. A machine with no
 * `DATABASE_URL` anywhere gets none, and the integration suites skip.
 */
function testEnv(): Record<string, string> {
  try {
    return { DATABASE_URL: resolveDatabaseUrl({ defaultUrl: null }).url };
  } catch {
    return {};
  }
}

export default defineConfig({
  // tsconfig.base.json sets `jsx: "preserve"` for Next.js, so the test
  // transform has to compile JSX itself.
  plugins: [react()],
  test: {
    globals: true,
    testTimeout: 15_000,
    setupFiles: ["./vitest.setup.ts"],
    env: testEnv(),
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/{config,db,types,email,rules}/**/*.test.{ts,tsx}",
            "scripts/**/*.test.{ts,tsx}",
          ],
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
