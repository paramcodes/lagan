import {
  courses,
  lessons,
  modules,
  type CourseStatus,
  type LessonStatus,
  type LessonType,
} from "@lagan/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../../lib/db";

export interface BuilderLesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  position: number;
  status: LessonStatus;
  muxPlaybackId: string | null;
  externalUrl: string | null;
  fileKey: string | null;
  updatedAt: Date;
}

export interface BuilderModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
  lessons: BuilderLesson[];
}

export interface CourseBuilderData {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  status: CourseStatus;
  authorId: string;
  modules: BuilderModule[];
}

export async function loadCourseBuilderData(
  courseId: string,
  authorId: string,
): Promise<CourseBuilderData | null> {
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      priceCents: courses.priceCents,
      discountPercent: courses.discountPercent,
      isFree: courses.isFree,
      status: courses.status,
      authorId: courses.authorId,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.authorId, authorId)))
    .limit(1);

  if (!course) {
    return null;
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
    return {
      ...course,
      modules: [],
    };
  }

  const moduleIds = moduleRows.map((mod) => mod.id);
  const lessonRows = await db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      type: lessons.type,
      title: lessons.title,
      position: lessons.position,
      status: lessons.status,
      muxPlaybackId: lessons.muxPlaybackId,
      externalUrl: lessons.externalUrl,
      fileKey: lessons.fileKey,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(inArray(lessons.moduleId, moduleIds))
    .orderBy(asc(lessons.position));

  const lessonsByModule = new Map<string, BuilderLesson[]>();
  for (const mod of moduleRows) {
    lessonsByModule.set(mod.id, []);
  }

  for (const lesson of lessonRows) {
    lessonsByModule.get(lesson.moduleId)?.push(lesson);
  }

  return {
    ...course,
    modules: moduleRows.map((mod) => ({
      ...mod,
      lessons: lessonsByModule.get(mod.id) ?? [],
    })),
  };
}
