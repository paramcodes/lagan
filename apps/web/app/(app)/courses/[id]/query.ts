import {
  courses,
  type CourseStatus,
  hasAccess,
  type LessonContent,
  type LessonType,
  lessons,
  modules,
  profiles,
  user,
} from "@lagan/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { type LessonProgressRow, resolveResumeLesson } from "../../learn/query";

export interface SyllabusLesson {
  id: string;
  moduleId: string;
  title: string;
  type: LessonType;
  position: number;
  duration: string;
  isPreview: boolean;
}

export interface CourseDetailModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
  lessons: SyllabusLesson[];
}

export interface CourseDetailInstructor {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
}

export interface CourseDetailData {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  status: CourseStatus;
  version: number;
  publishedAt: Date | null;
  instructor: CourseDetailInstructor;
  modules: CourseDetailModule[];
  totalLessons: number;
  totalDuration: string;
}

const authorNameSql = sql<string>`coalesce(${user}."name", 'Unknown author')`;

/**
 * Derives user-facing lesson duration and free preview status from lesson properties
 * and content JSON metadata.
 */
export function extractLessonMetadata(
  lesson: {
    id: string;
    moduleId: string;
    title: string;
    type: LessonType;
    position: number;
    contentJson?: LessonContent | Record<string, unknown> | null;
  },
  modulePosition: number,
): { duration: string; isPreview: boolean } {
  const json = (lesson.contentJson as Record<string, unknown> | null) ?? {};

  // First lesson of first module is a preview by default unless explicitly disabled,
  // or any lesson explicitly marked as preview.
  const isExplicitPreview = json.isPreview === true || json.preview === true;
  const isFirstOfFirst = modulePosition === 0 && lesson.position === 0;
  const isPreview = isExplicitPreview || isFirstOfFirst;

  let duration = "";
  if (typeof json.duration === "string" && json.duration.trim()) {
    duration = json.duration.trim();
  } else if (typeof json.durationMinutes === "number" && json.durationMinutes > 0) {
    duration = `${json.durationMinutes} min`;
  } else if (typeof json.durationSeconds === "number" && json.durationSeconds > 0) {
    duration = `${Math.max(1, Math.ceil(json.durationSeconds / 60))} min`;
  } else if (typeof json.duration === "number" && json.duration > 0) {
    duration =
      json.duration > 120 ? `${Math.ceil(json.duration / 60)} min` : `${json.duration} min`;
  } else {
    // Sensible standard estimated runtime by lesson type
    switch (lesson.type) {
      case "video":
        duration = "10 min";
        break;
      case "text":
        duration = "5 min";
        break;
      case "quiz":
        duration = "15 min";
        break;
      case "file":
        duration = "5 min";
        break;
      case "external":
        duration = "10 min";
        break;
      default:
        duration = "5 min";
    }
  }

  return { duration, isPreview };
}

/** Formats cumulative minutes into hours and minutes. */
export function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Loads published course details, joined with author profile, and syllabus outline.
 * Returns null if the course does not exist or is not published.
 */
