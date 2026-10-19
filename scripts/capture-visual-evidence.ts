import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";
import pg from "pg";

interface RouteSpec {
  name: string;
  path: string;
  description: string;
  /** Requires the seeded author session cookie. */
  auth?: boolean;
  /** Extra interaction before the screenshot. */
  action?: "notifications-popover";
}

const ROUTES: RouteSpec[] = [
  { name: "landing", path: "/", description: "Landing page" },
  { name: "sign-in", path: "/sign-in", description: "Authentication (sign-in)" },
  { name: "sign-up", path: "/sign-up", description: "Authentication (sign-up)" },
  { name: "courses-cards", path: "/courses?view=cards", description: "Catalogue grid view" },
  { name: "courses-ledger", path: "/courses?view=ledger", description: "Catalogue list view" },
  { name: "course-detail", path: "/courses/course_distributed", description: "Course detail page" },
  {
    name: "lesson-player",
    path: "/courses/course_distributed/lessons/les_raft",
    description: "Lesson player page",
    auth: true,
  },
  { name: "author-profile", path: "/authors/author_evelyn", description: "Public author profile" },
  {
    name: "learn-cards",
    path: "/learn?view=cards",
    description: "My Learning (cards)",
    auth: true,
  },
  {
    name: "learn-ledger",
    path: "/learn?view=ledger",
    description: "My Learning (list)",
    auth: true,
  },
  { name: "profile", path: "/profile", description: "Profile settings", auth: true },
  {
    name: "teach-analytics",
    path: "/teach/analytics",
    description: "Author analytics",
    auth: true,
  },
  {
    name: "course-builder",
    path: "/teach/courses/course_distributed/builder",
    description: "Course builder",
    auth: true,
  },
  {
    name: "notifications",
    path: "/courses?view=cards",
    description: "Notification centre popover",
    auth: true,
    action: "notifications-popover",
  },
];

const THEMES = [
  { name: "light", colorScheme: "light" as const, darkClass: false },
  { name: "dark", colorScheme: "dark" as const, darkClass: true },
];

const AUTHOR_ID = "author_evelyn";
const DEFAULT_URL = "postgres://lagan:lagan@localhost:5433/lagan";

