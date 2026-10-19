"use server";

import { courses, enrollLearner } from "@lagan/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { RateLimitError, checkRateLimit } from "../../../../lib/rate-limit";

const enrollFreeCourseInputSchema = z.union([
  z.string().trim().min(1, "Course ID is required"),
  z.object({ courseId: z.string().trim().min(1, "Course ID is required") }).strict(),
]);
export async function enrollFreeCourse(
  courseInput: string | { courseId: string },
): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const parsedInput = enrollFreeCourseInputSchema.parse(courseInput);
  const courseId = typeof parsedInput === "string" ? parsedInput : parsedInput.courseId;

  const rl = checkRateLimit(`enroll:${userId}`, 10, 60);
  if (!rl.allowed) {
    throw new RateLimitError(rl.resetSeconds);
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
