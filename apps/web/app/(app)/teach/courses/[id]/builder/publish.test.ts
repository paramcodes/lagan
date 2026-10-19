import type * as DrizzleOrm from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual =
    typeof importOriginal === "function" ? await importOriginal<typeof DrizzleOrm>() : {};
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => ({ column: column?.name, value }),
    and: (...conditions: unknown[]) => conditions,
    asc: (column: unknown) => ({ column, direction: "asc" }),
    inArray: (column: { name?: string }, values: unknown[]) => ({ column: column?.name, values }),
  };
});

interface SelectPromise extends Promise<unknown> {
  from: () => SelectPromise;
  where: (condition: unknown) => SelectPromise;
  orderBy: () => SelectPromise;
  limit: () => SelectPromise;
}

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const updateCalls: Array<{
    table: unknown;
    set: Record<string, unknown>;
    where: unknown;
  }> = [];

  const select = vi.fn(() => {
    const rows = selectQueue.shift() ?? [];
    const promise = Promise.resolve(rows) as SelectPromise;
    promise.from = () => promise;
    promise.where = () => promise;
    promise.orderBy = () => promise;
    promise.limit = () => Promise.resolve(rows) as unknown as SelectPromise;
    return promise;
  });

  const insertReturning = vi.fn();
  const insertValues = vi.fn((vals: Record<string, unknown>) => {
    insertCalls.push({ table: lastInsertedTable, values: vals });
    return {
      returning: insertReturning,
    };
  });
  let lastInsertedTable: unknown = null;
  const insert = vi.fn((table: unknown) => {
    lastInsertedTable = table;
    return { values: insertValues };
  });

  let lastUpdatedTable: unknown = null;
  let lastUpdateSet: Record<string, unknown> = {};
  const updateReturning = vi.fn();
  const updateWhere = vi.fn((condition: unknown) => {
    updateCalls.push({
      table: lastUpdatedTable,
      set: lastUpdateSet,
      where: condition,
    });
    return { returning: updateReturning };
  });
  const updateSet = vi.fn((vals: Record<string, unknown>) => {
    lastUpdateSet = vals;
    return { where: updateWhere };
  });
  const update = vi.fn((table: unknown) => {
    lastUpdatedTable = table;
    return { set: updateSet };
  });

  const tx = { select, insert, update };
  const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx));

  return {
    selectQueue,
    select,
    insert,
    insertValues,
    insertReturning,
    insertCalls,
    update,
    updateSet,
    updateWhere,
    updateReturning,
    updateCalls,
    transaction,
  };
});

vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: dbMock.select,
    insert: dbMock.insert,
    update: dbMock.update,
    transaction: dbMock.transaction,
  },
}));

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../../../../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSession } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { archiveCourse, publishCourse, unarchiveCourse, validateCoursePreflight } from "./publish";

const USER_ID = "author_1";
const COURSE_ID = "course_1";