async function seedDatabaseIfPossible(databaseUrl?: string) {
  const url = databaseUrl || process.env.DATABASE_URL || DEFAULT_URL;

  try {
    const client = new pg.Client({ connectionString: url });
    await client.connect();

    // The demo dataset is owned by this script: wipe it so re-runs are deterministic
    // and the unique (course_id, position) constraints cannot collide with leftovers.
    await client.query(`
      DELETE FROM "lesson_progress" WHERE course_id LIKE 'course_%';
      DELETE FROM "course_event" WHERE course_id LIKE 'course_%';
      DELETE FROM "enrollments" WHERE course_id LIKE 'course_%';
      DELETE FROM "notifications" WHERE user_id = '${AUTHOR_ID}';
      DELETE FROM "lessons" WHERE module_id IN (SELECT id FROM "modules" WHERE course_id LIKE 'course_%');
      DELETE FROM "modules" WHERE course_id LIKE 'course_%';
      DELETE FROM "courses" WHERE id LIKE 'course_%';
    `);

    await client.query(`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES ('${AUTHOR_ID}', 'Dr. Evelyn Reed', 'evelyn@example.com', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

      INSERT INTO "profiles" (id, user_id, bio, website_url, social_links_json, avatar_url, created_at, updated_at)
      VALUES ('profile_evelyn', '${AUTHOR_ID}',
        'Systems engineer writing about consensus, storage engines and the craft of reliable software.',
        'https://evelyn.example.com', '[{"label":"GitHub","url":"https://github.com/evelyn"}]', NULL, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET bio = EXCLUDED.bio;

      INSERT INTO "courses" (id, tenant_id, author_id, title, description, price_cents, discount_percent, is_free, status, published_at)
      VALUES
        ('course_distributed', 'default', '${AUTHOR_ID}', 'Distributed Systems in Practice', 'Build robust, fault-tolerant distributed services with consensus and replication algorithms.', 4999, 10, false, 'published', NOW() - INTERVAL '3 days'),
        ('course_typescript', 'default', '${AUTHOR_ID}', 'Type-Driven Architecture with TypeScript', 'Master type-level programming, brand types, template literals, and domain modeling.', 2999, 0, false, 'published', NOW() - INTERVAL '2 days'),
        ('course_database', 'default', '${AUTHOR_ID}', 'Database Internals: Storage & Retrieval', 'Learn B-trees, LSM trees, WAL, write amplification, and page buffer management from scratch.', 0, 0, true, 'published', NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;

      INSERT INTO "modules" (id, course_id, title, position)
      VALUES
        ('mod_consensus', 'course_distributed', 'Consensus & State Machine Replication', 0),
        ('mod_replication', 'course_distributed', 'Replication & Failure Detection', 1),
        ('mod_db_1', 'course_database', 'Storage Engine Fundamentals', 0),
        ('mod_ts_1', 'course_typescript', 'Type-Level Programming', 0)
      ON CONFLICT DO NOTHING;

      INSERT INTO "lessons" (id, module_id, type, title, position, status, mux_playback_id)
      VALUES
        ('les_raft', 'mod_consensus', 'video', 'Raft Consensus Protocol & Leader Election', 0, 'published', 'demo_playback_id'),
        ('les_safety', 'mod_consensus', 'text', 'Safety and Invariants in Distributed Systems', 1, 'published', NULL),
        ('les_quiz', 'mod_consensus', 'quiz', 'Module Knowledge Assessment', 2, 'published', NULL),
        ('les_replication', 'mod_replication', 'video', 'Leaderless Replication in Practice', 0, 'published', 'demo_playback_id'),
        ('les_db_1', 'mod_db_1', 'text', 'B-Trees vs LSM Trees', 0, 'published', NULL),
        ('les_db_2', 'mod_db_1', 'text', 'Write-Ahead Logging Protocols', 1, 'published', NULL),
        ('les_ts_1', 'mod_ts_1', 'text', 'Brand Types and Phantom Types', 0, 'published', NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO "enrollments" (id, user_id, course_id, stripe_payment_id, enrolled_at, course_version_seen)
      VALUES
        ('enroll_db', '${AUTHOR_ID}', 'course_database', 'capture_free', NOW() - INTERVAL '6 days', 1),
        ('enroll_ds', '${AUTHOR_ID}', 'course_distributed', 'capture_paid', NOW() - INTERVAL '9 days', 1)
      ON CONFLICT DO NOTHING;

      INSERT INTO "lesson_progress" (id, tenant_id, user_id, lesson_id, course_id, completed, completed_at, position_seconds, last_seen_at)
      VALUES
        ('lp_db_1', 'default', '${AUTHOR_ID}', 'les_db_1', 'course_database', true, NOW() - INTERVAL '2 days', 0, NOW() - INTERVAL '2 days'),
        ('lp_raft', 'default', '${AUTHOR_ID}', 'les_raft', 'course_distributed', false, NULL, 240, NOW() - INTERVAL '1 day')
      ON CONFLICT DO NOTHING;

      INSERT INTO "course_event" (id, tenant_id, user_id, course_id, lesson_id, type, position_seconds, created_at)
      SELECT
        'ev_' || g || '_' || c || '_' || t,
        'default',
        '${AUTHOR_ID}',
        c,
        NULL,
        t,
        0,
        NOW() - (g || ' days')::interval
      FROM generate_series(0, 24) AS g
      CROSS JOIN (VALUES ('course_distributed'), ('course_typescript'), ('course_database')) AS cs(c)
      CROSS JOIN (VALUES ('view'), ('progress'), ('complete')) AS ts(t)
      WHERE (g + length(c)) % 3 = 0
      ON CONFLICT DO NOTHING;

      INSERT INTO "notifications" (id, tenant_id, user_id, type, payload, read_at, created_at)
      VALUES
        ('ntf_1', 'default', '${AUTHOR_ID}', 'course_published',
          '{"courseTitle":"Distributed Systems in Practice","courseId":"course_distributed","url":"/courses/course_distributed"}', NULL, NOW() - INTERVAL '5 minutes'),
        ('ntf_2', 'default', '${AUTHOR_ID}', 'lesson_published',
          '{"courseTitle":"Type-Driven Architecture with TypeScript","lessonTitle":"Brand Types and Phantom Types","url":"/courses/course_typescript"}', NULL, NOW() - INTERVAL '45 minutes'),
        ('ntf_3', 'default', '${AUTHOR_ID}', 'enrollment_confirmed',
          '{"courseTitle":"Database Internals: Storage & Retrieval","url":"/learn"}', NOW(), NOW() - INTERVAL '3 hours')
      ON CONFLICT DO NOTHING;
    `);
    await client.end();
    return url;
  } catch (err) {
    console.warn("Database connection/seed skipped:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * Signs a throwaway account up through the real auth endpoint and rebinds the
 * resulting session to the seeded author, so authenticated routes render with
 * realistic data instead of a mocked header.
 */
async function createAuthorSession(baseUrl: string): Promise<{ name: string; value: string }[]> {
  const email = `capture_${Date.now()}@example.com`;
  const password = "Password123!";
  try {
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dr. Evelyn Reed", email, password }),
    });
    if (!res.ok) {
      console.warn("Sign-up failed:", res.status, await res.text());
      return [];
    }
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cookies = setCookie
      .map((c) => c.split(";")[0] ?? "")
      .filter((c) => c.startsWith("better-auth.session_token="))
      .map((c) => {
        const eq = c.indexOf("=");
        return { name: c.slice(0, eq), value: c.slice(eq + 1) };
      });
    if (cookies.length === 0) return [];

    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL || DEFAULT_URL,
    });
    await client.connect();
    const { rows } = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
    const tempId = rows[0]?.id;
    if (tempId) {
      await client.query('UPDATE "session" SET user_id = $1 WHERE user_id = $2', [
        AUTHOR_ID,
        tempId,
      ]);
      await client.query('UPDATE "account" SET user_id = $1, account_id = $1 WHERE user_id = $2', [
        AUTHOR_ID,
        tempId,
      ]);
      await client.query('DELETE FROM "user" WHERE id = $1', [tempId]);
    }
    await client.end();
    return cookies;
  } catch (err) {
    console.warn("Author session setup failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function waitForServer(url: string, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status < 500) return true;
    } catch {
      // Server not accepting connections yet
    }
    await sleep(1000);
  }
  return false;
}

