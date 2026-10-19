import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { courses, lessons, modules } from "./course";

describe("course schema", () => {
  it("maps courses to the expected snake_case columns", () => {
    const columns = getTableColumns(courses);

    expect(Object.keys(columns)).toEqual([
      "id",
      "tenantId",
      "authorId",
      "title",
      "description",
      "priceCents",
      "discountPercent",
      "isFree",
      "status",
      "version",
      "publishedAt",
      "createdAt",
      "updatedAt",
    ]);

    expect(columns.tenantId.name).toBe("tenant_id");
    expect(columns.tenantId.notNull).toBe(true);
    expect(columns.authorId.notNull).toBe(true);
    expect(columns.title.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");
    expect(columns.version.default).toBe(1);
    expect(columns.priceCents.default).toBe(0);
    expect(columns.discountPercent.default).toBe(0);
    expect(columns.isFree.default).toBe(false);
    expect(columns.publishedAt.notNull).toBe(false);
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("maps modules to the expected columns and defaults", () => {
    const columns = getTableColumns(modules);

    expect(Object.keys(columns)).toEqual(["id", "courseId", "title", "position"]);
    expect(columns.courseId.name).toBe("course_id");
    expect(columns.courseId.notNull).toBe(true);
    expect(columns.title.notNull).toBe(true);
    expect(columns.position.default).toBe(0);
  });

  it("maps lessons to the expected columns and defaults", () => {
    const columns = getTableColumns(lessons);

    expect(Object.keys(columns)).toEqual([
      "id",
      "moduleId",
      "type",
      "title",
      "position",
      "status",
      "muxPlaybackId",
      "contentJson",
      "externalUrl",
      "fileKey",
      "updatedAt",
    ]);

    expect(columns.moduleId.name).toBe("module_id");
    expect(columns.moduleId.notNull).toBe(true);
    expect(columns.type.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");
    expect(columns.position.default).toBe(0);
    expect(columns.muxPlaybackId.name).toBe("mux_playback_id");
    expect(columns.contentJson.name).toBe("content_json");
    expect(columns.externalUrl.name).toBe("external_url");
    expect(columns.fileKey.name).toBe("file_key");
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("points foreign keys at the parent tables and cascades deletes", () => {
    const [authorFk] = getTableConfig(courses).foreignKeys;
    if (!authorFk) throw new Error("courses.author_id foreign key missing");
    expect(getTableConfig(authorFk.reference().foreignTable).name).toBe("user");
    expect(authorFk.onDelete).toBe("cascade");

    const [moduleFk] = getTableConfig(modules).foreignKeys;
    if (!moduleFk) throw new Error("modules.course_id foreign key missing");
    const moduleReference = moduleFk.reference();
    expect(getTableConfig(moduleReference.foreignTable).name).toBe("courses");
    expect(moduleReference.columns.map((column) => column.name)).toEqual(["course_id"]);
    expect(moduleFk.onDelete).toBe("cascade");

    const [lessonFk] = getTableConfig(lessons).foreignKeys;
    if (!lessonFk) throw new Error("lessons.module_id foreign key missing");
    const lessonReference = lessonFk.reference();
    expect(getTableConfig(lessonReference.foreignTable).name).toBe("modules");
    expect(lessonReference.columns.map((column) => column.name)).toEqual(["module_id"]);
    expect(lessonFk.onDelete).toBe("cascade");
  });

  it("keeps sibling position unique inside each parent", () => {
    const moduleIndexes = getTableConfig(modules).indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
    }));
    expect(moduleIndexes).toContainEqual({
      name: "modules_course_id_position_key",
      unique: true,
    });

    const lessonIndexes = getTableConfig(lessons).indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
    }));
    expect(lessonIndexes).toContainEqual({
      name: "lessons_module_id_position_key",
      unique: true,
    });
  });
});
