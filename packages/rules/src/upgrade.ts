import { parse } from "yaml";
import { detectOwner, resolveCatalogue } from "../resolve";
import { loadRuleTable, type Rule } from "../templates/audit-rules";
import { bootstrap } from "./catalogue";
import { RULES_DIR, readProjectFile } from "./project";

export interface Difference {
  id: string;
  title: string;
  layer: string;
  mechanism: string[];
  field: string;
  before: string;
  after: string;
}

export interface UpgradeReport {
  catalogue: string;
  added: string[];
  changed: Difference[];
  dropped: string[];
}

const FIELDS = ["title", "layer", "enforced_by", "artifact", "failure", "owner", "protects"];

function comparable(document: unknown): Record<string, unknown> {
  const record = (document ?? {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (record[field] !== undefined) picked[field] = record[field];
  }
  return picked;
}

function show(value: unknown): string {
  if (value === undefined) return "nothing";
  if (typeof value === "string") return value.split("\n")[0] ?? "";
  return JSON.stringify(value);
}

/**
 * What the catalogue has and the table does not.
 *
 * The report stops there. A change to the rules needs a human who owns them, so the
 * command compares and says, and the human decides.
 */
export function compare(root: string, cataloguePaths?: string[]): UpgradeReport | undefined {
  const chosen = bootstrap(root, cataloguePaths);
  if (!chosen) return undefined;

  const owner = detectOwner(root);
  const resolution = resolveCatalogue(chosen.catalogue, {
    root,
    facts: chosen.facts,
    owner,
  });
  const table = loadRuleTable(root);
  const existing = new Map<string, Rule>(table.rules.map((rule) => [rule.id, rule]));

  const added: string[] = [];
  const changed: Difference[] = [];
  const catalogueIds = new Set<string>();

  for (const rule of resolution.rules) {
    catalogueIds.add(rule.id);
    const current = existing.get(rule.id);
    if (!current) {
      added.push(rule.id);
      continue;
    }
    const source = readProjectFile(root, `${RULES_DIR}/${rule.id}.yaml`);
    if (source === undefined) continue;
    const before = comparable(parse(source));
    const after = comparable(parse(rule.document));
    for (const field of FIELDS) {
      if (JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
      changed.push({
        id: rule.id,
        title: String(after.title ?? current.title ?? rule.id),
        layer: String(after.layer ?? "-"),
        mechanism: rule.enforced_by.map((entry) => entry.path),
        field,
        before: show(before[field]),
        after: show(after[field]),
      });
    }
  }

  const dropped = table.rules
    .filter((rule) => !catalogueIds.has(rule.id))
    .map((rule) => rule.id);

  return { catalogue: chosen.catalogue.id, added, changed, dropped };
}

export function runUpgrade(root: string, cataloguePaths?: string[]): number {
  const report = compare(root, cataloguePaths);
  if (!report) {
    console.error("No catalogue was found, so there is nothing to compare against.");
    return 1;
  }

  console.log(`Catalogue ${report.catalogue} against ${root}`);
  console.log("");

  console.log(`New (${report.added.length})`);
  for (const id of report.added) console.log(`  ${id}`);
  if (report.added.length === 0) console.log("  none");
  console.log("");

  console.log(`Changed (${report.changed.length})`);
  for (const difference of report.changed) {
    console.log(`  ${difference.id} ${difference.field}`);
    console.log(`    - ${difference.before}`);
    console.log(`    + ${difference.after}`);
  }
  if (report.changed.length === 0) console.log("  none");
  console.log("");

  console.log(`In the table and not in the catalogue (${report.dropped.length})`);
  for (const id of report.dropped) console.log(`  ${id}`);
  if (report.dropped.length === 0) console.log("  none");
  console.log("");

  console.log("Nothing was written. A change to the rules needs a human who owns them.");
  return 0;
}
