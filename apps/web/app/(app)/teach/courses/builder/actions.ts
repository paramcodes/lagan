"use server";

import {
  applyLessonOrder,
  applyModuleOrder,
  courses,
  lessons,
  modules,
  type LessonContent,
  type LessonOrder,
  type NewLesson,
  type NewModule,
} from "@lagan/db";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../../../../../lib/auth";
import { db } from "../../../../../lib/db";
import {
  createLessonSchema,
  createModuleSchema,
  deleteLessonSchema,
  deleteModuleSchema,
  moveLessonToModuleSchema,
  reorderLessonsSchema,
  reorderModulesSchema,
  updateLessonSchema,
  updateModuleSchema,
  type CreateLessonInput,
  type CreateModuleInput,
  type MoveLessonToModuleInput,
  type ReorderLessonsInput,
  type ReorderModulesInput,
  type UpdateLessonInput,
  type UpdateModuleInput,
} from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

async function assertCourseOwned(courseId: string, authorId: string): Promise<void> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
    .limit(1);
  if (!course) {
    throw new Error("Course not found");
  }
}

async function assertModuleOwned(moduleId: string, authorId: string): Promise<void> {
  const [owned] = await db
    .select({ id: modules.id })
    .from(modules)
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(eq(modules.id, moduleId), eq(courses.authorId, authorId)))
    .limit(1);
  if (!owned) {
    throw new Error("Module not found");
  }
}

async function assertLessonOwned(lessonId: string, authorId: string): Promise<void> {
  const [owned] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), eq(courses.authorId, authorId)))
    .limit(1);
  if (!owned) {
    throw new Error("Lesson not found");
  }
}

function assertSameIds(current: string[], expected: string[], label: string): void {
  if (current.length !== expected.length || !expected.every((id) => current.includes(id))) {
    throw new Error(`Reorder list does not match the course ${label}`);
  }
}

async function nextModulePosition(tx: Tx, courseId: string): Promise<number> {
  const [last] = await tx
    .select({ position: modules.position })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(desc(modules.position))
    .limit(1);
  return (last?.position ?? -1) + 1;
}

async function nextLessonPosition(tx: Tx, moduleId: string): Promise<number> {
  const [last] = await tx
    .select({ position: lessons.position })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(desc(lessons.position))
    .limit(1);
  return (last?.position ?? -1) + 1;
}

async function orderedLessonIds(tx: Tx, moduleId: string, excludeId?: string): Promise<string[]> {
  const rows = await tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(lessons.position);
  return rows.map((row) => row.id).filter((id) => id !== excludeId);
}

export async function createModule(input: CreateModuleInput) {
  const authorId = await requireUserId();
  const data = createModuleSchema.parse(input);
  await assertCourseOwned(data.courseId, authorId);

  const [created] = await db.transaction(async (tx) => {
    const values: NewModule = {
      id: crypto.randomUUID(),
      courseId: data.courseId,
      title: data.title,
      position: await nextModulePosition(tx, data.courseId),
    };
    return tx.insert(modules).values(values).returning();
  });

  if (!created) {
    throw new Error("Failed to create module");
  }
  return created;
}

export async function updateModule(input: UpdateModuleInput) {
  const authorId = await requireUserId();
  const { id, ...fields } = updateModuleSchema.parse(input);
  await assertModuleOwned(id, authorId);

  const values: Partial<NewModule> = {};
  if (fields.title !== undefined) values.title = fields.title;

  const [updated] = await db.update(modules).set(values).where(eq(modules.id, id)).returning();

  if (!updated) {
    throw new Error("Module not found");
  }
  return updated;
}

export async function deleteModule(input: { id: string }) {
  const authorId = await requireUserId();
  const { id } = deleteModuleSchema.parse(input);
  await assertModuleOwned(id, authorId);

  const deleted = await db.delete(modules).where(eq(modules.id, id)).returning({ id: modules.id });

  if (deleted.length === 0) {
    throw new Error("Module not found");
  }
  return { id };
}

export async function reorderModules(input: ReorderModulesInput) {
  const authorId = await requireUserId();
  const { courseId, orderedIds } = reorderModulesSchema.parse(input);
  await assertCourseOwned(courseId, authorId);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.courseId, courseId));
    assertSameIds(
      rows.map((row) => row.id),
      orderedIds,
      "modules",
    );
    await applyModuleOrder(tx, orderedIds);
  });

  return { courseId, orderedIds };
}

