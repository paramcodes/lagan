import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * WCAG 2.2 AA tags enforced across Lagan per ADR-0010:
 * "Build to WCAG 2.2 AA; be able to prove WCAG 2.1 AA, which is the US legal floor."
 */
export const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export interface A11yAuditOptions {
  /** Additional axe tags to include */
  tags?: string[];
  /** Rules to disable for this audit */
  disableRules?: string[];
  /** CSS selectors to scope analysis to */
  include?: string[];
  /** CSS selectors to exclude from analysis */
  exclude?: string[];
}

/**
 * Pre-configures an AxeBuilder instance targeting WCAG 2.2 AA compliance.
 */
export function createA11yBuilder(page: Page, options: A11yAuditOptions = {}) {
  const tags = options.tags ?? [...WCAG_AA_TAGS];
  let builder = new AxeBuilder({ page }).withTags(tags);

  if (options.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }
  if (options.include?.length) {
    for (const selector of options.include) {
      builder = builder.include(selector);
    }
  }
  if (options.exclude?.length) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }

  return builder;
}

/**
 * Executes an automated axe accessibility audit on the page and asserts 0 violations.
 */
export async function assertNoA11yViolations(page: Page, options: A11yAuditOptions = {}) {
  const results = await createA11yBuilder(page, options).analyze();

  if (results.violations.length > 0) {
    const formatted = results.violations
      .map((v) => {
        const nodes = v.nodes
          .map(
            (n) =>
              `  - Target: ${n.target.join(" ")}\n    HTML: ${n.html}\n    Summary: ${n.failureSummary}`,
          )
          .join("\n");
        return `[${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.helpUrl})\n${nodes}`;
      })
      .join("\n\n");

    expect(
      results.violations,
      `Expected 0 WCAG 2.2 AA violations but found ${results.violations.length}:\n\n${formatted}`,
    ).toEqual([]);
  }

  expect(results.violations).toEqual([]);
  return results;
}
