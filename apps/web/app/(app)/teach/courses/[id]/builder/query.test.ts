import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];

  const select = vi.fn(() => {
    const rows = selectQueue.shift() ?? [];
    const chain: Record<string, unknown> & Promise<unknown> = Promise.resolve(
      rows,
    ) as unknown as Record<string, unknown> & Promise<unknown>;
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve(rows));
    return chain;
  });

  return { select, selectQueue };
});

vi.mock("../../../../../../lib/db", () => ({
  db: { select: dbMock.select },
}));

import { loadCourseBuilderData } from "./query";

describe("loadCourseBuilderData", () => {
  beforeEach(() => {
    dbMock.selectQueue.length = 0;
    dbMock.select.mockClear();
  });

  it("returns null when course is not found or not owned by author", async () => {
    dbMock.selectQueue.push([]); // course query returns empty

    const result = await loadCourseBuilderData("c_nonexistent", "author_1");
    expect(result).toBeNull();
  });

  it("returns course with empty modules array when no modules exist", async () => {
    dbMock.selectQueue.push([
      {
        id: "c_1",
        title: "Test Course",
        description: "Course description",
        priceCents: 1000,
        discountPercent: 0,
        isFree: false,
        status: "draft",
        authorId: "author_1",
      },
    ]);
    dbMock.selectQueue.push([]); // modules query returns empty

    const result = await loadCourseBuilderData("c_1", "author_1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("c_1");
    expect(result?.title).toBe("Test Course");
    expect(result?.modules).toEqual([]);
  });

  it("returns course with ordered modules and nested ordered lessons", async () => {
    dbMock.selectQueue.push([
      {
        id: "c_1",
        title: "Test Course",
        description: null,
        priceCents: 0,
        discountPercent: 0,
        isFree: true,
        status: "draft",
        authorId: "author_1",
      },
    ]);
    dbMock.selectQueue.push([
      { id: "mod_1", courseId: "c_1", title: "Module 1", position: 0 },
      { id: "mod_2", courseId: "c_1", title: "Module 2", position: 1 },
    ]);
    dbMock.selectQueue.push([
      {
        id: "les_1",
        moduleId: "mod_1",
        type: "video",
        title: "Lesson 1.1",
        position: 0,
        status: "draft",
        muxPlaybackId: "mux_1",
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "les_2",
        moduleId: "mod_1",
        type: "text",
        title: "Lesson 1.2",
        position: 1,
        status: "published",
        muxPlaybackId: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-01-02"),
      },
      {
        id: "les_3",
        moduleId: "mod_2",
        type: "quiz",
        title: "Lesson 2.1",
        position: 0,
        status: "draft",
        muxPlaybackId: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date("2026-01-03"),
      },
    ]);

    const result = await loadCourseBuilderData("c_1", "author_1");
    expect(result).not.toBeNull();
    expect(result?.modules).toHaveLength(2);
    expect(result?.modules[0]?.id).toBe("mod_1");
    expect(result?.modules[0]?.lessons).toHaveLength(2);
    expect(result?.modules[0]?.lessons[0]?.title).toBe("Lesson 1.1");
    expect(result?.modules[0]?.lessons[1]?.title).toBe("Lesson 1.2");
    expect(result?.modules[1]?.id).toBe("mod_2");
    expect(result?.modules[1]?.lessons).toHaveLength(1);
    expect(result?.modules[1]?.lessons[0]?.title).toBe("Lesson 2.1");
  });
});