describe("publish and version management actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.selectQueue.length = 0;
    dbMock.insertCalls.length = 0;
    dbMock.updateCalls.length = 0;
    authMock.getSession.mockResolvedValue({ user: { id: USER_ID } });
  });

  describe("authorization and ownership check", () => {
    it("rejects anonymous callers with Unauthorized", async () => {
      authMock.getSession.mockResolvedValue(null);

      await expect(publishCourse(COURSE_ID)).rejects.toThrow("Unauthorized");
      await expect(archiveCourse(COURSE_ID)).rejects.toThrow("Unauthorized");
      await expect(unarchiveCourse(COURSE_ID)).rejects.toThrow("Unauthorized");
      await expect(validateCoursePreflight(COURSE_ID)).rejects.toThrow("Unauthorized");

      expect(dbMock.select).not.toHaveBeenCalled();
      expect(dbMock.update).not.toHaveBeenCalled();
    });

    it("rejects non-existent course or course not owned by the caller", async () => {
      dbMock.selectQueue.push([]); // assertCourseOwned returns empty

      await expect(publishCourse(COURSE_ID)).rejects.toThrow("Course not found");
      expect(dbMock.update).not.toHaveBeenCalled();
    });

    it("accepts course input as object with id property", async () => {
      dbMock.selectQueue.push([
        {
          id: COURSE_ID,
          tenantId: "default",
          authorId: USER_ID,
          title: "My Course",
          status: "draft",
          version: 1,
          publishedAt: null,
        },
      ]);
      // modules query returns empty
      dbMock.selectQueue.push([]);

      const result = await validateCoursePreflight({ id: COURSE_ID });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Course must have at least one module.");
    });
  });

  describe("preflight validation", () => {
    it("fails when course has no modules", async () => {
      dbMock.selectQueue.push([
        {
          id: COURSE_ID,
          tenantId: "default",
          authorId: USER_ID,
          title: "Empty Course",
          status: "draft",
          version: 1,
          publishedAt: null,
        },
      ]);
      dbMock.selectQueue.push([]); // modules query: empty

      const result = await publishCourse(COURSE_ID);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain("Course must have at least one module.");
      }
      expect(dbMock.transaction).not.toHaveBeenCalled();
    });

    it("fails when a module has no published lessons", async () => {
      dbMock.selectQueue.push([
        {
          id: COURSE_ID,
          tenantId: "default",
          authorId: USER_ID,
          title: "Test Course",
          status: "draft",
          version: 1,
          publishedAt: null,
        },
      ]);
      // 3. modules query: 2 modules
      dbMock.selectQueue.push([
        { id: "mod_1", courseId: COURSE_ID, title: "Module One", position: 0 },
        { id: "mod_2", courseId: COURSE_ID, title: "Module Two", position: 1 },
      ]);
      // 4. lessons query: mod_1 has a draft lesson only, mod_2 has no lessons
      dbMock.selectQueue.push([
        {
          id: "les_1",
          moduleId: "mod_1",
          type: "text",
          title: "Draft Lesson",
          position: 0,
          status: "draft",
          contentJson: { type: "doc" },
        },
      ]);

      const result = await publishCourse(COURSE_ID);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain(
          'Module "Module One" must have at least one published lesson.',
        );
        expect(result.errors).toContain(
          'Module "Module Two" must have at least one published lesson.',
        );
      }
      expect(dbMock.transaction).not.toHaveBeenCalled();
    });

    it("fails when published lessons are missing required content for their type", async () => {
      const courseRow = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Test Course",
        status: "draft",
        version: 1,
        publishedAt: null,
      };
      dbMock.selectQueue.push([courseRow]);

      // modules query: 1 module
      dbMock.selectQueue.push([
        { id: "mod_1", courseId: COURSE_ID, title: "Module One", position: 0 },
      ]);

      // lessons query: 5 published lessons each missing their respective required content
      dbMock.selectQueue.push([
        {
          id: "les_vid",
          moduleId: "mod_1",
          type: "video",
          title: "Video Lesson",
          position: 0,
          status: "published",
          muxPlaybackId: null, // missing video
        },
        {
          id: "les_txt",
          moduleId: "mod_1",
          type: "text",
          title: "Text Lesson",
          position: 1,
          status: "published",
          contentJson: null, // missing text content
        },
        {
          id: "les_quiz",
          moduleId: "mod_1",
          type: "quiz",
          title: "Quiz Lesson",
          position: 2,
          status: "published",
          contentJson: null, // missing quiz content
        },
        {
          id: "les_file",
          moduleId: "mod_1",
          type: "file",
          title: "File Lesson",
          position: 3,
          status: "published",
          fileKey: "   ", // blank fileKey
        },
        {
          id: "les_ext",
          moduleId: "mod_1",
          type: "external",
          title: "External Lesson",
          position: 4,
          status: "published",
          externalUrl: "", // empty URL
        },
      ]);

      const result = await publishCourse(COURSE_ID);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toEqual([
          'Lesson "Video Lesson" (video) requires a video playback ID.',
          'Lesson "Text Lesson" (text) requires text content.',
          'Lesson "Quiz Lesson" (quiz) requires quiz content.',
          'Lesson "File Lesson" (file) requires an uploaded file.',
          'Lesson "External Lesson" (external) requires an external URL.',
        ]);
      }
    });

    it("validateCoursePreflight returns valid: true when course satisfies all requirements", async () => {
      const courseRow = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Complete Course",
        status: "draft",
        version: 1,
        publishedAt: null,
      };
      dbMock.selectQueue.push([courseRow]);
      dbMock.selectQueue.push([
        { id: "mod_1", courseId: COURSE_ID, title: "Module One", position: 0 },
      ]);
      dbMock.selectQueue.push([
        {
          id: "les_1",
          moduleId: "mod_1",
          type: "video",
          title: "Intro Video",
          position: 0,
          status: "published",
          muxPlaybackId: "playback_123",
        },
      ]);

      const preflight = await validateCoursePreflight(COURSE_ID);
      expect(preflight.valid).toBe(true);
      expect(preflight.errors).toHaveLength(0);
    });
  });

  describe("first publish", () => {
    it("transitions draft status to published, sets publishedAt, and records event", async () => {
      const draftCourse = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Complete Course",
        status: "draft" as const,
        version: 1,
        publishedAt: null,
      };

      dbMock.selectQueue.push([draftCourse]);
      dbMock.selectQueue.push([
        { id: "mod_1", courseId: COURSE_ID, title: "Module 1", position: 0 },
      ]);
      dbMock.selectQueue.push([
        {
          id: "les_1",
          moduleId: "mod_1",
          type: "text",
          title: "Intro",
          position: 0,
          status: "published",
          contentJson: { type: "doc", content: [] },
        },
      ]);

      const publishedCourse = {
        ...draftCourse,
        status: "published" as const,
        publishedAt: new Date("2026-10-19T10:00:00Z"),
      };
      dbMock.updateReturning.mockResolvedValueOnce([publishedCourse]);

      const result = await publishCourse(COURSE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.course.status).toBe("published");
        expect(result.isVersionBump).toBe(false);
        expect(result.version).toBe(1);
      }

      expect(dbMock.transaction).toHaveBeenCalled();
      expect(dbMock.updateCalls[0]?.set).toMatchObject({
        status: "published",
        version: 1,
        publishedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(dbMock.insertCalls[0]?.values).toMatchObject({
        tenantId: "default",
        userId: USER_ID,
        courseId: COURSE_ID,
        lessonId: null,
        type: "publish",
        positionSeconds: 0,
      });
    });
  });

  describe("republish (version bump)", () => {
    it("increments version integer, updates publishedAt, and records version_bump event", async () => {
      const publishedCourse = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Complete Course",
        status: "published" as const,
        version: 1,
        publishedAt: new Date("2026-09-01T00:00:00Z"),
      };

      dbMock.selectQueue.push([publishedCourse]);
      dbMock.selectQueue.push([
        { id: "mod_1", courseId: COURSE_ID, title: "Module 1", position: 0 },
      ]);
      dbMock.selectQueue.push([
        {
          id: "les_1",
          moduleId: "mod_1",
          type: "video",
          title: "Updated Video",
          position: 0,
          status: "published",
          muxPlaybackId: "mux_new_456",
        },
      ]);

      const republishedCourse = {
        ...publishedCourse,
        version: 2,
        publishedAt: new Date("2026-10-19T12:00:00Z"),
      };
      dbMock.updateReturning.mockResolvedValueOnce([republishedCourse]);

      const result = await publishCourse(COURSE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isVersionBump).toBe(true);
        expect(result.version).toBe(2);
        expect(result.course.version).toBe(2);
      }

      expect(dbMock.updateCalls[0]?.set).toMatchObject({
        status: "published",
        version: 2,
        publishedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(dbMock.insertCalls[0]?.values).toMatchObject({
        tenantId: "default",
        userId: USER_ID,
        courseId: COURSE_ID,
        type: "version_bump",
      });
    });
  });

  describe("archiveCourse", () => {
    it("transitions course status to archived and records archive event", async () => {
      const course = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Retiring Course",
        status: "published" as const,
        version: 2,
        publishedAt: new Date("2026-01-01"),
      };
      dbMock.selectQueue.push([course]);

      const archivedCourse = { ...course, status: "archived" as const };
      dbMock.updateReturning.mockResolvedValueOnce([archivedCourse]);

      const result = await archiveCourse(COURSE_ID);
      expect(result.success).toBe(true);
      expect(result.course.status).toBe("archived");

      expect(dbMock.updateCalls[0]?.set).toMatchObject({
        status: "archived",
        updatedAt: expect.any(Date),
      });

      expect(dbMock.insertCalls[0]?.values).toMatchObject({
        tenantId: "default",
        userId: USER_ID,
        courseId: COURSE_ID,
        type: "archive",
      });
    });
  });

  describe("unarchiveCourse", () => {
    it("restores previously published course to published status", async () => {
      const archivedCourse = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Archived Course",
        status: "archived" as const,
        version: 2,
        publishedAt: new Date("2026-01-01"),
      };
      dbMock.selectQueue.push([archivedCourse]);

      const restoredCourse = { ...archivedCourse, status: "published" as const };
      dbMock.updateReturning.mockResolvedValueOnce([restoredCourse]);

      const result = await unarchiveCourse(COURSE_ID);
      expect(result.success).toBe(true);
      expect(result.course.status).toBe("published");

      expect(dbMock.updateCalls[0]?.set).toMatchObject({
        status: "published",
        updatedAt: expect.any(Date),
      });

      expect(dbMock.insertCalls[0]?.values).toMatchObject({
        type: "unarchive",
      });
    });

    it("restores previously unpublished (draft) course to draft status", async () => {
      const archivedDraftCourse = {
        id: COURSE_ID,
        tenantId: "default",
        authorId: USER_ID,
        title: "Archived Draft",
        status: "archived" as const,
        version: 1,
        publishedAt: null,
      };
      dbMock.selectQueue.push([archivedDraftCourse]);

      const restoredCourse = { ...archivedDraftCourse, status: "draft" as const };
      dbMock.updateReturning.mockResolvedValueOnce([restoredCourse]);

      const result = await unarchiveCourse(COURSE_ID);
      expect(result.success).toBe(true);
      expect(result.course.status).toBe("draft");

      expect(dbMock.updateCalls[0]?.set).toMatchObject({
        status: "draft",
        updatedAt: expect.any(Date),
      });
    });
  });
});
