import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.base.json sets `jsx: "preserve"` for Next.js, so the test
  // transform has to compile JSX itself.
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 15_000,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
    ],
  },
});
