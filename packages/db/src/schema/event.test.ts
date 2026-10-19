import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { courseEvent } from "./event";

describe("course_event schema", () => {
  it("maps course_event to the expected snake_case columns and defaults", () => {
    const columns = getTableColumns(courseEvent);

    expect(Object.keys(columns)).toEqual([
      "id",
      "tenantId",
      "userId",
      "courseId",
      "lessonId",
      "type",
      "positionSeconds",
      "createdAt",
    ]);

    expect(getTableConfig(courseEvent).name).toBe("course_event");
    expect(columns.tenantId.name).toBe("tenant_id");
    expect(columns.tenantId.notNull).toBe(true);
    expect(columns.userId.name).toBe("user_id");
    expect(columns.userId.notNull).toBe(true);
    expect(columns.courseId.name).toBe("course_id");
    expect(columns.courseId.notNull).toBe(true);
    expect(columns.lessonId.name).toBe("lesson_id");
    expect(columns.lessonId.notNull).toBe(false);
    expect(columns.type.notNull).toBe(true);
    expect(columns.positionSeconds.name).toBe("position_seconds");
    expect(columns.positionSeconds.default).toBe(0);
    expect(columns.createdAt.name).toBe("created_at");
    expect(columns.createdAt.notNull).toBe(true);
  });

  it("points foreign keys at the parent tables and cascades deletes", () => {
    const foreignKeys = getTableConfig(courseEvent).foreignKeys;
    const byColumn = new Map(
      foreignKeys.map((foreignKey) => [
        foreignKey.reference().columns.map((column) => column.name).join(","),
        foreignKey,
      ]),
    );

    const userFk = byColumn.get("user_id");
    if (!userFk) throw new Error("course_event.user_id foreign key missing");
    expect(getTableConfig(userFk.reference().foreignTable).name).toBe("user");
    expect(userFk.onDelete).toBe("cascade");

    const courseFk = byColumn.get("course_id");
    if (!courseFk) throw new Error("course_event.course_id foreign key missing");
    expect(getTableConfig(courseFk.reference().foreignTable).name).toBe("courses");
    expect(courseFk.onDelete).toBe("cascade");

    const lessonFk = byColumn.get("lesson_id");
    if (!lessonFk) throw new Error("course_event.lesson_id foreign key missing");
    expect(getTableConfig(lessonFk.reference().foreignTable).name).toBe("lessons");
    expect(lessonFk.onDelete).toBe("cascade");

    expect(byColumn.has("tenant_id")).toBe(false);
  });

  it("indexes the columns the analytics queries filter on", () => {
    const indexes = getTableConfig(courseEvent).indexes.map((index) => ({
      name: index.config.name,
      columns: index.config.columns.map((column) => (column as { name: string }).name),
    }));

    expect(indexes.map((index) => index.name)).toEqual([
      "course_event_tenant_id_idx",
      "course_event_user_id_idx",
      "course_event_course_id_idx",
      "course_event_lesson_id_idx",
      "course_event_course_id_created_at_idx",
    ]);

    const timeSeries = indexes.find(
      (index) => index.name === "course_event_course_id_created_at_idx",
    );
    if (!timeSeries) throw new Error("course_event composite index missing");
    expect(timeSeries.columns).toEqual(["course_id", "created_at"]);
  });
});
