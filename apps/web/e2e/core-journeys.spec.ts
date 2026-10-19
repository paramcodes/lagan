import { expect, test } from "@playwright/test";
import { cleanupTestData, createTestNotification, getUserIdByEmail, seedE2EData } from "./seed";

test.describe("Core Journeys", () => {
  const createdEmails: string[] = [];
  const createdCourseIds: string[] = [];

  test.beforeAll(async () => {
    await seedE2EData();
  });

  test.afterAll(async () => {
    await cleanupTestData(createdEmails, createdCourseIds);
  });

  test("auth journey: sign-up, sign-in, session persistence, and sign-out", async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `learner_${timestamp}@example.com`;
    createdEmails.push(testEmail);
    const password = "Password123!";

    // 1. Sign up
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await page.getByLabel("Name").fill("Alex Learner");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();

    // Verify authenticated landing on /learn
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.getByRole("heading", { name: "My Learning" })).toBeVisible();

    // 2. Session persistence across navigation and reload
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    // 3. Sign out via Account menu
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // 4. Sign in
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.getByRole("heading", { name: "My Learning" })).toBeVisible();
  });

  test("authoring journey: create course, add modules/lessons, edit content, autosave draft, publish with preflight validation", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const authorEmail = `author_${timestamp}@example.com`;
    createdEmails.push(authorEmail);
    const password = "Password123!";

    // Authenticate author
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Prof. Ada Lovelace");
    await page.getByLabel("Email").fill(authorEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/learn/);

    // 1. Create course
    await page.goto("/teach/courses/new");
    await expect(page.getByRole("heading", { name: "Create Course" })).toBeVisible();
    const courseTitle = `Quantum Computing Architecture ${timestamp}`;
    await page.getByLabel("Course title").fill(courseTitle);
    await page
      .getByLabel("Course description")
      .fill("A deep dive into qubits, gates, and quantum algorithms.");
    await page.getByRole("button", { name: "Create course" }).click();

    // Redirected to builder
    await expect(page).toHaveURL(/\/teach\/courses\/[^/]+\/builder/);
    const urlMatch = page.url().match(/\/teach\/courses\/([^/]+)\/builder/);
    if (urlMatch?.[1]) createdCourseIds.push(urlMatch[1]);

    await expect(page.getByRole("heading", { level: 1, name: courseTitle })).toBeVisible();

    // 2. Add module
    await page.getByRole("button", { name: "Add Module" }).click();
    await page.getByLabel("New module title").fill("Qubit State Vector Spaces");
    await page.getByRole("button", { name: "Add module" }).click();
    await expect(page.getByRole("heading", { name: /Qubit State Vector Spaces/ })).toBeVisible();

    // 3. Add lesson
    await page
      .getByRole("button", {
        name: 'Add lesson to module "Qubit State Vector Spaces"',
      })
      .click();
    await page
      .getByRole("textbox", {
        name: "New lesson title for module Qubit State Vector Spaces",
      })
      .fill("Superposition Principles");
    await page.getByRole("button", { name: "Add lesson" }).click();
    await expect(page.getByText("Superposition Principles")).toBeVisible();

    // 4. Edit content: rename module
    await page.getByRole("button", { name: 'Edit module "Qubit State Vector Spaces"' }).click();
    const moduleInput = page.getByRole("textbox", { name: "Module title" });
    await moduleInput.fill("Qubit Vector Spaces (Revised)");
    await page.getByRole("button", { name: "Save module title" }).click();
    await expect(
      page.getByRole("heading", { name: /Qubit Vector Spaces \(Revised\)/ }),
    ).toBeVisible();

    // 5. Autosave draft check
    await expect(page.getByText("Saved")).toBeVisible();

    // 6. Publish with preflight validation
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish Course" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm & Publish" }).click();

    // Newly created lesson is draft, so preflight validation enforces published lesson requirement
    await expect(
      page.getByRole("alert", { name: "Publish preflight validation errors" }),
    ).toBeVisible();
    await expect(page.getByText(/must have at least one published lesson/i)).toBeVisible();

    // Close publish modal
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByRole("heading", { name: "Publish Course" })).not.toBeVisible();
  });

  test("discovery & purchase journey: browse /courses, search, category filter, view course detail, free enrollment and test checkout", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const learnerEmail = `buyer_${timestamp}@example.com`;
    createdEmails.push(learnerEmail);
    const password = "Password123!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Charlie Buyer");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/learn/);

    // 1. Browse /courses
    await page.goto("/courses");
    await expect(page.getByRole("heading", { level: 1, name: "Courses" })).toBeVisible();
    await expect(page.getByText("Distributed Systems in Practice")).toBeVisible();
    await expect(page.getByText("Database Internals: Storage & Retrieval")).toBeVisible();

    // 2. Search filtering
    const searchInput = page.getByRole("searchbox", {
      name: "Search courses, lessons, people",
    });
    await searchInput.fill("Distributed");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/q=Distributed/);
    await expect(page.getByText("Distributed Systems in Practice")).toBeVisible();
    await expect(page.getByText("Database Internals: Storage & Retrieval")).not.toBeVisible();

    // Clear search filter
    await searchInput.fill("");
    await searchInput.press("Enter");
    await expect(page.getByText("Database Internals: Storage & Retrieval")).toBeVisible();

    // 3. Category filtering
    const categorySelect = page.getByRole("combobox", {
      name: "Category filter",
    });
    await categorySelect.selectOption("development");
    await expect(page).toHaveURL(/category=development/);
    await expect(page.getByRole("status")).toBeVisible();

    // Reset category
    await categorySelect.selectOption("all");

    // 4. View course detail: Free course
    await page
      .getByRole("link", { name: /Database Internals: Storage & Retrieval/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/courses\/course_database/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Database Internals: Storage & Retrieval",
      }),
    ).toBeVisible();

    // 5. Trigger free enrollment
    const freeEnrollBtn = page.getByRole("button", { name: "Enroll for Free" });
    await expect(freeEnrollBtn).toBeVisible();
    await freeEnrollBtn.click();

    // Follows enrollment to course resume href
    await expect(page).toHaveURL(/\/courses\/course_database/);

    // 6. View course detail: Paid course with test checkout
    await page.goto("/courses/course_distributed");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Distributed Systems in Practice",
      }),
    ).toBeVisible();

    // Intercept checkout API to simulate test checkout redirect
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "http://localhost:3000/courses/course_distributed?checkout=success",
        }),
      });
    });

    const buyButton = page.getByRole("button", { name: "Buy Now" });
    await expect(buyButton).toBeVisible();
    await buyButton.click();

    // Follows checkout redirect
    await expect(page).toHaveURL(/checkout=success/);
  });

  test("learning & progress journey: visit /learn, launch player, track progress, auto-advance", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const learnerEmail = `student_${timestamp}@example.com`;
    createdEmails.push(learnerEmail);
    const password = "Password123!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Dana Student");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/learn/);

    // Enroll in free course
    await page.goto("/courses/course_database");
    await page.getByRole("button", { name: "Enroll for Free" }).click();

    // 1. Visit /learn (My Learning dashboard)
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1, name: "My Learning" })).toBeVisible();
    await expect(page.getByText("Database Internals: Storage & Retrieval")).toBeVisible();

    // 2. Launch lesson player
    await page
      .getByRole("link", { name: /Continue Learning/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/courses\/course_database\/lessons\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 3. Progress tracking: Mark as Complete
    const markCompleteButton = page.getByRole("button", {
      name: "Mark as Complete",
    });
    await expect(markCompleteButton).toBeVisible();
    await markCompleteButton.click();

    // Button updates state to Completed
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();

    // 4. Auto-advance banner
    const autoAdvanceBanner = page.getByLabel("Auto-advance countdown");
    await expect(autoAdvanceBanner).toBeVisible();
    await expect(page.getByText(/Auto-advancing in/)).toBeVisible();

    // Advance to next lesson
    await page.getByRole("button", { name: "Play Next" }).click();
    await expect(page).toHaveURL(/\/courses\/course_database\/lessons\/les_db_2/);
    await expect(
      page.getByRole("heading", { name: "Write-Ahead Logging Protocols" }),
    ).toBeVisible();
  });

  test("notifications journey: receive new content notification, popover unread badge, mark as read", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const learnerEmail = `notify_test_${timestamp}@example.com`;
    createdEmails.push(learnerEmail);
    const password = "Password123!";

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Noam Notified");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/learn/);

    const userId = await getUserIdByEmail(learnerEmail);
    expect(userId).toBeTruthy();
    if (!userId) throw new Error("User id not found");

    // Seed test notification in database
    const notificationTitle = `New Chapter Published ${timestamp}`;
    await createTestNotification(
      userId,
      notificationTitle,
      "Chapter 4 on Consensus Protocols is now live!",
    );

    // Refresh to trigger notification fetch
    await page.goto("/courses");

    // Check unread badge in notification center
    const notificationButton = page.getByRole("button", {
      name: /Notifications \(\d+ unread\)/i,
    });
    await expect(notificationButton).toBeVisible();
    await expect(page.getByTestId("unread-badge")).toBeVisible();

    // Open popover
    await notificationButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Notifications" })).toBeVisible();
    await expect(page.getByText(notificationTitle)).toBeVisible();

    // Mark as read
    const markAsReadButton = page.getByRole("button", {
      name: `Mark "${notificationTitle}" as read`,
    });
    await expect(markAsReadButton).toBeVisible();
    await markAsReadButton.click();

    // Assert unread badge is cleared
    await expect(page.getByTestId("unread-badge")).not.toBeVisible();
  });
});
