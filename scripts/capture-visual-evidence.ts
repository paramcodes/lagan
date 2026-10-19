import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import pg from "pg";

interface RouteSpec {
  name: string;
  path: string;
  description: string;
}

const ROUTES: RouteSpec[] = [
  {
    name: "landing",
    path: "/",
    description: "Landing page",
  },
  {
    name: "sign-in",
    path: "/sign-in",
    description: "Authentication (sign-in)",
  },
  {
    name: "courses-cards",
    path: "/courses?view=cards",
    description: "Catalogue grid view",
  },
  {
    name: "courses-ledger",
    path: "/courses?view=ledger",
    description: "Catalogue list view",
  },
  {
    name: "lesson-player",
    path: "/courses/course_distributed/lessons/les_raft",
    description: "Lesson player page",
  },
];

const targetRouteArg = process.argv[2];
const activeRoutes = targetRouteArg ? ROUTES.filter((r) => r.name === targetRouteArg) : ROUTES;

const THEMES = [
  { name: "light", colorScheme: "light" as const, darkClass: false },
  { name: "dark", colorScheme: "dark" as const, darkClass: true },
];

async function seedDatabaseIfPossible(databaseUrl?: string) {
  const url =
    databaseUrl || process.env.DATABASE_URL || "postgres://lagan:lagan@localhost:5433/lagan";

  try {
    const client = new pg.Client({ connectionString: url });
    await client.connect();

    // Ensure user table has display name column expected by courses catalogue query
    await client.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name" text');

    // Seed sample author
    await client.query(`
      INSERT INTO "user" (id, name)
      VALUES ('author_evelyn', 'Dr. Evelyn Reed')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    `);

    // Seed sample courses, modules and lessons
    await client.query(`
      INSERT INTO "courses" (id, tenant_id, author_id, title, description, price_cents, discount_percent, is_free, status, published_at)
      VALUES 
        ('course_distributed', 'default', 'author_evelyn', 'Distributed Systems in Practice', 'Build robust, fault-tolerant distributed services with consensus and replication algorithms.', 4999, 10, false, 'published', NOW() - INTERVAL '3 days'),
        ('course_typescript', 'default', 'author_evelyn', 'Type-Driven Architecture with TypeScript', 'Master type-level programming, brand types, template literals, and domain modeling.', 2999, 0, false, 'published', NOW() - INTERVAL '2 days'),
        ('course_database', 'default', 'author_evelyn', 'Database Internals: Storage & Retrieval', 'Learn B-trees, LSM trees, WAL, write amplification, and page buffer management from scratch.', 0, 0, true, 'published', NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO "modules" (id, course_id, title, position)
      VALUES ('mod_consensus', 'course_distributed', 'Consensus & State Machine Replication', 0)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO "lessons" (id, module_id, type, title, position, status, mux_playback_id)
      VALUES 
        ('les_raft', 'mod_consensus', 'video', 'Raft Consensus Protocol & Leader Election', 0, 'published', 'demo_playback_id'),
        ('les_safety', 'mod_consensus', 'text', 'Safety and Invariants in Distributed Systems', 1, 'published', NULL),
        ('les_quiz', 'mod_consensus', 'quiz', 'Module Knowledge Assessment', 2, 'published', NULL)
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.end();
    return url;
  } catch (err) {
    console.warn("Database connection/seed skipped:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status < 500) {
        return true;
      }
    } catch {
      // Server not accepting connections yet
    }
    await sleep(1000);
  }
  return false;
}

async function main() {
  const outputDir = join(process.cwd(), "docs", "evidence");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const dbUrl = await seedDatabaseIfPossible();

  let serverProcess: ChildProcess | undefined;
  let targetPort = 3000;
  let baseUrl = process.env.APP_URL || `http://localhost:${targetPort}`;

  let alreadyRunning = false;
  try {
    const ping = await fetch(baseUrl, { method: "HEAD" });
    alreadyRunning = ping.status < 500;
  } catch {
    alreadyRunning = false;
  }

  if (!alreadyRunning) {
    targetPort = 3333;
    baseUrl = `http://localhost:${targetPort}`;
    console.log(`Starting Next.js dev server on ${baseUrl}...`);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(targetPort),
    };
    if (dbUrl) {
      env.DATABASE_URL = dbUrl;
    }
    serverProcess = spawn("bun", ["--cwd", "apps/web", "dev", "-p", String(targetPort)], {
      stdio: "inherit",
      env,
    });

    const ready = await waitForServer(baseUrl, 60_000);
    if (!ready) {
      if (serverProcess) {
        serverProcess.kill();
      }
      throw new Error(`Server failed to start at ${baseUrl} within 60s`);
    }
    console.log(`Server is ready at ${baseUrl}`);
  } else {
    console.log(`Using existing server at ${baseUrl}`);
  }

  // Pre-warm routes so Turbopack compiles them before browser navigation
  console.log("Warming up product routes...");
  for (const route of activeRoutes) {
    try {
      console.log(`  Pre-warming ${route.path}...`);
      await fetch(`${baseUrl}${route.path}`, {
        headers: { Accept: "text/html", "x-dev-user-id": "author_evelyn" },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      // Ignore initial warm-up errors
    }
  }

  try {
    console.log("\nLaunching Chromium via Playwright...");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    for (const theme of THEMES) {
      console.log(`\nCapturing screenshots in [${theme.name.toUpperCase()}] mode...`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: theme.colorScheme,
        extraHTTPHeaders: {
          "x-dev-user-id": "author_evelyn",
        },
      });

      for (const route of activeRoutes) {
        const page = await context.newPage();
        const pageUrl = `${baseUrl}${route.path}`;
        console.log(`Navigating to ${route.description} (${pageUrl})...`);

        await page.goto(pageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });

        // Toggle dark class if necessary for Tailwind v4 class/media parity
        if (theme.darkClass) {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        } else {
          await page.evaluate(() => document.documentElement.classList.remove("dark"));
        }

        // Wait for fonts and network settle
        await page.evaluate(() => document.fonts.ready);
        await sleep(800);

        const filename = `${route.name}-${theme.name}.png`;
        const filePath = join(outputDir, filename);

        await page.screenshot({
          path: filePath,
          fullPage: true,
        });

        console.log(`  ✓ Saved: docs/evidence/${filename}`);
        await page.close();
      }

      await context.close();
    }

    await browser.close();
    console.log("\nAll visual evidence screenshots captured successfully.");
  } finally {
    if (serverProcess) {
      console.log("Shutting down dev server...");
      serverProcess.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error("Visual evidence capture failed:", err);
  process.exit(1);
});
