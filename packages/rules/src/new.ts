import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { loadRuleTable } from "../templates/audit-rules";
import { RULES_DIR, readProjectFile, writeProjectFile } from "./project";
import { StaticPrompter, TerminalPrompter, type Prompter } from "./prompt";

export interface NewOptions {
  root: string;
  yes: boolean;
}

export interface NewRule {
  id: string;
  title: string;
  layer: string;
  mechanism: string;
  artifact: string;
  failure: string;
  owner: string;
}

function slug(text: string): string {
  const value = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value.length > 0 ? value : "new-rule";
}

function defaultOwner(root: string): string {
  const table = loadRuleTable(root);
  const owners = new Set(table.rules.map((rule) => rule.owner).filter((owner) => owner.length > 0));
  return owners.size === 1 ? ([...owners][0] as string) : "";
}

export async function askForRule(prompter: Prompter, root: string): Promise<NewRule> {
  const title = await prompter.ask("What is the rule, as one sentence?", "");
  const failure = await prompter.ask("What went wrong? This is the story the rule exists for.", "");
  const layer = await prompter.ask(
    "Which layer enforces it? type, primitive, runtime, test, lint, ci or prose.",
    "prose",
  );
  const mechanism = await prompter.ask(
    "Which path and marker enforce it? Empty when nothing does.",
    "",
  );
  const artifact = await prompter.ask(
    "Where does a reviewer look? A path or pr:comment.",
    "pr:comment",
  );
  const owner = await prompter.ask("Who owns the rule?", defaultOwner(root));

  return {
    id: slug(title),
    title,
    layer,
    mechanism,
    artifact,
    failure,
    owner: owner.startsWith("@") ? owner : owner.length > 0 ? `@${owner}` : "",
  };
}

export function ruleDocument(rule: NewRule): string {
  const document: Record<string, unknown> = {
    id: rule.id,
    title: rule.title,
    layer: rule.layer,
  };
  const [path, ...markers] = rule.mechanism.split("|").map((part) => part.trim());
  if (path && path.length > 0) {
    const match = markers.filter((marker) => marker.length > 0);
    document.enforced_by =
      match.length > 0 ? [{ path, match: match.length === 1 ? match[0] : match }] : [{ path }];
  }
  document.artifact = [{ path: rule.artifact }];
  document.failure = `${rule.failure}\n`;
  document.owner = rule.owner;
  return stringify(document, { lineWidth: 0 });
}

export async function runNew(options: NewOptions): Promise<number> {
  const prompter = options.yes ? new StaticPrompter() : new TerminalPrompter();
  let rule: NewRule;
  try {
    rule = await askForRule(prompter, options.root);
  } finally {
    prompter.close();
  }

  if (rule.title.trim().length === 0) {
    console.error("A rule needs a title. Nothing was written.");
    return 1;
  }

  if (readProjectFile(options.root, `${RULES_DIR}/${rule.id}.yaml`) !== undefined) {
    console.error(`The rule "${rule.id}" is already in the table. Nothing was written.`);
    return 1;
  }

  writeProjectFile(options.root, `${RULES_DIR}/${rule.id}.yaml`, ruleDocument(rule));
  console.log(`Wrote ${RULES_DIR}/${rule.id}.yaml`);
  console.log('Run "bun run rules:audit" and then "bun run rules:sync".');
  return 0;
}

export function readRule(root: string, id: string): unknown {
  const source = readFileSync(join(root, RULES_DIR, `${id}.yaml`), "utf8");
  return parse(source);
}
