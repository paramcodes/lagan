import { courses } from "@lagan/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { createStripeCheckoutSession } from "../../../../lib/stripe";

const checkoutRequestSchema = z.object({
  courseId: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, parsed.data.courseId))
    .limit(1);

  if (!course) {
    return Response.json({ error: "course not found" }, { status: 404 });
  }
  if (course.isFree || course.priceCents <= 0) {
    return Response.json({ error: "course is free" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const checkout = await createStripeCheckoutSession({
    userId,
    courseId: course.id,
    courseTitle: course.title,
    priceCents: course.priceCents,
    currency: "usd",
    successUrl: `${baseUrl}/courses/${course.id}?checkout=success`,
    cancelUrl: `${baseUrl}/courses/${course.id}?checkout=cancelled`,
  });

  return Response.json({ url: checkout.url });
}
