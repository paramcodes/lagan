import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { CourseOutlineBuilder } from "./course-outline-builder";
import { loadCourseBuilderData } from "./query";

export const instant = false;

export const metadata = { title: "Course Builder" };

export default async function CourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/teach/courses/${id}/builder`);
    return;
  }

  const course = await loadCourseBuilderData(id, session.user.id);
  if (!course) {
    notFound();
    return;
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <CourseOutlineBuilder initialCourse={course} />
    </main>
  );
}
