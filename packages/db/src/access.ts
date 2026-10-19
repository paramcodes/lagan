import { and, eq } from "drizzle-orm";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { courses, lessons, modules } from "./schema/course";
import { type Enrollment, enrollments } from "./schema/enrollment";

export type AccessDb = Pick<NodePgDatabase<Record<string, never>>, "select" | "insert">;

let defaultAccessDb: AccessDb | null = null;
let lazyPool: Pool | null = null;
let lazyDrizzleDb: AccessDb | null = null;

export function setDefaultAccessDb(db: AccessDb | null): void {
  defaultAccessDb = db;
}

function resolveDb(explicitDb?: AccessDb): AccessDb {
  if (explicitDb) return explicitDb;
  if (defaultAccessDb) return defaultAccessDb;
  if (process.env.DATABASE_URL) {
    if (!lazyDrizzleDb) {
      lazyPool = new Pool({ connectionString: process.env.DATABASE_URL });
      lazyDrizzleDb = drizzle(lazyPool) as unknown as AccessDb;
    }
    return lazyDrizzleDb;
  }
  throw new Error(
    "Access helper requires a database instance. Pass db as an argument, call setDefaultAccessDb(db), or define process.env.DATABASE_URL.",
  );
}

export interface HasAccessOptions {
  db?: AccessDb;
  allowFree?: boolean;
}

export interface HasAccessInput extends HasAccessOptions {
  userId?: string | null;
  courseId: string;
  tenantId: string;
}

export interface CanAccessLessonInput extends HasAccessOptions {
  userId?: string | null;
  lessonId: string;
  tenantId: string;
}

export interface EnrollLearnerOptions {
  db?: AccessDb;
  stripePaymentId?: string;
  courseVersionSeen?: number;
  id?: string;
  enrolledAt?: Date;
  source?: "stripe" | "free" | "manual" | "programmatic" | string;
}

export interface EnrollLearnerInput extends EnrollLearnerOptions {
  userId: string;
  courseId: string;
  tenantId: string;
}

export interface EnrolledLearner extends Enrollment {
  isNew: boolean;
}

export async function hasAccess(options: HasAccessInput): Promise<boolean>;
export async function hasAccess(
  db: AccessDb,
  userId: string | null | undefined,
  courseId: string,
  tenantId: string,
  options?: HasAccessOptions,
): Promise<boolean>;
export async function hasAccess(
  userId: string | null | undefined,
  courseId: string,
  tenantId: string,
  optionsOrDb?: HasAccessOptions | AccessDb,
): Promise<boolean>;
export async function hasAccess(
  first: AccessDb | HasAccessInput | string | null | undefined,
  second?: string | HasAccessOptions | AccessDb | null,
  third?: string,
  fourth?: HasAccessOptions | AccessDb | string,
  fifth?: HasAccessOptions,
): Promise<boolean> {
  let db: AccessDb | undefined;
  let userId: string | null | undefined;
  let courseId = "";
  let tenantId = "";
  let options: HasAccessOptions | undefined;

  if (
    first &&
    typeof first === "object" &&
    "courseId" in first &&
    "tenantId" in first &&
    !("select" in first)
  ) {
    userId = first.userId;
    courseId = first.courseId;
    tenantId = first.tenantId;
    options = first;
    db = first.db;
  } else if (first && typeof first === "object" && "select" in first) {
    db = first as AccessDb;
    userId = second as string | null | undefined;
    courseId = third ?? "";
    tenantId = (fourth as string) ?? "";
    options = fifth;
  } else {
    userId = first as string | null | undefined;
    courseId = (second as string) ?? "";
    tenantId = third ?? "";
    if (fourth && typeof fourth === "object") {
      if ("select" in fourth) {
        db = fourth as AccessDb;
      } else {
        options = fourth as HasAccessOptions;
        db = options.db;
      }
    }
  }

  if (!userId) {
    return false;
  }

  if (!courseId || !tenantId) {
    return false;
  }

  const activeDb = resolveDb(db);

  const [courseRow] = await activeDb
    .select({
      id: courses.id,
      authorId: courses.authorId,
      tenantId: courses.tenantId,
      isFree: courses.isFree,
      priceCents: courses.priceCents,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)));

  if (!courseRow) {
    return false;
  }

  if (courseRow.authorId === userId) {
    return true;
  }

  const [enrollmentRow] = await activeDb
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

  if (enrollmentRow) {
    return true;
  }

  if (options?.allowFree && (courseRow.isFree || courseRow.priceCents <= 0)) {
    return true;
  }

  return false;
}

