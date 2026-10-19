import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { lessons, modules } from "./schema/course";

/**
 * Writes `position` values for sibling rows without transiently violating the
 * non-deferrable `unique (course_id, position)` / `unique (module_id, position)`
 * indexes: every affected row is parked on a distinct negative position first,
 * then each row receives its final 0-based position.
 */

type OrderExecutor = Pick<NodePgDatabase, "update">;

export interface LessonOrder {
  moduleId: string;
  lessonIds: string[];
}

export async function applyModuleOrder(
  executor: OrderExecutor,
  orderedIds: string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await executor
      .update(modules)
      .set({ position: -(index + 1) })
      .where(eq(modules.id, id));
  }
  for (const [index, id] of orderedIds.entries()) {
    await executor.update(modules).set({ position: index }).where(eq(modules.id, id));
  }
}

export async function applyLessonOrder(
  executor: OrderExecutor,
  orders: LessonOrder[],
): Promise<void> {
  for (const { moduleId, lessonIds } of orders) {
    for (const [index, id] of lessonIds.entries()) {
      await executor
        .update(lessons)
        .set({ moduleId, position: -(index + 1) })
        .where(eq(lessons.id, id));
    }
  }
  for (const { moduleId, lessonIds } of orders) {
    for (const [index, id] of lessonIds.entries()) {
      await executor.update(lessons).set({ moduleId, position: index }).where(eq(lessons.id, id));
    }
  }
}
