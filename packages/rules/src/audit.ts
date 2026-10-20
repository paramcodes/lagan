import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { AUDITOR_CANDIDATES, PROJECTOR_CANDIDATES, findLocalScript } from "./project";

/**
 * Run one of the project's own copies.
 *
 * The project owns the scripts after the bootstrap, and the package is not a dependency of
 * the project, so the package runs the copy the project has. When there is no copy, the
 * package says so instead of running its own, because its own would check the package
 * instead of the project.
 */
export function runProjectScript(
  root: string,
  candidates: string[],
  label: string,
  args: string[],
): number {
  const script = findLocalScript(root, candidates);
  if (!script) {
    console.error(
      `This project has no ${label}. Looked in: ${candidates.join(", ")}.`,
      "",
      "Run \"rules init\" to create one. The package's own copy is not run on purpose: it would",
      "check the package instead of the project.",
    );
    return 1;
  }
  const result = spawnSync("bun", [join(root, script), "--root", root, ...args], {
    cwd: root,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

export function runAudit(root: string, args: string[] = []): number {
  return runProjectScript(root, AUDITOR_CANDIDATES, "auditor", args);
}

export function runSync(root: string, args: string[] = []): number {
  return runProjectScript(root, PROJECTOR_CANDIDATES, "projector", args);
}
