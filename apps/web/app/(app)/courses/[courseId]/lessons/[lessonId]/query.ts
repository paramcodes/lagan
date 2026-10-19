import type { LessonType } from "@lagan/db";
import { courses, hasAccess, lessonProgress, lessons, modules } from "@lagan/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../../lib/db";

export interface NavigationLesson {
  id: string;
  moduleId: string;
  title: string;
  type: LessonType;
  position: number;
  completed: boolean;
  href: string;
}

export interface NavigationModule {
  id: string;
  title: string;
  position: number;
  lessons: NavigationLesson[];
}

export interface CurrentLesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  position: number;
  muxPlaybackId: string | null;
  contentJson: unknown | null;
  externalUrl: string | null;
  fileKey: string | null;
}

export interface CurrentProgress {
  completed: boolean;
  positionSeconds: number;
}

export interface LessonPlayerData {
  status: "success";
  course: {
    id: string;
    title: string;
    isAuthor: boolean;
  };
  lesson: CurrentLesson;
  modules: NavigationModule[];
  currentProgress: CurrentProgress;
  prevLesson: NavigationLesson | null;
  nextLesson: NavigationLesson | null;
  totalLessons: number;
  completedLessonsCount: number;
}

export type LessonPlayerResult =
  | LessonPlayerData
  | { status: "not_found" }
  | { status: "unauthorized" };

export async function getLessonPlayerData(
  courseId: string,
  lessonId: string,
  userId: string,
): Promise<LessonPlayerResult> {
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      tenantId: courses.tenantId,
      authorId: courses.authorId,
      isFree: courses.isFree,
      priceCents: courses.priceCents,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return { status: "not_found" };
  }

  const isAuthor = course.authorId === userId;
  const authorized =
    isAuthor ||
    (await hasAccess({
      db,
      userId,
      courseId,
      tenantId: course.tenantId,
      allowFree: true,
    }));

  if (!authorized) {
    return { status: "unauthorized" };
  }

  const moduleRows = await db
    .select({
      id: modules.id,
      courseId: modules.courseId,
      title: modules.title,
      position: modules.position,
    })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position));

  if (moduleRows.length === 0) {
    return { status: "not_found" };
  }

  const moduleIds = moduleRows.map((m) => m.id);
  const lessonCondition = isAuthor
    ? inArray(lessons.moduleId, moduleIds)
    : and(inArray(lessons.moduleId, moduleIds), eq(lessons.status, "published"));

  const lessonRows = await db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      type: lessons.type,
      title: lessons.title,
      position: lessons.position,
      status: lessons.status,
      muxPlaybackId: lessons.muxPlaybackId,
      contentJson: lessons.contentJson,
      externalUrl: lessons.externalUrl,
      fileKey: lessons.fileKey,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(lessonCondition)
    .orderBy(asc(lessons.position));

  const currentLesson = lessonRows.find((l) => l.id === lessonId);
  if (!currentLesson) {
    return { status: "not_found" };
  }

  const progressRows = await db
    .select({
      lessonId: lessonProgress.lessonId,
      completed: lessonProgress.completed,
      positionSeconds: lessonProgress.positionSeconds,
    })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.courseId, courseId)));

  const progressMap = new Map(
    progressRows.map((p) => [
      p.lessonId,
      { completed: p.completed, positionSeconds: p.positionSeconds },
    ]),
  );

  const modulesWithLessons: NavigationModule[] = moduleRows.map((mod) => {
    const modLessons = lessonRows
      .filter((l) => l.moduleId === mod.id)
      .sort((a, b) => a.position - b.position)
      .map((l) => {
        const prog = progressMap.get(l.id);
        return {
          id: l.id,
          moduleId: l.moduleId,
          title: l.title,
          type: l.type,
          position: l.position,
          completed: prog?.completed ?? false,
          href: `/courses/${courseId}/lessons/${l.id}`,
        };
      });

    return {
      id: mod.id,
      title: mod.title,
      position: mod.position,
      lessons: modLessons,
    };
  });

  const allSequentialLessons = modulesWithLessons.flatMap((m) => m.lessons);
  const currentIndex = allSequentialLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? (allSequentialLessons[currentIndex - 1] ?? null) : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allSequentialLessons.length - 1
      ? (allSequentialLessons[currentIndex + 1] ?? null)
      : null;

  const currentProgress = progressMap.get(lessonId) ?? {
    completed: false,
    positionSeconds: 0,
  };

  return {
    status: "success",
    course: {
      id: course.id,
      title: course.title,
      isAuthor,
    },
    lesson: currentLesson,
    modules: modulesWithLessons,
    currentProgress,
    prevLesson,
    nextLesson,
    totalLessons: allSequentialLessons.length,
    completedLessonsCount: allSequentialLessons.filter((l) => l.completed).length,
  };
}
