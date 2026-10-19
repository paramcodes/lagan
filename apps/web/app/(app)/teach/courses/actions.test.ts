import { courses } from "@lagan/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown) => ({ column: column.name, value }),
    and: (...conditions: unknown[]) => conditions,
  };
});

const dbMock = vi.hoisted(() => {
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

  return {
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
  };
});

vi.mock("../../../../lib/db", () => ({
  db: { insert: dbMock.insert, update: dbMock.update, delete: dbMock.remove },
}));

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("../../../../lib/auth", () => ({ auth: { api: { getSession } } }));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

import { createCourse, deleteCourse, publishCourse, updateCourse } from "./actions";

const USER_ID = "user_1";
const COURSE_ID = "course_1";

describe("course server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { id: USER_ID } });
  });

  it("rejects anonymous callers before touching the database", async () => {
    getSession.mockResolvedValue(null);

    await expect(createCourse({ title: "Systems Design" })).rejects.toThrow("Unauthorized");
    await expect(updateCourse({ id: COURSE_ID, title: "Systems Design" })).rejects.toThrow(
      "Unauthorized",
    );
    await expect(deleteCourse({ id: COURSE_ID })).rejects.toThrow("Unauthorized");
    await expect(publishCourse({ id: COURSE_ID })).rejects.toThrow("Unauthorized");

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.remove).not.toHaveBeenCalled();
  });

  it("creates a draft course owned by the signed-in author", async () => {
    dbMock.insertReturning.mockResolvedValue([{ id: COURSE_ID }]);

    const course = await createCourse({ title: "  Systems Design  " });

    expect(course).toEqual({ id: COURSE_ID });
    expect(dbMock.insert).toHaveBeenCalledWith(courses);
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        tenantId: "default",
        authorId: USER_ID,
        title: "Systems Design",
        description: null,
        priceCents: 0,
        discountPercent: 0,
        isFree: false,
        status: "draft",
      }),
    );
  });

  it("keeps provided pricing fields when creating", async () => {
    dbMock.insertReturning.mockResolvedValue([{ id: COURSE_ID }]);

    await createCourse({
      title: "Paid Course",
      description: "Deep dive",
      priceCents: 4900,
      discountPercent: 10,
      isFree: false,
    });

    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Deep dive",
        priceCents: 4900,
        discountPercent: 10,
      }),
    );
  });

  it("refuses to create a course with a blank title", async () => {
    await expect(createCourse({ title: "   " })).rejects.toThrow();

    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("updates only the fields supplied, scoped to the author", async () => {
    dbMock.updateReturning.mockResolvedValue([{ id: COURSE_ID, title: "New title" }]);

    const course = await updateCourse({ id: COURSE_ID, title: "New title" });

    expect(course).toEqual({ id: COURSE_ID, title: "New title" });
    expect(dbMock.update).toHaveBeenCalledWith(courses);
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      title: "New title",
      updatedAt: expect.any(Date),
    });
    expect(dbMock.updateWhere).toHaveBeenCalledWith([
      { column: "id", value: COURSE_ID },
      { column: "author_id", value: USER_ID },
    ]);
  });

  it("clears the description when null is passed", async () => {
    dbMock.updateReturning.mockResolvedValue([{ id: COURSE_ID }]);

    await updateCourse({ id: COURSE_ID, description: null });

    expect(dbMock.updateSet).toHaveBeenCalledWith({
      description: null,
      updatedAt: expect.any(Date),
    });
  });

  it("surfaces a course the author does not own as not found", async () => {
    dbMock.updateReturning.mockResolvedValue([]);

    await expect(updateCourse({ id: COURSE_ID, title: "Hijacked" })).rejects.toThrow(
      "Course not found",
    );
  });

  it("deletes a course scoped to the author", async () => {
    dbMock.deleteReturning.mockResolvedValue([{ id: COURSE_ID }]);

    await expect(deleteCourse({ id: COURSE_ID })).resolves.toEqual({ id: COURSE_ID });

    expect(dbMock.remove).toHaveBeenCalledWith(courses);
    expect(dbMock.deleteWhere).toHaveBeenCalledWith([
      { column: "id", value: COURSE_ID },
      { column: "author_id", value: USER_ID },
    ]);
  });

  it("refuses to delete a course the author does not own", async () => {
    dbMock.deleteReturning.mockResolvedValue([]);

    await expect(deleteCourse({ id: COURSE_ID })).rejects.toThrow("Course not found");
  });

  it("publishes a course and stamps the publish time", async () => {
    dbMock.updateReturning.mockResolvedValue([{ id: COURSE_ID, status: "published" }]);

    const course = await publishCourse({ id: COURSE_ID });

    expect(course).toEqual({ id: COURSE_ID, status: "published" });
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      status: "published",
      publishedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(dbMock.updateWhere).toHaveBeenCalledWith([
      { column: "id", value: COURSE_ID },
      { column: "author_id", value: USER_ID },
    ]);
  });

  it("refuses to publish a course the author does not own", async () => {
    dbMock.updateReturning.mockResolvedValue([]);

    await expect(publishCourse({ id: COURSE_ID })).rejects.toThrow("Course not found");
  });
});
