import { EmptyState } from "@lagan/ui";
import { BookOpen } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../lib/auth";
import { LearnViewToggle } from "./learn-view-toggle";
import { LearnerCourseCard } from "./learner-course-card";
import { LearnerCourseRow } from "./learner-course-row";
import { parseLearnView, type RawSearchParams } from "./params";
import { listEnrolledCourses } from "./query";

export const instant = false;

export const metadata = { title: "My Learning" };

export default async function LearnDashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/sign-in?next=/learn");
    return;
  }

  const params = await searchParams;
  const view = parseLearnView(params?.view);
  const courses = await listEnrolledCourses(session.user.id);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--color-edge)]">Dashboard</p>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">My Learning</h1>
          <p className="mt-1 text-sm text-[var(--color-edge)]">
            {courses.length === 0
              ? "No enrolled courses"
              : `${courses.length} enrolled ${courses.length === 1 ? "course" : "courses"}`}
          </p>
        </div>
        {courses.length > 0 ? <LearnViewToggle value={view} /> : null}
      </header>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses yet"
          description="You haven't enrolled in any courses yet. Browse our course catalogue to discover topics and start learning."
          action={
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-xs font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
            >
              Browse Courses
            </Link>
          }
        />
      ) : view === "ledger" ? (
        <ul className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] list-none p-0">
          {courses.map((course) => (
            <LearnerCourseRow key={course.id} course={course} />
          ))}
        </ul>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <LearnerCourseCard course={course} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
