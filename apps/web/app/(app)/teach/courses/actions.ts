"use server";

import { courses, type NewCourse } from "@lagan/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { RateLimitError, checkRateLimit } from "../../../../lib/rate-limit";
import {
  createCourseSchema,
  deleteCourseSchema,
  publishCourseSchema,
  updateCourseSchema,
  type CreateCourseInput,
  type DeleteCourseInput,
  type PublishCourseInput,
  type UpdateCourseInput,
} from "./schema";

const DEFAULT_TENANT_ID = "default";

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function createCourse(input: CreateCourseInput) {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`course-create:${authorId}`, 20, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const data = createCourseSchema.parse(input);
  const [course] = await db
    .insert(courses)
    .values({
      id: crypto.randomUUID(),
      tenantId: DEFAULT_TENANT_ID,
      authorId,
      title: data.title,
      description: data.description ?? null,
      priceCents: data.priceCents,
      discountPercent: data.discountPercent,
      isFree: data.isFree,
      status: "draft",
    })
    .returning();

  if (!course) {
    throw new Error("Failed to create course");
  }
  return course;
}

export async function updateCourse(input: UpdateCourseInput) {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`course-update:${authorId}`, 60, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const { id, ...fields } = updateCourseSchema.parse(input);
  const values: Partial<NewCourse> = { updatedAt: new Date() };
  if (fields.title !== undefined) values.title = fields.title;
  if (fields.description !== undefined) values.description = fields.description;
  if (fields.priceCents !== undefined) values.priceCents = fields.priceCents;
  if (fields.discountPercent !== undefined) values.discountPercent = fields.discountPercent;
  if (fields.isFree !== undefined) values.isFree = fields.isFree;

  const [course] = await db
    .update(courses)
    .set(values)
    .where(and(eq(courses.id, id), eq(courses.authorId, authorId)))
    .returning();

  if (!course) {
    throw new Error("Course not found");
  }
  return course;
}

export async function deleteCourse(input: DeleteCourseInput) {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`course-delete:${authorId}`, 20, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const { id } = deleteCourseSchema.parse(input);
  const deleted = await db
    .delete(courses)
    .where(and(eq(courses.id, id), eq(courses.authorId, authorId)))
    .returning({ id: courses.id });

  if (deleted.length === 0) {
    throw new Error("Course not found");
  }
  return { id };
}

export async function publishCourse(input: PublishCourseInput) {
  const authorId = await requireUserId();
  const rl = checkRateLimit(`course-publish:${authorId}`, 20, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
  }
  const { id } = publishCourseSchema.parse(input);
  const now = new Date();
  const [course] = await db
    .update(courses)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(and(eq(courses.id, id), eq(courses.authorId, authorId)))
    .returning();

  if (!course) {
    throw new Error("Course not found");
  }
  return course;
}
