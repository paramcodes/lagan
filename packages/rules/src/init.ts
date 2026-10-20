import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { detectOwner, resolveCatalogue } from "../resolve";
import { loadRuleTable } from "../templates/audit-rules";
import { buildCodeowners, buildProtectedPaths } from "../templates/sync-agent-rules";
import { bootstrap, factLines, type Bootstrap, type Candidate } from "./catalogue";
import { packageFile, renderTemplate } from "./package-files";
import {
  AUDITOR_FILE,
  CI_FILE,
  CODEOWNERS_FILE,
  COMMAND_DIR,
  CONTEXT_FILE,
  PROJECTOR_FILE,
  PROTECTED_PATHS_FILE,
  RULES_DIR,
  SKILL_FILE,
  COMMANDS,
  readManifest,
  readProjectFile,
  writeManifest,
  writeProjectFile,
} from "./project";
import { StaticPrompter, TerminalPrompter, type Choice, type Prompter } from "./prompt";

export interface InitOptions {
  root: string;
  yes: boolean;
  owner?: string | undefined;
  cataloguePaths?: string[] | undefined;
}

export interface Answers {
  owner: string;
  heavyCommands: string;
  historyRule: string;
  selected: string[];
}

export interface Proof {
  rule: string;
  finding: string;
  broken: boolean;
  restored: boolean;
}

const SCRIPTS: Record<string, string> = {
  "rules:audit": `bun ${AUDITOR_FILE}`,
  "rules:sync": `bun ${PROJECTOR_FILE}`,
  "rules:sync:check": `bun ${PROJECTOR_FILE} --check`,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normaliseOwner(owner: string): string {
  const trimmed = owner.trim();
  if (trimmed.length === 0) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function slug(text: string): string {
  const value = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value.length > 0 ? value : "rule-from-history";
}

function heavyDefault(facts: Record<string, string | undefined>): string {
  const heavy = ["test_script_exists", "build_script_exists"]
    .map((fact) => facts[fact])
    .filter((value): value is string => typeof value === "string");
  return heavy.length > 0 ? heavy.map((name) => `bun run ${name}`).join(", ") : "none yet";
}

function candidateChoices(candidates: Candidate[]): Choice[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    label: `${candidate.id} [${candidate.layer}] ${candidate.title}`,
  }));
}

export async function askQuestions(
  prompter: Prompter,
  chosen: Bootstrap,
  options: InitOptions,
): Promise<Answers> {
  const defaultOwner = normaliseOwner(options.owner ?? detectOwner(options.root));
  const owner = normaliseOwner(
    await prompter.ask("Who owns the rule table? A GitHub handle.", defaultOwner),
  );
  const heavyCommands = await prompter.ask(
    "Which commands count as heavy on this machine?",
    heavyDefault(chosen.facts),
  );
  const historyRule = await prompter.ask(
    "Is there a rule from this project's history that the detector cannot see? Empty for none.",
    "",
  );
  const selected = await prompter.choose(
    "Which of the detected candidates become rules?",
    candidateChoices(chosen.candidates),
    chosen.candidates.map((candidate) => candidate.id),
  );
  return { owner, heavyCommands, historyRule, selected };
}

function historyRuleDocument(text: string, owner: string): { id: string; document: string } {
  const id = slug(text);
  const document = stringify(
    {
      id,
      title: text.split("\n")[0]?.trim() || id,
      layer: "prose",
      artifact: [
        { path: "pr:comment", note: "The pull request comment that carries the evidence." },
      ],
      failure: `${today()}. ${text.trim()}\n`,
      owner,
    },
    { lineWidth: 0 },
  );
  return { id, document };
}

function ciJob(frozen: boolean): string {
  return [
    "  agent-rules:",
    "    name: Agent rules",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "",
    "      - uses: oven-sh/setup-bun@v2",
    "        with:",
    "          bun-version: latest",
    "",
    "      - name: Install",
    `        run: bun install${frozen ? " --frozen-lockfile" : ""}`,
    "",
    "      - name: Audit the rule table",
    "        run: bun run rules:audit",
    "",
    "      - name: Check the projections",
    "        run: bun run rules:sync:check",
    "",
  ].join("\n");
}

function newCiFile(job: string): string {
  return ["name: Agent rules", "", "on:", "  pull_request:", "", "jobs:", job].join("\n");
}

