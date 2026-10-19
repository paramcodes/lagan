export type CourseStatus = "draft" | "published" | "archived";
export const COURSE_STATUSES = ["draft", "published", "archived"] as const;

export type LessonStatus = "draft" | "published";
export const LESSON_STATUSES = ["draft", "published"] as const;

export type LessonType = "video" | "text" | "quiz" | "file" | "external";
export const LESSON_TYPES = ["video", "text", "quiz", "file", "external"] as const;

export interface LessonContent {
  type: "doc";
  content?: unknown[];
}

export interface Course {
  id: string;
  tenantId: string;
  authorId: string;
  title: string;
  description: string | null;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  status: CourseStatus;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  position: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  position: number;
  status: LessonStatus;
  muxPlaybackId: string | null;
  contentJson: LessonContent | null;
  externalUrl: string | null;
  fileKey: string | null;
  updatedAt: Date;
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export interface CourseWithModules extends Course {
  modules: ModuleWithLessons[];
}
