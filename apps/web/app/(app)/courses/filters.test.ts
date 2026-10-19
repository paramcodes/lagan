import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildPublishedCourseWhere } from "./filters";

const dialect = new PgDialect();

function compile(search: string): { sql: string; params: unknown[] } {
  const { sql, params } = dialect.sqlToQuery(buildPublishedCourseWhere(search));
  return { sql, params };
}

describe("buildPublishedCourseWhere", () => {
  it("filters on published status", () => {
    expect(compile("")).toEqual({
      sql: '"courses"."status" = $1',
      params: ["published"],
    });
  });

  it("matches the search term against title and description", () => {
    expect(compile("algebra")).toEqual({
      sql:
        '("courses"."status" = $1 and ("courses"."title" ilike $2 or ' +
        '"courses"."description" ilike $3))',
      params: ["published", "%algebra%", "%algebra%"],
    });
  });

  it("binds the search term as a parameter instead of interpolating it", () => {
    const { sql, params } = compile("algebra");

    expect(sql).not.toContain("algebra");
    expect(params).toContain("%algebra%");
  });

  it("does not add a category predicate, because no category column exists", () => {
    expect(compile("design").sql).not.toContain("category");
  });

  it("treats a whitespace-only search as no search", () => {
    expect(compile("   ")).toEqual(compile(""));
  });
});
