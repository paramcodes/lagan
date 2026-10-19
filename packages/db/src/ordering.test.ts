import { describe, expect, it, vi } from "vitest";
import { applyLessonOrder, applyModuleOrder } from "./ordering";
import { lessons, modules } from "./schema/course";

describe("applyModuleOrder", () => {
  it("parks modules at negative positions in phase 1, then sets 0-based positions in phase 2", async () => {
    const updates: Array<{ table: unknown; set: unknown; where: unknown }> = [];
    const executor = {
      update: vi.fn((table: unknown) => ({
        set: vi.fn((setValues: unknown) => ({
          where: vi.fn((whereCondition: unknown) => {
            updates.push({ table, set: setValues, where: whereCondition });
            return Promise.resolve();
          }),
        })),
      })),
    };

    await applyModuleOrder(executor as never, ["mod-a", "mod-b", "mod-c"]);

    expect(executor.update).toHaveBeenCalledTimes(6);
    expect(updates.map((u) => u.table)).toEqual([
      modules,
      modules,
      modules,
      modules,
      modules,
      modules,
    ]);
    expect(updates.slice(0, 3).map((u) => u.set)).toEqual([
      { position: -1 },
      { position: -2 },
      { position: -3 },
    ]);
    expect(updates.slice(3).map((u) => u.set)).toEqual([
      { position: 0 },
      { position: 1 },
      { position: 2 },
    ]);
  });

  it("handles empty list without updates", async () => {
    const executor = { update: vi.fn() };
    await applyModuleOrder(executor as never, []);
    expect(executor.update).not.toHaveBeenCalled();
  });
});

describe("applyLessonOrder", () => {
  it("parks lessons at negative positions in phase 1, then sets 0-based positions in phase 2 across modules", async () => {
    const updates: Array<{ table: unknown; set: unknown; where: unknown }> = [];
    const executor = {
      update: vi.fn((table: unknown) => ({
        set: vi.fn((setValues: unknown) => ({
          where: vi.fn((whereCondition: unknown) => {
            updates.push({ table, set: setValues, where: whereCondition });
            return Promise.resolve();
          }),
        })),
      })),
    };

    await applyLessonOrder(executor as never, [
      { moduleId: "mod-1", lessonIds: ["les-1", "les-2"] },
      { moduleId: "mod-2", lessonIds: ["les-3"] },
    ]);

    expect(executor.update).toHaveBeenCalledTimes(6);
    expect(updates.map((u) => u.table)).toEqual([
      lessons,
      lessons,
      lessons,
      lessons,
      lessons,
      lessons,
    ]);
    expect(updates.slice(0, 3).map((u) => u.set)).toEqual([
      { moduleId: "mod-1", position: -1 },
      { moduleId: "mod-1", position: -2 },
      { moduleId: "mod-2", position: -1 },
    ]);
    expect(updates.slice(3).map((u) => u.set)).toEqual([
      { moduleId: "mod-1", position: 0 },
      { moduleId: "mod-1", position: 1 },
      { moduleId: "mod-2", position: 0 },
    ]);
  });

  it("handles empty orders without updates", async () => {
    const executor = { update: vi.fn() };
    await applyLessonOrder(executor as never, []);
    expect(executor.update).not.toHaveBeenCalled();
  });
});