function upsertCiJob(existing: string, job: string): string {
  const lines = existing.split("\n");
  const start = lines.findIndex((line) => /^ {2}agent-rules:\s*$/.test(line));
  if (start === -1) {
    const head = existing.trimEnd();
    return head.length > 0 ? `${head}\n\n${job}` : newCiFile(job);
  }
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end] ?? "";
    if (line.trim().length > 0 && line.length - line.trimStart().length <= 2) break;
    end += 1;
  }
  const kept = [...lines.slice(0, start), ...lines.slice(end)];
  return `${kept.join("\n").trimEnd()}\n\n${job}`;
}

function writeScripts(root: string): void {
  const manifest = readManifest(root);
  const scripts = { ...(manifest.scripts ?? {}), ...SCRIPTS };
  writeManifest(root, { ...manifest, scripts });
}

export interface Written {
  files: string[];
  ruleIds: string[];
  historyRuleId?: string | undefined;
  ciPath: string;
  projected: boolean;
  projectionError: string;
}

export function writeProject(root: string, chosen: Bootstrap, answers: Answers): Written {
  const files: string[] = [];
  const resolution = resolveCatalogue(chosen.catalogue, {
    root,
    facts: chosen.facts,
    owner: answers.owner,
  });
  const selected = resolution.rules.filter((rule) => answers.selected.includes(rule.id));

  for (const rule of selected) {
    writeProjectFile(root, `${RULES_DIR}/${rule.id}.yaml`, rule.document);
    files.push(`${RULES_DIR}/${rule.id}.yaml`);
  }

  let historyRuleId: string | undefined;
  if (answers.historyRule.trim().length > 0) {
    const rule = historyRuleDocument(answers.historyRule.trim(), answers.owner);
    writeProjectFile(root, `${RULES_DIR}/${rule.id}.yaml`, rule.document);
    files.push(`${RULES_DIR}/${rule.id}.yaml`);
    historyRuleId = rule.id;
  }

  const orientation = renderTemplate(packageFile("templates/context.yaml"), {
    framework: chosen.facts.framework_version?.split("@")[0] ?? "the one in the manifest",
    version: chosen.facts.framework_version?.split("@")[1] ?? "",
    package_manager: chosen.catalogue.stack.package_manager,
    lockfile: chosen.facts.has_lockfile ?? "not committed",
    heavy_commands: answers.heavyCommands,
    owner: answers.owner || "the owner of the table",
  });
  writeProjectFile(root, CONTEXT_FILE, orientation);
  files.push(CONTEXT_FILE);

  writeProjectFile(root, AUDITOR_FILE, packageFile("templates/audit-rules.ts"));
  files.push(AUDITOR_FILE);
  writeProjectFile(root, PROJECTOR_FILE, packageFile("templates/sync-agent-rules.ts"));
  files.push(PROJECTOR_FILE);

  writeProjectFile(root, SKILL_FILE, packageFile("skills/agent-rules/SKILL.md"));
  files.push(SKILL_FILE);
  for (const command of COMMANDS) {
    writeProjectFile(root, `${COMMAND_DIR}/${command}`, packageFile(`commands/${command}`));
    files.push(`${COMMAND_DIR}/${command}`);
  }

  writeScripts(root);
  files.push("package.json");

  const ciPath = chosen.facts.ci_workflow_exists ?? CI_FILE;
  const existingCi = readProjectFile(root, ciPath) ?? "";
  const frozen = chosen.facts.has_lockfile !== undefined;
  writeProjectFile(root, ciPath, upsertCiJob(existingCi, ciJob(frozen)));
  files.push(ciPath);

  const { rules } = loadRuleTable(root);
  writeProjectFile(root, PROTECTED_PATHS_FILE, buildProtectedPaths(rules));
  files.push(PROTECTED_PATHS_FILE);
  writeProjectFile(
    root,
    CODEOWNERS_FILE,
    buildCodeowners(rules, readProjectFile(root, CODEOWNERS_FILE) ?? ""),
  );
  files.push(CODEOWNERS_FILE);

  const projected = runProjector(root);

  return {
    files,
    ruleIds: selected.map((rule) => rule.id),
    historyRuleId,
    ciPath,
    projected: projected.ok,
    projectionError: projected.ok ? "" : projected.output,
  };
}

