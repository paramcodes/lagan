import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { enrollments } from "./enrollment";

describe("enrollment schema", () => {
  it("maps enrollments to the expected snake_case columns", () => {
    const columns = getTableColumns(enrollments);

    expect(Object.keys(columns)).toEqual([
      "id",
      "userId",
      "courseId",
      "stripePaymentId",
      "enrolledAt",
      "courseVersionSeen",
    ]);

    expect(columns.userId.name).toBe("user_id");
    expect(columns.userId.notNull).toBe(true);
    expect(columns.courseId.name).toBe("course_id");
    expect(columns.courseId.notNull).toBe(true);
    expect(columns.stripePaymentId.name).toBe("stripe_payment_id");
    expect(columns.stripePaymentId.notNull).toBe(true);
    expect(columns.stripePaymentId.isUnique).toBe(true);
    expect(columns.enrolledAt.name).toBe("enrolled_at");
    expect(columns.enrolledAt.notNull).toBe(true);
    expect(columns.enrolledAt.hasDefault).toBe(true);
    expect(columns.courseVersionSeen.name).toBe("course_version_seen");
    expect(columns.courseVersionSeen.notNull).toBe(true);
    expect(columns.courseVersionSeen.default).toBe(1);
  });

  it("points foreign keys at user and courses and cascades deletes", () => {
    const foreignKeys = getTableConfig(enrollments).foreignKeys;

    const userFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "user",
    );
    if (!userFk) throw new Error("enrollments.user_id foreign key missing");
    expect(userFk.reference().columns.map((column) => column.name)).toEqual(["user_id"]);
    expect(userFk.onDelete).toBe("cascade");

    const courseFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "courses",
    );
    if (!courseFk) throw new Error("enrollments.course_id foreign key missing");
    expect(courseFk.reference().columns.map((column) => column.name)).toEqual(["course_id"]);
    expect(courseFk.onDelete).toBe("cascade");
  });

  it("keeps one enrollment per user and course", () => {
    const indexes = getTableConfig(enrollments).indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
    }));

    expect(indexes).toContainEqual({
      name: "enrollments_user_id_course_id_key",
      unique: true,
    });
    expect(indexes).toContainEqual({ name: "enrollments_user_id_idx", unique: false });
    expect(indexes).toContainEqual({ name: "enrollments_course_id_idx", unique: false });
  });
});