export async function canAccessLesson(options: CanAccessLessonInput): Promise<boolean>;
export async function canAccessLesson(
  db: AccessDb,
  userId: string | null | undefined,
  lessonId: string,
  tenantId: string,
  options?: HasAccessOptions,
): Promise<boolean>;
export async function canAccessLesson(
  userId: string | null | undefined,
  lessonId: string,
  tenantId: string,
  optionsOrDb?: HasAccessOptions | AccessDb,
): Promise<boolean>;
export async function canAccessLesson(
  first: AccessDb | CanAccessLessonInput | string | null | undefined,
  second?: string | HasAccessOptions | AccessDb | null,
  third?: string,
  fourth?: HasAccessOptions | AccessDb | string,
  fifth?: HasAccessOptions,
): Promise<boolean> {
  let db: AccessDb | undefined;
  let userId: string | null | undefined;
  let lessonId = "";
  let tenantId = "";
  let options: HasAccessOptions | undefined;

  if (
    first &&
    typeof first === "object" &&
    "lessonId" in first &&
    "tenantId" in first &&
    !("select" in first)
  ) {
    userId = first.userId;
    lessonId = first.lessonId;
    tenantId = first.tenantId;
    options = first;
    db = first.db;
  } else if (first && typeof first === "object" && "select" in first) {
    db = first as AccessDb;
    userId = second as string | null | undefined;
    lessonId = third ?? "";
    tenantId = (fourth as string) ?? "";
    options = fifth;
  } else {
    userId = first as string | null | undefined;
    lessonId = (second as string) ?? "";
    tenantId = third ?? "";
    if (fourth && typeof fourth === "object") {
      if ("select" in fourth) {
        db = fourth as AccessDb;
      } else {
        options = fourth as HasAccessOptions;
        db = options.db;
      }
    }
  }

  if (!userId || !lessonId || !tenantId) {
    return false;
  }

  const activeDb = resolveDb(db);

  const [lessonCourse] = await activeDb
    .select({
      courseId: courses.id,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(eq(lessons.id, lessonId), eq(courses.tenantId, tenantId)));

  if (!lessonCourse) {
    return false;
  }

  return hasAccess(activeDb, userId, lessonCourse.courseId, tenantId, options);
}

export async function enrollLearner(options: EnrollLearnerInput): Promise<EnrolledLearner>;
export async function enrollLearner(
  db: AccessDb,
  userId: string,
  courseId: string,
  tenantId: string,
  options?: EnrollLearnerOptions | string,
): Promise<EnrolledLearner>;
export async function enrollLearner(
  userId: string,
  courseId: string,
  tenantId: string,
  optionsOrDb?: EnrollLearnerOptions | string | AccessDb,
): Promise<EnrolledLearner>;
export async function enrollLearner(
  first: AccessDb | EnrollLearnerInput | string,
  second?: string | EnrollLearnerOptions,
  third?: string,
  fourth?: string | EnrollLearnerOptions | AccessDb,
  fifth?: EnrollLearnerOptions | string,
): Promise<EnrolledLearner> {
  let db: AccessDb | undefined;
  let userId = "";
  let courseId = "";
  let tenantId = "";
  let options: EnrollLearnerOptions | undefined;

  if (
    first &&
    typeof first === "object" &&
    "courseId" in first &&
    "tenantId" in first &&
    !("select" in first || "insert" in first)
  ) {
    userId = first.userId;
    courseId = first.courseId;
    tenantId = first.tenantId;
    options = first;
    db = first.db;
  } else if (first && typeof first === "object" && ("select" in first || "insert" in first)) {
    db = first as AccessDb;
    userId = second as string;
    courseId = third ?? "";
    tenantId = (fourth as string) ?? "";
    options = typeof fifth === "string" ? { stripePaymentId: fifth } : fifth;
  } else {
    userId = first as string;
    courseId = (second as string) ?? "";
    tenantId = third ?? "";
    if (fourth && typeof fourth === "object") {
      if ("select" in fourth || "insert" in fourth) {
        db = fourth as AccessDb;
        options = typeof fifth === "string" ? { stripePaymentId: fifth } : fifth;
      } else {
        options = fourth as EnrollLearnerOptions;
        db = options.db;
      }
    } else if (typeof fourth === "string") {
      options = { stripePaymentId: fourth };
    }
  }

  if (!userId) {
    throw new Error("userId is required for enrollment.");
  }
  if (!courseId) {
    throw new Error("courseId is required for enrollment.");
  }
  if (!tenantId) {
    throw new Error("tenantId is required for enrollment.");
  }

  const activeDb = resolveDb(db);

  const [courseRow] = await activeDb
    .select({
      id: courses.id,
      version: courses.version,
      isFree: courses.isFree,
      priceCents: courses.priceCents,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)));

  if (!courseRow) {
    throw new Error(`Course "${courseId}" not found for tenant "${tenantId}".`);
  }

  const paymentId =
    options?.stripePaymentId ??
    (options?.source ? `${options.source}_${crypto.randomUUID()}` : null) ??
    (courseRow.isFree ? `free_${crypto.randomUUID()}` : `manual_${crypto.randomUUID()}`);

  const id = options?.id ?? crypto.randomUUID();
  const courseVersionSeen = options?.courseVersionSeen ?? courseRow.version ?? 1;

  const [inserted] = await activeDb
    .insert(enrollments)
    .values({
      id,
      userId,
      courseId,
      stripePaymentId: paymentId,
      courseVersionSeen,
      ...(options?.enrolledAt ? { enrolledAt: options.enrolledAt } : {}),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return { ...inserted, isNew: true };
  }

  const [existing] = await activeDb
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

  if (!existing) {
    throw new Error("Enrollment conflict: duplicate payment ID or concurrent update.");
  }

  return { ...existing, isNew: false };
}