function runProjector(root: string): { ok: boolean; output: string } {
  const result = spawnSync("bun", [join(root, PROJECTOR_FILE), "--root", root], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function runAuditor(root: string): { ok: boolean; output: string } {
  const result = spawnSync("bun", [join(root, AUDITOR_FILE), "--root", root], {
    cwd: root,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}

/**
 * Break a rule on purpose, so the human has seen the check fail.
 *
 * A check the human has never seen fail is a check they will not trust, and the failure
 * has to be a real one: a rule whose mechanism is gone.
 */
export function proveCheck(root: string, ruleId: string): Proof {
  const path = join(root, RULES_DIR, `${ruleId}.yaml`);
  const original = readFileSync(path, "utf8");
  const document = parse(original) as Record<string, unknown>;
  const enforced = document.enforced_by;
  const hasMechanism = Array.isArray(enforced) && enforced.length > 0;

  if (hasMechanism) {
    document.enforced_by = [{ path: `${RULES_DIR}/this-mechanism-is-gone.yaml` }];
  } else {
    delete document.failure;
  }
  writeFileSync(path, stringify(document, { lineWidth: 0 }), "utf8");
  const broken = runAuditor(root);
  writeFileSync(path, original, "utf8");
  const restored = runAuditor(root);

  const finding = broken.output
    .split("\n")
    .find((line) => line.trim().startsWith("error"))
    ?.trim();

  return {
    rule: ruleId,
    finding: finding ?? broken.output.split("\n").slice(-1)[0] ?? "",
    broken: !broken.ok,
    restored: restored.ok,
  };
}

function printCandidates(chosen: Bootstrap): void {
  console.log(`Catalogue: ${chosen.catalogue.id} (${chosen.cataloguePath})`);
  console.log(`Title: ${chosen.catalogue.title}`);
  console.log("");
  console.log("Facts detected");
  for (const line of factLines(chosen.facts)) console.log(line);
  console.log("");
  console.log(`Candidates (${chosen.candidates.length})`);
  for (const candidate of chosen.candidates) {
    const kind = candidate.policy ? "policy" : "derived";
    console.log(`  ${candidate.id} [${candidate.layer}, ${kind}] ${candidate.title}`);
    for (const mechanism of candidate.mechanism) console.log(`      mechanism: ${mechanism}`);
    for (const artifact of candidate.artifact) console.log(`      artifact:  ${artifact}`);
  }
  console.log("");
}

function printReport(root: string, answers: Answers, written: Written, proof: Proof): void {
  console.log("Written");
  for (const file of written.files) console.log(`  ${file}`);
  console.log("");

  const failureDerived = written.historyRuleId === undefined ? 0 : 1;
  console.log(`Failure-derived rules: ${failureDerived}`);
  if (failureDerived === 0) {
    console.log("  This project has not had a failure yet, so no rule was written from one.");
  } else {
    console.log(`  ${written.historyRuleId} was written from what the detector could not see.`);
  }
  console.log("");

  console.log("Strikes");
  if (failureDerived === 0) {
    console.log("  None recorded in this project yet.");
  } else {
    console.log(`  ${written.historyRuleId}: one strike, so one rule.`);
  }
  console.log("  Strike one is a bug. Strike two is a class, and it earns a rule. Strike three is");
  console.log('  a pattern, and it earns a lint rule or a hook. Run "rules new" at strike two.');
  console.log("");

  console.log("The check works");
  console.log(`  broke ${proof.rule}: the audit failed`);
  if (proof.finding.length > 0) console.log(`    ${proof.finding}`);
  console.log(`  restored ${proof.rule}: the audit passed`);
  console.log("");

  console.log("Next");
  console.log(`  bun run rules:audit        checks the table in ${root}`);
  console.log("  bun run rules:sync         writes the projections");
  if (!written.projected) {
    console.log("  The projector could not write the routing file.");
    if (written.projectionError.length > 0) {
      console.log(`    ${written.projectionError.split("\n")[0]}`);
    }
    console.log('  Add a README.md, then run "bun run rules:sync".');
  }
  console.log("  Edit docs/ai/context.yaml with the facts only you know.");
  console.log(`  ${answers.owner} owns the table and the code owners file.`);
}

export async function runInit(options: InitOptions): Promise<number> {
  const root = options.root;
  const chosen = bootstrap(root, options.cataloguePaths);
  if (!chosen) {
    console.error("No catalogue was found, so there is nothing to resolve against.");
    return 1;
  }

  printCandidates(chosen);

  const prompter = options.yes ? new StaticPrompter() : new TerminalPrompter();
  let answers: Answers;
  try {
    answers = await askQuestions(prompter, chosen, options);
  } finally {
    prompter.close();
  }

  const written = writeProject(root, chosen, answers);
  const proof = proveCheck(root, written.ruleIds[0] ?? "the-table");
  printReport(root, answers, written, proof);

  if (!proof.broken || !proof.restored) {
    console.error("The check did not behave as it should. Read the output above.");
    return 1;
  }
  return 0;
}

export function projectExists(root: string): boolean {
  return existsSync(join(root, "package.json"));
}
