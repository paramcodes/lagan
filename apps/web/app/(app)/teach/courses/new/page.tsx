"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCourse } from "../actions";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceCents, setPriceCents] = useState(2999);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const course = await createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        isFree,
        priceCents: isFree ? 0 : priceCents,
      });
      router.push(`/teach/courses/${course.id}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Create Course</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Start by giving your course a title and description. You can add modules and lessons next.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="course-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Course title
          </label>
          <input
            id="course-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Course title"
            placeholder="e.g., Modern Web Architecture"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="course-description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Course description
          </label>
          <textarea
            id="course-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Course description"
            placeholder="Overview of the course topics and goals..."
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="course-is-free"
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            aria-label="Free course"
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="course-is-free" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            This is a free course
          </label>
        </div>

        {!isFree && (
          <div>
            <label htmlFor="course-price" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Price (in cents)
            </label>
            <input
              id="course-price"
              type="number"
              min={0}
              value={priceCents}
              onChange={(e) => setPriceCents(Number(e.target.value))}
              aria-label="Price in cents"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create course"}
        </button>
      </form>
    </main>
  );
}
