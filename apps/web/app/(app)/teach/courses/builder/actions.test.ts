import { lessons, modules } from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../../../lib/rate-limit";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown) => ({ column: column.name, value }),
    and: (...conditions: unknown[]) => conditions,
  };
});

interface SelectPromise extends Promise<unknown> {
  from: () => SelectPromise;
  innerJoin: () => SelectPromise;
  where: (condition: unknown) => SelectPromise;
  orderBy: () => SelectPromise;
  limit: () => SelectPromise;
}

const dbMock = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const selectWhere: unknown[] = [];

  const select = vi.fn(() => {
    const promise = Promise.resolve(selectResults.shift() ?? []) as SelectPromise;
    promise.from = () => promise;
    promise.innerJoin = () => promise;
    promise.where = (condition: unknown) => {
      selectWhere.push(condition);
      return promise;
    };
    promise.orderBy = () => promise;
    promise.limit = () => promise;
    return promise;
  });

  const insertReturning = vi.fn();
  const insertValues = vi.fn((_values: Record<string, unknown>) => ({
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn((_condition: unknown) => ({ returning: updateReturning }));
  const updateSet = vi.fn((_values: Record<string, unknown>) => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const deleteReturning = vi.fn();
  const deleteWhere = vi.fn((_condition: unknown) => ({ returning: deleteReturning }));
  const remove = vi.fn(() => ({ where: deleteWhere }));

  const tx = { select, insert, update, delete: remove };
  const transaction = vi.fn((callback: (tx: unknown) => unknown) => callback(tx));

  return {
    select,
    selectResults,
    selectWhere,
    insert,
    insertValues,
    insertReturning,
    update,
    updateSet,
    updateWhere,
    updateReturning,
    remove,
    deleteWhere,
    deleteReturning,
    transaction,
  };
});

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: dbMock.select,
    insert: dbMock.insert,
    update: dbMock.update,
    delete: dbMock.remove,
    transaction: dbMock.transaction,
  },
}));

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("../../../../../lib/auth", () => ({ auth: { api: { getSession } } }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  moveLessonToModule,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateModule,
} from "./actions";

const USER_ID = "user_1";
const COURSE_ID = "course_1";
const MODULE_ID = "module_1";
const OTHER_MODULE_ID = "module_2";
const LESSON_ID = "lesson_1";

function whereValues(): string[] {
  return dbMock.updateWhere.mock.calls.map((call) => (call[0] as { value: string }).value);
}

function setValues(): Record<string, unknown>[] {
  return dbMock.updateSet.mock.calls.map((call) => call[0]);
}

function deleteWhereValues(): string[] {
  return dbMock.deleteWhere.mock.calls.map((call) => (call[0] as { value: string }).value);
}

function positionsByParent(values: Record<string, unknown>[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const value of values) {
    const parent = value.moduleId as string;
    const positions = grouped.get(parent) ?? [];
    positions.push(value.position as number);
    grouped.set(parent, positions);
  }
  return grouped;
}

function assertTwoPhasePositions(values: Record<string, unknown>[]): void {
  const temps = values.filter((value) => (value.position as number) < 0);
  const finals = values.filter((value) => (value.position as number) >= 0);

  expect(temps.length).toBeGreaterThan(0);
  expect(new Set(temps.map((value) => value.position)).size).toBe(temps.length);
  expect(new Set(finals.map((value) => value.position)).size).toBe(finals.length);
  expect(values.indexOf(finals[0] as Record<string, unknown>)).toBe(temps.length);
}

describe("module server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    dbMock.selectResults.length = 0;
    dbMock.selectWhere.length = 0;
    getSession.mockResolvedValue({ user: { id: USER_ID } });
  });

  it("rejects anonymous callers before touching the database", async () => {
    getSession.mockResolvedValue(null);

    await expect(createModule({ courseId: COURSE_ID, title: "Intro" })).rejects.toThrow(
      "Unauthorized",
    );
    await expect(updateModule({ id: MODULE_ID, title: "Intro" })).rejects.toThrow("Unauthorized");
    await expect(deleteModule({ id: MODULE_ID })).rejects.toThrow("Unauthorized");
    await expect(reorderModules({ courseId: COURSE_ID, orderedIds: [MODULE_ID] })).rejects.toThrow(
      "Unauthorized",
    );
    await expect(
      createLesson({ moduleId: MODULE_ID, type: "text", title: "Lesson" }),
    ).rejects.toThrow("Unauthorized");
    await expect(updateLesson({ id: LESSON_ID, title: "Lesson" })).rejects.toThrow("Unauthorized");
    await expect(deleteLesson({ id: LESSON_ID })).rejects.toThrow("Unauthorized");
    await expect(reorderLessons({ moduleId: MODULE_ID, orderedIds: [LESSON_ID] })).rejects.toThrow(
      "Unauthorized",
    );
    await expect(
      moveLessonToModule({ lessonId: LESSON_ID, toModuleId: OTHER_MODULE_ID }),
    ).rejects.toThrow("Unauthorized");

    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.remove).not.toHaveBeenCalled();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("appends a module owned by the signed-in author", async () => {
    dbMock.selectResults.push([{ id: COURSE_ID }]);
    dbMock.selectResults.push([{ position: 2 }]);
    dbMock.insertReturning.mockResolvedValue([{ id: MODULE_ID }]);

    const created = await createModule({ courseId: COURSE_ID, title: "  Systems  " });

    expect(created).toEqual({ id: MODULE_ID });
    expect(dbMock.selectWhere[0]).toEqual([
      { column: "id", value: COURSE_ID },
      { column: "author_id", value: USER_ID },
    ]);
    expect(dbMock.insert).toHaveBeenCalledWith(modules);
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        courseId: COURSE_ID,
        title: "Systems",
        position: 3,
      }),
    );
  });

  it("refuses a blank module title and never queries", async () => {
    await expect(createModule({ courseId: COURSE_ID, title: "   " })).rejects.toThrow();

    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("refuses to add a module to a course the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(createModule({ courseId: COURSE_ID, title: "Hijack" })).rejects.toThrow(
      "Course not found",
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("renames a module through the course ownership join", async () => {
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.updateReturning.mockResolvedValue([{ id: MODULE_ID, title: "Renamed" }]);

    const module = await updateModule({ id: MODULE_ID, title: "Renamed" });

    expect(module).toEqual({ id: MODULE_ID, title: "Renamed" });
    expect(dbMock.selectWhere[0]).toEqual([
      { column: "id", value: MODULE_ID },
      { column: "author_id", value: USER_ID },
    ]);
    expect(dbMock.update).toHaveBeenCalledWith(modules);
    expect(dbMock.updateSet).toHaveBeenCalledWith({ title: "Renamed" });
    expect(whereValues()).toEqual([MODULE_ID]);
  });

  it("surfaces a module the author does not own as not found", async () => {
    dbMock.selectResults.push([]);

    await expect(updateModule({ id: MODULE_ID, title: "Hijacked" })).rejects.toThrow(
      "Module not found",
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("deletes a module scoped to the author", async () => {
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.deleteReturning.mockResolvedValue([{ id: MODULE_ID }]);

    await expect(deleteModule({ id: MODULE_ID })).resolves.toEqual({ id: MODULE_ID });

    expect(dbMock.remove).toHaveBeenCalledWith(modules);
    expect(deleteWhereValues()).toEqual([MODULE_ID]);
  });

  it("refuses to delete a module the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(deleteModule({ id: MODULE_ID })).rejects.toThrow("Module not found");
    expect(dbMock.remove).not.toHaveBeenCalled();
  });

  it("reorders modules in two phases so the unique index never collides", async () => {
    dbMock.selectResults.push([{ id: COURSE_ID }]);
    dbMock.selectResults.push([{ id: MODULE_ID }, { id: OTHER_MODULE_ID }]);

    const result = await reorderModules({
      courseId: COURSE_ID,
      orderedIds: [OTHER_MODULE_ID, MODULE_ID],
    });

    expect(result).toEqual({ courseId: COURSE_ID, orderedIds: [OTHER_MODULE_ID, MODULE_ID] });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(whereValues()).toEqual([OTHER_MODULE_ID, MODULE_ID, OTHER_MODULE_ID, MODULE_ID]);
    assertTwoPhasePositions(setValues());
    expect(setValues().map((value) => value.position)).toEqual([-1, -2, 0, 1]);
  });

  it("refuses a reorder list that does not match the course modules", async () => {
    dbMock.selectResults.push([{ id: COURSE_ID }]);
    dbMock.selectResults.push([{ id: MODULE_ID }, { id: OTHER_MODULE_ID }]);

    await expect(
      reorderModules({ courseId: COURSE_ID, orderedIds: [MODULE_ID, "module_9"] }),
    ).rejects.toThrow("Reorder list does not match the course modules");

    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("refuses to reorder modules of a course the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(reorderModules({ courseId: COURSE_ID, orderedIds: [MODULE_ID] })).rejects.toThrow(
      "Course not found",
    );

    expect(dbMock.transaction).not.toHaveBeenCalled();
  });
});

describe("lesson server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    dbMock.selectResults.length = 0;
    dbMock.selectWhere.length = 0;
    getSession.mockResolvedValue({ user: { id: USER_ID } });
  });

  it("appends a lesson to a module owned by the signed-in author", async () => {
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.selectResults.push([{ position: 0 }]);
    dbMock.insertReturning.mockResolvedValue([{ id: LESSON_ID }]);

    const created = await createLesson({ moduleId: MODULE_ID, type: "text", title: "Intro" });

    expect(created).toEqual({ id: LESSON_ID });
    expect(dbMock.selectWhere[0]).toEqual([
      { column: "id", value: MODULE_ID },
      { column: "author_id", value: USER_ID },
    ]);
    expect(dbMock.insert).toHaveBeenCalledWith(lessons);
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: MODULE_ID,
        type: "text",
        title: "Intro",
        position: 1,
        contentJson: null,
        muxPlaybackId: null,
        externalUrl: null,
        fileKey: null,
      }),
    );
  });

  it("refuses to add a lesson to a module the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(
      createLesson({ moduleId: MODULE_ID, type: "text", title: "Hijack" }),
    ).rejects.toThrow("Module not found");

    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("updates provided lesson fields scoped to the owner", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.updateReturning.mockResolvedValue([{ id: LESSON_ID, title: "Renamed" }]);

    const lesson = await updateLesson({ id: LESSON_ID, title: "Renamed", status: "published" });

    expect(lesson).toEqual({ id: LESSON_ID, title: "Renamed" });
    expect(dbMock.selectWhere[0]).toEqual([
      { column: "id", value: LESSON_ID },
      { column: "author_id", value: USER_ID },
    ]);
    expect(dbMock.update).toHaveBeenCalledWith(lessons);
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      title: "Renamed",
      status: "published",
      updatedAt: expect.any(Date),
    });
    expect(whereValues()).toEqual([LESSON_ID]);
  });

  it("clears nullable lesson fields when null is passed", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.updateReturning.mockResolvedValue([{ id: LESSON_ID }]);

    await updateLesson({ id: LESSON_ID, externalUrl: null, contentJson: null });

    expect(dbMock.updateSet).toHaveBeenCalledWith({
      contentJson: null,
      externalUrl: null,
      updatedAt: expect.any(Date),
    });
  });

  it("refuses to update a lesson the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(updateLesson({ id: LESSON_ID, title: "Hijacked" })).rejects.toThrow(
      "Lesson not found",
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("deletes a lesson scoped to the author", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.deleteReturning.mockResolvedValue([{ id: LESSON_ID }]);

    await expect(deleteLesson({ id: LESSON_ID })).resolves.toEqual({ id: LESSON_ID });

    expect(dbMock.remove).toHaveBeenCalledWith(lessons);
    expect(deleteWhereValues()).toEqual([LESSON_ID]);
  });

  it("refuses to delete a lesson the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(deleteLesson({ id: LESSON_ID })).rejects.toThrow("Lesson not found");
    expect(dbMock.remove).not.toHaveBeenCalled();
  });

  it("reorders lessons in two phases so the unique index never collides", async () => {
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.selectResults.push([{ id: "lesson_1" }, { id: "lesson_2" }, { id: "lesson_3" }]);

    await reorderLessons({
      moduleId: MODULE_ID,
      orderedIds: ["lesson_3", "lesson_1", "lesson_2"],
    });

    expect(whereValues()).toEqual([
      "lesson_3",
      "lesson_1",
      "lesson_2",
      "lesson_3",
      "lesson_1",
      "lesson_2",
    ]);
    assertTwoPhasePositions(setValues());
    expect(setValues().map((value) => value.position)).toEqual([-1, -2, -3, 0, 1, 2]);
  });

  it("refuses a reorder list that does not match the module lessons", async () => {
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.selectResults.push([{ id: "lesson_1" }]);

    await expect(
      reorderLessons({ moduleId: MODULE_ID, orderedIds: ["lesson_1", "lesson_2"] }),
    ).rejects.toThrow("Reorder list does not match the course lessons");

    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("refuses to reorder lessons of a module the author does not own", async () => {
    dbMock.selectResults.push([]);

    await expect(reorderLessons({ moduleId: MODULE_ID, orderedIds: [LESSON_ID] })).rejects.toThrow(
      "Module not found",
    );

    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("moves a lesson into another module of the same course", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.selectResults.push([{ id: OTHER_MODULE_ID }]);
    dbMock.selectResults.push([{ moduleId: MODULE_ID }]);
    dbMock.selectResults.push([{ courseId: COURSE_ID }]);
    dbMock.selectResults.push([{ courseId: COURSE_ID }]);
    dbMock.selectResults.push([{ id: "lesson_1" }, { id: "lesson_3" }]);
    dbMock.selectResults.push([{ id: "lesson_4" }, { id: "lesson_5" }]);

    const result = await moveLessonToModule({
      lessonId: "lesson_2",
      toModuleId: OTHER_MODULE_ID,
      toIndex: 1,
    });

    expect(result).toEqual({ lessonId: "lesson_2", moduleId: OTHER_MODULE_ID, position: 1 });

    const sets = setValues();
    const ids = whereValues();
    const movedIndex = ids.lastIndexOf("lesson_2");
    expect(sets[movedIndex]).toMatchObject({ moduleId: OTHER_MODULE_ID, position: 1 });

    const phaseOne = positionsByParent(sets.slice(0, 5));
    const phaseTwo = positionsByParent(sets.slice(5));
    expect(phaseOne.get(MODULE_ID)).toEqual([-1, -2]);
    expect(phaseOne.get(OTHER_MODULE_ID)).toEqual([-1, -2, -3]);
    expect(phaseTwo.get(MODULE_ID)).toEqual([0, 1]);
    expect(phaseTwo.get(OTHER_MODULE_ID)).toEqual([0, 1, 2]);
    expect(ids.slice(0, 5)).toEqual(["lesson_1", "lesson_3", "lesson_4", "lesson_2", "lesson_5"]);
  });

  it("reorders inside the same module when the target module matches", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.selectResults.push([{ id: MODULE_ID }]);
    dbMock.selectResults.push([{ moduleId: MODULE_ID }]);
    dbMock.selectResults.push([{ courseId: COURSE_ID }]);
    dbMock.selectResults.push([{ courseId: COURSE_ID }]);
    dbMock.selectResults.push([{ id: "lesson_1" }, { id: "lesson_3" }]);

    const result = await moveLessonToModule({ lessonId: "lesson_2", toModuleId: MODULE_ID });

    expect(result).toEqual({ lessonId: "lesson_2", moduleId: MODULE_ID, position: 2 });
    expect(whereValues()).toEqual([
      "lesson_1",
      "lesson_3",
      "lesson_2",
      "lesson_1",
      "lesson_3",
      "lesson_2",
    ]);
  });

  it("refuses to move a lesson across courses", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.selectResults.push([{ id: OTHER_MODULE_ID }]);
    dbMock.selectResults.push([{ moduleId: MODULE_ID }]);
    dbMock.selectResults.push([{ courseId: COURSE_ID }]);
    dbMock.selectResults.push([{ courseId: "course_2" }]);

    await expect(
      moveLessonToModule({ lessonId: LESSON_ID, toModuleId: OTHER_MODULE_ID }),
    ).rejects.toThrow("Cannot move a lesson between courses");

    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("refuses to move a lesson to a module the author does not own", async () => {
    dbMock.selectResults.push([{ id: LESSON_ID }]);
    dbMock.selectResults.push([]);

    await expect(
      moveLessonToModule({ lessonId: LESSON_ID, toModuleId: OTHER_MODULE_ID }),
    ).rejects.toThrow("Module not found");

    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("rejects unknown fields via strict schema validation", async () => {
    await expect(
      // @ts-expect-error Testing unknown field rejection
      createLesson({ moduleId: MODULE_ID, type: "text", title: "Intro", unknownField: "bad" }),
    ).rejects.toThrow();
  });

  it("rate limits rapid builder operations exceeding 120 req/min per author", async () => {
    dbMock.selectResults.length = 0;
    for (let i = 0; i < 120; i++) {
      dbMock.selectResults.push([{ id: MODULE_ID }]);
      dbMock.selectResults.push([{ position: 0 }]);
      dbMock.insertReturning.mockResolvedValue([{ id: LESSON_ID }]);
      await createLesson({ moduleId: MODULE_ID, type: "text", title: "Intro" });
    }

    // 121st call triggers rate limit
    await expect(
      createLesson({ moduleId: MODULE_ID, type: "text", title: "Intro" }),
    ).rejects.toThrow("Too many requests");
  });
});
