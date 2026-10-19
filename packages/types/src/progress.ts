export interface LessonProgress {
  id: string;
  tenantId: string;
  userId: string;
  lessonId: string;
  courseId: string;
  completed: boolean;
  completedAt: Date | null;
  positionSeconds: number;
  lastSeenAt: Date;
}

export interface LessonProgressInput {
  lessonId: string;
  courseId: string;
  positionSeconds: number;
  completed?: boolean;
}

export interface CourseProgressSummary {
  courseId: string;
  userId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  isCompleted: boolean;
  lastSeenLessonId: string | null;
  lastSeenAt: Date | null;
}

export interface ModuleProgressSummary {
  moduleId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  isCompleted: boolean;
}
