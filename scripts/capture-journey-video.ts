import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.APP_URL || "http://localhost:3000";
const outputDir = join(process.cwd(), "docs", "evidence");
const flow = process.argv[2] ?? "learner";
const AUTHOR = { email: "evelyn@example.com", password: "Password123!" };

mkdirSync(outputDir, { recursive: true });

async function settle(page: Page, ms = 900) {
  await page.evaluate(() => document.fonts.ready);
  await sleep(ms);
}

async function signIn(page: Page) {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(AUTHOR.email);
  await page.getByLabel("Password").fill(AUTHOR.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/learn/);
  await settle(page);
}

async function learnerFlow(page: Page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  await page.mouse.wheel(0, 900);
  await sleep(800);

  await page.goto(`${baseUrl}/sign-up`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const email = `journey_${Date.now()}@example.com`;
  await page.getByLabel("Name").fill("Journey Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByLabel("Confirm password").fill("Password123!");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(/\/learn/, { timeout: 30_000 });
  await settle(page, 1200);

  await page.goto(`${baseUrl}/courses?view=cards`, { waitUntil: "domcontentloaded" });
  await settle(page);

  const search = page.getByRole("searchbox", { name: "Search courses, lessons, people" });
  await search.fill("Database");
  await search.press("Enter");
  await settle(page);
  await search.fill("");
  await search.press("Enter");
  await settle(page);

  await page
    .getByRole("link", { name: /Database Internals: Storage & Retrieval/ })
    .first()
    .click();
  await page.waitForURL(/\/courses\/course_database/);
  await settle(page, 1200);

  await page.getByRole("button", { name: "Enroll for Free" }).click();
  await page.waitForURL(/\/courses\/course_database\/lessons\//, { timeout: 30_000 });
  await settle(page, 1200);

  await page.goto(`${baseUrl}/learn?view=cards`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);

  await page
    .getByRole("link", { name: /Continue Learning/i })
    .first()
    .click();
  await page.waitForURL(/\/lessons\//, { timeout: 30_000 });
  await settle(page, 1500);

  const markComplete = page.getByRole("button", { name: "Mark as Complete" });
  if (await markComplete.isVisible().catch(() => false)) {
    await markComplete.click();
    await settle(page, 1200);
    const next = page.getByRole("button", { name: "Play Next" });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await settle(page, 1200);
    }
  }

  await page.goto(`${baseUrl}/courses?view=cards`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 20_000 });
  await settle(page, 1200);
}

async function authorFlow(page: Page) {
  await signIn(page);

  await page.goto(`${baseUrl}/teach/courses/course_distributed/builder`, {
    waitUntil: "domcontentloaded",
  });
  await settle(page, 1500);
  await page.mouse.wheel(0, 700);
  await sleep(700);

  await page.goto(`${baseUrl}/teach/analytics`, { waitUntil: "domcontentloaded" });
  await settle(page, 1800);
  await page.mouse.wheel(0, 700);
  await sleep(900);

  await page.goto(`${baseUrl}/learn?view=ledger`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: join(outputDir, ".video"), size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

try {
  if (flow === "author") {
    await authorFlow(page);
  } else {
    await learnerFlow(page);
  }
  console.log("Journey recorded.");
} catch (err) {
  console.error("Journey capture failed:", err);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  const path = await video?.path();
  if (path) {
    const target = join(outputDir, ".video", `${flow}.webm`);
    renameSync(path, target);
    console.log(`Video: ${target}`);
  }
  await browser.close();
}
