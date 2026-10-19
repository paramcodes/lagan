import { Badge, formatPrice } from "@lagan/ui";
import { BookOpen, CheckCircle2, ChevronRight, Globe, Layers, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../../lib/auth";
import { CourseActionButtons } from "./course-action-buttons";
import { checkCourseAccess, getCourseDetail, getResumeLessonForCourse } from "./query";
import { SyllabusPreview } from "./syllabus-preview";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourseDetail(id);
  if (!course) {
    return { title: "Course not found | Lagan" };
  }

  return {
    title: `${course.title} | Lagan`,
    description: course.description ?? `Learn ${course.title} with expert instruction on Lagan.`,
    openGraph: {
      title: course.title,
      description: course.description ?? `Learn ${course.title} with expert instruction on Lagan.`,
      type: "website",
    },
  };
}

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;

  const course = await getCourseDetail(id);
  if (!course) {
    notFound();
    return null;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(userId);
  const isEnrolled = userId ? await checkCourseAccess(userId, course.id, course.tenantId) : false;

  // Determine resume deep link for enrolled users or default first lesson
  let resumeHref = `/courses/${course.id}`;
  if (isEnrolled && userId) {
    const resumeInfo = await getResumeLessonForCourse(course.id, userId);
    resumeHref = resumeInfo.resumeHref;
  } else if (course.modules[0]?.lessons[0]?.id) {
    resumeHref = `/courses/${course.id}/lessons/${course.modules[0].lessons[0].id}`;
  }

  const price = formatPrice({
    priceCents: course.priceCents,
    discountPercent: course.discountPercent,
    isFree: course.isFree,
  });

  return (
    <main className="mx-auto max-w-6xl p-6 lg:p-8">
      {/* Checkout return banners */}
      {sp.checkout === "success" ? (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-semibold">Payment successful!</p>
            <p className="text-xs opacity-90">
              You now have full access to this course. Start learning below.
            </p>
          </div>
        </div>
      ) : null}

      {sp.checkout === "cancelled" ? (
        <div
          role="status"
          className="mb-6 rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200"
        >
          Checkout was cancelled. You have not been charged.
        </div>
      ) : null}

      {/* Breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-xs text-[var(--color-edge)]">
          <li>
            <Link href="/courses" className="transition-colors hover:text-[var(--color-ink)]">
              Courses
            </Link>
          </li>
          <li>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </li>
          <li className="truncate font-medium text-[var(--color-ink)]">{course.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left column: Overview, Instructor & Syllabus */}
        <section className="space-y-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="brand" size="sm">
                Course
              </Badge>
              {course.isFree ? (
                <Badge variant="neutral" size="sm">
                  Free
                </Badge>
              ) : null}
              {course.discountPercent > 0 ? (
                <Badge variant="alert" size="sm">
                  {course.discountPercent}% OFF
                </Badge>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl lg:text-4xl">
              {course.title}
            </h1>

            {course.description ? (
              <p className="mt-3 text-base leading-relaxed text-[var(--color-edge)]">
                {course.description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--color-edge)]">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {course.modules.length} {course.modules.length === 1 ? "module" : "modules"}
              </span>
              <span>•</span>
              <span>{course.totalLessons} lessons</span>
              <span>•</span>
              <span>{course.totalDuration} total</span>
            </div>
          </div>

          {/* Course cover graphic */}
          <div
            data-testid="course-cover"
            className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-canvas)]"
          >
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] shadow-xs">
                <BookOpen className="h-8 w-8 text-[var(--color-ink)]" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-edge)]">
                Curriculum Overview
              </span>
            </div>
          </div>

          {/* Instructor Bio & Profile */}
          <div
            data-testid="instructor-card"
            className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-start gap-4">
              {course.instructor.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: dynamic user avatar URL from profile
                <img
                  src={course.instructor.avatarUrl}
                  alt={course.instructor.name}
                  className="h-14 w-14 shrink-0 rounded-full border border-[var(--color-line)] object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] text-base font-semibold text-[var(--color-ink)]"
                >
                  {course.instructor.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-edge)]">
                  Instructor
                </div>
                <h3 className="truncate text-base font-semibold text-[var(--color-ink)]">
                  {course.instructor.name}
                </h3>
                {course.instructor.bio ? (
                  <p className="mt-1 text-sm text-[var(--color-edge)]">{course.instructor.bio}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-[var(--color-edge)]">
                    Instructor at Lagan
                  </p>
                )}

                {course.instructor.websiteUrl ? (
                  <a
                    href={course.instructor.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-edge)] hover:text-[var(--color-ink)]"
                  >
                    <Globe className="h-3 w-3" />
                    Website
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* Syllabus Outline */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-ink)]">Curriculum Syllabus</h2>
              <p className="text-xs text-[var(--color-edge)]">
                Explore the lesson schedule, key topics, and previewable material.
              </p>
            </div>

            <SyllabusPreview
              courseId={course.id}
              modules={course.modules}
              isEnrolled={isEnrolled}
            />
          </div>
        </section>

        {/* Right column: Sticky Checkout & Action Panel */}
        <aside className="h-fit space-y-6 lg:sticky lg:top-8">
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs">
            {/* Price formatting */}
            <div className="mb-6 border-b border-[var(--color-line)] pb-5">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-edge)]">
                Price
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="course-price"
                  className="text-3xl font-extrabold tracking-tight text-[var(--color-ink)]"
                >
                  {price.amount}
                </span>
                {price.originalAmount ? (
                  <span className="text-base text-[var(--color-edge)] line-through">
                    {price.originalAmount}
                  </span>
                ) : null}
              </div>
              {price.originalAmount ? (
                <p className="mt-1 text-xs font-medium text-[var(--color-alert)]">
                  Save {course.discountPercent}% off the standard price
                </p>
              ) : null}
            </div>

            {/* Primary Action Button */}
            <CourseActionButtons
              courseId={course.id}
              isEnrolled={isEnrolled}
              resumeHref={resumeHref}
              isFree={course.isFree}
              priceCents={course.priceCents}
              isAuthenticated={isAuthenticated}
            />

            {/* Course benefits checklist */}
            <div className="mt-6 space-y-2.5 border-t border-[var(--color-line)] pt-5 text-xs text-[var(--color-edge)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-ink)]" />
                <span>Full lifetime access</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-[var(--color-ink)]" />
                <span>{course.totalLessons} self-paced lessons</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-ink)]" />
                <span>Access on desktop, tablet, and mobile</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
