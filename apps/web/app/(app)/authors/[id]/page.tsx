import { CourseCard } from "@lagan/ui";
import { ExternalLink, Globe } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAuthorProfile, getAuthorPublishedCourses, getAuthorStats } from "./query";

export const instant = false;

interface AuthorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { id } = await params;
  const author = await getAuthorProfile(id);

  if (!author) {
    return {
      title: "Author Not Found | Lagan",
      description: "The requested author profile could not be found.",
    };
  }

  const title = `${author.name} — Author Profile | Lagan`;
  const description = author.bio || `${author.name} is a course author and instructor on Lagan.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(author.avatarUrl ? { images: [{ url: author.avatarUrl }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(author.avatarUrl ? { images: [author.avatarUrl] } : {}),
    },
  };
}

export default async function AuthorProfilePage({ params }: AuthorPageProps) {
  await connection();
  const { id } = await params;
  const author = await getAuthorProfile(id);

  if (!author) {
    notFound();
  }

  const [stats, courses] = await Promise.all([
    getAuthorStats(author.id),
    getAuthorPublishedCourses(author.id),
  ]);

  const initials =
    author.name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A";

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Author Profile Header Card */}
      <section
        aria-label="Author Profile"
        className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          {/* Avatar / Fallback */}
          <div className="shrink-0">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.name}
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-full object-cover border border-[var(--color-line)] shadow-xs"
              />
            ) : (
              <div
                data-testid="author-avatar-fallback"
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] text-2xl font-bold text-[var(--color-ink)]"
              >
                {initials}
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
                {author.name}
              </h1>
              <span className="rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-canvas)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ink)]">
                {author.headline}
              </span>
            </div>

            {author.bio ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink2)] sm:text-base">
                {author.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-[var(--color-edge)]">No bio provided yet.</p>
            )}

            {/* Website & Social Links */}
            {(author.websiteUrl || author.socialLinks.length > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium">
                {author.websiteUrl ? (
                  <a
                    href={author.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent,#4F46E5)] hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                  >
                    <Globe className="h-3.5 w-3.5 text-[var(--color-edge)]" aria-hidden="true" />
                    <span>{author.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  </a>
                ) : null}

                {author.socialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent,#4F46E5)] hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                  >
                    <ExternalLink
                      className="h-3.5 w-3.5 text-[var(--color-edge)]"
                      aria-hidden="true"
                    />
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Author Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-6 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl tabular-nums">
              {stats.publishedCoursesCount}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--color-edge)]">
              Published {stats.publishedCoursesCount === 1 ? "course" : "courses"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl tabular-nums">
              {stats.enrolledLearnersCount}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--color-edge)]">
              Enrolled {stats.enrolledLearnersCount === 1 ? "learner" : "learners"}
            </span>
          </div>
        </div>
      </section>

      {/* Published Courses Section */}
      <section className="mt-8" aria-labelledby="author-courses-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="author-courses-heading" className="text-lg font-semibold text-[var(--color-ink)]">
            Courses by {author.name}
          </h2>
          <span className="text-xs text-[var(--color-edge)]">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center">
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">
              No published courses yet
            </h3>
            <p className="mt-1 text-xs text-[var(--color-edge)]">
              This author has not published any courses yet.
            </p>
          </div>
        ) : (
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
