"use server";

import { courses, enrollLearner } from "@lagan/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

export async function enrollFreeCourse(courseId: string): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const [course] = await db
    .select({
      id: courses.id,
      tenantId: courses.tenantId,
      status: courses.status,
      priceCents: courses.priceCents,
      isFree: courses.isFree,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.status, "published")))
    .limit(1);

  if (!course) {
    throw new Error("Course not found or unavailable");
  }

  if (!course.isFree && course.priceCents > 0) {
    throw new Error("Cannot enroll for free: course requires payment");
  }

  await enrollLearner({
    db,
    userId,
    courseId: course.id,
    tenantId: course.tenantId,
  });

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/learn");

  return { success: true };
}
