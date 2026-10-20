import {
  defaultCataloguePaths,
  detectFacts,
  fillTitle,
  loadCatalogue,
  resolveCatalogue,
  type Catalogue,
  type Derivation,
  type Facts,
  type Resolution,
} from "../resolve";

export interface Candidate {
  id: string;
  title: string;
  layer: string;
  mechanism: string[];
  artifact: string[];
  failure: string;
  policy: boolean;
}

export interface Bootstrap {
  catalogue: Catalogue;
  facts: Facts;
  candidates: Candidate[];
  cataloguePath: string;
}

function candidatesFor(catalogue: Catalogue, resolution: Resolution, facts: Facts): Candidate[] {
  const derivations = new Map<string, Derivation>();
  for (const derivation of catalogue.rules) derivations.set(derivation.id, derivation);
  for (const derivation of catalogue.policies) derivations.set(derivation.id, derivation);

  return resolution.rules.map((rule) => {
    const derivation = derivations.get(rule.id);
    return {
      id: rule.id,
      title: derivation ? fillTitle(derivation.title, facts) : rule.id,
      layer: derivation?.layer ?? "prose",
      mechanism: rule.enforced_by.map((entry) =>
        entry.match === undefined ? entry.path : `${entry.path} (${entry.match})`,
      ),
      artifact: rule.artifact.map((entry) => entry.path),
      failure: derivation?.note ?? "",
      policy: catalogue.policies.some((policy) => policy.id === rule.id),
    };
  });
}

/**
 * The catalogue that fits the repository, and the rules it produces.
 *
 * Every catalogue is resolved against the repository with its own stack, and the one that
 * produces the most rules wins. The number of rules is the signal, because a catalogue of
 * another stack detects nothing and produces nothing but its policies.
 */
export function bootstrap(root: string, cataloguePaths?: string[]): Bootstrap | undefined {
  const paths = cataloguePaths ?? defaultCataloguePaths();
  let best: Bootstrap | undefined;
  let bestRules = -1;

  for (const path of paths) {
    const catalogue = loadCatalogue(path);
    const facts = detectFacts(root, catalogue.stack);
    const resolution = resolveCatalogue(catalogue, { root, facts, owner: "" });
    if (resolution.rules.length <= bestRules) continue;
    bestRules = resolution.rules.length;
    best = {
      catalogue,
      facts,
      candidates: candidatesFor(catalogue, resolution, facts),
      cataloguePath: path,
    };
  }

  return best;
}

export function factLines(facts: Facts): string[] {
  return Object.entries(facts).map(([fact, value]) => `  ${fact.padEnd(26)} ${value ?? ""}`);
}
