import {
  getStandardContrastRules,
  loadColorTokens,
  verifyContrastRules,
} from "../packages/config/src/contrast";

function run() {
  console.log("Checking token contrast ratios per ADR-0010 (WCAG 2.2 AA)...\n");

  const colors = loadColorTokens();
  const rules = getStandardContrastRules(colors);
  const { results, passed } = verifyContrastRules(rules);

  console.log("| Rule | Colors | Min | Ratio | Status | Criterion |");
  console.log("|---|---|---|---|---|---|");

  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const fgBg = `${r.rule.foreground} / ${r.rule.background}`;
    console.log(
      `| ${r.rule.name.padEnd(16)} | ${fgBg} | ${r.rule.minRatio}:1 | ${r.ratio.toFixed(2)}:1 | ${status} | ${r.rule.wcagCriterion} |`,
    );
  }

  console.log("\nExemptions noted per docs/design-system.md:");
  console.log(
    `- --line (${colors.line}) is decoration (panel rules, dividers); exempt from contrast requirements.`,
  );

  if (!passed) {
    console.error(
      "\n❌ Token contrast check failed: One or more tokens do not satisfy WCAG 2.2 AA.",
    );
    process.exit(1);
  }

  console.log("\n✅ All design tokens satisfy WCAG 2.2 AA contrast requirements.");
}

run();