export async function getCourseDetail(
  courseId: string,
  database = db,
): Promise<CourseDetailData | null> {
  const [courseRow] = await database
    .select({
      id: courses.id,
      tenantId: courses.tenantId,
      authorId: courses.authorId,
      title: courses.title,
      description: courses.description,
      priceCents: courses.priceCents,
      discountPercent: courses.discountPercent,
      isFree: courses.isFree,
      status: courses.status,
      version: courses.version,
      publishedAt: courses.publishedAt,
      authorName: authorNameSql,
      authorAvatarUrl: profiles.avatarUrl,
      authorBio: profiles.bio,
      authorWebsiteUrl: profiles.websiteUrl,
    })
    .from(courses)
    .leftJoin(user, eq(user.id, courses.authorId))
    .leftJoin(profiles, eq(profiles.userId, courses.authorId))
    .where(and(eq(courses.id, courseId), eq(courses.status, "published")))
    .limit(1);

  if (!courseRow) {
    return null;
  }

  const moduleRows = await database
    .select({
      id: modules.id,
      courseId: modules.courseId,
      title: modules.title,
      position: modules.position,
    })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position), asc(modules.id));

  let totalMinutes = 0;
  let totalLessons = 0;

  let detailModules: CourseDetailModule[] = [];

  if (moduleRows.length > 0) {
    const moduleIds = moduleRows.map((m) => m.id);
    const modulePositionMap = new Map<string, number>();
    for (const mod of moduleRows) {
      modulePositionMap.set(mod.id, mod.position);
    }

    const lessonRows = await database
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        type: lessons.type,
        title: lessons.title,
        position: lessons.position,
        status: lessons.status,
        contentJson: lessons.contentJson,
      })
      .from(lessons)
      .where(and(inArray(lessons.moduleId, moduleIds), eq(lessons.status, "published")))
      .orderBy(asc(lessons.position), asc(lessons.id));

    const lessonsByModule = new Map<string, SyllabusLesson[]>();
    for (const mod of moduleRows) {
      lessonsByModule.set(mod.id, []);
    }

    for (const lesson of lessonRows) {
      const modPos = modulePositionMap.get(lesson.moduleId) ?? 0;
      const { duration, isPreview } = extractLessonMetadata(lesson, modPos);

      // Parse numerical minutes if present for summary calculation
      const match = duration.match(/^(\d+)/);
      if (match?.[1]) {
        totalMinutes += Number.parseInt(match[1], 10);
      } else {
        totalMinutes += 5;
      }
      totalLessons += 1;

      const list = lessonsByModule.get(lesson.moduleId) ?? [];
      list.push({
        id: lesson.id,
        moduleId: lesson.moduleId,
        title: lesson.title,
        type: lesson.type,
        position: lesson.position,
        duration,
        isPreview,
      });
      lessonsByModule.set(lesson.moduleId, list);
    }

    detailModules = moduleRows.map((mod) => ({
      id: mod.id,
      courseId: mod.courseId,
      title: mod.title,
      position: mod.position,
      lessons: lessonsByModule.get(mod.id) ?? [],
    }));
  }

  return {
    id: courseRow.id,
    tenantId: courseRow.tenantId,
    title: courseRow.title,
    description: courseRow.description,
    priceCents: courseRow.priceCents,
    discountPercent: courseRow.discountPercent,
    isFree: courseRow.isFree,
    status: courseRow.status,
    version: courseRow.version,
    publishedAt: courseRow.publishedAt,
    instructor: {
      id: courseRow.authorId,
      name: courseRow.authorName,
      bio: courseRow.authorBio,
      avatarUrl: courseRow.authorAvatarUrl,
      websiteUrl: courseRow.authorWebsiteUrl,
    },
    modules: detailModules,
    totalLessons,
    totalDuration: formatTotalDuration(totalMinutes),
  };
}

/**
 * Resolves the next lesson resume link for an enrolled learner.
 */
export async function getResumeLessonForCourse(
  courseId: string,
  userId: string,
  database = db,
): Promise<{ resumeLessonId: string | null; resumeHref: string }> {
  const lessonRows = await database
    .select({
      courseId: modules.courseId,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
      completed: sql<boolean | null>`lp.completed`,
      positionSeconds: sql<number | null>`lp.position_seconds`,
      lastSeenAt: sql<Date | null>`lp.last_seen_at`,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .leftJoin(sql`lesson_progress lp`, sql`lp.lesson_id = ${lessons.id} AND lp.user_id = ${userId}`)
    .where(and(eq(modules.courseId, courseId), eq(lessons.status, "published")))
    .orderBy(asc(modules.position), asc(lessons.position), asc(lessons.id));

  const progressRows: LessonProgressRow[] = lessonRows.map((r) => ({
    lessonId: r.lessonId,
    lessonTitle: r.lessonTitle,
    completed: r.completed,
    positionSeconds: r.positionSeconds,
    lastSeenAt: r.lastSeenAt,
  }));

  const resume = resolveResumeLesson(courseId, progressRows);
  return {
    resumeLessonId: resume.resumeLessonId,
    resumeHref: resume.resumeHref,
  };
}

/**
 * Evaluates whether a user has access to a course via authoritative DB helper.
 */
export async function checkCourseAccess(
  userId: string | null | undefined,
  courseId: string,
  tenantId: string,
  database = db,
): Promise<boolean> {
  if (!userId) return false;
  return hasAccess({ db: database, userId, courseId, tenantId });
}
