import { test } from "@playwright/test";
import { assertNoA11yViolations } from "./a11y";

test.describe("Accessibility (WCAG 2.2 AA)", () => {
  test.describe.configure({ mode: "serial" });

  test.describe("Signed-out pages", () => {
    test("landing page complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/");
      await assertNoA11yViolations(page);
    });

    test("sign-in page complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/sign-in");
      await assertNoA11yViolations(page);
    });

    test("sign-up page complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/sign-up");
      await assertNoA11yViolations(page);
    });
  });

  test.describe("Browse and course view pages", () => {
    test("courses browse page complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/courses");
      await assertNoA11yViolations(page);
    });

    test("courses card view complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/courses?view=cards");
      await assertNoA11yViolations(page);
    });

    test("courses ledger view complies with WCAG 2.2 AA", async ({ page }) => {
      await page.goto("/courses?view=ledger");
      await assertNoA11yViolations(page);
    });
  });
});
