import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * The build id says which build is being served. Next.js generates a random
 * one, so two builds of the same source disagree about their asset URLs and a
 * client can end up asking a server for assets it does not have, which is the
 * "build id mismatch" failure. Deriving it from the commit makes the identity
 * of a build the source it was built from.
 *
 * The config file is evaluated more than once during a build, so the result is
 * cached at module scope rather than shelling out to git each time.
 */
let cachedBuildId: string | null | undefined;

function commitBuildId(): string | null {
  if (cachedBuildId !== undefined) return cachedBuildId;
  try {
    const hash = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    cachedBuildId = hash || null;
  } catch {
    // No git, or not inside a repository. The default random build id still works.
    cachedBuildId = null;
  }
  return cachedBuildId;
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  generateBuildId: async () => commitBuildId(),
  /**
   * The deploy command builds into a directory named after the commit and
   * starts the server from it. A failed build then cannot damage the
   * directory the running server is serving from, so a failed deploy leaves
   * the running application exactly as it was. The dev server does not set
   * the variable and keeps the default directory.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
