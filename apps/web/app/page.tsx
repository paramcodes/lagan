import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Code2,
  PlayCircle,
  Terminal,
} from "lucide-react";
import { CodeSandboxPreview, LandingFooter } from "./landing-components";
import {
  CURRICULUM_TRACKS,
  FEATURE_PILLARS,
  PEDAGOGY_ITEMS,
  TOPIC_BADGES,
} from "./landing-constants";

const PILLAR_ICONS = {
  "Interactive Editor": Code2,
  "Video Player": PlayCircle,
  "In-depth Curriculum": BookOpen,
  "Author Analytics": BarChart3,
} as const;

export const metadata: Metadata = {
  title: "Lagan | Master Systems with Depth",
  description:
    "Expert-led courses in database internals, distributed architectures, and systems programming.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-chalk)] selection:text-[var(--color-ink)]">
      {/* Header Landmark */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[var(--radius-chip)]"
              aria-label="Lagan home"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand)] text-[var(--color-surface)]">
                <Terminal className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
                Lagan
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
              <a
                href="#pillars-heading"
                className="text-sm font-medium text-[var(--color-ink2)] transition-colors hover:text-[var(--color-ink)]"
              >
                Architecture
              </a>
              <a
                href="#curriculum-heading"
                className="text-sm font-medium text-[var(--color-ink2)] transition-colors hover:text-[var(--color-ink)]"
              >
                Curriculum
              </a>
              <Link
                href="/courses"
                className="text-sm font-medium text-[var(--color-ink2)] transition-colors hover:text-[var(--color-ink)]"
              >
                Courses
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Sign In
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Explore Courses
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Landmark */}
      <main className="flex-1">
        {/* Hero Section */}
        <section
          aria-labelledby="hero-title"
          className="relative overflow-hidden border-b border-[var(--color-line)] py-20 sm:py-28 lg:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-ink2)] shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                Specialized Systems Engineering Education
              </div>

              <h1
                id="hero-title"
                className="text-4xl font-bold tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl"
              >
                Master Systems with Depth
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-[var(--color-ink2)] sm:text-xl">
                Expert-led courses in database internals, distributed architectures, and systems
                programming.
              </p>

              {/* Action CTAs */}
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/courses"
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-6 text-base font-medium text-[var(--color-surface)] shadow-xs transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  Explore Courses
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/sign-in"
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-6 text-base font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  Sign In
                </Link>
              </div>

              {/* Topic Badges */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-2 pt-6 border-t border-[var(--color-line)]">
                {TOPIC_BADGES.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Code / Architecture Interactive Preview */}
            <CodeSandboxPreview />
          </div>
        </section>

        {/* Feature Pillars Section */}
        <section
          id="pillars-heading"
          aria-labelledby="pillars-title"
          className="scroll-mt-16 border-b border-[var(--color-line)] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                Core Platform Architecture
              </span>
              <h2
                id="pillars-title"
                className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl"
              >
                Built for Rigorous Engineering
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--color-ink2)] sm:text-lg">
                Four unified pillars designed to transform complex systems concepts into production
                intuitions.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURE_PILLARS.map((pillar) => {
                const IconComponent = PILLAR_ICONS[pillar.title];
                return (
                  <div
                    key={pillar.title}
                    className="flex flex-col justify-between rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs transition-colors hover:border-[var(--color-edge)]"
                  >
                    <div>
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-ink)]">
                        <IconComponent className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink2)]">
                        {pillar.badge}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
                        {pillar.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink2)]">
                        {pillar.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[var(--color-line)]">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink)]">
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                        Verified implementation
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Learning Experience Details Section */}
        <section
          id="curriculum-heading"
          aria-labelledby="curriculum-title"
          className="scroll-mt-16 border-b border-[var(--color-line)] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                  Pedagogy & Rigor
                </span>
                <h2
                  id="curriculum-title"
                  className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl"
                >
                  No Toy Implementations. Real Systems Code.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[var(--color-ink2)]">
                  Traditional courses explain algorithms on whiteboards. Lagan teaches you to build
                  real runtimes from source, debug cache-invalidation races under thread sanitizers,
                  and benchmark p99 tail latencies.
                </p>

                <ul className="mt-8 space-y-4">
                  {PEDAGOGY_ITEMS.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[var(--color-surface)]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      </div>
                      <span className="text-sm text-[var(--color-ink)]">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex items-center gap-4">
                  <Link
                    href="/courses"
                    className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    Browse Curriculum
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-ink)]">
                      Course Architecture Map
                    </h3>
                    <p className="text-xs text-[var(--color-ink2)]">
                      Self-contained modules with interactive progression
                    </p>
                  </div>
                  <span className="rounded-[var(--radius-chip)] bg-[var(--color-canvas)] px-2.5 py-1 text-xs font-mono text-[var(--color-ink)]">
                    4 Tracks
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {CURRICULUM_TRACKS.map((track) => (
                    <div
                      key={track.title}
                      className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-canvas)]/50 p-3.5 transition-colors hover:border-[var(--color-edge)]"
                    >
                      <div className="min-w-0 pr-4">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                          {track.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink2)]">
                          {track.tag} • {track.lessons}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink)]">
                        {track.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner Section */}
        <section aria-labelledby="cta-heading" className="relative py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8 sm:p-12 text-center shadow-xs">
              <h2
                id="cta-heading"
                className="text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl"
              >
                Ready to Master Systems with Depth?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--color-ink2)] sm:text-lg">
                Join engineering teams building resilient databases, distributed caches, and cloud
                infrastructure.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/courses"
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-brand)] px-6 text-sm font-medium text-[var(--color-surface)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  Explore Courses
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-edge)] bg-[var(--color-surface)] px-6 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Landmark */}
      <LandingFooter />
    </div>
  );
}
