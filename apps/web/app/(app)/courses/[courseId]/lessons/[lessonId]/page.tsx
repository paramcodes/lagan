import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { LessonPlayerView } from "./lesson-player-view";
import { getLessonPlayerData } from "./query";

export const instant = false;

interface PageProps {
  params: Promise<{
    courseId: string;
    lessonId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  return {
    title: `Lesson ${lessonId} | Course ${courseId}`,
  };
}

export default async function LessonPage({ params }: PageProps) {
  await connection();
  const { courseId, lessonId } = await params;
  const reqHeaders = await headers();
  let session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user?.id && process.env.NODE_ENV !== "production") {
    const devUserId = reqHeaders.get("x-dev-user-id");
    if (devUserId) {
      session = {
        user: { id: devUserId, email: "dev@lagan.internal" },
        session: {
          id: "dev_session",
          userId: devUserId,
          expiresAt: new Date(Date.now() + 86400000),
        },
      } as unknown as typeof session;
    }
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/courses/${courseId}/lessons/${lessonId}`);
    return;
  }

  const result = await getLessonPlayerData(courseId, lessonId, session.user.id);

  if (result.status === "not_found") {
    notFound();
    return;
  }

  if (result.status === "unauthorized") {
    redirect(`/courses/${courseId}`);
    return;
  }

  return (
    <main className="w-full max-w-7xl mx-auto p-4 lg:p-6">
      <LessonPlayerView data={result} />
    </main>
  );
}