async function waitForStyles(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForFunction(
    () => {
      const link = document.querySelector("link[rel=stylesheet]") as HTMLLinkElement | null;
      if (!link?.sheet) return false;
      try {
        return link.sheet.cssRules.length > 20;
      } catch {
        return false;
      }
    },
    null,
    { timeout: 60_000 },
  );
}

async function runAction(page: Page, action: RouteSpec["action"]) {
  if (action === "notifications-popover") {
    await page.getByRole("button", { name: "Notifications" }).click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 20_000 });
    await sleep(600);
  }
}

async function main() {
  const outputDir = join(process.cwd(), "docs", "evidence");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const dbUrl = await seedDatabaseIfPossible();

  let serverProcess: ChildProcess | undefined;
  let baseUrl = process.env.APP_URL || "http://localhost:3000";

  let alreadyRunning = false;
  try {
    const ping = await fetch(baseUrl, { method: "HEAD" });
    alreadyRunning = ping.status < 500;
  } catch {
    alreadyRunning = false;
  }

  if (!alreadyRunning) {
    const targetPort = 3333;
    baseUrl = `http://localhost:${targetPort}`;
    console.log(`Starting Next.js dev server on ${baseUrl}...`);
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(targetPort) };
    if (dbUrl) env.DATABASE_URL = dbUrl;
    serverProcess = spawn("bun", ["--cwd", "apps/web", "dev", "-p", String(targetPort)], {
      stdio: "inherit",
      env,
    });
    if (!(await waitForServer(baseUrl, 60_000))) {
      serverProcess.kill();
      throw new Error(`Server failed to start at ${baseUrl} within 60s`);
    }
    console.log(`Server is ready at ${baseUrl}`);
  } else {
    console.log(`Using existing server at ${baseUrl}`);
  }

  const sessionCookies = await createAuthorSession(baseUrl);
  const sessionCookie = sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  console.log(
    sessionCookies.length > 0 ? "Author session ready" : "No author session (public routes only)",
  );

  console.log("Warming up product routes...");
  for (const route of ROUTES) {
    try {
      await fetch(`${baseUrl}${route.path}`, {
        headers: {
          Accept: "text/html",
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        },
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
      const storageState =
        sessionCookies.length > 0
          ? {
              cookies: sessionCookies.map((c) => ({
                name: c.name,
                value: c.value,
                domain: "localhost",
                path: "/",
                expires: -1,
                httpOnly: false,
                secure: false,
                sameSite: "Lax" as const,
              })),
              origins: [],
            }
          : undefined;

      // Public routes must render signed out: the middleware redirects /sign-in
      // to /learn for authenticated sessions, so they need their own context.
      const publicContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: theme.colorScheme,
      });
      const authOptions: Parameters<typeof browser.newContext>[0] = {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: theme.colorScheme,
      };
      if (storageState) authOptions.storageState = storageState;
      const authContext = await browser.newContext(authOptions);

      for (const route of ROUTES) {
        if (route.auth && !sessionCookies.length) continue;
        const context = route.auth ? authContext : publicContext;
        const page = await context.newPage();
        const pageUrl = `${baseUrl}${route.path}`;
        console.log(`Navigating to ${route.description} (${pageUrl})...`);

        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await waitForStyles(page);

        if (theme.darkClass) {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        } else {
          await page.evaluate(() => document.documentElement.classList.remove("dark"));
        }

        await page.evaluate(() => document.fonts.ready);
        await sleep(800);

        if (route.action) await runAction(page, route.action);

        const filePath = join(outputDir, `${route.name}-${theme.name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`  ✓ Saved: docs/evidence/${route.name}-${theme.name}.png`);
        await page.close();
      }

      await publicContext.close();
      await authContext.close();
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
