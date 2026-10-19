import { readFileSync, writeFileSync } from "node:fs";

type Token = { $type: string; $value: string };
type Group = { [k: string]: Token | Group };

const tokens = JSON.parse(readFileSync("tokens/tokens.json", "utf8")) as Group;

function flatten(obj: Group, prefix = ""): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${k}` : k;
    if (v && typeof v === "object" && "$value" in v) {
      out.push({ name, value: (v as Token).$value });
    } else {
      out.push(...flatten(v as Group, name));
    }
  }
  return out;
}

const flat = flatten(tokens);
const vars = flat.map((t) => `  --${t.name}: ${t.value};`).join("\n");
const theme = flat.map((t) => `  --color-${t.name}: var(--${t.name});`).join("\n");

const css = `/* AUTO-GENERATED from tokens/tokens.json. Do not edit. */
:root {
${vars}
}

@theme inline {
${theme}
}
`;

writeFileSync("apps/web/app/tokens.css", css);
console.log("Generated apps/web/app/tokens.css");
