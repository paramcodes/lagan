import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { lessonProgress } from "./progress";

describe("lesson_progress schema", () => {
  it("maps lesson_progress to the expected snake_case columns and defaults", () => {
    const columns = getTableColumns(lessonProgress);

    expect(Object.keys(columns)).toEqual([
      "id",
      "tenantId",
      "userId",
      "lessonId",
      "courseId",
      "completed",
      "completedAt",
      "positionSeconds",
      "lastSeenAt",
    ]);

    expect(getTableConfig(lessonProgress).name).toBe("lesson_progress");

    expect(columns.id.name).toBe("id");
    expect(columns.id.primary).toBe(true);

    expect(columns.tenantId.name).toBe("tenant_id");
    expect(columns.tenantId.notNull).toBe(true);

    expect(columns.userId.name).toBe("user_id");
    expect(columns.userId.notNull).toBe(true);

    expect(columns.lessonId.name).toBe("lesson_id");
    expect(columns.lessonId.notNull).toBe(true);

    expect(columns.courseId.name).toBe("course_id");
    expect(columns.courseId.notNull).toBe(true);

    expect(columns.completed.name).toBe("completed");
    expect(columns.completed.notNull).toBe(true);
    expect(columns.completed.default).toBe(false);

    expect(columns.completedAt.name).toBe("completed_at");
    expect(columns.completedAt.notNull).toBe(false);

    expect(columns.positionSeconds.name).toBe("position_seconds");
    expect(columns.positionSeconds.notNull).toBe(true);
    expect(columns.positionSeconds.default).toBe(0);

    expect(columns.lastSeenAt.name).toBe("last_seen_at");
    expect(columns.lastSeenAt.notNull).toBe(true);
    expect(columns.lastSeenAt.hasDefault).toBe(true);
  });

  it("points foreign keys at user, lessons, and courses with cascading deletes", () => {
    const foreignKeys = getTableConfig(lessonProgress).foreignKeys;

    const userFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "user",
    );
    if (!userFk) throw new Error("lesson_progress.user_id foreign key missing");
    expect(userFk.reference().columns.map((column) => column.name)).toEqual(["user_id"]);
    expect(userFk.onDelete).toBe("cascade");

    const lessonFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "lessons",
    );
    if (!lessonFk) throw new Error("lesson_progress.lesson_id foreign key missing");
    expect(lessonFk.reference().columns.map((column) => column.name)).toEqual(["lesson_id"]);
    expect(lessonFk.onDelete).toBe("cascade");

    const courseFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "courses",
    );
    if (!courseFk) throw new Error("lesson_progress.course_id foreign key missing");
    expect(courseFk.reference().columns.map((column) => column.name)).toEqual(["course_id"]);
    expect(courseFk.onDelete).toBe("cascade");
  });

  it("defines the expected unique and compound indexes", () => {
    const indexes = getTableConfig(lessonProgress).indexes.map((index) => {
      const columns = index.config.columns.map((column) =>
        column && typeof column === "object" && "name" in column && typeof column.name === "string"
          ? column.name
          : "",
      );
      return {
        name: index.config.name,
        unique: index.config.unique,
        columns,
      };
    });

    const uniqueUserLesson = indexes.find(
      (idx) => idx.name === "lesson_progress_user_id_lesson_id_key",
    );
    if (!uniqueUserLesson)
      throw new Error("lesson_progress (user_id, lesson_id) unique index missing");
    expect(uniqueUserLesson.unique).toBe(true);
    expect(uniqueUserLesson.columns).toEqual(["user_id", "lesson_id"]);

    const compoundProgress = indexes.find(
      (idx) => idx.name === "lesson_progress_user_id_course_id_completed_idx",
    );
    if (!compoundProgress)
      throw new Error("lesson_progress (user_id, course_id, completed) index missing");
    expect(compoundProgress.unique).toBe(false);
    expect(compoundProgress.columns).toEqual(["user_id", "course_id", "completed"]);

    const tenantIdx = indexes.find((idx) => idx.name === "lesson_progress_tenant_id_idx");
    if (!tenantIdx) throw new Error("lesson_progress tenant_id index missing");
    expect(tenantIdx.unique).toBe(false);
    expect(tenantIdx.columns).toEqual(["tenant_id"]);
  });
});