export async function createLesson(input: CreateLessonInput) {
  const authorId = await requireUserId();
  const data = createLessonSchema.parse(input);
  await assertModuleOwned(data.moduleId, authorId);

  const [created] = await db.transaction(async (tx) => {
    const values: NewLesson = {
      id: crypto.randomUUID(),
      moduleId: data.moduleId,
      type: data.type,
      title: data.title,
      position: await nextLessonPosition(tx, data.moduleId),
      contentJson: (data.contentJson as LessonContent | null | undefined) ?? null,
      muxPlaybackId: data.muxPlaybackId ?? null,
      externalUrl: data.externalUrl ?? null,
      fileKey: data.fileKey ?? null,
    };
    return tx.insert(lessons).values(values).returning();
  });

  if (!created) {
    throw new Error("Failed to create lesson");
  }
  return created;
}

export async function updateLesson(input: UpdateLessonInput) {
  const authorId = await requireUserId();
  const { id, ...fields } = updateLessonSchema.parse(input);
  await assertLessonOwned(id, authorId);

  const values: Partial<NewLesson> = { updatedAt: new Date() };
  if (fields.type !== undefined) values.type = fields.type;
  if (fields.title !== undefined) values.title = fields.title;
  if (fields.status !== undefined) values.status = fields.status;
  if (fields.contentJson !== undefined) {
    values.contentJson = fields.contentJson as LessonContent | null;
  }
  if (fields.muxPlaybackId !== undefined) values.muxPlaybackId = fields.muxPlaybackId ?? null;
  if (fields.externalUrl !== undefined) values.externalUrl = fields.externalUrl ?? null;
  if (fields.fileKey !== undefined) values.fileKey = fields.fileKey ?? null;

  const [updated] = await db.update(lessons).set(values).where(eq(lessons.id, id)).returning();

  if (!updated) {
    throw new Error("Lesson not found");
  }
  return updated;
}

export async function deleteLesson(input: { id: string }) {
  const authorId = await requireUserId();
  const { id } = deleteLessonSchema.parse(input);
  await assertLessonOwned(id, authorId);

  const deleted = await db.delete(lessons).where(eq(lessons.id, id)).returning({ id: lessons.id });

  if (deleted.length === 0) {
    throw new Error("Lesson not found");
  }
  return { id };
}

export async function reorderLessons(input: ReorderLessonsInput) {
  const authorId = await requireUserId();
  const { moduleId, orderedIds } = reorderLessonsSchema.parse(input);
  await assertModuleOwned(moduleId, authorId);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId));
    assertSameIds(
      rows.map((row) => row.id),
      orderedIds,
      "lessons",
    );
    await applyLessonOrder(tx, [{ moduleId, lessonIds: orderedIds }]);
  });

  return { moduleId, orderedIds };
}

export async function moveLessonToModule(input: MoveLessonToModuleInput) {
  const authorId = await requireUserId();
  const { lessonId, toModuleId, toIndex } = moveLessonToModuleSchema.parse(input);
  await assertLessonOwned(lessonId, authorId);
  await assertModuleOwned(toModuleId, authorId);

  return db.transaction(async (tx) => {
    const [lesson] = await tx
      .select({ moduleId: lessons.moduleId })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);
    if (!lesson) {
      throw new Error("Lesson not found");
    }
    const fromModuleId = lesson.moduleId;

    const [fromModule] = await tx
      .select({ courseId: modules.courseId })
      .from(modules)
      .where(eq(modules.id, fromModuleId))
      .limit(1);
    const [toModule] = await tx
      .select({ courseId: modules.courseId })
      .from(modules)
      .where(eq(modules.id, toModuleId))
      .limit(1);
    if (!fromModule || !toModule) {
      throw new Error("Module not found");
    }
    if (fromModule.courseId !== toModule.courseId) {
      throw new Error("Cannot move a lesson between courses");
    }

    if (fromModuleId === toModuleId) {
      const ids = await orderedLessonIds(tx, toModuleId, lessonId);
      const index = Math.min(toIndex ?? ids.length, ids.length);
      ids.splice(index, 0, lessonId);
      await applyLessonOrder(tx, [{ moduleId: toModuleId, lessonIds: ids }]);
      return { lessonId, moduleId: toModuleId, position: index };
    }

    const fromIds = await orderedLessonIds(tx, fromModuleId, lessonId);
    const toIds = await orderedLessonIds(tx, toModuleId);
    const index = Math.min(toIndex ?? toIds.length, toIds.length);
    toIds.splice(index, 0, lessonId);
    const orders: LessonOrder[] = [
      { moduleId: fromModuleId, lessonIds: fromIds },
      { moduleId: toModuleId, lessonIds: toIds },
    ];
    await applyLessonOrder(tx, orders);
    return { lessonId, moduleId: toModuleId, position: index };
  });
}
