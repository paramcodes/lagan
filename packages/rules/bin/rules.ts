#!/usr/bin/env bun
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit, runSync } from "../src/audit";
import { runInit } from "../src/init";
import { runNew } from "../src/new";
import { runUpgrade } from "../src/upgrade";

const USAGE = `Usage: rules <command> [options]

Commands:
  init       Set the project up for agents. Detect, resolve, ask, write, prove, report.
  audit      Run the project's own auditor.
  sync       Run the project's own projector.
  new        Write one rule, after a failure class repeats.
  upgrade    Report the catalogue entries the project has not adopted.

Options:
  --root <dir>   The project root. The default is the working directory.
  --yes          Take the default answer for every question.
  --check        (sync) fail when a projection is stale.
  --help         Show this text.
`;

interface Options {
  command: string;
  root: string;
  yes: boolean;
  check: boolean;
  owner: string | undefined;
  rest: string[];
}

export function parseArgs(argv: string[]): Options {
  const options: Options = {
    command: "",
    root: process.cwd(),
    yes: false,
    check: false,
    owner: undefined,
    rest: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === "--root" && next) {
      options.root = resolve(next);
      index += 1;
    } else if (argument === "--owner" && next) {
      options.owner = next;
      index += 1;
    } else if (argument === "--yes") {
      options.yes = true;
    } else if (argument === "--check") {
      options.check = true;
    } else if (argument === "--help" || argument === "-h") {
      options.command = "help";
    } else if (options.command === "") {
      options.command = argument ?? "";
    } else {
      options.rest.push(argument ?? "");
    }
  }
  return options;
}

export async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  switch (options.command) {
    case "init":
      return runInit({ root: options.root, yes: options.yes, owner: options.owner });
    case "audit":
      return runAudit(options.root, options.rest);
    case "sync":
      return runSync(options.root, options.check ? ["--check", ...options.rest] : options.rest);
    case "new":
      return runNew({ root: options.root, yes: options.yes });
    case "upgrade":
      return runUpgrade(options.root);
    case "help":
      console.log(USAGE);
      return 0;
    default:
      console.error(USAGE);
      return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
