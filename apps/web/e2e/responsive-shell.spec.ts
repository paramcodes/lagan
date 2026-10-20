import { expect, test, type Locator } from "@playwright/test";

const PHONE_WIDTH = 390;
const TABLET_WIDTH = 768;

async function rightEdge(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("locator has no bounding box");
  return box.x + box.width;
}

test.describe("Responsive app shell", () => {
  test("catalogue fits a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 844 });
    await page.goto("/courses");

    const heading = page.getByRole("heading", { level: 1, name: "Courses" });
    await expect(heading).toBeVisible();
    expect(await rightEdge(heading)).toBeLessThanOrEqual(PHONE_WIDTH);

    const card = page.getByRole("article").first();
    await expect(card).toBeVisible();
    expect(await rightEdge(card)).toBeLessThanOrEqual(PHONE_WIDTH);

    const cardTitle = card.getByRole("heading", { level: 3 });
    await expect(cardTitle).toBeVisible();
    expect(await rightEdge(cardTitle)).toBeLessThanOrEqual(PHONE_WIDTH);

    await expect(page.locator("[data-sidebar]")).toHaveAttribute("data-state", "collapsed");

    const search = page.getByRole("searchbox", { name: "Search courses, lessons, people" });
    await expect(search).toBeVisible();
    const searchBox = await search.boundingBox();
    expect(searchBox?.width ?? 0).toBeGreaterThanOrEqual(150);

    await expect(page.getByRole("combobox", { name: "Category filter" })).toBeVisible();

    const account = page.getByRole("button", { name: "Account" });
    await expect(account).toBeVisible();
    expect(await rightEdge(account)).toBeLessThanOrEqual(PHONE_WIDTH);

    const notifications = page.getByRole("button", { name: /Notifications/ });
    await expect(notifications).toBeVisible();
    expect(await rightEdge(notifications)).toBeLessThanOrEqual(PHONE_WIDTH);
  });

  test("catalogue fits a tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: TABLET_WIDTH, height: 1024 });
    await page.goto("/courses");

    const heading = page.getByRole("heading", { level: 1, name: "Courses" });
    await expect(heading).toBeVisible();
    expect(await rightEdge(heading)).toBeLessThanOrEqual(TABLET_WIDTH);

    const card = page.getByRole("article").first();
    await expect(card).toBeVisible();
    expect(await rightEdge(card)).toBeLessThanOrEqual(TABLET_WIDTH);

    await expect(page.locator("[data-sidebar]")).toHaveAttribute("data-state", "expanded");
  });
});
